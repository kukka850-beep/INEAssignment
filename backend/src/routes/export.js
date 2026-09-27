const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const supabase = require('../supabaseClient');


router.get(['/', '/csv'], async (req, res) => {
  const { data: products, error: perr } = await supabase.from('tracked_products').select('*');
  if (perr) return res.status(500).json({ error: perr.message });

  const { data: history, error: herr } = await supabase
    .from('scrape_history')
    .select('*')
    .order('attempted_at', { ascending: true });
  if (herr) return res.status(500).json({ error: herr.message });

  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));

  const rows = history.map((h) => {
    const p = productsById[h.tracked_product_id] || {};
    let productIdFromUrl = '';
    if (p.product_url) {
      try {
        productIdFromUrl = new URL(p.product_url).pathname.split('/').filter(Boolean).at(-1) || '';
      } catch (error) {
        console.error(`[export] invalid product URL for tracked product ${p.id}:`, error);
      }
    }
    return {
      store_product_id: productIdFromUrl || p.store_product_id || '',
      product_name: p.product_name || '',
      option: p.option_label || '',
      timestamp_utc: new Date(h.attempted_at).toISOString(),
      price: h.outcome === 'failed' || h.price == null ? '' : h.price,
      stock: h.outcome === 'failed' || h.stock == null ? '' : h.stock,
      outcome: h.outcome,
    };
  });

  const parser = new Parser({
    fields: ['store_product_id', 'product_name', 'option', 'timestamp_utc', 'price', 'stock', 'outcome'],
  });
  const csv = parser.parse(rows);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="scrape_history.csv"');
  res.send(csv);
});

module.exports = router;
