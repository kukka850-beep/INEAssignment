import { Routes, Route, Link, NavLink, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import AddProduct from './pages/AddProduct.jsx';
import { api } from './api.js';

function TopBar() {
  const location = useLocation();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        {/* Logo */}
        <Link to="/" className="topbar-logo" id="nav-logo">
          <span className="topbar-logo-icon">⬡</span>
          <span className="topbar-logo-name">PriceWatch</span>
        </Link>

        {/* Nav links */}
        <nav className="topbar-nav">
          <NavLink
            to="/"
            end
            id="nav-home"
            className={({ isActive }) => 'topbar-link' + (isActive ? ' topbar-link-active' : '')}
          >
            Home
          </NavLink>
          <NavLink
            to="/dashboard"
            id="nav-dashboard"
            className={({ isActive }) => 'topbar-link' + (isActive ? ' topbar-link-active' : '')}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/add"
            id="nav-add"
            className={({ isActive }) => 'topbar-link' + (isActive ? ' topbar-link-active' : '')}
          >
            Add product
          </NavLink>
        </nav>

        {/* Actions */}
        <div className="topbar-actions">
          <a href={api.exportCsvUrl()} className="btn btn-ghost mono" id="nav-export" style={{ fontSize: 13 }}>
            Export CSV ↓
          </a>
          <Link to="/add" className="btn btn-primary" id="nav-track" style={{ fontSize: 13, padding: '8px 18px' }}>
            + Track
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/add" element={<AddProduct />} />
          <Route path="/product/:id" element={<ProductDetail />} />
        </Routes>
      </main>
      <footer className="footer">
        <span className="dim" style={{ fontSize: 12 }}>
          PriceWatch · INE Assignment · tracks prices every 2h
        </span>
      </footer>
    </div>
  );
}
