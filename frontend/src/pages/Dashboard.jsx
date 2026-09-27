import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

function outcomeChip(outcome) {
  if (!outcome) return <span className="badge badge-muted">no data yet</span>;
  if (outcome === 'success') return <span className="badge badge-up">● ok</span>;
  if (outcome === 'retried') return <span className="badge badge-amber">● retried</span>;
  return <span className="badge badge-down">● failed</span>;
}

function AlertRow({ latest, lastAttempt }) {
  if (!latest && lastAttempt?.page_structure_ok !== false) return null;
  const tags = [];
  if (latest?.price_drop)
    tags.push(<span key="drop" className="badge badge-up">▼ price drop</span>);
  if (latest?.back_in_stock)
    tags.push(<span key="stock" className="badge badge-up">● back in stock</span>);
  if (lastAttempt?.page_structure_ok === false)
    tags.push(<span key="struct" className="badge badge-down">⚠ layout changed</span>);
  if (tags.length === 0) return null;
  return <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>{tags}</div>;
}

export default function Dashboard() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    api.listTracked().then(setProducts).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  if (error) {
    return (
      <div className="page-content">
        <div className="card" style={{ color: 'var(--red)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>⚠</span>
          <span>Couldn't load tracked products: {error}</span>
        </div>
      </div>
    );
  }

  if (!products) {
    return (
      <div className="page-content" style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--text-dim)' }}>
        <span className="spinner" /> Loading products…
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="page-content fade-in">
        <div className="card" style={{ textAlign: 'center', padding: '56px 32px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h2 style={{ fontSize: 24, marginBottom: 8 }}>Nothing on the board yet</h2>
          <p className="dim" style={{ marginBottom: 24, maxWidth: 380, margin: '0 auto 24px' }}>
            Search the store and pick a product + option to start tracking its price every 2 hours.
          </p>
          <Link to="/add" className="btn btn-primary" id="dashboard-empty-add">
            + Add your first product
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content fade-in">
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Tracked products</h2>
          <span className="dim" style={{ fontSize: 13 }}>
            {products.length} product{products.length !== 1 ? 's' : ''} on the board
          </span>
        </div>
        <Link to="/add" className="btn btn-primary" id="dashboard-add-btn" style={{ fontSize: 13 }}>
          + Add product
        </Link>
      </div>

      {/* Table wrapper */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table id="dashboard-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Option</th>
              <th>Current price</th>
              <th>Stock</th>
              <th>Last scrape</th>
              <th>Alerts</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const price = p.latest?.price != null
                ? `₹${Number(p.latest.price).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : '—';
              const stock = p.latest?.stock || '—';
              const inStock = stock === 'in_stock';
              const outStock = stock === 'out_of_stock';

              return (
                <tr key={p.id}>
                  <td>
                    <Link
                      to={`/product/${p.id}`}
                      style={{ fontWeight: 600, color: 'var(--text)', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.target.style.color = 'var(--amber)'}
                      onMouseLeave={e => e.target.style.color = 'var(--text)'}
                    >
                      {p.product_name}
                    </Link>
                    <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>
                      #{p.store_product_id}
                    </div>
                  </td>
                  <td>
                    <span className="tag">{p.option_label}</span>
                  </td>
                  <td className="mono" style={{ fontWeight: 600, color: p.latest?.price_drop ? 'var(--green)' : 'var(--text)' }}>
                    {price}
                  </td>
                  <td>
                    {inStock && <span className="badge badge-up">In stock</span>}
                    {outStock && <span className="badge badge-down">Sold out</span>}
                    {!inStock && !outStock && <span className="dim mono" style={{ fontSize: 13 }}>{stock}</span>}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {outcomeChip(p.lastAttempt?.outcome)}
                  </td>
                  <td>
                    <AlertRow latest={p.latest} lastAttempt={p.lastAttempt} />
                    {!p.latest?.price_drop &&
                      !p.latest?.back_in_stock &&
                      p.lastAttempt?.page_structure_ok !== false && (
                      <span className="muted" style={{ fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
