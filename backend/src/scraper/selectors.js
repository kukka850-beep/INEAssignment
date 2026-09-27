module.exports = {
  search: {
    // The store exposes a real search/filter API — use it directly.
    // q param filters by name (case-insensitive substring on the backend).
    resultsUrlTemplate: (base, query) =>
      `${base}/api/v2/listings?page=1&limit=30&q=${encodeURIComponent(query)}`,
    // These are used if we fall back to DOM scraping of the /search page
    resultItem: '[data-testid="product-card"], .product-card',
    resultLink: 'a',
    resultName: '.product-card__name, [data-testid="product-name"], h3',
  },
  product: {
    // Product pages live at /item/:id on the SPA
    pageUrlTemplate: (base, id) => `${base}/item/${id}`,
    // DOM: name
    name: 'h1',
    // DOM: option selector buttons
    optionSelector: '.opt-chip, .variant-btn, [data-testid="variant-btn"], .variant-pill, button[data-variant]',
    optionLabelAttr: 'data-variant',
    // DOM: the offer panel unlock button
    unlockButton: 'button.ctl-main, [aria-label="Check today\'s price"]',
    // The visible sale amount changes tag; hidden decoy amounts are spans.
    price: '.offer-row > div, .offer-row > b, .offer-row > strong',
    // DOM: stock badge
    stock: '.avail-pill',
    // DOM: marker that the offer panel finished loading after unlock
    offerReady: '.offer-row, .offer-facts',
    consentScrim: '.consent-scrim',
    // DOM: generic content-ready marker (used to detect page load)
    contentReadyMarker: '.offer-panel, h1',
  },
  // Structural fingerprint — if fewer than half these selectors match,
  // we treat the page structure as changed.
  structuralFingerprint: [
    'h1',
    '.offer-panel',
    '.opt-chip, .variant-btn, [data-testid="variant-btn"], .variant-pill, button[data-variant]',
    '.avail-pill',
    '.offer-row > div, .offer-row > b, .offer-row > strong',
  ],
};
