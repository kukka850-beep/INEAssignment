import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { api } from '../api.js';

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateFull(iso) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: 'var(--bg-raised)',
      border: '1px solid var(--border-mid)',
      borderRadius: 'var(--radius-sm)',
      padding: '10px 14px',
      fontSize: 13,
    }}>
      <div className="dim" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, color: 'var(--amber)', fontFamily: 'var(--mono)' }}>
        ₹{Number(payload[0].value).toLocaleString('en-IN')}
      </div>
    </div>
  );
}

function outcomeChip(outcome) {
  if (outcome === 'success') return <span className="badge badge-up">success</span>;
  if (outcome === 'retried') return <span className="badge badge-amber">retried</span>;
  return <span className="badge badge-down">failed</span>;
}

export default function ProductDetail() {
  const { id } = useParams();
  const [history, setHistory] = useState(null);
  const [product, setProduct] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [scrapeResult, setScrapeResult] = useState(null);

  const load = async () => {
    try {
      const [h, products] = await Promise.all([
        api.getHistory(id),
        api.listTracked(),
      ]);
      setHistory(h);
      setProduct(products.find(p => p.id === id) || null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, [id]);

  async function scrapeNow() {
    setBusy(true);
    setError(null);
    setScrapeResult(null);
    try {
      const result = await api.scrapeNow(id);
      setScrapeResult(result);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="page-content">
        <div className="card" style={{ color: 'var(--red)' }}>{error}</div>
      </div>
    );
  }

  if (!history) {
    return (
      <div className="page-content" style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-dim)' }}>
        <span className="spinner" /> Loading history…
      </div>
    );
  }

  const chartData = history
    .filter((h) => h.outcome !== 'failed' && h.price != null)
    .map((h) => ({ time: formatTime(h.attempted_at), price: Number(h.price) }));

  const latestSuccess = history.filter(h => h.price != null).at(-1);
  const oldestSuccess = history.filter(h => h.price != null).at(0);
  const priceChange = latestSuccess && oldestSuccess
    ? latestSuccess.price - oldestSuccess.price
    : null;

  return (
    <div className="page-content fade-in">
      {scrapeResult && (
        <div
          className="card"
          role="status"
          style={{ color: scrapeResult.outcome === 'failed' ? 'var(--red)' : 'var(--green)' }}
        >
          {scrapeResult.outcome === 'failed'
            ? `Scrape failed: ${scrapeResult.errorMessage || 'No valid price or stock reading was returned.'}`
            : `Scrape ${scrapeResult.outcome}: ${scrapeResult.price} — ${scrapeResult.stock}`}
        </div>
      )}
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13 }}>
        <Link to="/dashboard" className="dim" style={{ textDecoration: 'none' }}>
          Dashboard
        </Link>
        <span className="muted">›</span>
        <span>{product?.product_name || 'Product'}</span>
        {product?.option_label && <span className="tag">{product.option_label}</span>}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            {product?.product_name || 'Price history'}
          </h2>
          {product && (
            <a href={product.product_url} target="_blank" rel="noreferrer"
              className="dim" style={{ fontSize: 13, textDecoration: 'none' }}>
              ↗ View on store
            </a>
          )}
        </div>
        <button
          id="scrape-now-btn"
          className="btn btn-primary"
          onClick={scrapeNow}
          disabled={busy}
          style={{ flexShrink: 0 }}
        >
          {busy ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Scraping…</> : '⟳ Scrape now'}
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
            Current price
          </div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--amber)' }}>
            {latestSuccess ? `₹${Number(latestSuccess.price).toLocaleString('en-IN')}` : '—'}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
            Change
          </div>
          <div className="mono" style={{
            fontSize: 24, fontWeight: 700,
            color: priceChange === null ? 'var(--text-muted)' : priceChange < 0 ? 'var(--green)' : priceChange > 0 ? 'var(--red)' : 'var(--text-dim)',
          }}>
            {priceChange === null
              ? '—'
              : `${priceChange < 0 ? '▼' : priceChange > 0 ? '▲' : ''}₹${Math.abs(priceChange).toLocaleString('en-IN')}`}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
            Stock
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {latestSuccess?.stock === 'in_stock'
              ? <span className="up">In stock</span>
              : latestSuccess?.stock === 'out_of_stock'
              ? <span className="down">Sold out</span>
              : <span className="dim">{latestSuccess?.stock || '—'}</span>}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
            Scrapes logged
          </div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 700 }}>{history.length}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="card" style={{ padding: '20px 20px 12px', marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Price over time</h3>
        {chartData.length > 1 ? (
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f0a830" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f0a830" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  width={72}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `₹${Number(v).toLocaleString('en-IN')}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="var(--amber)"
                  strokeWidth={2}
                  fill="url(#priceGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: 'var(--amber)', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="dim" style={{ fontSize: 14, padding: '24px 0' }}>
            Not enough successful scrapes yet to draw a trend line.
          </p>
        )}
      </div>

      {/* Scrape log */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Scrape log</h3>
        </div>
        <table id="scrape-log-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>#</th>
              <th>Outcome</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().map((h) => (
              <tr key={h.id}>
                <td className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {formatDateFull(h.attempted_at)}
                </td>
                <td className="mono dim">#{h.attempt_number}</td>
                <td>{outcomeChip(h.outcome)}</td>
                <td className="mono" style={{ fontWeight: 600 }}>
                  {h.price != null ? `₹${Number(h.price).toLocaleString('en-IN')}` : '—'}
                </td>
                <td style={{ fontSize: 13 }}>
                  {h.stock === 'in_stock' && <span className="up">in_stock</span>}
                  {h.stock === 'out_of_stock' && <span className="down">out_of_stock</span>}
                  {h.stock && h.stock !== 'in_stock' && h.stock !== 'out_of_stock' && (
                    <span className="dim mono">{h.stock}</span>
                  )}
                  {!h.stock && <span className="muted">—</span>}
                </td>
                <td style={{ fontSize: 12 }}>
                  {h.price_drop && <span className="badge badge-up" style={{ marginRight: 4 }}>▼ price drop</span>}
                  {h.back_in_stock && <span className="badge badge-up" style={{ marginRight: 4 }}>● back in stock</span>}
                  {h.page_structure_ok === false && (
                    <span className="badge badge-down" style={{ marginRight: 4 }}>⚠ layout changed</span>
                  )}
                  {h.error_message && (
                    <span className="dim" title={h.error_message}>
                      {h.error_message.length > 50 ? h.error_message.slice(0, 50) + '…' : h.error_message}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
