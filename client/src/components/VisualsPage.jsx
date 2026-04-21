import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useOutletContext } from 'react-router-dom';
import { getPositions }                       from '../api/positions';
import { getSchwabStatus, getSchwabPositions } from '../api/schwab';
import { getFidelityPositions }               from '../api/fidelity';
import { getApexPositions }                   from '../api/apex';
import { getSectors }                         from '../api/sectors';
import './VisualsPage.css';

// ── Shared constants (exported for SectorListPage) ────────────────────────────
export const SECTOR_COLORS = {
  'Technology':             '#818cf8',
  'Communication Services': '#22d3ee',
  'Consumer Discretionary': '#f472b6',
  'Consumer Staples':       '#fb923c',
  'Energy':                 '#f59e0b',
  'Financials':             '#38bdf8',
  'Healthcare':             '#34d399',
  'Industrials':            '#a78bfa',
  'Materials':              '#4ade80',
  'Real Estate':            '#e879f9',
  'Utilities':              '#64748b',
  'Unknown':                '#3a3f6b',
};

export function sectorColor(s) { return SECTOR_COLORS[s] ?? '#3a3f6b'; }

export function extractStocks(accounts) {
  const out = [];
  for (const acct of accounts ?? []) {
    for (const pos of acct.portfolio?.positions ?? []) {
      if (pos.instrument?.type === 'STOCK' && pos.instrument?.symbol) {
        out.push({ ...pos, _institution: acct._institution ?? acct.accountName ?? '' });
      }
    }
  }
  return out;
}

export function extractAll(accounts) {
  const out = [];
  for (const acct of accounts ?? []) {
    for (const pos of acct.portfolio?.positions ?? []) {
      if (parseFloat(pos.currentValue ?? 0) !== 0) {
        out.push({ ...pos, _institution: acct._institution ?? acct.accountName ?? '' });
      }
    }
  }
  return out;
}

function tagInstitution(accounts, label) {
  return (accounts ?? []).map((a) => ({
    ...a,
    portfolio: {
      ...a.portfolio,
      positions: (a.portfolio?.positions ?? []).map((p) => ({ ...p, _institution: label })),
    },
  }));
}

export function fmt$(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

// ── Data loader hook (shared between tab children via Outlet context) ──────────
function usePortfolioSectors() {
  const [state, setState] = useState({
    loading: true, error: '', byInstitution: {}, allByInstitution: {}, sectorMap: {}, sectorSources: [], loadedAt: null,
  });

  useEffect(() => {
    async function load() {
      try {
        const [publicData, schwabStatus, fidelityData, apexData] = await Promise.all([
          getPositions().catch(() => null),
          getSchwabStatus().catch(() => ({ authorized: false })),
          getFidelityPositions().catch(() => null),
          getApexPositions().catch(() => null),
        ]);

        const schwabData = schwabStatus?.authorized
          ? await getSchwabPositions().catch(() => null) : null;

        const byInstitution = {
          Public:   extractStocks(tagInstitution(publicData?.accounts,   'Public')),
          Schwab:   extractStocks(tagInstitution(schwabData?.accounts,   'Schwab')),
          Fidelity: extractStocks(tagInstitution(fidelityData?.accounts, 'Fidelity')),
          Stash:    extractStocks(tagInstitution(apexData?.accounts,     'Stash')),
        };

        const allByInstitution = {
          Public:   extractAll(tagInstitution(publicData?.accounts,   'Public')),
          Schwab:   extractAll(tagInstitution(schwabData?.accounts,   'Schwab')),
          Fidelity: extractAll(tagInstitution(fidelityData?.accounts, 'Fidelity')),
          Stash:    extractAll(tagInstitution(apexData?.accounts,     'Stash')),
        };

        const symbols = [...new Set(
          Object.values(byInstitution).flat().map((p) => p.instrument.symbol)
        )];

        const { sectors: sectorMap = {}, sources: sectorSources = [] } =
          symbols.length ? await getSectors(symbols) : {};
        setState({ loading: false, error: '', byInstitution, allByInstitution, sectorMap, sectorSources, loadedAt: new Date() });
      } catch (e) {
        setState({ loading: false, error: e.message, byInstitution: {}, sectorMap: {} });
      }
    }
    load();
  }, []);

  return state;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { label: 'Sector Breakdown',      to: 'breakdown' },
  { label: 'Sector List',           to: 'sectors'   },
  { label: 'Fund Type Allocation',  to: 'fundtypes' },
];

// ── Layout ────────────────────────────────────────────────────────────────────
export default function VisualsPage() {
  const ctx = usePortfolioSectors();

  return (
    <div className="vis-page">
      <header className="vis-header">
        <div className="vis-header-glow" />
        <h1 className="vis-title">
          <span className="vis-title-accent">Portfolio</span> Visuals
        </h1>
      </header>

      <div className="vis-tabs">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => `vis-tab${isActive ? ' vis-tab--active' : ''}`}
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <div className="vis-body">
        <Outlet context={ctx} />
      </div>
    </div>
  );
}

// ── Sector Breakdown tab ──────────────────────────────────────────────────────
function buildChartData(byInstitution, sectorMap) {
  const all = Object.values(byInstitution).flat();
  const bars = [
    { label: 'All', positions: all },
    ...Object.entries(byInstitution)
      .filter(([, p]) => p.length > 0)
      .map(([label, positions]) => ({ label, positions })),
  ];

  return bars.map(({ label, positions }) => {
    if (!positions.length) return null;
    const totals = {};
    let total = 0;
    for (const pos of positions) {
      const sector = sectorMap[pos.instrument.symbol] ?? 'Unknown';
      const val    = parseFloat(pos.currentValue ?? 0);
      totals[sector] = (totals[sector] ?? 0) + val;
      total += val;
    }
    return { label, totals, total };
  }).filter(Boolean);
}

const PAD = { l: 48, r: 16, t: 16, b: 52 };
const VW  = 740, VH = 320;
const CW  = VW - PAD.l - PAD.r;
const CH  = VH - PAD.t - PAD.b;

function StackedBarChart({ chartData, allSectors }) {
  const [tooltip, setTooltip] = useState(null);
  const wrapRef = useRef(null);
  const N   = chartData.length;
  const barW = Math.min(88, CW / N - 16);
  const gap  = (CW - N * barW) / (N + 1);

  function barX(i) { return PAD.l + gap + i * (barW + gap); }
  function pctY(p) { return PAD.t + CH * (1 - p / 100); }

  return (
    <div className="vis-chart-wrap" ref={wrapRef}>
      <svg viewBox={`0 0 ${VW} ${VH}`} className="vis-svg"
        onMouseLeave={() => setTooltip(null)}>
        {[0, 25, 50, 75, 100].map((p) => {
          const y = pctY(p);
          return (
            <g key={p}>
              <line x1={PAD.l} x2={VW - PAD.r} y1={y} y2={y}
                stroke="var(--border,#1e2140)"
                strokeWidth={p === 0 ? 1.5 : 0.75}
                strokeDasharray={p === 0 ? 'none' : '3 4'} />
              <text x={PAD.l - 6} y={y + 4} textAnchor="end" className="vis-axis-label">{p}%</text>
            </g>
          );
        })}

        {chartData.map((bar, i) => {
          const x = barX(i);
          let cumPct = 0;
          const activeSectors = allSectors.filter((s) => bar.totals[s]);
          return (
            <g key={bar.label}>
              {activeSectors.map((sector) => {
                const pct  = bar.total > 0 ? (bar.totals[sector] / bar.total) * 100 : 0;
                const y1   = pctY(cumPct + pct);
                const y2   = pctY(cumPct);
                cumPct += pct;
                const isTop = sector === activeSectors.at(-1);
                return (
                  <rect key={sector} x={x} y={y1} width={barW}
                    height={Math.max(y2 - y1, 1)}
                    fill={sectorColor(sector)}
                    rx={isTop ? 4 : 0} ry={isTop ? 4 : 0}
                    className="vis-bar-seg"
                    onMouseMove={(e) => {
                      if (!wrapRef.current) return;
                      const r = wrapRef.current.getBoundingClientRect();
                      setTooltip({ x: e.clientX - r.left, y: e.clientY - r.top,
                        institution: bar.label, sector, pct, val: bar.totals[sector] });
                    }}
                  />
                );
              })}
              <text x={x + barW / 2} y={PAD.t + CH + 20} textAnchor="middle"
                className="vis-axis-label vis-axis-label--x">{bar.label}</text>
              <text x={x + barW / 2} y={PAD.t + CH + 36} textAnchor="middle"
                className="vis-axis-label vis-axis-label--sub">{fmt$(bar.total)}</text>
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div className="vis-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          <div className="vis-tt-header">
            <span className="vis-tt-dot" style={{ background: sectorColor(tooltip.sector) }} />
            {tooltip.sector}
          </div>
          <div className="vis-tt-row">
            <span>{tooltip.institution}</span>
            <span className="vis-tt-val">{tooltip.pct.toFixed(1)}%</span>
          </div>
          <div className="vis-tt-row vis-tt-dim">
            <span>Value</span><span>{fmt$(tooltip.val)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ sectors }) {
  return (
    <div className="vis-legend">
      {sectors.map((s) => (
        <div key={s} className="vis-legend-item">
          <span className="vis-legend-dot" style={{ background: sectorColor(s) }} />
          <span className="vis-legend-label">{s}</span>
        </div>
      ))}
    </div>
  );
}

export function Breakdown() {
  const { loading, error, byInstitution, sectorMap } = useOutletContext();

  if (loading) return (
    <div className="vis-loading">
      <div className="vis-spinner" />
      <span>Loading positions &amp; sector data…</span>
    </div>
  );
  if (error)  return <p className="vis-error">{error}</p>;

  const allPositions = Object.values(byInstitution).flat();
  if (!allPositions.length) return (
    <p className="vis-empty">No stock positions found. Connect your portfolios in the Positions tab first.</p>
  );

  const chartData = buildChartData(byInstitution, sectorMap);
  const sectorTotals = {};
  for (const bar of chartData) {
    for (const [s, v] of Object.entries(bar.totals)) {
      sectorTotals[s] = (sectorTotals[s] ?? 0) + v;
    }
  }
  const allSectors = Object.entries(sectorTotals).sort((a, b) => b[1] - a[1]).map(([s]) => s);

  return (
    <div className="vis-card">
      <h2 className="vis-card-title">Sector Weights by Institution</h2>
      <p className="vis-card-sub">Individual stocks only · percentage of stock portfolio value</p>
      <StackedBarChart chartData={chartData} allSectors={allSectors} />
      <Legend sectors={allSectors} />
    </div>
  );
}

VisualsPage.Breakdown = Breakdown;
