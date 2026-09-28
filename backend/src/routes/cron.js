const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { runAndLogScrape, logRetryAttempt, logScrapeResult } = require('./products');
const { scrapeMultipleOptions } = require('../scraper/scraper');

let currentRun = null;

function hasValidCronSecret(req) {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  return Boolean(process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
}

function recordOutcome(run, outcome) {
  run.processed += 1;
  if (outcome === 'failed') run.failed += 1;
  else run.succeeded += 1;
}

/**
 * POST /api/cron/run-scrapes
 * Triggered by an external cron service every two hours. A scrape batch can
 * outlast the cron provider's HTTP timeout, so acknowledge it immediately and
 * keep progress in the server while each attempt is persisted to scrape_history.
 */
router.post('/run-scrapes', async (req, res) => {
  if (!hasValidCronSecret(req)) {
    console.warn('[cron] rejected request with invalid or missing secret');
    return res.status(401).send('Error');
  }

  if (currentRun && ['preparing', 'running'].includes(currentRun.status)) {
    return res.status(202).send('OK');
  }

  const run = {
    runId: crypto.randomUUID(),
    status: 'preparing',
    triggeredAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: null,
    totalTracked: 0,
    due: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    error: null,
  };
  currentRun = run;

  let products;
  let due;
  try {
    const productsResult = await supabase
      .from('tracked_products')
      .select('*')
      .eq('is_active', true);
    if (productsResult.error) throw new Error(productsResult.error.message);
    products = productsResult.data || [];

    const attemptsResult = await supabase
      .from('latest_attempt')
      .select('*');
    if (attemptsResult.error) throw new Error(attemptsResult.error.message);

    const latestByProduct = Object.fromEntries(
      (attemptsResult.data || []).map((attempt) => [attempt.tracked_product_id, attempt])
    );
    due = products.filter((product) => {
      const last = latestByProduct[product.id];
      if (!last) return true;
      const elapsedMinutes = (Date.now() - new Date(last.attempted_at).getTime()) / 60000;
      return elapsedMinutes >= product.scrape_interval_minutes;
    });
  } catch (error) {
    currentRun = null;
    console.error('[cron] could not prepare scrape run:', error);
    return res.status(500).send('Error');
  }

  run.status = 'running';
  run.totalTracked = products.length;
  run.due = due.length;

  console.log(`[cron] run ${run.runId} accepted: ${due.length}/${products.length} products due`);
  res.status(202).send('OK');

  void executeCronRun(due, run).catch((error) => {
    run.status = 'failed';
    run.error = error.message;
    run.completedAt = new Date().toISOString();
    console.error(`[cron] run ${run.runId} crashed:`, error);
  });
});

router.get('/status', (req, res) => {
  if (!hasValidCronSecret(req)) {
    return res.status(401).json({ error: 'Invalid or missing cron secret' });
  }
  if (!currentRun) return res.status(404).json({ error: 'No cron run has been recorded by this server process' });

  res.json(currentRun);
});

async function executeCronRun(due, run) {
  const groups = new Map();
  for (const product of due) {
    if (!groups.has(product.product_url)) groups.set(product.product_url, []);
    groups.get(product.product_url).push(product);
  }

  for (const [url, groupProducts] of groups.entries()) {
    if (groupProducts.length === 1) {
      const product = groupProducts[0];
      const result = await runAndLogScrape(product).catch((error) => {
        console.error(`[cron] scrape failed for ${product.id}:`, error);
        return { outcome: 'failed', errorMessage: error.message };
      });
      recordOutcome(run, result.outcome);
      console.log(`[cron] run ${run.runId}: ${run.processed}/${run.due} complete`);
      continue;
    }

    try {
      const options = groupProducts.map((product) => ({
        optionLabel: product.option_label,
        optionKey: product.option_key,
      }));
      const readings = await scrapeMultipleOptions(url, options);

      for (const product of groupProducts) {
        const reading = readings.get(product.option_label);
        if (!reading || reading.errorMessage) {
          try {
            await logRetryAttempt(product, {
              attemptNumber: 1,
              error: `Batch scrape attempt failed: ${reading?.errorMessage || 'No reading returned'}`,
              durationMs: reading?.durationMs,
              httpStatus: null,
              pageStructureOk: reading?.pageStructureOk,
            });
          } catch (error) {
            console.error(`[cron] could not persist batch failure for ${product.id}:`, error);
            recordOutcome(run, 'failed');
            continue;
          }

          const fallback = await runAndLogScrape(product).catch((error) => {
            console.error(`[cron] fallback scrape failed for ${product.id}:`, error);
            return { outcome: 'failed', errorMessage: error.message };
          });
          recordOutcome(run, fallback.outcome);
          continue;
        }

        try {
          const result = await logScrapeResult(product, {
            outcome: 'success',
            attempts: 1,
            price: reading.price,
            stock: reading.stock,
            httpStatus: reading.httpStatus,
            durationMs: reading.durationMs,
            pageStructureOk: reading.pageStructureOk,
            structureHash: reading.structureHash,
          });
          recordOutcome(run, result.outcome);
        } catch (error) {
          console.error(`[cron] could not persist batch result for ${product.id}:`, error);
          recordOutcome(run, 'failed');
        }
      }
    } catch (error) {
      console.warn(`[cron] batch scrape failed for ${url}, falling back per-option:`, error.message);
      for (const product of groupProducts) {
        try {
          await logRetryAttempt(product, {
            attemptNumber: 1,
            error: `Batch scrape attempt failed: ${error.message}`,
            httpStatus: error.httpStatus || null,
            pageStructureOk: error.pageStructureOk ?? null,
          });
        } catch (persistError) {
          console.error(`[cron] could not persist batch failure for ${product.id}:`, persistError);
          recordOutcome(run, 'failed');
          continue;
        }

        const result = await runAndLogScrape(product).catch((fallbackError) => {
          console.error(`[cron] fallback scrape failed for ${product.id}:`, fallbackError);
          return { outcome: 'failed', errorMessage: fallbackError.message };
        });
        recordOutcome(run, result.outcome);
      }
    }

    console.log(`[cron] run ${run.runId}: ${run.processed}/${run.due} complete`);
  }

  run.status = run.failed > 0 ? 'completed_with_failures' : 'completed';
  run.completedAt = new Date().toISOString();
  console.log(
    `[cron] run ${run.runId} finished: ${run.succeeded} succeeded, ${run.failed} failed`
  );
}

module.exports = router;
