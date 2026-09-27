const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `Cannot reach the backend at ${BASE_URL}. Make sure it is running, the URL is correct, and CORS allows this frontend origin.`
      );
    }
    throw error;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  searchStore: (q) => request(`/api/products/search?q=${encodeURIComponent(q)}`),
  listTracked: () => request('/api/products'),
  addTracked: (payload) => request('/api/products', { method: 'POST', body: JSON.stringify(payload) }),
  stopTracking: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),
  getHistory: (id) => request(`/api/products/${id}/history`),
  scrapeNow: (id) => request(`/api/products/${id}/scrape`, { method: 'POST' }),
  exportCsvUrl: () => `${BASE_URL}/api/export/csv`,
};
