import { useState, useEffect } from 'react';
import './HamburgerMenu.css';

const NAV_ITEMS = [
  { icon: '▦', label: 'Dashboard' },
  { icon: '★', label: 'Watchlist' },
  { icon: '◎', label: 'Markets' },
  { icon: '◈', label: 'Positions' },
  { icon: '⚙', label: 'Settings' },
];

export default function HamburgerMenu({ active, onNavigate }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        className="hamburger-btn"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <span />
        <span />
        <span />
      </button>

      {open && (
        <div className="sidebar-overlay" onClick={() => setOpen(false)} />
      )}

      <nav className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-logo">
            <span className="sidebar-logo-accent">Market</span> Pulse
          </span>
          <button
            className="sidebar-close"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <ul className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <button
                className={`sidebar-nav-item ${active === item.label ? 'sidebar-nav-item--active' : ''}`}
                onClick={() => { onNavigate(item.label); setOpen(false); }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="sidebar-footer">
          <span className="sidebar-version">v1.0.0</span>
        </div>
      </nav>
    </>
  );
}
