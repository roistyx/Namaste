import { useState } from 'react';
import { getWeeklyData } from '../api/stocks';
import PetriDish from './PetriDish';
import './StockCard.css';

const SENTIMENT_CONFIG = {
  Bullish: { color: '#00c896', icon: '▲', bg: 'rgba(0,200,150,0.08)' },
  Bearish: { color: '#ff4d6d', icon: '▼', bg: 'rgba(255,77,109,0.08)' },
  Neutral: { color: '#a0a8c0', icon: '◆', bg: 'rgba(160,168,192,0.08)' },
};

function ScoreBar({ score }) {
  const pct = Math.min(Math.abs(score) / 0.5, 1) * 100;
  const positive = score >= 0;
  return (
    <div className="score-bar-track">
      <div
        className="score-bar-fill"
        style={{
          width: `${pct}%`,
          background: positive ? '#00c896' : '#ff4d6d',
          marginLeft: positive ? '50%' : `${50 - pct}%`,
        }}
      />
      <div className="score-bar-center" />
    </div>
  );
}

export default function StockCard({ stock, sentiment, index, loading }) {
  const changePositive = parseFloat(stock.change_percentage) >= 0;
  const cfg = sentiment ? SENTIMENT_CONFIG[sentiment.label] : SENTIMENT_CONFIG.Neutral;

  const [expanded, setExpanded] = useState(false);
  const [weekData, setWeekData] = useState(null);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekError, setWeekError] = useState(null);

  async function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && !weekData && !weekLoading) {
      setWeekLoading(true);
      setWeekError(null);
      try {
        const d = await getWeeklyData(stock.ticker);
        setWeekData(d);
      } catch (e) {
        setWeekError(e.message);
      } finally {
        setWeekLoading(false);
      }
    }
  }

  return (
    <div className="stock-card-outer" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="stock-card">
        <div className="card-rank">#{index + 1}</div>

        <div className="card-identity">
          <span className="ticker">{stock.ticker}</span>
          <span className="card-volume">
            Vol: {Number(stock.volume).toLocaleString()}
          </span>
        </div>

        <div className="card-price">
          <span className="price">${parseFloat(stock.price).toFixed(2)}</span>
          <span className={`change ${changePositive ? 'pos' : 'neg'}`}>
            {changePositive ? '▲' : '▼'} {Math.abs(parseFloat(stock.change_percentage)).toFixed(2)}%
          </span>
        </div>

        <div className="card-sentiment" style={{ background: cfg.bg }}>
          {loading ? (
            <div className="sentiment-loading">
              <span className="spinner" />
              <span className="sentiment-label-text">Analysing…</span>
            </div>
          ) : sentiment ? (
            <>
              <span className="sentiment-icon" style={{ color: cfg.color }}>{cfg.icon}</span>
              <span className="sentiment-label-text" style={{ color: cfg.color }}>
                {sentiment.label}
              </span>
              <span className="sentiment-score" style={{ color: cfg.color }}>
                {sentiment.score > 0 ? '+' : ''}{sentiment.score}
              </span>
              <div className="sentiment-meta">
                <ScoreBar score={sentiment.score} />
                <span className="articles-count">{sentiment.articles} articles</span>
              </div>
            </>
          ) : (
            <span className="sentiment-na">No data</span>
          )}
        </div>

        <button
          className={`expand-btn ${expanded ? 'open' : ''}`}
          onClick={handleExpand}
          aria-label={expanded ? 'Collapse weekly view' : 'Expand weekly view'}
          title="Weekly culture"
        >
          ⌄
        </button>
      </div>

      {expanded && (
        <div className="petri-panel">
          <div className="petri-panel-label">5-day culture — {stock.ticker}</div>
          <PetriDish
            data={weekData}
            loading={weekLoading}
            error={weekError}
            ticker={stock.ticker}
          />
        </div>
      )}
    </div>
  );
}
