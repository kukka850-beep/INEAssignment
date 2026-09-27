const assert = require('node:assert/strict');
const test = require('node:test');
const selectors = require('../src/scraper/selectors');
const { parsePrice, shouldFallbackToBrowser } = require('../src/scraper/scraper');

test('auto scraper falls back to browser for transient HTTP errors', () => {
  assert.equal(shouldFallbackToBrowser({ httpStatus: 503 }), true);
  assert.equal(shouldFallbackToBrowser({ httpStatus: 429 }), true);
});

test('auto scraper does not browser-fallback on permanent client errors', () => {
  assert.equal(shouldFallbackToBrowser({ httpStatus: 404 }), false);
  assert.equal(shouldFallbackToBrowser({ httpStatus: 403 }), false);
});
const { withRetry } = require('../src/utils/retry');

test('parsePrice reads the visible selling price with zero-width separators', () => {
  assert.equal(parsePrice('₹​5​4​,​6​1​7'), 54617);
  assert.equal(parsePrice('₹1,23,456.50'), 123456.5);
});

test('parsePrice rejects text without a numeric price', () => {
  assert.equal(parsePrice('Price locked'), null);
  assert.equal(parsePrice(''), null);
});

test('product selectors target the actual option chips and visible sale price', () => {
  assert.match(selectors.product.optionSelector, /\.opt-chip/);
  assert.equal(selectors.product.price, '.offer-row > div, .offer-row > b');
  assert.match(selectors.structuralFingerprint.at(-1), /\.offer-row > div, \.offer-row > b/);
});

test('retry logging errors stop retries instead of repeating a successful scrape', async () => {
  let scrapeCount = 0;

  await assert.rejects(
    withRetry(async () => {
      scrapeCount += 1;
      return { success: true };
    }, {
      maxAttempts: 3,
      onAttempt: async () => {
        throw new Error('history write failed');
      },
    }),
    /history write failed/
  );
  assert.equal(scrapeCount, 1);
});
