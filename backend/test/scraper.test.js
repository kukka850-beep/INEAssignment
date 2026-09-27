const assert = require('node:assert/strict');
const test = require('node:test');
const selectors = require('../src/scraper/selectors');
const { parsePrice } = require('../src/scraper/scraper');
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
  assert.equal(selectors.product.price, '.offer-row > div, .offer-row > b, .offer-row > strong');
  assert.match(selectors.structuralFingerprint.at(-1), /\.offer-row > strong/);
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
