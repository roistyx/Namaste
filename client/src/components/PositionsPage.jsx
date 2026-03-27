import { useState, useEffect } from 'react';
import { getPositions } from '../api/positions';
import { getSchwabStatus, getSchwabPositions } from '../api/schwab';
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

function LoadingState() {
  return (
    <div className="pos-loading">
      <div className="pulse-ring" />
      <span>Loading portfolio…</span>
    </div>
  );
}

function ErrorState({ msg }) {
  return <div className="pos-error">{msg}</div>;
}

function SchwabConnectPrompt({ configured }) {
  if (!configured) {
    return (
      <div className="connect-prompt">
        <div className="connect-icon">&#128279;</div>
        <h3 className="connect-title">Schwab not configured</h3>
        <p className="connect-body">
          Add <code>SCHWAB_CLIENT_ID</code> and <code>SCHWAB_CLIENT_SECRET</code> to{' '}
          <code>server/.env</code> to connect your Schwab account.
        </p>
      </div>
    );
  }

  return (
    <div className="connect-prompt">
      <div className="connect-icon">&#128275;</div>
      <h3 className="connect-title">Connect your Schwab account</h3>
      <p className="connect-body">
        Authorize Namaste to view your Schwab positions.
      </p>
      <a href="/api/schwab/auth" className="connect-btn">
        Connect Schwab
      </a>
    </div>
  );
}

function institutionTotals(data) {
  if (!data) return { totalValue: 0, totalHoldings: 0, activeAccounts: 0 };
  const accounts = data.accounts ?? [];
  const active = accounts.filter((a) => (a.portfolio?.positions?.length ?? 0) > 0);
  const totalValue = accounts.reduce(
    (s, a) => s + (a.portfolio?.equity ?? []).reduce((es, e) => es + parseFloat(e.value || 0), 0),
    0,
  );
  const totalHoldings = accounts.reduce((s, a) => s + (a.portfolio?.positions?.length ?? 0), 0);
  return { totalValue, totalHoldings, activeAccounts: active.length };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PositionsPage() {
  const [activeTab, setActiveTab] = useState('public');

  const [publicData,    setPublicData]    = useState(null);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError,   setPublicError]   = useState('');

  const [schwabData,    setSchwabData]    = useState(null);
  const [schwabLoading, setSchwabLoading] = useState(true);
  const [schwabError,   setSchwabError]   = useState('');
  const [schwabStatus,  setSchwabStatus]  = useState({ authorized: false, configured: false });

  useEffect(() => {
    getPositions()
      .then(setPublicData)
      .catch((e) => setPublicError(e.message))
      .finally(() => setPublicLoading(false));

    getSchwabStatus()
      .then((status) => {
        setSchwabStatus(status);
        if (status.authorized) {
          return getSchwabPositions()
            .then(setSchwabData)
            .catch((e) => setSchwabError(e.message))
            .finally(() => setSchwabLoading(false));
        }
        setSchwabLoading(false);
      })
      .catch(() => setSchwabLoading(false));
  }, []);

  // After OAuth redirect back with ?schwab=connected
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('schwab') === 'connected') {
      window.history.replaceState({}, '', window.location.pathname);
      setActiveTab('schwab');
      setSchwabStatus((s) => ({ ...s, authorized: true }));
      setSchwabLoading(true);
      getSchwabPositions()
        .then(setSchwabData)
        .catch((e) => setSchwabError(e.message))
        .finally(() => setSchwabLoading(false));
    }
  }, []);

  const publicTotals  = institutionTotals(publicData);
  const schwabTotals  = institutionTotals(schwabData);
  const currentTotals = activeTab === 'public' ? publicTotals : schwabTotals;

  function renderContent() {
    if (activeTab === 'public') {
      if (publicLoading) return <LoadingState />;
      if (publicError)   return <ErrorState msg={publicError} />;
      const accounts = (publicData?.accounts ?? []).filter((a) => (a.portfolio?.positions?.length ?? 0) > 0);
      return (
        <div className="pos-page-body">
          {accounts.map((a) => <AccountSection key={a.accountId} acct={a} />)}
        </div>
      );
    }

    if (!schwabStatus.configured || !schwabStatus.authorized) {
      return <SchwabConnectPrompt configured={schwabStatus.configured} />;
    }
    if (schwabLoading) return <LoadingState />;
    if (schwabError)   return <ErrorState msg={schwabError} />;
    const accounts = (schwabData?.accounts ?? []).filter((a) => (a.portfolio?.positions?.length ?? 0) > 0);
    return (
      <div className="pos-page-body">
        {accounts.map((a) => <AccountSection key={a.accountId} acct={a} />)}
      </div>
    );
  }

  return (
    <div className="positions-page">
      <div className="pos-page-header">
        <h1 className="pos-page-title">Positions</h1>
        <div className="pos-page-meta">
          <span className="pos-page-total">${fmt(currentTotals.totalValue)}</span>
          <span className="pos-page-count">
            {currentTotals.totalHoldings} holdings · {currentTotals.activeAccounts} accounts
          </span>
        </div>
      </div>

      <div className="institution-tabs">
        <button
          className={`inst-tab ${activeTab === 'public' ? 'inst-tab--active' : ''}`}
          onClick={() => setActiveTab('public')}
        >
          Public.com
          {!publicLoading && (
            <span className="inst-tab-count">{publicTotals.activeAccounts}</span>
          )}
        </button>
        <button
          className={`inst-tab ${activeTab === 'schwab' ? 'inst-tab--active' : ''}`}
          onClick={() => setActiveTab('schwab')}
        >
          Schwab
          {!schwabLoading && schwabStatus.authorized
            ? <span className="inst-tab-count">{schwabTotals.activeAccounts}</span>
            : <span className="inst-tab-badge">Connect</span>
          }
        </button>
      </div>

      {renderContent()}
    </div>
  );
}
