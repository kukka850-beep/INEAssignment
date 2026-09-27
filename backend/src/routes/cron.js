const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { runAndLogScrape, logRetryAttempt, logScrapeResult } = require('./products');
const { scrapeMultipleOptions } = require('../scraper/scraper');


router.post('/run-scrapes', async (req, res) => {
  const secret = req.query.secret || req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Invalid or missing cron secret' });
  }

  const { data: products, error } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('is_active', true);

  if (error) return res.status(500).json({ error: error.message });

  const { data: latestAttempts, error: latestError } = await supabase
    .from('latest_attempt')
    .select('*');
  if (latestError) return res.status(500).json({ error: latestError.message });
  const latestByProduct = Object.fromEntries(
    (latestAttempts || []).map((attempt) => [attempt.tracked_product_id, attempt])
  );

  const due = products.filter((p) => {
    const last = latestByProduct[p.id];
    if (!last) return true;
    const elapsedMin = (Date.now() - new Date(last.attempted_at).getTime()) / 60000;
    return elapsedMin >= p.scrape_interval_minutes;
  });

  console.log(`[cron] ${due.length}/${products.length} tracked products due for a scrape`);

  // BONUS: group due products by their store product URL so that several
  // tracked options of the SAME product get scraped from a single page
  // load instead of one page load per option.
  const groups = new Map();
  for (const p of due) {
    if (!groups.has(p.product_url)) groups.set(p.product_url, []);
    groups.get(p.product_url).push(p);
  }

  const outcomes = [];

  for (const [url, groupProducts] of groups.entries()) {
    if (groupProducts.length === 1) {
      const p = groupProducts[0];
      const r = await runAndLogScrape(p).catch((err) => {
        console.error(`[cron] scrape failed for ${p.id}:`, err);
        return { outcome: 'failed', errorMessage: err.message };
      });
      outcomes.push({ productId: p.id, outcome: r.outcome });
      continue;
    }

    
    try {
      const options = groupProducts.map((p) => ({
        optionLabel: p.option_label,
        optionKey: p.option_key,
      }));
      const readings = await scrapeMultipleOptions(url, options);

      for (const p of groupProducts) {
        const reading = readings.get(p.option_label);
        if (!reading || reading.errorMessage) {
          try {
            await logRetryAttempt(p, {
              attemptNumber: 1,
              error: `Batch scrape attempt failed: ${reading?.errorMessage || 'No reading returned'}`,
              durationMs: reading?.durationMs,
              httpStatus: null,
              pageStructureOk: reading?.pageStructureOk,
            });
          } catch (err) {
            console.error(`[cron] could not persist batch failure for ${p.id}:`, err);
            outcomes.push({ productId: p.id, outcome: 'failed' });
            continue;
          }

          const fallback = await runAndLogScrape(p).catch((err) => {
            console.error(`[cron] fallback scrape failed for ${p.id}:`, err);
            return { outcome: 'failed', errorMessage: err.message };
          });
          outcomes.push({ productId: p.id, outcome: fallback.outcome });
          continue;
        }

        const result = await logScrapeResult(p, {
          outcome: 'success',
          attempts: 1,
          price: reading.price,
          stock: reading.stock,
          httpStatus: reading.httpStatus,
          durationMs: reading.durationMs,
          pageStructureOk: reading.pageStructureOk,
          structureHash: reading.structureHash,
        });
        outcomes.push({ productId: p.id, outcome: result.outcome });
      }
    } catch (err) {
      
      console.warn(`[cron] batch scrape failed for ${url}, falling back per-option:`, err.message);
      for (const p of groupProducts) {
        try {
          await logRetryAttempt(p, {
            attemptNumber: 1,
            error: `Batch scrape attempt failed: ${err.message}`,
            httpStatus: err.httpStatus || null,
            pageStructureOk: err.pageStructureOk ?? null,
          });
        } catch (persistError) {
          console.error(`[cron] could not persist batch failure for ${p.id}:`, persistError);
          outcomes.push({ productId: p.id, outcome: 'failed' });
          continue;
        }

        const r = await runAndLogScrape(p).catch((e) => {
          console.error(`[cron] fallback scrape failed for ${p.id}:`, e);
          return { outcome: 'failed', errorMessage: e.message };
        });
        outcomes.push({ productId: p.id, outcome: r.outcome });
      }
    }
  }

  res.json({
    triggeredAt: new Date().toISOString(),
    totalTracked: products.length,
    scraped: due.length,
    results: outcomes,
  });
});

module.exports = router;
