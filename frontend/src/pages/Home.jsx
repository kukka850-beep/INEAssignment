import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Home() {
  const [stats, setStats] = useState({ total: 0, active: 0, drops: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.listTracked()
      .then(products => {
        const drops = products.filter(p => p.latest?.price_drop).length;
        setStats({
          total: products.length,
          active: products.filter(p => p.is_active).length,
          drops,
        });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  return (
    <div className="fade-in">
      {/* ── Hero ── */}
      <section className="home-hero">
        <div className="home-glow" />

        <div className="home-hero-badge">
          <span className="live-dot" />
          <span>LIVE PRICE TRACKING</span>
        </div>

        <h1 className="home-title">
          Never pay more than{' '}
          <span className="amber">you should</span>
        </h1>

        <p className="home-subtitle">
          PriceWatch monitors products on the INE store every 2 hours and alerts
          you the moment prices drop or items come back in stock.
        </p>

        <div className="home-cta-row">
          <Link to="/add" className="btn btn-primary" id="hero-start-tracking">
            Start tracking →
          </Link>
          <Link to="/dashboard" className="btn" id="hero-view-dashboard">
            View dashboard
          </Link>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="home-stats-section">
        <div className="home-stats-grid">
          {[
            { label: 'Products tracked', value: stats.total },
            { label: 'Currently active',  value: stats.active },
            { label: 'Price drops found', value: stats.drops },
          ].map((s, i) => (
            <div key={i} className="home-stat-cell">
              <div className={`home-stat-value mono${loaded ? ' fade-in' : ''}`}>{s.value}</div>
              <div className="home-stat-label dim">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="home-features-section">
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Everything you need</h2>
          <p className="dim" style={{ fontSize: 15 }}>
            Built for the assignment, designed like a real product.
          </p>
        </div>

        <div className="home-features-grid">
          {[
            {
              icon: '⏱',
              title: 'Auto-scrape every 2h',
              desc: 'Scheduled cron job hits the store every 2 hours. Per-product interval is configurable.',
              hue: '#f0a830',
            },
            {
              icon: '🔄',
              title: 'Smart retry + fallback',
              desc: 'Tries lightweight HTTP first. Falls back to headless Playwright when the page needs JS.',
              hue: '#e07a30',
            },
            {
              icon: '📉',
              title: 'Price drop alerts',
              desc: 'Detects drops and back-in-stock events. Email alerts fire automatically.',
              hue: '#34c77a',
            },
            {
              icon: '📊',
              title: 'Price history chart',
              desc: 'Visual trend line and a full scrape log showing outcome, attempts, and error detail.',
              hue: '#f0a830',
            },
            {
              icon: '🛡',
              title: 'Layout-change detection',
              desc: 'Structural fingerprinting flags when the store changes its HTML.',
              hue: '#e05656',
            },
            {
              icon: '📤',
              title: 'CSV export',
              desc: 'Download all scrape history as a CSV. One click, ready for Excel or Sheets.',
              hue: '#e07a30',
            },
          ].map((f, i) => (
            <FeatureCard key={i} icon={f.icon} title={f.title} desc={f.desc} hue={f.hue} />
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="home-cta-section">
        <div className="home-cta-box">
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10 }}>
            Ready to watch your first product?
          </h2>
          <p className="dim" style={{ marginBottom: 24 }}>
            Search the store, pick a product + option, and we handle the rest.
          </p>
          <Link to="/add" className="btn btn-primary" id="cta-add-product" style={{ fontSize: 15, padding: '11px 26px' }}>
            Add a product now →
          </Link>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc, hue }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="card feature-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderColor: hovered ? hue : '',
        transform: hovered ? 'translateY(-3px)' : '',
        transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
        boxShadow: hovered ? `0 8px 24px rgba(0,0,0,0.3)` : '',
      }}
    >
      <div style={{ fontSize: 30, marginBottom: 10 }}>{icon}</div>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
      <p className="dim" style={{ fontSize: 13, lineHeight: 1.65 }}>{desc}</p>
    </div>
  );
}
