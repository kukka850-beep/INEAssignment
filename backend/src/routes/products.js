const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { searchProducts } = require('../scraper/search');
const { scrapeProduct, STORE_BASE_URL } = require('../scraper/scraper');
const { detectAlert, sendEmailAlert } = require('../utils/alerts');

// GET /api/products/search?q=phone
router.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.status(400).json({ error: 'Query param "q" is required' });

  try {
    const results = await searchProducts(q);
    res.json({ query: q, results });
  } catch (err) {
    console.error('[search] failed:', err);
    res.status(502).json({ error: 'Could not reach the store to search', detail: err.message });
  }
});


router.get('/', async (req, res) => {
  const { data: products, error } = await supabase
    .from('tracked_products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const [latestResult, latestAttemptResult] = await Promise.all([
    supabase.from('latest_price').select('*'),
    supabase.from('latest_attempt').select('*'),
  ]);
  if (latestResult.error) return res.status(500).json({ error: latestResult.error.message });
  if (latestAttemptResult.error) {
    return res.status(500).json({ error: latestAttemptResult.error.message });
  }

  const latestByProduct = Object.fromEntries(
    (latestResult.data || []).map((l) => [l.tracked_product_id, l])
  );
  const latestAttemptByProduct = Object.fromEntries(
    (latestAttemptResult.data || []).map((l) => [l.tracked_product_id, l])
  );

  res.json(
    products.map((p) => ({
      ...p,
      latest: latestByProduct[p.id] || null,
      lastAttempt: latestAttemptByProduct[p.id] || null,
    }))
  );
});


router.post('/', async (req, res) => {
  const { storeProductId, productName, productUrl, optionLabel, optionKey, scrapeIntervalMinutes } =
    req.body;

  if (
    ![storeProductId, productName, productUrl, optionLabel].every(
      (value) => typeof value === 'string' && value.trim()
    )
  ) {
    return res.status(400).json({
      error: 'storeProductId, productName, productUrl and optionLabel are all required',
    });
  }

  let parsedProductUrl;
  let storeUrl;
  try {
    parsedProductUrl = new URL(productUrl);
    storeUrl = new URL(STORE_BASE_URL);
  } catch {
    return res.status(400).json({ error: 'productUrl must be a valid INE store product URL' });
  }

  if (
    parsedProductUrl.origin !== storeUrl.origin ||
    parsedProductUrl.pathname !== `/item/${encodeURIComponent(storeProductId.trim())}` ||
    parsedProductUrl.search ||
    parsedProductUrl.hash
  ) {
    return res.status(400).json({
      error: 'productUrl must identify the selected product on the configured INE store',
    });
  }

  const interval = scrapeIntervalMinutes === undefined ? 120 : Number(scrapeIntervalMinutes);
  if (!Number.isInteger(interval) || interval < 15) {
    return res.status(400).json({ error: 'scrapeIntervalMinutes must be an integer of at least 15' });
  }

  const { data, error } = await supabase
    .from('tracked_products')
    .insert({
      store_product_id: storeProductId,
      product_name: productName,
      product_url: productUrl,
      option_label: optionLabel.trim(),
      option_key: typeof optionKey === 'string' && optionKey.trim() ? optionKey.trim() : null,
      scrape_interval_minutes: interval,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'This product+option is already being tracked' });
    }
    return res.status(500).json({ error: error.message });
  }

  
  runAndLogScrape(data).catch((e) => console.error('[initial scrape] failed:', e));

  res.status(201).json(data);
});


router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('tracked_products')
    .update({ is_active: false })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});


router.get('/:id/history', async (req, res) => {
  const { data, error } = await supabase
    .from('scrape_history')
    .select('*')
    .eq('tracked_product_id', req.params.id)
    .order('attempted_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});


router.post('/:id/scrape', async (req, res) => {
  const { data: product, error } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error || !product) return res.status(404).json({ error: 'Tracked product not found' });

  try {
    const result = await runAndLogScrape(product);
    res.json(result);
  } catch (err) {
    console.error('[manual scrape] failed:', err);
    res.status(500).json({ error: 'Could not complete and record the scrape' });
  }
});


async function runAndLogScrape(product) {
  const finalResult = await scrapeProduct(
    {
      productUrl: product.product_url,
      optionLabel: product.option_label,
      optionKey: product.option_key,
    },
    {
      onAttempt: async (info) => {
        
        if (!info.isFinal) {
          await logRetryAttempt(product, info);
        }
      },
    }
  );

  return logScrapeResult(product, finalResult);
}

async function logRetryAttempt(product, info) {
  const { error } = await supabase.from('scrape_history').insert({
    tracked_product_id: product.id,
    outcome: 'retried',
    attempt_number: info.attemptNumber,
    http_status: info.httpStatus,
    error_message: info.error,
    duration_ms: info.durationMs,
    page_structure_ok: info.pageStructureOk ?? null,
    price: null,
    stock: null,
  });
  if (error) throw new Error(`Could not persist retry attempt: ${error.message}`);
}


async function logScrapeResult(product, finalResult) {
  const { data: previous, error: previousError } = await supabase
    .from('scrape_history')
    .select('price, stock')
    .eq('tracked_product_id', product.id)
    .in('outcome', ['success', 'retried'])
    .not('price', 'is', null)
    .order('attempted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousError) throw new Error(`Could not load the previous successful reading: ${previousError.message}`);

  const hasValidReading =
    finalResult.outcome !== 'failed' &&
    Number.isFinite(Number(finalResult.price)) &&
    Number(finalResult.price) > 0 &&
    typeof finalResult.stock === 'string' &&
    finalResult.stock.trim().length > 0;
  if (finalResult.outcome !== 'failed' && !hasValidReading) {
    throw new Error('Successful scrape results must include a positive price and a stock status');
  }

  const currentReading = hasValidReading
    ? { price: Number(finalResult.price), stock: finalResult.stock }
    : null;
  const alerts = detectAlert(previous, currentReading) || [];

  const { error: insertError } = await supabase.from('scrape_history').insert({
    tracked_product_id: product.id,
    outcome: finalResult.outcome,
    attempt_number: finalResult.attempts || 1,
    http_status: finalResult.httpStatus,
    error_message: finalResult.errorMessage || null,
    duration_ms: finalResult.durationMs ?? null,
    price: currentReading?.price ?? null,
    stock: currentReading?.stock ?? null,
    page_structure_ok: finalResult.pageStructureOk,
    price_drop: alerts.some((a) => a.type === 'price_drop'),
    back_in_stock: alerts.some((a) => a.type === 'back_in_stock'),
  });
  if (insertError) throw new Error(`Could not persist final scrape result: ${insertError.message}`);

  if (alerts.length > 0) {
    
    sendEmailAlert({ productName: product.product_name, optionLabel: product.option_label, alerts })
      .then((result) => {
        if (!result.sent) console.warn('[alerts] Email alert was not sent:', result.reason || result.status);
      })
      .catch((err) => console.error('[alerts] Email alert failed:', err));
  }

  return { ...finalResult, alerts };
}

module.exports = { router, runAndLogScrape, logRetryAttempt, logScrapeResult };
