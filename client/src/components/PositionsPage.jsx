import { useState, useEffect } from 'react';
import { getPositions } from '../api/positions';
import './PositionsPage.css';

const EQUITY_COLORS = {
  STOCK:        '#818cf8',
  BONDS:        '#06b6d4',
  CRYPTO:       '#f59e0b',
  CASH:         '#4a5080',
  JIKO_ACCOUNT: '#10b981',
};

const TYPE_LABELS = {
  EQUITY: 'Stock',
  BOND:   'Bond',
  CRYPTO: 'Crypto',
  OPTION: 'Option',
};

const ACCOUNT_LABELS = {
  TRADITIONAL_IRA: 'Traditional IRA',
  BROKERAGE:       'Brokerage',
  BOND_ACCOUNT:    'Bond Account',
  TREASURY:        'Treasury',
  HIGH_YIELD:      'High Yield',
  ROTH_IRA:        'Roth IRA',
};

const COLUMNS = [
  { key: 'symbol',  label: 'Symbol',    cls: '',             get: (p) => p.instrument.symbol },
  { key: 'name',    label: 'Name',      cls: 'pos-name-col', get: (p) => p.instrument.name },
  { key: 'qty',     label: 'Qty',       cls: 'num',          get: (p) => parseFloat(p.quantity) },
  { key: 'price',   label: 'Price',     cls: 'num',          get: (p) => parseFloat(p.lastPrice?.lastPrice || 0) },
  { key: 'value',   label: 'Value',     cls: 'num',          get: (p) => parseFloat(p.currentValue) },
  { key: 'dailyPL', label: 'Daily P/L', cls: 'num',          get: (p) => parseFloat(p.positionDailyGain?.gainPercentage || 0) },
  { key: 'totalPL', label: 'Total P/L', cls: 'num',          get: (p) => parseFloat(p.costBasis?.gainPercentage || 0) },
];

function fmt(n, decimals = 2) {
  return parseFloat(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function GainCell({ value, pct }) {
  const v = parseFloat(value || 0);
  const p = parseFloat(pct || 0);
  const pos = v >= 0;
  return (
    <span className={`gain-cell ${pos ? 'pos' : 'neg'}`}>
      <span className="gain-dollar">{pos ? '+' : '−'}${Math.abs(v).toFixed(2)}</span>
      <span className="gain-pct">{pos ? '+' : ''}{p.toFixed(2)}%</span>
    </span>
  );
}

function EquityBar({ equity }) {
  return (
    <div className="equity-bar">
      {equity.map((e) => (
        <div
          key={e.type}
          className="equity-segment"
          style={{
            width: `${e.percentageOfPortfolio}%`,
            background: EQUITY_COLORS[e.type] || '#4a5080',
          }}
          title={`${e.type}: $${e.value} (${e.percentageOfPortfolio}%)`}
        />
      ))}
    </div>
  );
}

function SortIcon({ active, dir }) {
  if (!active) return <span className="sort-icon sort-idle">⇅</span>;
  return <span className="sort-icon sort-active">{dir === 'asc' ? '▲' : '▼'}</span>;
}

function AccountSection({ acct }) {
  const [sortKey, setSortKey] = useState('value');
  const [sortDir, setSortDir] = useState('desc');

  const p = acct.portfolio;
  const positions = p?.positions ?? [];
  if (!positions.length) return null;

  const total = (p.equity ?? []).reduce((s, e) => s + parseFloat(e.value || 0), 0);
  const bp = parseFloat(p.buyingPower?.buyingPower || 0);

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const col = COLUMNS.find((c) => c.key === sortKey);
  const sorted = [...positions].sort((a, b) => {
    const av = col.get(a);
    const bv = col.get(b);
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="account-section">
      <div className="account-header">
        <div className="account-title-group">
          <span className="account-type-label">
            {ACCOUNT_LABELS[acct.accountType] ?? acct.accountType}
          </span>
          <span className="account-id">{acct.accountId}</span>
        </div>
        <div className="account-figures">
          <span className="account-total">${fmt(total)}</span>
          <span className="account-bp">Cash available ${fmt(bp)}</span>
        </div>
      </div>

      <EquityBar equity={p.equity ?? []} />
      <div className="equity-legend">
        {(p.equity ?? []).map((e) => (
          <span key={e.type} className="equity-pill">
            <span className="pill-dot" style={{ background: EQUITY_COLORS[e.type] || '#4a5080' }} />
            {e.type.replace(/_/g, ' ')}
            <span className="pill-pct">{parseFloat(e.percentageOfPortfolio).toFixed(1)}%</span>
          </span>
        ))}
      </div>

      <div className="pos-table-wrap">
        <div className="pos-table">
          {/* Sortable header */}
          <div className="pos-row pos-header">
            {COLUMNS.map((c) => (
              <button
                key={c.key}
                className={`col-header ${c.cls} ${sortKey === c.key ? 'col-header--active' : ''}`}
                onClick={() => handleSort(c.key)}
              >
                {c.label}
                <SortIcon active={sortKey === c.key} dir={sortDir} />
              </button>
            ))}
          </div>

          {sorted.map((pos) => {
            const inst = pos.instrument;
            const typeColor = EQUITY_COLORS[
              inst.type === 'EQUITY' ? 'STOCK' :
              inst.type === 'CRYPTO' ? 'CRYPTO' : 'BONDS'
            ];
            return (
              <div key={`${inst.symbol}-${pos.openedAt}`} className="pos-row">
                <div className="pos-symbol-cell">
                  <span className="pos-symbol">{inst.symbol}</span>
                  <span className="pos-type-badge" style={{ color: typeColor, borderColor: typeColor }}>
                    {TYPE_LABELS[inst.type] ?? inst.type}
                  </span>
                </div>
                <span className="pos-name-col pos-name">{inst.name}</span>
                <span className="num pos-qty">{parseFloat(pos.quantity).toFixed(4)}</span>
                <span className="num">${fmt(pos.lastPrice?.lastPrice)}</span>
                <span className="num pos-value">${fmt(pos.currentValue)}</span>
                <span className="num">
                  {pos.positionDailyGain
                    ? <GainCell value={pos.positionDailyGain.gainValue} pct={pos.positionDailyGain.gainPercentage} />
                    : <span className="na">—</span>}
                </span>
                <span className="num">
                  {pos.costBasis
                    ? <GainCell value={pos.costBasis.gainValue} pct={pos.costBasis.gainPercentage} />
                    : <span className="na">—</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PositionsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getPositions()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="pos-loading">
        <div className="pulse-ring" />
        <span>Loading portfolio…</span>
      </div>
    );
  }

  if (error) {
    return <div className="pos-error">{error}</div>;
  }

  const accounts = data?.accounts ?? [];
  const active = accounts.filter((a) => (a.portfolio?.positions?.length ?? 0) > 0);
  const totalValue = accounts.reduce(
    (s, a) => s + (a.portfolio?.equity ?? []).reduce((es, e) => es + parseFloat(e.value || 0), 0),
    0,
  );
  const totalHoldings = accounts.reduce((s, a) => s + (a.portfolio?.positions?.length ?? 0), 0);

  return (
    <div className="positions-page">
      <div className="pos-page-header">
        <h1 className="pos-page-title">Positions</h1>
        <div className="pos-page-meta">
          <span className="pos-page-total">${fmt(totalValue)}</span>
          <span className="pos-page-count">
            {totalHoldings} holdings · {active.length} accounts
          </span>
        </div>
      </div>

      <div className="pos-page-body">
        {active.map((acct) => (
          <AccountSection key={acct.accountId} acct={acct} />
        ))}
      </div>
    </div>
  );
}
