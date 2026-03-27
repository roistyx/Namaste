import { useState } from 'react';
import { getMostActive, getSentiment } from './api/stocks';
import StockCard from './components/StockCard';
import HamburgerMenu from './components/HamburgerMenu';
import ThemeToggle from './components/ThemeToggle';
import PositionsPage from './components/PositionsPage';
import './App.css';

function Dashboard() {
  const [stocks, setStocks] = useState([]);
  const [sentiments, setSentiments] = useState({});
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [loadingSentiment, setLoadingSentiment] = useState({});
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);

  async function handleFetch() {
    setError('');
    setLoadingStocks(true);
    setStocks([]);
    setSentiments({});
    setStarted(true);

    let active;
    try {
      active = await getMostActive();
    } catch (e) {
      setError(e.message);
      setLoadingStocks(false);
      return;
    }

    setLoadingStocks(false);
    setStocks(active);

    for (const stock of active) {
      setLoadingSentiment((prev) => ({ ...prev, [stock.ticker]: true }));
      try {
        const s = await getSentiment(stock.ticker);
        setSentiments((prev) => ({ ...prev, [stock.ticker]: s }));
      } catch {
        setSentiments((prev) => ({ ...prev, [stock.ticker]: null }));
      }
      setLoadingSentiment((prev) => ({ ...prev, [stock.ticker]: false }));
      // Finnhub free tier: 60 req/min
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="header-glow" />
        <h1 className="app-title">
          <span className="title-accent">Market</span> Pulse
        </h1>
        <p className="app-subtitle">
          Top 10 most active NYSE &amp; Nasdaq stocks with live sentiment analysis
        </p>
      </header>

      <div className="api-form">
        <button
          className="fetch-btn"
          onClick={handleFetch}
          disabled={loadingStocks}
        >
          {loadingStocks ? <span className="btn-spinner" /> : 'Analyse'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {loadingStocks && (
        <div className="loading-stocks">
          <div className="pulse-ring" />
          <span>Fetching most active stocks…</span>
        </div>
      )}

      {stocks.length > 0 && (
        <div className="stocks-section">
          <div className="section-header">
            <span className="live-dot" />
            <span className="section-title">
              Most Active —{' '}
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
          <div className="column-labels">
            <span>#</span>
            <span>Ticker / Volume</span>
            <span>Price / Change</span>
            <span>Sentiment</span>
            <span />
          </div>
          <div className="stocks-list">
            {stocks.map((stock, i) => (
              <StockCard
                key={stock.ticker}
                stock={stock}
                sentiment={sentiments[stock.ticker]}
                loading={loadingSentiment[stock.ticker]}
                index={i}
              />
            ))}
          </div>
          {Object.keys(sentiments).length < stocks.length && (
            <p className="rate-note">
              Fetching sentiment ~1 ticker / 1s…
            </p>
          )}
        </div>
      )}

      {started && !loadingStocks && stocks.length === 0 && !error && (
        <p className="empty-state">No data returned. Markets may be closed or key is invalid.</p>
      )}
    </>
  );
}

export default function App() {
  const [page, setPage] = useState('Dashboard');

  return (
    <div className="app">
      <HamburgerMenu active={page} onNavigate={setPage} />
      <ThemeToggle />
      {page === 'Positions' ? <PositionsPage /> : <Dashboard />}
    </div>
  );
}
