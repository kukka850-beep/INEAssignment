

const fetch = require('node-fetch');
const crypto = require('crypto');
const { withRetry } = require('../utils/retry');
const selectors = require('./selectors');

require('dotenv').config();

const STORE_BASE_URL = process.env.STORE_BASE_URL || 'https://demo.inelabteamdev.com';
const MAX_RETRIES = Number(process.env.SCRAPER_MAX_RETRIES || 3);
const TIMEOUT_MS = Number(process.env.SCRAPER_TIMEOUT_MS || 20000);

let chromium;
function getChromium() {
  if (!chromium) chromium = require('playwright').chromium;
  return chromium;
}

function fingerprintHash(presenceFlags) {
  return crypto.createHash('sha1').update(JSON.stringify(presenceFlags)).digest('hex');
}

function isStructureTrustworthy(presenceFlags) {
  return presenceFlags.every(Boolean);
}

function parsePrice(text) {
  if (!text) return null;
  const normalized = String(text).replace(/\p{Cf}/gu, '');
  const match = normalized.match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

function normalizeStock(text) {
  if (!text) return null;
  const t = String(text).trim().toLowerCase();
  if (/out of stock|unavailable|sold out|no stock|avail-no/.test(t)) return 'out_of_stock';
  if (/in stock|available|in-stock|avail-yes/.test(t)) return 'in_stock';
  return text.trim();
}

function shouldFallbackToBrowser(error) {
  const status = Number(error?.httpStatus);
  return error?.needsBrowser || !Number.isInteger(status) || status === 429 || status >= 500;
}

async function dismissConsent(page) {
  const scrim = page.locator(selectors.product.consentScrim).first();
  if (!(await scrim.count())) return;

  const button = scrim.locator('button').first();
  if (await button.count()) {
    await button.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await scrim.waitFor({ state: 'hidden', timeout: TIMEOUT_MS });
}

async function selectOption(page, optionLabel) {
  if (!optionLabel) return;

  const expectedLabel = optionLabel.trim().replace(/\s+/g, ' ').toLowerCase();
  const optionButtons = page.locator(selectors.product.optionSelector);
  let matchedButton = null;

  for (let i = 0; i < (await optionButtons.count()); i++) {
    const button = optionButtons.nth(i);
    const label = (await button.innerText()).trim().replace(/\s+/g, ' ').toLowerCase();
    if (label === expectedLabel) {
      matchedButton = button;
      break;
    }
  }

  if (!matchedButton) {
    throw new Error(`Option "${optionLabel}" was not found on the product page`);
  }

  const isSelected = async () =>
    (await matchedButton.getAttribute('aria-pressed')) === 'true' ||
    (await matchedButton.getAttribute('class') || '').split(/\s+/).some((className) =>
      ['opt-chip-on', 'selected', 'active'].includes(className)
    );

  const wasSelected = await isSelected();
  if (!wasSelected) await matchedButton.click();

  await page.waitForFunction(
    ({ selector, expected }) =>
      [...document.querySelectorAll(selector)].some((button) => {
        const label = (button.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase();
        const classes = button.classList;
        return (
          label === expected &&
          (button.getAttribute('aria-pressed') === 'true' ||
            classes.contains('opt-chip-on') ||
            classes.contains('selected') ||
            classes.contains('active'))
        );
      }),
    { selector: selectors.product.optionSelector, expected: expectedLabel },
    { timeout: TIMEOUT_MS }
  );
  return !wasSelected;
}

function waitForQuoteResponse(page) {
  return page.waitForResponse(
    (response) => {
      try {
        return new URL(response.url()).pathname.endsWith('/quote');
      } catch {
        return false;
      }
    },
    { timeout: TIMEOUT_MS }
  );
}

async function readQuoteResponse(responsePromise, optionKey) {
  const quoteResponse = await responsePromise;
  if (quoteResponse.error) throw quoteResponse.error;
  if (!quoteResponse.ok()) {
    const error = new Error(`Quote request failed with HTTP ${quoteResponse.status()}`);
    error.httpStatus = quoteResponse.status();
    throw error;
  }

  const quote = await quoteResponse.json();
  if (optionKey && String(quote.option) !== String(optionKey)) {
    throw new Error(
      `Store returned option "${quote.option}" instead of requested option "${optionKey}"`
    );
  }
  return quote;
}

async function unlockOffer(page, optionKey) {
  const offerPanel = page.locator('.offer-panel').first();
  await offerPanel.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  const box = await offerPanel.boundingBox();
  if (!box) throw new Error('Offer panel is not visible');

  for (let i = 0; i <= 30; i++) {
    const x = box.x + 10 + ((box.width - 20) * i) / 30;
    const y = box.y + Math.min(box.height - 10, 15 + (i % 5) * 6);
    await page.mouse.move(x, y);
    await page.waitForTimeout(35);
  }

  const unlockButton = page.locator(selectors.product.unlockButton).first();
  await unlockButton.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  await page.waitForFunction(
    (selector) => {
      const button = document.querySelector(selector);
      return button instanceof HTMLButtonElement && !button.disabled;
    },
    selectors.product.unlockButton,
    { timeout: TIMEOUT_MS }
  );

  const quoteResponsePromise = waitForQuoteResponse(page).catch((error) => ({ error }));
  await unlockButton.click();
  const quote = await readQuoteResponse(quoteResponsePromise, optionKey);
  await page.waitForSelector(selectors.product.offerReady, {
    state: 'visible',
    timeout: TIMEOUT_MS,
  });
  return quote;
}

async function waitForStableText(page, selector) {
  await page.waitForFunction(
    ({ targetSelector, stableMs }) => {
      const element = document.querySelector(targetSelector);
      if (!element || !element.textContent.trim()) return false;

      const text = element.textContent;
      if (element.dataset.scraperObservedText !== text) {
        element.dataset.scraperObservedText = text;
        element.dataset.scraperTextStableSince = String(Date.now());
        return false;
      }
      return Date.now() - Number(element.dataset.scraperTextStableSince) >= stableMs;
    },
    { targetSelector: selector, stableMs: 500 },
    { timeout: TIMEOUT_MS, polling: 50 }
  );
}

async function readOffer(page) {
  const priceElement = page.locator(selectors.product.price).first();
  await priceElement.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  await waitForStableText(page, selectors.product.price);
  const price = parsePrice(await priceElement.textContent());
  if (price === null || price <= 0) {
    throw new Error('Could not extract a valid selling price from the unlocked offer');
  }

  const stockElement = page.locator(selectors.product.stock).first();
  await stockElement.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  await waitForStableText(page, selectors.product.stock);
  const stockText = await stockElement.innerText();
  const classList = (await stockElement.getAttribute('class')) || '';
  const stock = classList.includes('avail-no')
    ? 'out_of_stock'
    : classList.includes('avail-yes')
      ? 'in_stock'
      : normalizeStock(stockText);
  if (!stock) throw new Error('Could not extract stock status from the unlocked offer');

  return { price, stock };
}

/**
 * Attempt 1 — quick HTTP check.
 * The store's HTML never contains prices (pure SPA), so this will always
 * throw err.needsBrowser = true. We keep it here so the architecture is
 * correct per the assignment (try HTTP first, fall back to browser).
 */
async function scrapeWithHttp(productUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(productUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; INEPriceTracker/1.0)' },
    });
    clearTimeout(timer);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} from store`);
      err.httpStatus = res.status;
      throw err;
    }
    // The page is a React SPA — price is never in static HTML.
    const err = new Error('Price is rendered client-side; headless browser required');
    err.needsBrowser = true;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Attempt 2 — headless Playwright. The quote response confirms which option
 * the store priced; its visible offer row supplies the decoded selling price.
 */
async function scrapeWithBrowser(productUrl, optionLabel, optionKey, { headed = false } = {}) {
  const browser = await getChromium().launch({
    headless: !headed,
    slowMo: headed ? 200 : 0,
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT_MS);

    const httpResponse = await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
    const httpStatus = httpResponse ? httpResponse.status() : null;
    if (!httpResponse || !httpResponse.ok()) {
      const error = new Error(`Product page request failed with HTTP ${httpStatus || 'no response'}`);
      error.httpStatus = httpStatus;
      throw error;
    }

    await page.waitForSelector(selectors.product.contentReadyMarker, { timeout: TIMEOUT_MS });
    await dismissConsent(page);
    await selectOption(page, optionLabel);
    const quote = await unlockOffer(page, optionKey);

    const presenceFlags = await Promise.all(
      selectors.structuralFingerprint.map(async (selector) => (await page.$$(selector)).length > 0)
    );
    const structureHash = fingerprintHash(presenceFlags);
    const pageStructureOk = isStructureTrustworthy(presenceFlags);

    if (!pageStructureOk) {
      const err = new Error(
        `Page structure looks different (${presenceFlags.filter(Boolean).length}/${presenceFlags.length} required selectors matched)`
      );
      err.structureChanged = true;
      err.structureHash = structureHash;
      err.pageStructureOk = false;
      throw err;
    }

    const { price, stock } = await readOffer(page);

    return {
      price,
      stock,
      httpStatus,
      structureHash,
      pageStructureOk,
      optionKey: quote.option || null,
      method: 'browser',
    };
  } finally {
    await browser.close();
  }
}

/**
 * Batch scrape multiple options of the same product in one page load.
 * Returns a Map<optionLabel, reading-or-error>.
 */
async function scrapeMultipleOptions(productUrl, options, { headed = false } = {}) {
  const browser = await getChromium().launch({ headless: !headed, slowMo: headed ? 200 : 0 });
  const out = new Map();

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT_MS);

    const httpResponse = await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
    if (!httpResponse || !httpResponse.ok()) {
      throw new Error(`Product page request failed with HTTP ${httpResponse?.status() || 'no response'}`);
    }
    await page.waitForSelector(selectors.product.contentReadyMarker, { timeout: TIMEOUT_MS });
    await dismissConsent(page);

    let offerUnlocked = false;
    for (const { optionLabel, optionKey } of options) {
      const startedAt = Date.now();
      try {
        const quotePromise = offerUnlocked
          ? waitForQuoteResponse(page).catch((error) => ({ error }))
          : null;
        const optionChanged = await selectOption(page, optionLabel);
        let quote;
        if (!offerUnlocked) {
          quote = await unlockOffer(page, optionKey);
          offerUnlocked = true;
        } else if (optionChanged) {
          quote = await readQuoteResponse(quotePromise, optionKey);
          await page.waitForSelector(selectors.product.offerReady, {
            state: 'visible',
            timeout: TIMEOUT_MS,
          });
        } else {
          throw new Error(`Option "${optionLabel}" did not trigger a new store quote`);
        }

        const presenceFlags = await Promise.all(
          selectors.structuralFingerprint.map(async (selector) => (await page.$$(selector)).length > 0)
        );
        const structureHash = fingerprintHash(presenceFlags);
        const pageStructureOk = isStructureTrustworthy(presenceFlags);
        if (!pageStructureOk) {
          const error = new Error(
            `Page structure looks different (${presenceFlags.filter(Boolean).length}/${presenceFlags.length} required selectors matched)`
          );
          error.structureChanged = true;
          error.structureHash = structureHash;
          error.pageStructureOk = false;
          throw error;
        }

        const { price, stock } = await readOffer(page);

        out.set(optionLabel, {
          price,
          stock,
          httpStatus: 200,
          optionKey: quote.option || null,
          pageStructureOk,
          structureHash,
          durationMs: Date.now() - startedAt,
          method: 'browser-batch',
        });
      } catch (error) {
        out.set(optionLabel, {
          errorMessage: error.message,
          pageStructureOk: error.pageStructureOk ?? null,
          structureHash: error.structureHash || null,
          durationMs: Date.now() - startedAt,
        });
      }
    }

    return out;
  } finally {
    await browser.close();
  }
}

/**
 * Public entrypoint. Always returns a safe result (never throws for normal
 * scrape failures). Tries HTTP first (fast-path), then browser if needed.
 */
async function scrapeProduct(
  { productUrl, optionLabel, optionKey },
  { headed = false, onAttempt } = {}
) {
  let finalDurationMs = null;

  const strategy = async () => {
    const mode = process.env.SCRAPER_MODE || 'auto';

    if (mode === 'browser') {
      return scrapeWithBrowser(productUrl, optionLabel, optionKey, { headed });
    }
    if (mode === 'http') {
      return scrapeWithHttp(productUrl);
    }

    try {
      return await scrapeWithHttp(productUrl);
    } catch (error) {
      if (!shouldFallbackToBrowser(error)) throw error;
      return scrapeWithBrowser(productUrl, optionLabel, optionKey, { headed });
    }
  };

  const { success, result, error, attempts } = await withRetry(
    () => strategy(),
    {
      maxAttempts: MAX_RETRIES,
      onAttempt: async (info) => {
        if (info.success || info.isLastAttempt) finalDurationMs = info.durationMs;
        if (onAttempt) {
          await onAttempt({
            attemptNumber: info.attempt,
            outcome: info.success ? (info.attempt > 1 ? 'retried' : 'success') : 'failed',
            durationMs: info.durationMs,
            error: info.error ? info.error.message : null,
            httpStatus: info.error ? info.error.httpStatus || null : info.result?.httpStatus,
            pageStructureOk: info.error?.pageStructureOk ?? info.result?.pageStructureOk ?? null,
            isFinal: info.success || info.isLastAttempt,
          });
        }
      },
    }
  );

  if (success) {
    return {
      outcome: attempts > 1 ? 'retried' : 'success',
      attempts,
      durationMs: finalDurationMs,
      ...result,
    };
  }

  return {
    outcome: 'failed',
    attempts,
    durationMs: finalDurationMs,
    price: null,
    stock: null,
    httpStatus: error?.httpStatus || null,
    errorMessage: error?.message || 'Unknown scrape failure',
    pageStructureOk: error?.pageStructureOk ?? null,
    structureHash: error?.structureHash || null,
  };
}

module.exports = {
  scrapeProduct,
  scrapeMultipleOptions,
  parsePrice,
  shouldFallbackToBrowser,
  STORE_BASE_URL,
};
