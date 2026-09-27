

const fetch = require('node-fetch');
require('dotenv').config();

const STORE_BASE_URL = process.env.STORE_BASE_URL || 'https://demo.inelabteamdev.com';
const REQUEST_TIMEOUT_MS = Number(process.env.SCRAPER_TIMEOUT_MS || 20000);
const SEARCH_PAGE_LIMIT = 60;
const MAX_CATALOG_REQUESTS = 200;
const MAX_RESULTS = 20;
let catalogCache = null;

async function fetchJson(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; INEPriceTracker/1.0)' },
      });
      if (!response.ok) {
        const error = new Error(`Store request failed with HTTP ${response.status}`);
        error.httpStatus = response.status;
        throw error;
      }
      return await response.json();
    } catch (error) {
      if (attempt === 3 || (error.httpStatus && error.httpStatus < 500 && error.httpStatus !== 429)) {
        throw error;
      }
      const delayMs = 250 * 2 ** (attempt - 1) + Math.random() * 150;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } finally {
      clearTimeout(timer);
    }
  }
}

async function searchProducts(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  let matches;
  if (catalogCache) {
    matches = catalogCache.filter((item) => {
      const haystack = [item.name, item.brand, item.category, item.sku]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  } else {
    const firstPage = await fetchJson(
      `${STORE_BASE_URL}/api/v2/listings?page=1&limit=${SEARCH_PAGE_LIMIT}`
    );
    if (!firstPage || !Array.isArray(firstPage.results)) {
      throw new Error('Store catalog response did not contain a results list');
    }

    const totalCount = Number(firstPage.count);
    const totalPages = Number(firstPage.totalPages);
    if (
      !Number.isInteger(totalCount) ||
      totalCount < 0 ||
      !Number.isInteger(totalPages) ||
      (totalCount > 0 && totalPages < 1)
    ) {
      throw new Error('Store catalog response did not contain valid pagination metadata');
    }

    const productsById = new Map();
    const matchesById = new Map();
    let exactMatchFound = false;
    const addPage = (data) => {
      if (!data || !Array.isArray(data.results)) {
        throw new Error('Store catalog response did not contain a results list');
      }
      for (const item of data.results) {
        if (item.id == null) continue;
        const id = String(item.id);
        productsById.set(id, item);
        const haystack = [item.name, item.brand, item.category, item.sku]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (haystack.includes(q)) matchesById.set(id, item);
        if (String(item.name || '').trim().toLowerCase() === q) exactMatchFound = true;
      }
    };
    addPage(firstPage);

    const enoughMatches = () =>
      exactMatchFound ||
      matchesById.size >= MAX_RESULTS ||
      (q.includes(' ') && matchesById.size > 0);
    const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
    let requests = 1;
    let pageOffset = 0;
    while (
      productsById.size < totalCount &&
      !enoughMatches() &&
      requests < MAX_CATALOG_REQUESTS
    ) {
      const pages = pageNumbers.slice(pageOffset, pageOffset + 5);
      if (pages.length === 0) {
        pageOffset = 0;
        continue;
      }

      const responses = await Promise.all(
        pages.map((page) =>
          fetchJson(`${STORE_BASE_URL}/api/v2/listings?page=${page}&limit=${SEARCH_PAGE_LIMIT}`)
        )
      );
      responses.forEach(addPage);
      requests += pages.length;
      pageOffset += pages.length;
      if (pageOffset >= pageNumbers.length) pageOffset = 0;
    }

    if (productsById.size === totalCount) {
      catalogCache = [...productsById.values()];
    } else if (!enoughMatches()) {
      throw new Error(
        `Store catalog search was incomplete (${productsById.size}/${totalCount} products loaded)`
      );
    }
    matches = [...matchesById.values()];
  }

  const selectedMatches = matches.slice(0, MAX_RESULTS);
  const results = [];
  for (let i = 0; i < selectedMatches.length; i += 10) {
    const batch = selectedMatches.slice(i, i + 10);
    const batchResults = await Promise.all(batch.map(async (item) => {
      const detail = await fetchJson(`${STORE_BASE_URL}/api/v2/items/${item.id}`);
      if (!Array.isArray(detail.options)) {
        throw new Error(`Store detail response for item ${item.id} did not contain options`);
      }

      return {
        name: item.name,
        brand: item.brand,
        category: item.category,
        url: `${STORE_BASE_URL}/item/${item.id}`,
        storeProductId: String(item.id),
        options: detail.options,
      };
    }));
    results.push(...batchResults);
  }

  return results;
}

module.exports = { searchProducts };
