import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortfolio, addHolding } from '../api/portfolios.js';
import { getStockProfile, getStockFundamentals } from '../api/stocks.js';
import './TerminalPage.css';

const ASSET_CLASSES = ['EQUITY', 'FIXED INCOME', 'MULTI-ASSET', 'COMMODITY', 'CRYPTO'];
const CURRENCIES    = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];

// ─── Idle ────────────────────────────────────────────────────────────────────

function IdleScreen() {
  return (
    <div className="trm-idle">
      <div className="trm-idle-title">NAMASTE TERMINAL  v1.0</div>
      <div className="trm-idle-subtitle">
        Type a command and press &lt;GO&gt;, or type a ticker and press &lt;EQUITY&gt;
      </div>
      <div className="trm-idle-cmds">
        <div className="trm-idle-cmd-row">
          <span className="trm-cmd-name">PRTU</span>
          <span className="trm-cmd-desc">Portfolio &amp; Risk Analytics — Create &amp; Manage Portfolios</span>
        </div>
        <div className="trm-idle-cmd-row">
          <span className="trm-cmd-name">
            TICKER <span className="trm-eq-inline">EQUITY</span>
          </span>
          <span className="trm-cmd-desc">Security Analysis — DES · FA</span>
        </div>
      </div>
    </div>
  );
}

// ─── PRTU: Create ────────────────────────────────────────────────────────────

function PrtuCreateScreen({ form, setForm, onSubmit, error, loading }) {
  const nameRef = useRef();
  useEffect(() => { nameRef.current?.focus(); }, []);

  function handleKey(e) { if (e.key === 'Enter') onSubmit(); }

  return (
    <div className="trm-panel">
      <div className="trm-panel-breadcrumb">PRTU &gt; PORTFOLIO CREATE</div>
      <div className="trm-panel-title">CREATE NEW PORTFOLIO</div>

      <div className="trm-form">
        <div className="trm-form-row">
          <label className="trm-label">NAME</label>
          <input
            ref={nameRef}
            className="trm-field"
            value={form.name}
            maxLength={50}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={handleKey}
            placeholder="e.g. MY GROWTH PORTFOLIO"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="trm-form-row">
          <label className="trm-label">ASSET CLASS</label>
          <select
            className="trm-field trm-select"
            value={form.assetClass}
            onChange={e => setForm(f => ({ ...f, assetClass: e.target.value }))}
          >
            {ASSET_CLASSES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="trm-form-row">
          <label className="trm-label">BASE CURRENCY</label>
          <select
            className="trm-field trm-select"
            value={form.baseCurrency}
            onChange={e => setForm(f => ({ ...f, baseCurrency: e.target.value }))}
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="trm-error">{error}</div>}

      <div className="trm-form-actions">
        <button className="trm-go-btn" onClick={onSubmit} disabled={loading}>
          {loading ? 'CREATING...' : 'CREATE  <GO>'}
        </button>
      </div>
    </div>
  );
}

// ─── PRTU: Holdings ──────────────────────────────────────────────────────────

function PrtuHoldingsScreen({ portfolio, holdings, onAddHolding, error, loading }) {
  const [row, setRow] = useState({ ticker: '', quantity: '', costBasis: '' });
  const tickerRef = useRef();

  useEffect(() => { tickerRef.current?.focus(); }, []);

  function handleRowKey(e) { if (e.key === 'Enter') submit(); }

  function submit() {
    if (!row.ticker || !row.quantity || !row.costBasis) return;
    onAddHolding(row.ticker, row.quantity, row.costBasis);
    setRow({ ticker: '', quantity: '', costBasis: '' });
    tickerRef.current?.focus();
  }

  function fmtDate(d) {
    const date  = new Date(d);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'TODAY';
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();
  }

  return (
    <div className="trm-panel">
      <div className="trm-panel-breadcrumb">
        PRTU &gt; {portfolio.name.toUpperCase()} &nbsp;
        <span className="trm-tag">{portfolio.assetClass}</span>
        <span className="trm-tag">{portfolio.baseCurrency}</span>
      </div>
      <div className="trm-panel-title">HOLDINGS</div>

      <table className="trm-table">
        <thead>
          <tr>
            <th>#</th>
            <th>TICKER</th>
            <th className="trm-num">QUANTITY</th>
            <th className="trm-num">COST BASIS</th>
            <th>ADDED</th>
          </tr>
        </thead>
        <tbody>
          {holdings.length === 0 && (
            <tr><td colSpan={5} className="trm-empty">NO HOLDINGS — ADD BELOW</td></tr>
          )}
          {holdings.map((h, i) => (
            <tr key={i}>
              <td className="trm-dim">{i + 1}</td>
              <td className="trm-ticker">{h.ticker}</td>
              <td className="trm-num">{Number(h.quantity).toLocaleString()}</td>
              <td className="trm-num">{Number(h.costBasis).toFixed(2)}</td>
              <td className="trm-dim">{fmtDate(h.addedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="trm-add-row">
        <span className="trm-add-arrow">&gt;</span>
        <input
          ref={tickerRef}
          className="trm-field trm-add-field trm-field-ticker"
          placeholder="TICKER"
          value={row.ticker}
          maxLength={10}
          onChange={e => setRow(r => ({ ...r, ticker: e.target.value.toUpperCase() }))}
          onKeyDown={handleRowKey}
        />
        <input
          className="trm-field trm-add-field trm-field-num"
          placeholder="QTY"
          value={row.quantity}
          type="number"
          min="0"
          onChange={e => setRow(r => ({ ...r, quantity: e.target.value }))}
          onKeyDown={handleRowKey}
        />
        <input
          className="trm-field trm-add-field trm-field-num"
          placeholder="COST"
          value={row.costBasis}
          type="number"
          min="0"
          step="0.01"
          onChange={e => setRow(r => ({ ...r, costBasis: e.target.value }))}
          onKeyDown={handleRowKey}
        />
        <button className="trm-add-btn" onClick={submit} disabled={loading}>
          {loading ? '...' : 'ADD'}
        </button>
      </div>

      {error && <div className="trm-error">{error}</div>}
    </div>
  );
}

// ─── EQ: Description ────────────────────────────────────────────────────────

function EqDesScreen({ ticker, data, loading, error }) {
  if (loading) return <div className="trm-loading">LOADING {ticker} EQUITY...</div>;
  if (error)   return <div className="trm-loading trm-error">{error}</div>;
  if (!data)   return null;

  const { profile, quote } = data;
  const isPos = (quote.dp ?? 0) >= 0;

  function fmt(n, d = 2) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toFixed(d);
  }
  function fmtCap(n) {
    // Finnhub marketCapitalization is in millions USD
    if (n == null || isNaN(n)) return '—';
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}T`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}B`;
    return `$${n.toFixed(0)}M`;
  }

  const rows = [
    ['EXCHANGE',    profile.exchange   || '—'],
    ['SECTOR',      profile.finnhubIndustry || '—'],
    ['COUNTRY',     profile.country    || '—'],
    ['CURRENCY',    profile.currency   || '—'],
    ['IPO DATE',    profile.ipo        || '—'],
    ['EMPLOYEES',   profile.employeeTotal ? Number(profile.employeeTotal).toLocaleString() : '—'],
    ['MKT CAP',     fmtCap(profile.marketCapitalization)],
    ['OPEN',        fmt(quote.o)],
    ['PREV CLOSE',  fmt(quote.pc)],
    ['DAY HIGH',    fmt(quote.h)],
    ['DAY LOW',     fmt(quote.l)],
  ];

  return (
    <div className="trm-panel">
      <div className="trm-panel-breadcrumb">
        {ticker} <span className="trm-eq-tag">EQUITY</span> &gt; DES
      </div>

      <div className="trm-eq-header">
        <div>
          <div className="trm-eq-name">{profile.name}</div>
          <div className="trm-eq-meta">{profile.exchange} &nbsp;·&nbsp; {profile.currency}</div>
        </div>
        <div className="trm-eq-price-block">
          <div className="trm-eq-price">{fmt(quote.c)}</div>
          <div className={isPos ? 'trm-pos' : 'trm-neg'}>
            {isPos ? '+' : ''}{fmt(quote.d)} &nbsp; ({isPos ? '+' : ''}{fmt(quote.dp)}%)
          </div>
        </div>
      </div>

      <div className="trm-eq-grid">
        {rows.map(([k, v]) => (
          <div key={k} className="trm-eq-kv">
            <span className="trm-eq-k">{k}</span>
            <span className="trm-eq-v">{v}</span>
          </div>
        ))}
        {profile.weburl && (
          <div className="trm-eq-kv trm-eq-kv-full">
            <span className="trm-eq-k">WEBSITE</span>
            <span className="trm-eq-v trm-eq-url">{profile.weburl}</span>
          </div>
        )}
      </div>

      <div className="trm-eq-fn-hint">
        TYPE <strong>FA</strong> + &lt;GO&gt; FOR FINANCIAL ANALYSIS
      </div>
    </div>
  );
}

// ─── EQ: Financial Analysis ──────────────────────────────────────────────────

function EqFaScreen({ ticker, profileData, data, loading, error }) {
  if (loading) return <div className="trm-loading">LOADING {ticker} FA...</div>;
  if (error)   return <div className="trm-loading trm-error">{error}</div>;
  if (!data)   return null;

  const m = data.metric || {};

  function fmt(n, d = 2, suffix = '') {
    if (n == null || isNaN(n)) return '—';
    return `${Number(n).toFixed(d)}${suffix}`;
  }

  // Volume fields from Finnhub are in millions of shares
  function fmtVol(n) {
    if (n == null || isNaN(n)) return '—';
    return `${Number(n).toFixed(2)}M`;
  }

  const quote = profileData?.quote;
  const isPos = (quote?.dp ?? 0) >= 0;

  const metrics = [
    ['52W HIGH',      fmt(m['52WeekHigh'])],
    ['52W LOW',       fmt(m['52WeekLow'])],
    ['BETA',          fmt(m.beta, 3)],
    ['P/E (TTM)',     fmt(m.peTTM)],
    ['EPS (TTM)',     fmt(m.epsTTM)],
    ['DIV YIELD',     fmt(m.dividendYieldIndicatedAnnual, 2, '%')],
    ['REV / SH',      fmt(m.revenuePerShareTTM)],
    ['GROSS MARGIN',  fmt(m.grossMarginTTM, 1, '%')],
    ['NET MARGIN',    fmt(m.netProfitMarginTTM, 1, '%')],
    ['ROE',           fmt(m.roeTTM, 1, '%')],
    ['CURRENT RATIO', fmt(m.currentRatioAnnual)],
    ['DEBT / EQUITY', fmt(m.totalDebtToEquityAnnual)],
    ['10D AVG VOL',   fmtVol(m['10DayAverageTradingVolume'])],
    ['3M AVG VOL',    fmtVol(m['3MonthAverageTradingVolume'])],
  ];

  return (
    <div className="trm-panel">
      <div className="trm-panel-breadcrumb">
        {ticker} <span className="trm-eq-tag">EQUITY</span> &gt; FA
      </div>

      {quote && (
        <div className="trm-eq-fa-header">
          <span className="trm-eq-fa-price">{Number(quote.c).toFixed(2)}</span>
          <span className={isPos ? 'trm-pos' : 'trm-neg'}>
            {isPos ? '+' : ''}{Number(quote.dp).toFixed(2)}%
          </span>
        </div>
      )}

      <div className="trm-panel-title">FINANCIAL ANALYSIS</div>

      <div className="trm-fa-grid">
        {metrics.map(([k, v]) => (
          <div key={k} className="trm-fa-row">
            <span className="trm-fa-k">{k}</span>
            <span className="trm-fa-v">{v}</span>
          </div>
        ))}
      </div>

      <div className="trm-eq-fn-hint">
        TYPE <strong>DES</strong> + &lt;GO&gt; FOR DESCRIPTION
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function TerminalPage() {
  const [terminalState, setTerminalState] = useState('IDLE');
  const [cmdInput, setCmdInput]           = useState('');
  const [error, setError]                 = useState('');
  const [loading, setLoading]             = useState(false);

  // PRTU state
  const [form, setForm]           = useState({ name: '', assetClass: 'EQUITY', baseCurrency: 'USD' });
  const [portfolio, setPortfolio] = useState(null);
  const [holdings, setHoldings]   = useState([]);

  // EQ state
  const [eqTicker,       setEqTicker]       = useState('');
  const [eqProfile,      setEqProfile]      = useState(null);   // { profile, quote }
  const [eqFundamentals, setEqFundamentals] = useState(null);
  const [eqDesLoading,   setEqDesLoading]   = useState(false);
  const [eqFaLoading,    setEqFaLoading]    = useState(false);
  const [eqDesError,     setEqDesError]     = useState('');
  const [eqFaError,      setEqFaError]      = useState('');

  const cmdRef = useRef();

  // ESC → IDLE from any screen
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        setTerminalState('IDLE');
        setError('');
        setCmdInput('');
        setTimeout(() => cmdRef.current?.focus(), 0);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Press the yellow EQUITY key
  const handleEquity = useCallback(async () => {
    const ticker = cmdInput.trim().toUpperCase();
    if (!ticker) { setError('ENTER A TICKER FIRST'); return; }
    setEqTicker(ticker);
    setEqProfile(null);
    setEqFundamentals(null);
    setEqDesError('');
    setEqFaError('');
    setCmdInput('');
    setError('');
    setTerminalState('EQ_DES');
    setEqDesLoading(true);
    try {
      const data = await getStockProfile(ticker);
      setEqProfile(data);
    } catch (err) {
      setEqDesError(err.message.toUpperCase());
    } finally {
      setEqDesLoading(false);
    }
  }, [cmdInput]);

  const handleGo = useCallback(async () => {
    setError('');

    // ── IDLE ──────────────────────────────────────────────────
    if (terminalState === 'IDLE') {
      const cmd = cmdInput.trim().toUpperCase();
      if (cmd === 'PRTU') {
        setTerminalState('PRTU_CREATE');
        setCmdInput('');
      } else if (cmd) {
        setError(`UNKNOWN COMMAND: ${cmd}`);
      }
      return;
    }

    // ── EQ screens: type a function code and GO ───────────────
    if (terminalState.startsWith('EQ_')) {
      const fn = cmdInput.trim().toUpperCase() || 'DES';
      setCmdInput('');
      if (fn === 'DES') {
        setTerminalState('EQ_DES');
      } else if (fn === 'FA') {
        setTerminalState('EQ_FA');
        if (!eqFundamentals) {
          setEqFaLoading(true);
          setEqFaError('');
          try {
            const data = await getStockFundamentals(eqTicker);
            setEqFundamentals(data);
          } catch (err) {
            setEqFaError(err.message.toUpperCase());
          } finally {
            setEqFaLoading(false);
          }
        }
      } else {
        setError(`UNKNOWN FUNCTION: ${fn}`);
      }
      return;
    }

    // ── PRTU_CREATE ───────────────────────────────────────────
    if (terminalState === 'PRTU_CREATE') {
      if (!form.name.trim()) { setError('NAME IS REQUIRED'); return; }
      setLoading(true);
      try {
        const p = await createPortfolio(form.name.trim(), form.assetClass, form.baseCurrency);
        setPortfolio(p);
        setHoldings(p.holdings || []);
        setTerminalState('PRTU_HOLDINGS');
        setForm({ name: '', assetClass: 'EQUITY', baseCurrency: 'USD' });
      } catch (err) {
        setError(err.message.toUpperCase());
      } finally {
        setLoading(false);
      }
    }
  }, [terminalState, cmdInput, form, eqFundamentals, eqTicker]);

  const handleAddHolding = useCallback(async (ticker, quantity, costBasis) => {
    setLoading(true);
    setError('');
    try {
      const holding = await addHolding(portfolio._id, ticker, quantity, costBasis);
      setHoldings(h => [...h, holding]);
    } catch (err) {
      setError(err.message.toUpperCase());
    } finally {
      setLoading(false);
    }
  }, [portfolio]);

  function handleCmdKey(e) { if (e.key === 'Enter') handleGo(); }

  const isEq   = terminalState.startsWith('EQ_');
  const isPrtu = terminalState.startsWith('PRTU_');
  const cmdDisabled = isPrtu;

  return (
    <div className="trm-root">
      <div className="trm-screen">
        {terminalState === 'IDLE' && <IdleScreen />}

        {terminalState === 'PRTU_CREATE' && (
          <PrtuCreateScreen
            form={form} setForm={setForm}
            onSubmit={handleGo} error={error} loading={loading}
          />
        )}
        {terminalState === 'PRTU_HOLDINGS' && portfolio && (
          <PrtuHoldingsScreen
            portfolio={portfolio} holdings={holdings}
            onAddHolding={handleAddHolding} error={error} loading={loading}
          />
        )}

        {terminalState === 'EQ_DES' && (
          <EqDesScreen
            ticker={eqTicker}
            data={eqProfile}
            loading={eqDesLoading}
            error={eqDesError}
          />
        )}
        {terminalState === 'EQ_FA' && (
          <EqFaScreen
            ticker={eqTicker}
            profileData={eqProfile}
            data={eqFundamentals}
            loading={eqFaLoading}
            error={eqFaError}
          />
        )}
      </div>

      <div className="trm-divider" />

      {/* ── Command bar ── */}
      <div className="trm-cmdbar">
        <span className="trm-prompt">&gt;</span>

        {isEq && (
          <span className="trm-eq-cmdtag">
            {eqTicker}&nbsp;<span className="trm-eq-inline">EQUITY</span>
          </span>
        )}

        <input
          ref={cmdRef}
          className="trm-cmd-input"
          value={cmdInput}
          onChange={e => setCmdInput(e.target.value.toUpperCase())}
          onKeyDown={handleCmdKey}
          placeholder={
            terminalState === 'IDLE' ? 'ENTER COMMAND OR TICKER...' :
            isEq                     ? 'FUNCTION  (DES · FA)' : ''
          }
          disabled={cmdDisabled}
          autoComplete="off"
          spellCheck={false}
        />

        <button
          className="trm-equity-btn"
          onClick={handleEquity}
          disabled={terminalState !== 'IDLE'}
          title="Select security (EQUITY)"
        >
          EQUITY
        </button>

        <button className="trm-go-btn trm-go-main" onClick={handleGo}>
          &lt;GO&gt;
        </button>
      </div>

      {error && !isPrtu && <div className="trm-cmdbar-error">{error}</div>}

      {/* ── Function key strip ── */}
      <div className="trm-fnkeys">
        {isEq ? (
          <>
            <span className={terminalState === 'EQ_DES' ? 'trm-fn-active' : ''}>DES  DESCRIPTION</span>
            <span className={terminalState === 'EQ_FA'  ? 'trm-fn-active' : ''}>FA  FINANCIALS</span>
            <span>ESC  BACK</span>
          </>
        ) : (
          <>
            <span>F1  HELP</span>
            <span>F2  NEWS</span>
            <span>F4  MSG</span>
            <span className={terminalState.startsWith('PRTU') ? 'trm-fn-active' : ''}>F8  PRTU</span>
            <span>ESC  BACK</span>
          </>
        )}
      </div>
    </div>
  );
}
