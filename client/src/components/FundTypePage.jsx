import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { fmt$ } from './VisualsPage';
import './FundTypePage.css';

// ── Fund type classification ──────────────────────────────────────────────────
const FUND_COLORS = {
  'Stocks':             '#818cf8',
  'ETFs':               '#22d3ee',
  'Mutual Funds':       '#34d399',
  'Bonds':              '#f59e0b',
  'Cash & Equivalents': '#64748b',
  'Options':            '#f472b6',
  'Crypto':             '#fb923c',
  'Other':              '#3a3f6b',
};

function fundCategory(instrument) {
  const t = (instrument?.type ?? '').toUpperCase().replace(/[_\s-]/g, '');
  if (['STOCK','EQUITY','COMMONSTOCK','ADR'].includes(t)) return 'Stocks';
  if (['ETF','EXCHANGETRADEDFUND','ETP','EXCHANGETRADEDPRODUCT'].includes(t)) return 'ETFs';
  if (['MUTUALFUND','OPENENDFUND','CLOSEDENDFUND','FUND','COLLECTIVEINVESTMENT'].includes(t)) return 'Mutual Funds';
  if (['BOND','FIXEDINCOME','CORPORATEBOND','MUNICIPALBOND','TREASURY','CD','FIXEDINCOMEDEBT'].includes(t)) return 'Bonds';
  if (['CASH','MONEYMARKET','SWEEP','CASHEQUIVALENT','CASHBALANCE'].includes(t)) return 'Cash & Equivalents';
  if (['OPTION','PUT','CALL','OPTIONS'].includes(t)) return 'Options';
  if (['CRYPTO','CRYPTOCURRENCY','DIGITALASSET'].includes(t)) return 'Crypto';
  return 'Other';
}

const INST_LABELS = {
  Public: 'Public.com', Schwab: 'Schwab', Fidelity: 'Fidelity', Stash: 'Stash',
};

// ── Data builder ──────────────────────────────────────────────────────────────
function buildAllocation(allByInstitution) {
  const byType = {}; // type → { total, institutions: { inst → { total, positions[] } } }

  for (const [inst, positions] of Object.entries(allByInstitution)) {
    for (const pos of positions) {
      const type  = fundCategory(pos.instrument);
      const val   = parseFloat(pos.currentValue ?? 0);
      if (!byType[type]) byType[type] = { total: 0, institutions: {} };
      byType[type].total += val;
      if (!byType[type].institutions[inst]) byType[type].institutions[inst] = { total: 0, positions: [] };
      byType[type].institutions[inst].total += val;
      byType[type].institutions[inst].positions.push({
        symbol:   pos.instrument?.symbol ?? '—',
        name:     pos.instrument?.name   ?? '—',
        rawType:  pos.instrument?.type   ?? '—',
        value:    val,
        quantity: parseFloat(pos.quantity ?? 0),
      });
    }
  }

  const grandTotal = Object.values(byType).reduce((s, t) => s + t.total, 0);

  return {
    grandTotal,
    rows: Object.entries(byType)
      .map(([type, data]) => ({
        type,
        total: data.total,
        pct: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
        institutions: Object.entries(data.institutions).map(([inst, d]) => ({
          label: INST_LABELS[inst] ?? inst,
          total: d.total,
          pct: data.total > 0 ? (d.total / data.total) * 100 : 0,
          positions: d.positions.sort((a, b) => b.value - a.value),
        })).sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total),
  };
}

// ── Stacked bar ───────────────────────────────────────────────────────────────
function AllocationBar({ rows }) {
  return (
    <div className="ft-stack-bar">
      {rows.map(({ type, pct }) => (
        <div
          key={type}
          className="ft-stack-seg"
          style={{ width: `${pct}%`, background: FUND_COLORS[type] ?? '#3a3f6b' }}
          title={`${type}: ${pct.toFixed(1)}%`}
        />
      ))}
    </div>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────
const CX = 100, CY = 100, R = 72, SW = 30;
const CIRC = 2 * Math.PI * R;

function DonutChart({ rows, grandTotal }) {
  const [hovered, setHovered] = useState(null);

  let cumPct = 0;
  // rotate so first slice starts at the top (−90°)
  const startOffset = CIRC * 0.25;

  const slices = rows.map(({ type, pct, total }) => {
    const dash   = (pct / 100) * CIRC;
    const offset = startOffset - (cumPct / 100) * CIRC;
    cumPct += pct;
    return { type, pct, total, dash, offset };
  });

  const active = hovered ?? null;

  return (
    <div className="ft-donut-wrap">
      <svg viewBox="0 0 200 200" className="ft-donut-svg">
        {/* Track */}
        <circle cx={CX} cy={CY} r={R} fill="none"
          stroke="var(--border,#1e2140)" strokeWidth={SW} />

        {slices.map(({ type, pct, total, dash, offset }) => (
          <circle
            key={type}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={FUND_COLORS[type] ?? '#3a3f6b'}
            strokeWidth={SW}
            strokeDasharray={`${dash} ${CIRC - dash}`}
            strokeDashoffset={offset}
            className="ft-donut-slice"
            style={{ opacity: active && active.type !== type ? 0.25 : 1 }}
            onMouseEnter={() => setHovered({ type, pct, total })}
            onMouseLeave={() => setHovered(null)}
          />
        ))}

        {active ? (
          <>
            <text x={CX} y={CY - 12} textAnchor="middle" className="ft-donut-type">
              {active.type}
            </text>
            <text x={CX} y={CY + 8} textAnchor="middle" className="ft-donut-pct">
              {active.pct.toFixed(1)}%
            </text>
            <text x={CX} y={CY + 24} textAnchor="middle" className="ft-donut-val">
              {fmt$(active.total)}
            </text>
          </>
        ) : (
          <>
            <text x={CX} y={CY + 4} textAnchor="middle" className="ft-donut-idle-label">
              Total
            </text>
            <text x={CX} y={CY + 20} textAnchor="middle" className="ft-donut-idle-val">
              {fmt$(grandTotal)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FundTypePage() {
  const { loading, error, allByInstitution } = useOutletContext();
  const [expanded, setExpanded] = useState({});

  if (loading) return (
    <div className="vis-loading">
      <div className="vis-spinner" />
      <span>Loading positions…</span>
    </div>
  );
  if (error) return <p className="vis-error">{error}</p>;

  const allPositions = Object.values(allByInstitution).flat();
  if (!allPositions.length) return (
    <p className="vis-empty">No positions found. Connect your portfolios in the Positions tab first.</p>
  );

  const { grandTotal, rows } = buildAllocation(allByInstitution);

  function toggle(type) {
    setExpanded((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  return (
    <div className="ft-page">
      {/* Overview card */}
      <div className="ft-overview-card">
        <div className="ft-overview-header">
          <div>
            <h2 className="ft-overview-title">Fund Type Allocation</h2>
            <p className="ft-overview-sub">All holdings · percentage of total portfolio value</p>
          </div>
          <div className="ft-overview-total">
            <span className="ft-total-label">Total</span>
            <span className="ft-total-value">{fmt$(grandTotal)}</span>
          </div>
        </div>
        <AllocationBar rows={rows} />

        <div className="ft-chart-legend-row">
          <DonutChart rows={rows} grandTotal={grandTotal} />
          <div className="ft-legend">
            {rows.map(({ type, pct, total }) => (
              <div key={type} className="ft-legend-item">
                <span className="ft-legend-dot" style={{ background: FUND_COLORS[type] ?? '#3a3f6b' }} />
                <span className="ft-legend-label">{type}</span>
                <span className="ft-legend-pct">{pct.toFixed(1)}%</span>
                <span className="ft-legend-val">{fmt$(total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-type rows */}
      {rows.map(({ type, total, pct, institutions }) => {
        const color   = FUND_COLORS[type] ?? '#3a3f6b';
        const isOpen  = expanded[type];

        return (
          <div key={type} className="ft-group">
            <button className="ft-group-header" onClick={() => toggle(type)}>
              <div className="ft-group-left">
                <span className="ft-dot" style={{ background: color }} />
                <span className="ft-type-name">{type}</span>
              </div>
              <div className="ft-group-right">
                <div className="ft-pct-bar-wrap">
                  <div className="ft-pct-bar-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="ft-pct-label">{pct.toFixed(1)}%</span>
                <span className="ft-value-label">{fmt$(total)}</span>
                <span className={`ft-chevron${isOpen ? ' ft-chevron--open' : ''}`}>›</span>
              </div>
            </button>

            {isOpen && (
              <div className="ft-detail">
                {institutions.map(({ label, total: instTotal, pct: instPct, positions }) => (
                  <div key={label} className="ft-inst-block">
                    <div className="ft-inst-header">
                      <span className="ft-inst-label">{label}</span>
                      <span className="ft-inst-meta">
                        {fmt$(instTotal)} · {instPct.toFixed(1)}% of {type}
                      </span>
                    </div>
                    <table className="ft-table">
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Name</th>
                          <th>Type</th>
                          <th className="ft-num">Shares</th>
                          <th className="ft-num">Value</th>
                          <th className="ft-num">% of type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((p, i) => (
                          <tr key={`${p.symbol}-${i}`}>
                            <td><span className="ft-symbol">{p.symbol}</span></td>
                            <td className="ft-name">{p.name}</td>
                            <td><span className="ft-raw-type">{p.rawType}</span></td>
                            <td className="ft-num ft-dim">
                              {p.quantity % 1 === 0 ? p.quantity : p.quantity.toFixed(4)}
                            </td>
                            <td className="ft-num ft-val">{fmt$(p.value)}</td>
                            <td className="ft-num ft-dim">
                              {total > 0 ? ((p.value / total) * 100).toFixed(1) : '0.0'}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
