import React, { useState, useEffect } from "react";
import { getPositions } from "../api/positions";
import { getSchwabStatus, getSchwabPositions, getSchwabTransactions, getSchwabAccountNumbers } from "../api/schwab";
import { getAccountNames, saveAccountName } from "../api/accounts";
import { getFidelityPositions, uploadFidelityCSV } from "../api/fidelity";
import { getApexPositions, getApexStatus, saveApexCookie, clearApexSessions } from "../api/apex";
import "./PositionsPage.css";

const EQUITY_COLORS = {
  STOCK:       "#818cf8", // indigo
  ETF:         "#34d399", // emerald
  MUTUAL_FUND: "#f472b6", // pink
  BOND:        "#38bdf8", // sky blue
  BONDS:       "#38bdf8", // sky blue (equity-bar key)
  CRYPTO:      "#f59e0b", // amber
  OPTION:      "#fb923c", // orange
  CASH_EQ:     "#94a3b8", // slate
  CASH:        "#4a5080", // muted (equity-bar key)
  JIKO_ACCOUNT:"#10b981", // teal
};

const TYPE_LABELS = {
  STOCK: "Stock",
  ETF: "ETF",
  MUTUAL_FUND: "Fund",
  BOND: "Bond",
  CRYPTO: "Crypto",
  OPTION: "Option",
  CASH_EQ: "Cash",
};

const ACCOUNT_LABELS = {
  TRADITIONAL_IRA: "Traditional IRA",
  BROKERAGE: "Brokerage",
  BOND_ACCOUNT: "Bond Account",
  TREASURY: "Treasury",
  HIGH_YIELD: "High Yield",
  ROTH_IRA: "Roth IRA",
  ROLLOVER_IRA: "Rollover IRA",
  "403B": "403(b)",
  "401A": "401(a)",
};

const COLUMNS = [
  { key: "symbol", label: "Symbol", cls: "", get: (p) => p.instrument.symbol },
  {
    key: "name",
    label: "Name",
    cls: "pos-name-col",
    get: (p) => p.instrument.name,
  },
  { key: "qty", label: "Qty", cls: "num", get: (p) => parseFloat(p.quantity) },
  {
    key: "price",
    label: "Price",
    cls: "num",
    get: (p) => parseFloat(p.lastPrice?.lastPrice || 0),
  },
  {
    key: "value",
    label: "Value",
    cls: "num",
    get: (p) => parseFloat(p.currentValue),
  },
  {
    key: "dailyPL",
    label: "Daily P/L",
    cls: "num",
    get: (p) => parseFloat(p.positionDailyGain?.gainPercentage || 0),
  },
  {
    key: "totalPL",
    label: "Total P/L",
    cls: "num",
    get: (p) => parseFloat(p.costBasis?.gainPercentage || 0),
  },
];

function fmt(n, decimals = 2) {
  return parseFloat(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function GainCell({ value, pct }) {
  const p   = parseFloat(pct || 0);
  const pos = value != null ? parseFloat(value) >= 0 : p >= 0;
  return (
    <span className={`gain-cell ${pos ? "pos" : "neg"}`}>
      {value != null && (
        <span className="gain-dollar">
          {pos ? "+" : "−"}${Math.abs(parseFloat(value)).toFixed(2)}
        </span>
      )}
      <span className="gain-pct">
        {pos ? "+" : ""}{p.toFixed(2)}%
      </span>
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
            background: EQUITY_COLORS[e.type] || "#4a5080",
          }}
          title={`${e.type}: $${e.value} (${e.percentageOfPortfolio}%)`}
        />
      ))}
    </div>
  );
}

function matchesSearch(pos, query) {
  if (!query) return true;

  const isExact =
    (query.startsWith('"') && query.endsWith('"')) ||
    (query.startsWith("'") && query.endsWith("'"));

  const term = isExact ? query.slice(1, -1) : query;
  if (!term) return true;

  const q      = term.toLowerCase();
  const symbol = pos.instrument.symbol?.toLowerCase() ?? '';
  const name   = pos.instrument.name?.toLowerCase() ?? '';

  return isExact
    ? symbol === q || name === q
    : symbol.includes(q) || name.includes(q);
}

function SortIcon({ active, dir }) {
  if (!active) return <span className="sort-icon sort-idle">⇅</span>;
  return (
    <span className="sort-icon sort-active">{dir === "asc" ? "▲" : "▼"}</span>
  );
}

function AccountLabel({ accountId, defaultLabel, customName, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEdit() {
    setDraft(customName || defaultLabel);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== (customName || defaultLabel)) {
      onRename(trimmed);
    }
  }

  if (editing) {
    return (
      <input
        className="account-label-input"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <button className="account-label-btn" onClick={startEdit} title="Click to rename">
      {customName || defaultLabel}
      <span className="account-label-edit-icon">✎</span>
    </button>
  );
}

function SummaryRow({ positions }) {
  const totalValue = positions.reduce(
    (s, p) => s + parseFloat(p.currentValue || 0),
    0,
  );

  const withDaily = positions.filter((p) => p.positionDailyGain);
  const totalDailyVal = withDaily.reduce(
    (s, p) => s + parseFloat(p.positionDailyGain.gainValue || 0),
    0,
  );
  const totalDailyPct =
    totalValue - totalDailyVal !== 0
      ? (totalDailyVal / (totalValue - totalDailyVal)) * 100
      : 0;

  const withTotal = positions.filter((p) => p.costBasis);
  const totalPLVal = withTotal.reduce(
    (s, p) => s + parseFloat(p.costBasis.gainValue || 0),
    0,
  );
  const totalPLPct =
    totalValue - totalPLVal !== 0
      ? (totalPLVal / (totalValue - totalPLVal)) * 100
      : 0;

  function GainSummary({ val, pct }) {
    const pos = val >= 0;
    return (
      <span className={`gain-cell ${pos ? "pos" : "neg"}`}>
        <span className="gain-dollar">
          {pos ? "+" : "−"}${Math.abs(val).toFixed(2)}
        </span>
        <span className="gain-pct">
          {pos ? "+" : ""}
          {pct.toFixed(2)}%
        </span>
      </span>
    );
  }

  return (
    <div className="pos-row pos-summary-row">
      <span className="pos-summary-label">Account total</span>
      <span className="pos-name-col" />
      <span className="num" />
      <span className="num" />
      <span className="num pos-value">${fmt(totalValue)}</span>
      <span className="num">
        {withDaily.length > 0 ? (
          <GainSummary val={totalDailyVal} pct={totalDailyPct} />
        ) : (
          <span className="na">—</span>
        )}
      </span>
      <span className="num">
        {withTotal.length > 0 ? (
          <GainSummary val={totalPLVal} pct={totalPLPct} />
        ) : (
          <span className="na">—</span>
        )}
      </span>
    </div>
  );
}

function txTypeLabel(t) {
  if (t._action) return t._action;
  const raw  = t.description || "";
  const desc = raw.toUpperCase();
  const instr = t.transactionItem?.instruction ||
    t.transferItems?.find((i) => i.instruction)?.instruction;

  // Description-first: Schwab's description is always populated and reliable
  if (desc.includes("REINVEST DIVIDEND")) return "Reinvest Dividend";
  if (desc.includes("CASH DIVIDEND") || desc.includes("ORDINARY DIVIDEND")) return "Cash Dividend";
if (desc.includes("INTERNAL TRANSFER")) return "Internal Transfer";
  if (desc.includes("JOURNALED SHARES")) return "Journaled Shares";
  if (desc.includes("TRANSFER OF SECURITY") || desc.includes("TDA TRAN")) return "TDA Transfer";
  if (desc.includes("REINVEST SHARES") || desc.includes("REINVESTMENT")) return "Reinvest Shares";
  if (desc.includes("MARGIN INTEREST")) return "Margin Interest";
  if (desc.includes("WIRE")) return desc.includes("OUT") ? "Wire Out" : "Wire In";
  if (desc.includes("ACH")) return "ACH";

  // Some dividends use "Type~SYMBOL" format (e.g. "Ordinary Dividend~AGG")
  if (raw.includes("~")) {
    const label = raw.split("~")[0].trim();
    if (label) return label;
  }

  // Instruction or description keyword
  if (instr === "BUY"  || desc.includes("BOUGHT")) return "Buy";
  if (instr === "SELL" || desc.includes("SOLD"))   return "Sell";

  // For TRADE type: use positionEffect since Schwab omits instruction
  if (t.type === "TRADE") {
    const effect = t.transferItems?.find((i) => i.positionEffect)?.positionEffect
      ?? t.transactionItem?.positionEffect;
    const cost = t.transferItems?.reduce((s, i) => s + (i.cost ?? 0), 0)
      ?? t.transactionItem?.cost ?? 0;
    if (effect === "OPENING" || cost < 0) return "Buy";
    if (effect === "CLOSING" || cost > 0) return "Sell";
    return "Trade";
  }

  if (t.type === "DIVIDEND_OR_INTEREST") return t.qualifiedDividend ? "Qualified Dividend" : "Cash Dividend";
  if (t.type === "RECEIVE_AND_DELIVER")  return "Transfer";
  if (t.type === "JOURNAL")              return "Journal";
  if (t.type === "ACH_RECEIPT" || t.type === "ACH_DISBURSEMENT") return "ACH";
  if (t.type === "WIRE_IN" || t.type === "WIRE_OUT") return "Wire";

  return t.type?.replace(/_/g, " ") ?? "—";
}

function termLabel(acquiredDate) {
  const ms = Date.now() - new Date(acquiredDate).getTime();
  return ms >= 365 * 24 * 60 * 60 * 1000 ? "Long-term" : "Short-term";
}

function ExpandedDetail({ pos, accountHash, isSchwab }) {
  const [lots, setLots] = useState(null);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [lotsError, setLotsError] = useState("");

  const inst = pos.instrument;
  const qty = parseFloat(pos.quantity || 0);
  const currentValue = parseFloat(pos.currentValue || 0);
  const gainValue = parseFloat(pos.costBasis?.gainValue || 0);
  const gainPct = parseFloat(pos.costBasis?.gainPercentage || 0);
  const totalCostBasis = currentValue - gainValue;
  const avgCostBasis = qty > 0 ? totalCostBasis / qty : 0;

  useEffect(() => {
    if (!isSchwab || !accountHash) return;
    setLotsLoading(true);
    getSchwabTransactions(accountHash, inst.symbol, inst.name)
      .then((data) => {
        const txns = Array.isArray(data) ? data : [];
        // Pair same-date DIVIDEND_OR_INTEREST + TRADE with matching netAmount
        // to distinguish "Reinvest Dividend"/"Reinvest Shares" from "Cash Dividend"/"Buy"
        const divKeys = new Set();
        const tradeKeys = new Set();
        for (const t of txns) {
          const date = (t.tradeDate || t.transactionDate || "").slice(0, 10);
          const key = `${date}_${Math.abs(t.netAmount || 0).toFixed(2)}`;
          if (t.type === "DIVIDEND_OR_INTEREST") divKeys.add(key);
          else if (t.type === "TRADE") tradeKeys.add(key);
        }
        const annotated = txns.map((t) => {
          const date = (t.tradeDate || t.transactionDate || "").slice(0, 10);
          const key = `${date}_${Math.abs(t.netAmount || 0).toFixed(2)}`;
          if (t.type === "DIVIDEND_OR_INTEREST")
            return { ...t, _action: tradeKeys.has(key) ? "Reinvest Dividend" : "Cash Dividend" };
          if (t.type === "TRADE" && divKeys.has(key))
            return { ...t, _action: "Reinvest Shares" };
          return t;
        });
        setLots(annotated);
      })
      .catch((e) => setLotsError(e.message))
      .finally(() => setLotsLoading(false));
  }, [isSchwab, accountHash, inst.symbol, inst.name]);

  return (
    <div className="pos-expanded-row" style={{ gridColumn: "1 / -1" }}>
      <div className="pos-expanded-inner">
        <div className="pos-expanded-summary">
          {[
            { label: "Current value", value: `$${fmt(currentValue)}` },
            { label: "Quantity", value: qty.toFixed(4) },
            { label: "Avg cost basis", value: avgCostBasis > 0 ? `$${fmt(avgCostBasis)}` : "—" },
            { label: "Total cost basis", value: totalCostBasis > 0 ? `$${fmt(totalCostBasis)}` : "—" },
            {
              label: "Total gain/loss $",
              value: pos.costBasis
                ? <span className={gainValue >= 0 ? "detail-pos" : "detail-neg"}>
                    {gainValue >= 0 ? "+" : "−"}${Math.abs(gainValue).toFixed(2)}
                  </span>
                : "—",
            },
            {
              label: "Total gain/loss %",
              value: pos.costBasis
                ? <span className={gainPct >= 0 ? "detail-pos" : "detail-neg"}>
                    {gainPct >= 0 ? "+" : ""}{gainPct.toFixed(2)}%
                  </span>
                : "—",
            },
          ].map(({ label, value }) => (
            <div key={label} className="pos-expanded-stat">
              <span className="pos-expanded-stat-label">{label}</span>
              <span className="pos-expanded-stat-value">{value}</span>
            </div>
          ))}
        </div>

        {isSchwab && (
          <div className="pos-expanded-lots">
            <div className="pos-expanded-lots-title">Transaction history</div>
            {lotsLoading && <span className="pos-expanded-lots-msg">Loading…</span>}
            {lotsError && <span className="pos-expanded-lots-msg pos-expanded-lots-err">{lotsError}</span>}
            {!lotsLoading && !lotsError && lots?.length === 0 && (
              <span className="pos-expanded-lots-msg">No transactions found.</span>
            )}
            {!lotsLoading && !lotsError && lots?.length > 0 && (
              <div className="pos-lots-table">
                <div className="pos-lots-header pos-lots-header--full">
                  <span>Date</span>
                  <span>Type</span>
                  <span>Description</span>
                  <span className="num">Qty</span>
                  <span className="num">Price</span>
                  <span className="num">Amount</span>
                </div>
                {lots.map((t, i) => {
                  const item = t.transferItems?.find((ti) => ti.instrument?.symbol === inst.symbol) || t.transactionItem;
                  const qty = item?.amount != null ? Math.abs(item.amount) : null;
                  const price = item?.price || 0;
                  const amount = t.netAmount ?? 0;
                  const date = t.tradeDate || t.transactionDate;
                  const typeLabel = txTypeLabel(t);
                  const isBuy = ["Buy", "Reinvest Dividend", "Reinvest Shares"].includes(typeLabel);
                  return (
                    <div key={i} className="pos-lots-row pos-lots-row--full">
                      <span>{date ? new Date(date).toLocaleDateString() : "—"}</span>
                      <span className={`lots-type-badge lots-type--${isBuy ? "buy" : "other"}`}>{typeLabel}</span>
                      <span className="pos-lots-desc">{t.description || "—"}</span>
                      <span className="num">{qty != null ? qty.toFixed(4) : "—"}</span>
                      <span className="num">{price ? `$${fmt(price)}` : "—"}</span>
                      <span className={`num ${amount < 0 ? "detail-neg" : amount > 0 ? "detail-pos" : ""}`}>
                        {amount !== 0 ? `${amount < 0 ? "−" : "+"}$${fmt(Math.abs(amount))}` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AccountSection({ acct, isSchwab, accountHash, customName, onRename, search }) {
  const [sortKey, setSortKey] = useState("value");
  const [sortDir, setSortDir] = useState("desc");
  const [expandedSymbol, setExpandedSymbol] = useState(null);

  const p = acct.portfolio;
  const positions = (p?.positions ?? []).filter((pos) => matchesSearch(pos, search));
  if (!positions.length) return null;

  const total = (p.equity ?? []).reduce(
    (s, e) => s + parseFloat(e.value || 0),
    0,
  );
  const bp = parseFloat(p.buyingPower?.buyingPower || 0);

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const col = COLUMNS.find((c) => c.key === sortKey);
  const sorted = [...positions].sort((a, b) => {
    const av = col.get(a);
    const bv = col.get(b);
    const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="account-section">
      <div className="account-header">
        <div className="account-title-group">
          <AccountLabel
            accountId={acct.accountId}
            defaultLabel={acct.accountName || ACCOUNT_LABELS[acct.accountType] || acct.accountType}
            customName={customName}
            onRename={onRename}
          />
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
            <span
              className="pill-dot"
              style={{ background: EQUITY_COLORS[e.type] || "#4a5080" }}
            />
            {e.type.replace(/_/g, " ")}
            <span className="pill-pct">
              {parseFloat(e.percentageOfPortfolio).toFixed(1)}%
            </span>
          </span>
        ))}
      </div>

      <div className="pos-table-wrap">
        <div className="pos-table">
          <div className="pos-row pos-header">
            {COLUMNS.map((c) => (
              <button
                key={c.key}
                className={`col-header ${c.cls} ${sortKey === c.key ? "col-header--active" : ""}`}
                onClick={() => handleSort(c.key)}>
                {c.label}
                <SortIcon active={sortKey === c.key} dir={sortDir} />
              </button>
            ))}
          </div>

          {sorted.map((pos) => {
            const inst = pos.instrument;
            const typeColor = EQUITY_COLORS[inst.type] ?? EQUITY_COLORS["STOCK"];
            const isExpanded = expandedSymbol === inst.symbol;
            return (
            <React.Fragment key={`${inst.symbol}-${pos.openedAt}`}>
              <div className="pos-row">
                <div
                  className={`pos-symbol-cell pos-symbol-cell--clickable${isExpanded ? " pos-symbol-cell--expanded" : ""}`}
                  onClick={() => setExpandedSymbol(isExpanded ? null : inst.symbol)}>
                  <span className="pos-symbol">{inst.symbol}</span>
                  <span
                    className="pos-type-badge"
                    style={{ color: typeColor, borderColor: typeColor }}>
                    {TYPE_LABELS[inst.type] ?? inst.type}
                  </span>
                </div>
                <span className="pos-name-col pos-name">{inst.name}</span>
                <span className="num pos-qty">
                  {parseFloat(pos.quantity).toFixed(4)}
                </span>
                <span className="num">${fmt(pos.lastPrice?.lastPrice)}</span>
                <span className="num pos-value">${fmt(pos.currentValue)}</span>
                <span className="num">
                  {pos.positionDailyGain ? (
                    <GainCell
                      value={pos.positionDailyGain.gainValue}
                      pct={pos.positionDailyGain.gainPercentage}
                    />
                  ) : (
                    <span className="na">—</span>
                  )}
                </span>
                <span className="num">
                  {pos.costBasis ? (
                    <GainCell
                      value={pos.costBasis.gainValue}
                      pct={pos.costBasis.gainPercentage}
                    />
                  ) : (
                    <span className="na">—</span>
                  )}
                </span>
              </div>
              {isExpanded && (
                <ExpandedDetail
                  pos={pos}
                  accountHash={accountHash ?? acct.accountId}
                  isSchwab={isSchwab}
                />
              )}
            </React.Fragment>
            );
          })}
          <SummaryRow positions={positions} />
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
          Add <code>SCHWAB_CLIENT_ID</code> and{" "}
          <code>SCHWAB_CLIENT_SECRET</code> to <code>server/.env</code> to
          connect your Schwab account.
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

const ALL_COLUMNS = [
  { key: "symbol",  label: "Symbol",  cls: "",             get: (p) => p.instrument.symbol },
  { key: "name",    label: "Name",    cls: "pos-name-col", get: (p) => p.instrument.name },
  { key: "account", label: "Account", cls: "pos-name-col", get: (p) => p._accountLabel },
  { key: "qty", label: "Qty", cls: "num", get: (p) => parseFloat(p.quantity) },
  { key: "price", label: "Price", cls: "num", get: (p) => parseFloat(p.lastPrice?.lastPrice || 0) },
  { key: "value", label: "Value", cls: "num", get: (p) => parseFloat(p.currentValue) },
  { key: "dailyPL", label: "Daily P/L", cls: "num", get: (p) => parseFloat(p.positionDailyGain?.gainPercentage || 0) },
  { key: "totalPL", label: "Total P/L", cls: "num", get: (p) => parseFloat(p.costBasis?.gainPercentage || 0) },
];

function AllPositionsTab({ publicData, schwabData, fidelityData, apexData, accountNames, search }) {
  const [sortKey, setSortKey] = useState("value");
  const [sortDir, setSortDir] = useState("desc");

  function handleSort(key) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const allPositions = [];
  for (const acct of (publicData?.accounts ?? [])) {
    const label = accountNames[acct.accountId] || ACCOUNT_LABELS[acct.accountType] || acct.accountType;
    for (const pos of (acct.portfolio?.positions ?? [])) {
      allPositions.push({ ...pos, _accountLabel: `Public · ${label}`, _accountId: acct.accountId });
    }
  }
  for (const acct of (schwabData?.accounts ?? [])) {
    const label = accountNames[acct.accountId] || ACCOUNT_LABELS[acct.accountType] || acct.accountType;
    for (const pos of (acct.portfolio?.positions ?? [])) {
      allPositions.push({ ...pos, _accountLabel: `Schwab · ${label}`, _accountId: acct.accountId });
    }
  }
  for (const acct of (fidelityData?.accounts ?? [])) {
    const label = accountNames[acct.accountId] || ACCOUNT_LABELS[acct.accountType] || acct.accountType;
    for (const pos of (acct.portfolio?.positions ?? [])) {
      allPositions.push({ ...pos, _accountLabel: `Fidelity · ${label}`, _accountId: acct.accountId });
    }
  }
  for (const acct of (apexData?.accounts ?? [])) {
    const label = accountNames[acct.accountId] || acct.accountName || ACCOUNT_LABELS[acct.accountType] || acct.accountType;
    for (const pos of (acct.portfolio?.positions ?? [])) {
      allPositions.push({ ...pos, _accountLabel: label, _accountId: acct.accountId });
    }
  }

  const filtered = allPositions.filter((pos) => matchesSearch(pos, search));

  const col = ALL_COLUMNS.find((c) => c.key === sortKey);
  const sorted = [...filtered].sort((a, b) => {
    const av = col.get(a), bv = col.get(b);
    const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalValue  = filtered.reduce((s, p) => s + parseFloat(p.currentValue || 0), 0);
  const withPL      = filtered.filter((p) => p.costBasis);
  const totalPLVal  = withPL.reduce((s, p) => s + parseFloat(p.costBasis.gainValue || 0), 0);
  const totalPLPct  = (totalValue - totalPLVal) > 0 ? (totalPLVal / (totalValue - totalPLVal)) * 100 : 0;

  if (!allPositions.length) return <div className="pos-error">No positions found across any platform.</div>;

  return (
    <div className="pos-page-body">
      <div className="all-positions-summary">
        <span className="all-positions-total">${fmt(totalValue)}</span>
        <span className="all-positions-count">{filtered.length} positions across all accounts</span>
      </div>
      <div className="pos-table-wrap">
        <div className="pos-table pos-table--all">
          <div className="pos-row pos-header">
            {ALL_COLUMNS.map((c) => (
              <button
                key={c.key}
                className={`col-header ${c.cls} ${sortKey === c.key ? "col-header--active" : ""}`}
                onClick={() => handleSort(c.key)}>
                {c.label}
                <SortIcon active={sortKey === c.key} dir={sortDir} />
              </button>
            ))}
          </div>
          {sorted.map((pos, i) => {
            const inst = pos.instrument;
            const typeColor = EQUITY_COLORS[inst.type] ?? EQUITY_COLORS["STOCK"];
            return (
              <div key={i} className="pos-row">
                <div className="pos-symbol-cell">
                  <span className="pos-symbol">{inst.symbol}</span>
                  <span className="pos-type-badge" style={{ color: typeColor }}>
                    {TYPE_LABELS[inst.type] ?? inst.type}
                  </span>
                </div>
                <span className="pos-name-col pos-name">{inst.name}</span>
                <span className="pos-name-col pos-name">{pos._accountLabel}</span>
                <span className="num">{parseFloat(pos.quantity).toFixed(4)}</span>
                <span className="num">${fmt(pos.lastPrice?.lastPrice || 0)}</span>
                <span className="num">${fmt(pos.currentValue)}</span>
                <span className="num">
                  {pos.positionDailyGain
                    ? <GainCell value={pos.positionDailyGain.gainValue} pct={pos.positionDailyGain.gainPercentage} />
                    : "—"}
                </span>
                <span className="num">
                  {pos.costBasis
                    ? <GainCell value={pos.costBasis.gainValue} pct={pos.costBasis.gainPercentage} />
                    : "—"}
                </span>
              </div>
            );
          })}

          <div className="pos-row pos-summary-row">
            <span className="pos-summary-label">
              {search ? `${filtered.length} results` : "Total"}
            </span>
            <span className="pos-name-col" />
            <span className="pos-name-col" />
            <span className="num" />
            <span className="num" />
            <span className="num pos-value">${fmt(totalValue)}</span>
            <span className="num" />
            <span className="num">
              {withPL.length > 0
                ? <GainCell value={totalPLVal} pct={totalPLPct} />
                : <span className="na">—</span>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FidelityUploadPrompt({ onUpload, uploading, uploadedAt }) {
  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onUpload(ev.target.result);
    reader.readAsText(file);
    e.target.value = '';
  }
  return (
    <div className="fidelity-upload-wrap">
      {uploadedAt && (
        <p className="fidelity-upload-date">
          Last updated {new Date(uploadedAt).toLocaleString()}
        </p>
      )}
      <label className={`fidelity-upload-btn ${uploading ? 'fidelity-upload-btn--loading' : ''}`}>
        {uploading ? <span className="btn-spinner" /> : '↑ Upload Fidelity CSV'}
        <input type="file" accept=".csv" onChange={handleFile} hidden disabled={uploading} />
      </label>
    </div>
  );
}

function institutionTotals(data) {
  if (!data) return { totalValue: 0, totalHoldings: 0, activeAccounts: 0 };
  const accounts = data.accounts ?? [];
  const active = accounts.filter(
    (a) => (a.portfolio?.positions?.length ?? 0) > 0,
  );
  const totalValue = accounts.reduce(
    (s, a) =>
      s +
      (a.portfolio?.equity ?? []).reduce(
        (es, e) => es + parseFloat(e.value || 0),
        0,
      ),
    0,
  );
  const totalHoldings = accounts.reduce(
    (s, a) => s + (a.portfolio?.positions?.length ?? 0),
    0,
  );
  return { totalValue, totalHoldings, activeAccounts: active.length };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PositionsPage() {
  const [activeTab, setActiveTab] = useState("public");
  const [search, setSearch] = useState("");

  const [publicData, setPublicData] = useState(null);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState("");
  const [publicCached, setPublicCached] = useState(false);
  const [publicCachedAt, setPublicCachedAt] = useState(null);

  const [schwabData, setSchwabData] = useState(null);
  const [schwabLoading, setSchwabLoading] = useState(true);
  const [schwabError, setSchwabError] = useState("");
  const [schwabCached, setSchwabCached] = useState(false);
  const [schwabCachedAt, setSchwabCachedAt] = useState(null);
  const [schwabStatus, setSchwabStatus] = useState({
    authorized: false,
    configured: false,
  });
  const [schwabHashMap, setSchwabHashMap] = useState({}); // accountNumber → hashValue
  const [accountNames, setAccountNames] = useState({}); // accountId → custom name

  const [fidelityData, setFidelityData] = useState(null);
  const [fidelityLoading, setFidelityLoading] = useState(true);
  const [fidelityError, setFidelityError] = useState("");
  const [fidelityUploading, setFidelityUploading] = useState(false);
  const [fidelityUploadedAt, setFidelityUploadedAt] = useState(null);

  const [apexData, setApexData] = useState(null);
  const [apexLoading, setApexLoading] = useState(true);
  const [apexError, setApexError] = useState("");
  const [apexConnected, setApexConnected] = useState(false);
  const [apexConnecting, setApexConnecting] = useState(false);
  const [apexCookieDraft, setApexCookieDraft] = useState("");
  const [apexCsrfDraft, setApexCsrfDraft] = useState("");
  const [apexCached, setApexCached] = useState(false);
  const [apexCachedAt, setApexCachedAt] = useState(null);
  const [apexUpdating, setApexUpdating] = useState(false);
  const [apexSessionCount, setApexSessionCount] = useState(0);

  useEffect(() => {
    getPositions()
      .then((d) => { setPublicData(d); setPublicCached(d.cached ?? false); setPublicCachedAt(d.cachedAt ?? null); })
      .catch((e) => setPublicError(e.message))
      .finally(() => setPublicLoading(false));

    getFidelityPositions()
      .then((d) => { setFidelityData(d); setFidelityUploadedAt(d.uploadedAt ?? null); })
      .catch((e) => setFidelityError(e.message))
      .finally(() => setFidelityLoading(false));

    getApexStatus()
      .then((s) => setApexSessionCount(s.sessionCount ?? 0))
      .catch(() => {});

    getApexPositions()
      .then((d) => {
        setApexData(d);
        setApexConnected(true);
        setApexCached(d.cached ?? false);
        setApexCachedAt(d.cachedAt ?? null);
      })
      .catch((e) => setApexError(e.code || e.message))
      .finally(() => setApexLoading(false));

    getAccountNames()
      .then((list) => {
        const map = {};
        (list ?? []).forEach(({ accountId, name }) => { map[accountId] = name; });
        setAccountNames(map);
      })
      .catch(() => {});

    getSchwabStatus()
      .then((status) => {
        setSchwabStatus(status);
        if (status.authorized) {
          getSchwabAccountNumbers()
            .then((list) => {
              const map = {};
              (list ?? []).forEach(({ accountNumber, hashValue }) => {
                map[accountNumber] = hashValue;
              });
              setSchwabHashMap(map);
            })
            .catch(() => {});
          return getSchwabPositions()
            .then((d) => { setSchwabData(d); setSchwabCached(d.cached ?? false); setSchwabCachedAt(d.cachedAt ?? null); })
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
    if (params.get("schwab") === "connected") {
      window.history.replaceState({}, "", window.location.pathname);
      setActiveTab("schwab");
      setSchwabStatus((s) => ({ ...s, authorized: true }));
      setSchwabLoading(true);
      getSchwabPositions()
        .then((d) => { setSchwabData(d); setSchwabCached(d.cached ?? false); setSchwabCachedAt(d.cachedAt ?? null); })
        .catch((e) => setSchwabError(e.message))
        .finally(() => setSchwabLoading(false));
    }
  }, []);

  const publicTotals   = institutionTotals(publicData);
  const schwabTotals   = institutionTotals(schwabData);
  const fidelityTotals = institutionTotals(fidelityData);
  const apexTotals     = institutionTotals(apexData);
  const allTotals = {
    totalValue:     publicTotals.totalValue     + schwabTotals.totalValue     + fidelityTotals.totalValue    + apexTotals.totalValue,
    totalHoldings:  publicTotals.totalHoldings  + schwabTotals.totalHoldings  + fidelityTotals.totalHoldings + apexTotals.totalHoldings,
    activeAccounts: publicTotals.activeAccounts + schwabTotals.activeAccounts + fidelityTotals.activeAccounts + apexTotals.activeAccounts,
  };
  const currentTotals =
    activeTab === "all"      ? allTotals      :
    activeTab === "public"   ? publicTotals   :
    activeTab === "fidelity" ? fidelityTotals :
    activeTab === "stash"    ? apexTotals     : schwabTotals;

  function handleRename(accountId, name) {
    setAccountNames((prev) => ({ ...prev, [accountId]: name }));
    saveAccountName(accountId, name).catch(() => {});
  }

  async function handleApexConnect() {
    if (!apexCookieDraft.trim()) return;
    setApexConnecting(true);
    setApexError("");
    try {
      const saved = await saveApexCookie(apexCookieDraft.trim());
      setApexSessionCount(saved.sessionCount ?? 0);
      const d = await getApexPositions();
      setApexData(d);
      setApexConnected(true);
      setApexCached(d.cached ?? false);
      setApexCachedAt(d.cachedAt ?? null);
      setApexUpdating(false);
      setApexCookieDraft("");
      setApexCsrfDraft("");
    } catch (e) {
      setApexError(e.code === "session_expired" ? "Session expired — paste fresh values." : e.message);
    } finally {
      setApexConnecting(false);
    }
  }

  async function handleApexClearSessions() {
    await clearApexSessions().catch(() => {});
    setApexConnected(false);
    setApexData(null);
    setApexError("");
    setApexCached(false);
    setApexSessionCount(0);
    setApexUpdating(false);
    setApexCookieDraft("");
  }

  async function handleFidelityUpload(csvText) {
    setFidelityUploading(true);
    setFidelityError("");
    try {
      const d = await uploadFidelityCSV(csvText);
      setFidelityData(d);
      setFidelityUploadedAt(d.uploadedAt ?? new Date().toISOString());
    } catch (e) {
      setFidelityError(e.message);
    } finally {
      setFidelityUploading(false);
    }
  }

  function renderContent() {
    if (activeTab === "all") {
      if (publicLoading || schwabLoading || fidelityLoading || apexLoading) return <LoadingState />;
      return (
        <AllPositionsTab
          publicData={publicData}
          schwabData={schwabData}
          fidelityData={fidelityData}
          apexData={apexData}
          accountNames={accountNames}
          search={search}
        />
      );
    }

    if (activeTab === "stash") {
      if (apexLoading) return <LoadingState />;

      if (!apexConnected) {
        return (
          <div className="connect-prompt">
            <div className="connect-icon">🏦</div>
            <h3 className="connect-title">Connect your Stash account</h3>
            <p className="connect-body">
              Log into <strong>public-apps.apexclearing.com</strong>, open
              DevTools (⌥⌘I) → Network → click any <code>api.apexclearing.com</code> GET request →
              Request Headers → right-click <code>Cookie</code> → Copy Value → paste below.
            </p>
            <textarea
              className="apex-cookie-input"
              placeholder="Paste full Cookie header value…"
              value={apexCookieDraft}
              onChange={(e) => setApexCookieDraft(e.target.value)}
              rows={4}
              spellCheck={false}
            />
            {apexError && <p className="apex-cookie-error">{apexError}</p>}
            <button
              className="connect-btn"
              onClick={handleApexConnect}
              disabled={apexConnecting || !apexCookieDraft.trim()}>
              {apexConnecting ? "Connecting…" : "Connect Stash"}
            </button>
          </div>
        );
      }

      if (apexError) {
        const expired = apexError.includes("expired") || apexError === "session_expired";
        return (
          <div className="connect-prompt">
            <div className="connect-icon">🔒</div>
            <h3 className="connect-title">{expired ? "Session expired" : "Connection error"}</h3>
            <p className="connect-body">{expired ? "Session expired. In DevTools → Network, right-click the Cookie header → Copy Value → paste below." : apexError}</p>
            <textarea
              className="apex-cookie-input"
              placeholder="Paste full Cookie header value…"
              value={apexCookieDraft}
              onChange={(e) => setApexCookieDraft(e.target.value)}
              rows={4}
              spellCheck={false}
            />
            <button
              className="connect-btn"
              onClick={handleApexConnect}
              disabled={apexConnecting || !apexCookieDraft.trim()}>
              {apexConnecting ? "Connecting…" : "Reconnect"}
            </button>
          </div>
        );
      }

      const accounts = (apexData?.accounts ?? []).filter(
        (a) => (a.portfolio?.positions?.length ?? 0) > 0,
      );
      const cachedDate = apexCachedAt ? new Date(apexCachedAt).toLocaleString() : null;
      return (
        <div className="pos-page-body">
          {apexCached && (
            <div className="apex-stale-banner">
              <span>Showing saved data from {cachedDate} — sessions expired.</span>
              {!apexUpdating && (
                <button className="apex-stale-btn" onClick={() => setApexUpdating(true)}>Add session</button>
              )}
            </div>
          )}
          {!apexCached && (
            <div className="apex-session-bar">
              <span className="apex-session-count">{apexSessionCount} session{apexSessionCount !== 1 ? 's' : ''} active</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!apexUpdating && (
                  <button className="apex-stale-btn" onClick={() => setApexUpdating(true)}>Add session</button>
                )}
                <button className="apex-cancel-btn" onClick={handleApexClearSessions}>Clear all</button>
              </div>
            </div>
          )}
          {apexUpdating && (
            <div className="apex-update-form">
              <textarea
                className="apex-cookie-input"
                placeholder="Paste full Cookie header value…"
                value={apexCookieDraft}
                onChange={(e) => setApexCookieDraft(e.target.value)}
                rows={3}
                spellCheck={false}
              />
              <div className="apex-update-actions">
                <button className="connect-btn" onClick={handleApexConnect} disabled={apexConnecting || !apexCookieDraft.trim()}>
                  {apexConnecting ? "Adding…" : "Add session"}
                </button>
                <button className="apex-cancel-btn" onClick={() => { setApexUpdating(false); setApexCookieDraft(""); }}>Cancel</button>
              </div>
            </div>
          )}
          {accounts.map((a) => (
            <AccountSection
              key={a.accountId}
              acct={a}
              isSchwab={false}
              customName={accountNames[a.accountId]}
              onRename={(name) => handleRename(a.accountId, name)}
              search={search}
            />
          ))}
          {!accounts.length && (
            <div className="pos-empty">
              <p>No positions found in any Stash account.</p>
              {!apexUpdating && (
                <button className="connect-btn" style={{marginTop:'0.75rem'}} onClick={() => setApexUpdating(true)}>
                  Add session
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "fidelity") {
      if (fidelityLoading) return <LoadingState />;
      if (fidelityError) return <ErrorState msg={fidelityError} />;
      const accounts = (fidelityData?.accounts ?? []).filter(
        (a) => (a.portfolio?.positions?.length ?? 0) > 0,
      );
      return (
        <div className="pos-page-body">
          <FidelityUploadPrompt
            onUpload={handleFidelityUpload}
            uploading={fidelityUploading}
            uploadedAt={fidelityUploadedAt}
          />
          {accounts.map((a) => (
            <AccountSection
              key={a.accountId}
              acct={a}
              isSchwab={false}
              customName={accountNames[a.accountId]}
              onRename={(name) => handleRename(a.accountId, name)}
              search={search}
            />
          ))}
          {!accounts.length && !fidelityUploading && (
            <p className="pos-empty">No positions yet. Upload a Fidelity CSV to get started.</p>
          )}
        </div>
      );
    }

    if (activeTab === "public") {
      if (publicLoading) return <LoadingState />;
      if (publicError) return <ErrorState msg={publicError} />;
      const accounts = (publicData?.accounts ?? []).filter(
        (a) => (a.portfolio?.positions?.length ?? 0) > 0,
      );
      return (
        <div className="pos-page-body">
          {publicCached ? (
            <div className="apex-stale-banner">
              <span>Showing saved data from {publicCachedAt ? new Date(publicCachedAt).toLocaleString() : "unknown"} — API unavailable.</span>
            </div>
          ) : (
            <div className="schwab-live-banner">
              <span className="schwab-live-dot" />
              Live
            </div>
          )}
          {accounts.map((a) => (
            <AccountSection
              key={a.accountId}
              acct={a}
              isSchwab={false}
              customName={accountNames[a.accountId]}
              onRename={(name) => handleRename(a.accountId, name)}
              search={search}
            />
          ))}
        </div>
      );
    }

    if (!schwabStatus.configured || !schwabStatus.authorized) {
      return <SchwabConnectPrompt configured={schwabStatus.configured} />;
    }
    if (schwabLoading) return <LoadingState />;
    if (schwabError) return <ErrorState msg={schwabError} />;
    const accounts = (schwabData?.accounts ?? []).filter(
      (a) => (a.portfolio?.positions?.length ?? 0) > 0,
    );
    return (
      <div className="pos-page-body">
        {schwabCached ? (
          <div className="apex-stale-banner">
            <span>Showing saved data from {schwabCachedAt ? new Date(schwabCachedAt).toLocaleString() : "unknown"} — token expired.</span>
            <a href="/api/schwab/auth" className="apex-stale-btn">Reconnect</a>
          </div>
        ) : (
          <div className="schwab-live-banner">
            <span className="schwab-live-dot" />
            Live
          </div>
        )}
        {accounts.map((a) => (
          <AccountSection
            key={a.accountId}
            acct={a}
            isSchwab={true}
            accountHash={schwabHashMap[a.accountId] ?? a.accountId}
            customName={accountNames[a.accountId]}
            onRename={(name) => handleRename(a.accountId, name)}
            search={search}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="positions-page">
      <div className="pos-page-header">
        <div className="pos-page-title-group">
          <h1 className="pos-page-title">Positions</h1>
          <div className="pos-page-meta">
            <span className="pos-page-total">${fmt(currentTotals.totalValue)}</span>
            <span className="pos-page-count">
              {currentTotals.totalHoldings} holdings · {currentTotals.activeAccounts} accounts
            </span>
          </div>
        </div>
        <div className="pos-search-wrap">
          <span className="pos-search-icon">⌕</span>
          <input
            className="pos-search-input"
            type="text"
            placeholder="Search symbol or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            spellCheck={false}
          />
          {search && (
            <button className="pos-search-clear" onClick={() => setSearch("")} aria-label="Clear search">✕</button>
          )}
        </div>
      </div>

      <div className="institution-tabs">
        <button
          className={`inst-tab ${activeTab === "all" ? "inst-tab--active" : ""}`}
          onClick={() => setActiveTab("all")}>
          All
          {!publicLoading && !schwabLoading && !fidelityLoading && (
            <span className="inst-tab-count">{allTotals.totalHoldings}</span>
          )}
        </button>
        <button
          className={`inst-tab ${activeTab === "public" ? "inst-tab--active" : ""}`}
          onClick={() => setActiveTab("public")}>
          Public.com
          {!publicLoading && (
            <span className="inst-tab-count">{publicTotals.activeAccounts}</span>
          )}
        </button>
        <div className="inst-tab-group">
          <button
            className={`inst-tab ${activeTab === "schwab" ? "inst-tab--active" : ""}`}
            onClick={() => setActiveTab("schwab")}>
            Schwab
            {!schwabLoading && schwabStatus.authorized && (
              <span className="inst-tab-count">{schwabTotals.activeAccounts}</span>
            )}
          </button>
          {!schwabLoading && !schwabStatus.authorized && schwabStatus.configured && (
            <a href="/api/schwab/auth" className="schwab-connect-tab-btn">Connect ↗</a>
          )}
        </div>
        <button
          className={`inst-tab ${activeTab === "fidelity" ? "inst-tab--active" : ""}`}
          onClick={() => setActiveTab("fidelity")}>
          Fidelity
          {!fidelityLoading && fidelityTotals.activeAccounts > 0 ? (
            <span className="inst-tab-count">{fidelityTotals.activeAccounts}</span>
          ) : !fidelityLoading ? (
            <span className="inst-tab-badge">Upload</span>
          ) : null}
        </button>
        <button
          className={`inst-tab ${activeTab === "stash" ? "inst-tab--active" : ""}`}
          onClick={() => setActiveTab("stash")}>
          Stash
          {!apexLoading && apexTotals.activeAccounts > 0 ? (
            <span className="inst-tab-count">{apexTotals.activeAccounts}</span>
          ) : !apexLoading && !apexConnected ? (
            <span className="inst-tab-badge">Connect</span>
          ) : null}
        </button>
      </div>

      {renderContent()}
    </div>
  );
}
