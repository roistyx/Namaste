import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './HamburgerMenu.css';

const NAV_ITEMS = [
  { icon: '▦', label: 'Dashboard', path: '/'          },
  { icon: '★', label: 'Watchlist', path: '/watchlist'  },
  { icon: '◎', label: 'Markets',   path: '/markets'    },
  { icon: '◈', label: 'Positions', path: '/positions'  },
  { icon: '◉', label: 'Visuals',   path: '/visuals'    },
  { icon: '🤖', label: 'Alerts',   path: '/alerts'     },
  { icon: '▪', label: 'Terminal',  path: '/terminal'   },
  { icon: '⚙', label: 'Settings', path: '/settings'   },
];

export default function HamburgerMenu() {
  const [open, setOpen]   = useState(false);
  const navigate          = useNavigate();
  const { pathname }      = useLocation();

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function isActive(path) {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  }

  return (
    <>
      <button className="hamburger-btn" onClick={() => setOpen(true)} aria-label="Open menu">
        <span /><span /><span />
      </button>

      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <nav className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-logo">
            <span className="sidebar-logo-accent">Market</span> Pulse
          </span>
          <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu">✕</button>
        </div>

        <ul className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <button
                className={`sidebar-nav-item ${isActive(item.path) ? 'sidebar-nav-item--active' : ''}`}
                onClick={() => { navigate(item.path); setOpen(false); }}
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
