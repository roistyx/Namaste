import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortfolio, addHolding } from '../api/portfolios.js';
import './TerminalPage.css';

const ASSET_CLASSES = ['EQUITY', 'FIXED INCOME', 'MULTI-ASSET', 'COMMODITY', 'CRYPTO'];
const CURRENCIES    = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];


function IdleScreen() {
  return (
    <div className="trm-idle">
      <div className="trm-idle-title">NAMASTE TERMINAL  v1.0</div>
      <div className="trm-idle-subtitle">Type a command and press &lt;GO&gt;</div>
      <div className="trm-idle-cmds">
        <div className="trm-idle-cmd-row">
          <span className="trm-cmd-name">PRTU</span>
          <span className="trm-cmd-desc">Portfolio &amp; Risk Analytics — Create &amp; Manage Portfolios</span>
        </div>
      </div>
    </div>
  );
}

function PrtuCreateScreen({ form, setForm, onSubmit, error, loading }) {
  const nameRef = useRef();
  useEffect(() => { nameRef.current?.focus(); }, []);

  function handleKey(e) {
    if (e.key === 'Enter') onSubmit();
  }

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

function PrtuHoldingsScreen({ portfolio, holdings, onAddHolding, error, loading }) {
  const [row, setRow] = useState({ ticker: '', quantity: '', costBasis: '' });
  const tickerRef = useRef();

  useEffect(() => { tickerRef.current?.focus(); }, []);

  function handleRowKey(e) {
    if (e.key === 'Enter') submit();
  }

  function submit() {
    if (!row.ticker || !row.quantity || !row.costBasis) return;
    onAddHolding(row.ticker, row.quantity, row.costBasis);
    setRow({ ticker: '', quantity: '', costBasis: '' });
    tickerRef.current?.focus();
  }

  function fmtDate(d) {
    const date = new Date(d);
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

export default function TerminalPage() {
  const [terminalState, setTerminalState] = useState('IDLE');
  const [cmdInput, setCmdInput] = useState('');
  const [form, setForm] = useState({ name: '', assetClass: 'EQUITY', baseCurrency: 'USD' });
  const [portfolio, setPortfolio] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const cmdRef = useRef();

  // ESC resets to IDLE from any screen
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

  const handleGo = useCallback(async () => {
    setError('');

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
  }, [terminalState, cmdInput, form]);

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

  function handleCmdKey(e) {
    if (e.key === 'Enter') handleGo();
  }

  return (
    <div className="trm-root">
      <div className="trm-screen">
        {terminalState === 'IDLE' && <IdleScreen />}
        {terminalState === 'PRTU_CREATE' && (
          <PrtuCreateScreen
            form={form}
            setForm={setForm}
            onSubmit={handleGo}
            error={error}
            loading={loading}
          />
        )}
        {terminalState === 'PRTU_HOLDINGS' && portfolio && (
          <PrtuHoldingsScreen
            portfolio={portfolio}
            holdings={holdings}
            onAddHolding={handleAddHolding}
            error={error}
            loading={loading}
          />
        )}
      </div>

      <div className="trm-divider" />

      <div className="trm-cmdbar">
        <span className="trm-prompt">&gt;</span>
        <input
          ref={cmdRef}
          className="trm-cmd-input"
          value={cmdInput}
          onChange={e => setCmdInput(e.target.value.toUpperCase())}
          onKeyDown={handleCmdKey}
          placeholder={terminalState === 'IDLE' ? 'ENTER COMMAND...' : ''}
          disabled={terminalState !== 'IDLE'}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="trm-go-btn trm-go-main" onClick={handleGo}>
          &lt;GO&gt;
        </button>
      </div>

      <div className="trm-fnkeys">
        <span>F1 HELP</span>
        <span>F2 NEWS</span>
        <span>F4 MSG</span>
        <span className="trm-fn-active">F8 PRTU</span>
        <span>ESC BACK</span>
      </div>
    </div>
  );
}
