import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { SECTOR_COLORS, sectorColor, fmt$ } from './VisualsPage';
import './SectorListPage.css';

const INSTITUTION_LABELS = {
  Public:   'Public.com',
  Schwab:   'Schwab',
  Fidelity: 'Fidelity',
  Stash:    'Stash',
};

function buildSectorGroups(byInstitution, sectorMap) {
  const groups = {}; // sector → [{ symbol, name, institution, value, quantity }]

  for (const [inst, positions] of Object.entries(byInstitution)) {
    for (const pos of positions) {
      const sym    = pos.instrument.symbol;
      const sector = sectorMap[sym] ?? 'Unknown';
      if (!groups[sector]) groups[sector] = [];
      groups[sector].push({
        symbol:      sym,
        name:        pos.instrument.name,
        institution: INSTITUTION_LABELS[inst] ?? inst,
        value:       parseFloat(pos.currentValue ?? 0),
        quantity:    parseFloat(pos.quantity ?? 0),
        dailyGain:   pos.positionDailyGain ?? null,
        totalGain:   pos.costBasis         ?? null,
      });
    }
  }

  // Sort sectors by total value desc, positions within each sector by value desc
  return Object.entries(groups)
    .map(([sector, positions]) => {
      const total = positions.reduce((s, p) => s + p.value, 0);
      return { sector, positions: positions.sort((a, b) => b.value - a.value), total };
    })
    .sort((a, b) => b.total - a.total);
}

function GainBadge({ gain }) {
  if (!gain) return <span className="sl-dim">—</span>;
  const v = parseFloat(gain.gainValue ?? 0);
  const p = parseFloat(gain.gainPercentage ?? 0);
  const pos = v >= 0;
  return (
    <span className={pos ? 'sl-pos' : 'sl-neg'}>
      {pos ? '+' : '−'}${Math.abs(v).toFixed(2)}{' '}
      <span className="sl-pct">({pos ? '+' : ''}{p.toFixed(2)}%)</span>
    </span>
  );
}

function downloadCSV(groups, grandTotal) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Sector', 'Sector % of Total', 'Symbol', 'Name', 'Institution', 'Shares', 'Value ($)', 'Daily P/L ($)', 'Daily P/L (%)', 'Total P/L ($)', 'Total P/L (%)'],
  ];
  for (const { sector, positions, total } of groups) {
    const sectorPct = grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(2) : '0.00';
    for (const p of positions) {
      rows.push([
        esc(sector),
        sectorPct,
        esc(p.symbol),
        esc(p.name),
        esc(p.institution),
        p.quantity.toFixed(4),
        p.value.toFixed(2),
        p.dailyGain ? parseFloat(p.dailyGain.gainValue).toFixed(2)      : '',
        p.dailyGain ? parseFloat(p.dailyGain.gainPercentage).toFixed(2) : '',
        p.totalGain ? parseFloat(p.totalGain.gainValue).toFixed(2)      : '',
        p.totalGain ? parseFloat(p.totalGain.gainPercentage).toFixed(2) : '',
      ]);
    }
  }
  const csv  = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `sector-breakdown-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtTime(date) {
  if (!date) return '—';
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function SectorListPage() {
  const { loading, error, byInstitution, sectorMap, sectorSources, loadedAt } = useOutletContext();
  const [collapsed, setCollapsed] = useState({});

  if (loading) return (
    <div className="vis-loading">
      <div className="vis-spinner" />
      <span>Loading positions &amp; sector data…</span>
    </div>
  );
  if (error) return <p className="vis-error">{error}</p>;

  const allPositions = Object.values(byInstitution).flat();
  if (!allPositions.length) return (
    <p className="vis-empty">No stock positions found. Connect your portfolios in the Positions tab first.</p>
  );

  const groups     = buildSectorGroups(byInstitution, sectorMap);
  const grandTotal = groups.reduce((s, g) => s + g.total, 0);

  function toggle(sector) {
    setCollapsed((prev) => ({ ...prev, [sector]: !prev[sector] }));
  }

  return (
    <div className="sl-page">
      <div className="sl-meta-bar">
        <div className="sl-meta-item">
          <span className="sl-meta-label">Sources</span>
          <span className="sl-meta-value">
            {sectorSources.length ? sectorSources.join(' · ') : '—'}
          </span>
        </div>
        <div className="sl-meta-sep" />
        <div className="sl-meta-item">
          <span className="sl-meta-label">Last updated</span>
          <span className="sl-meta-value">{fmtTime(loadedAt)}</span>
        </div>
      </div>
      <div className="sl-summary">
        <span className="sl-summary-count">{allPositions.length} positions</span>
        <span className="sl-summary-sep">·</span>
        <span className="sl-summary-sectors">{groups.length} sectors</span>
        <span className="sl-summary-sep">·</span>
        <span className="sl-summary-total">{fmt$(grandTotal)} total</span>
        <button className="sl-csv-btn" onClick={() => downloadCSV(groups, grandTotal)}>
          ↓ Export CSV
        </button>
      </div>

      {groups.map(({ sector, positions, total }) => {
        const pct       = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
        const isOpen    = !collapsed[sector];
        const color     = sectorColor(sector);

        return (
          <div key={sector} className="sl-group">
            <button className="sl-group-header" onClick={() => toggle(sector)}>
              <div className="sl-group-left">
                <span className="sl-sector-dot" style={{ background: color }} />
                <span className="sl-sector-name">{sector}</span>
                <span className="sl-sector-count">{positions.length}</span>
              </div>
              <div className="sl-group-right">
                <span className="sl-sector-value">{fmt$(total)}</span>
                <span className="sl-sector-pct">{pct.toFixed(1)}%</span>
                <span className={`sl-chevron ${isOpen ? 'sl-chevron--open' : ''}`}>›</span>
              </div>
            </button>

            {/* Weight bar */}
            <div className="sl-weight-bar">
              <div className="sl-weight-fill" style={{ width: `${pct}%`, background: color }} />
            </div>

            {isOpen && (
              <div className="sl-table-wrap">
                <table className="sl-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th className="sl-th-name">Name</th>
                      <th>Institution</th>
                      <th className="sl-num">Shares</th>
                      <th className="sl-num">Value</th>
                      <th className="sl-num">Daily P/L</th>
                      <th className="sl-num">Total P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p, i) => (
                      <tr key={`${p.symbol}-${i}`}>
                        <td><span className="sl-symbol">{p.symbol}</span></td>
                        <td className="sl-name">{p.name}</td>
                        <td><span className="sl-inst">{p.institution}</span></td>
                        <td className="sl-num sl-dim">{p.quantity % 1 === 0 ? p.quantity : p.quantity.toFixed(4)}</td>
                        <td className="sl-num sl-value">{fmt$(p.value)}</td>
                        <td className="sl-num"><GainBadge gain={p.dailyGain} /></td>
                        <td className="sl-num"><GainBadge gain={p.totalGain} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="sl-foot-label">Sector total</td>
                      <td className="sl-num sl-foot-val">{fmt$(total)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
