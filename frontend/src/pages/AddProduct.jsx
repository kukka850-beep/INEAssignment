import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function AddProduct() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState(null);
  const [optionLabel, setOptionLabel] = useState('');
  const [optionKey, setOptionKey] = useState(null);
  const [intervalMinutes, setIntervalMinutes] = useState(120);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const { results } = await api.searchStore(query.trim());
      setResults(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTrack(e) {
    e.preventDefault();
    if (!selected || !optionLabel.trim()) return;
    const parsedInterval = Number(intervalMinutes);
    if (!Number.isInteger(parsedInterval) || parsedInterval < 15) {
      setError('Check interval must be a whole number of at least 15 minutes.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const product = await api.addTracked({
        storeProductId: selected.storeProductId,
        productName: selected.name,
        productUrl: selected.url,
        optionLabel: optionLabel.trim(),
        optionKey,
        scrapeIntervalMinutes: parsedInterval,
      });
      navigate(`/product/${product.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-content fade-in">
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Track a product</h2>
        <p className="dim" style={{ fontSize: 14 }}>
          Search the INE store, pick a product, then choose which option variant to monitor.
        </p>
      </div>

      <div style={{ maxWidth: 640 }}>
        {/* Step 1 — Search */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <StepBadge n={1} done={!!selected} />
            <span style={{ fontWeight: 600 }}>Search the store</span>
          </div>

          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
            <input
              id="search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. trail camera, tablet, wireless mouse…"
              style={{ flex: 1 }}
              disabled={busy && !selected}
            />
            <button
              id="search-btn"
              className="btn btn-primary"
              disabled={busy || !query.trim()}
              style={{ flexShrink: 0, minWidth: 96 }}
            >
              {busy && !selected ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="spinner" style={{ width: 14, height: 14 }} /> Searching
                </span>
              ) : 'Search'}
            </button>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="card" style={{ borderColor: 'var(--red-dim)', marginBottom: 20, color: 'var(--red)', fontSize: 14 }}>
            ⚠ {error}
          </div>
        )}

        {/* Results */}
        {results && results.length === 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <p className="dim" style={{ fontSize: 14 }}>No matches. Try a different search term.</p>
          </div>
        )}

        {results && results.length > 0 && !selected && (
          <div className="card fade-in" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>
                <span className="dim">{results.length} results for </span>
                <strong>"{query}"</strong>
              </span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {results.map((r) => (
                <ResultItem key={r.url} r={r} onSelect={setSelected} />
              ))}
            </ul>
          </div>
        )}

        {/* Step 2 — Configure tracking */}
        {selected && (
          <div className="card fade-in" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <StepBadge n={2} done={false} />
              <span style={{ fontWeight: 600 }}>Choose a variant</span>
            </div>

            {/* Selected product info */}
            <div style={{
              background: 'var(--bg-raised)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 16px',
              marginBottom: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{selected.name}</div>
                {selected.brand && (
                  <div className="dim" style={{ fontSize: 12 }}>{selected.brand} · {selected.category}</div>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setSelected(null);
                  setOptionLabel('');
                  setOptionKey(null);
                }}
                style={{ fontSize: 12, flexShrink: 0 }}
              >
                Change
              </button>
            </div>

            {/* Available options from the API */}
            {selected.options && selected.options.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Available options — click to select:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selected.options.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      id={`option-chip-${opt.id}`}
                      onClick={() => {
                        setOptionLabel(opt.label);
                        setOptionKey(opt.id);
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 100,
                        border: `1px solid ${optionLabel === opt.label ? 'var(--amber)' : 'var(--border-mid)'}`,
                        background: optionLabel === opt.label ? 'var(--amber-glow)' : 'transparent',
                        color: optionLabel === opt.label ? 'var(--amber)' : 'var(--text-dim)',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleTrack}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Option / variant label
              </label>
              <p className="dim" style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.5 }}>
                Must exactly match the option on the product page — e.g.{' '}
                <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--amber)' }}>Body only</code>,{' '}
                <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--amber)' }}>Standard kit</code>.
                Use the chips above to auto-fill.
              </p>
              <input
                id="option-input"
                value={optionLabel}
                onChange={(e) => {
                  setOptionLabel(e.target.value);
                  setOptionKey(null);
                }}
                placeholder="e.g. Standard kit"
                style={{ marginBottom: 16 }}
              />

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Check interval (minutes)
              </label>
              <p className="dim" style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.5 }}>
                Default 120 min (2h). The external cron fires every 2h; shorter values work once you add a matching cron job.
              </p>
              <input
                id="interval-input"
                type="number"
                min={15}
                step={1}
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(e.target.value)}
                style={{ width: 160, marginBottom: 20 }}
              />

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  id="track-btn"
                  className="btn btn-primary"
                  disabled={busy || !optionLabel.trim()}
                >
                  {busy ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="spinner" style={{ width: 14, height: 14 }} /> Saving…
                    </span>
                  ) : '→ Start tracking'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setSelected(null);
                    setOptionLabel('');
                    setOptionKey(null);
                  }}
                  id="back-to-results-btn"
                >
                  ← Back
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function StepBadge({ n, done }) {
  return (
    <span style={{
      width: 26, height: 26,
      background: done ? 'var(--green)' : 'var(--amber)',
      color: 'var(--bg-base)',
      borderRadius: '50%',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, flexShrink: 0,
    }}>
      {done ? '✓' : n}
    </span>
  );
}

function ResultItem({ r, onSelect }) {
  const [hovered, setHovered] = useState(false);
  return (
    <li
      id={`result-${r.storeProductId}`}
      style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        transition: 'background 0.12s',
      }}
      onClick={() => onSelect(r)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>{r.name}</div>
          {r.brand && (
            <div className="dim" style={{ fontSize: 12, marginBottom: 4 }}>{r.brand} · {r.category}</div>
          )}
          {r.options && r.options.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
              {r.options.map(o => (
                <span key={o.id} className="tag" style={{ fontSize: 11 }}>{o.label}</span>
              ))}
            </div>
          )}
        </div>
        <span style={{ color: 'var(--amber)', fontSize: 18, flexShrink: 0 }}>→</span>
      </div>
    </li>
  );
}
