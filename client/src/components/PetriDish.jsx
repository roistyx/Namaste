import './PetriDish.css';

const SIZE = 210;
const CX = SIZE / 2;
const CY = SIZE / 2;
const DISH_R = 90;

// Archimedes spiral: oldest day at centre, newest at edge
function spiralCoords(n) {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const angle = -Math.PI * 0.5 + t * Math.PI * 1.75; // 315° sweep
    const r = DISH_R * (0.13 + t * 0.65);
    return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
  });
}

function colonyColor(pct) {
  const v = parseFloat(pct) || 0;
  if (v >= 2.5) return '#00e8a0';
  if (v >= 1.0) return '#00c878';
  if (v >= 0)   return '#60a870';
  if (v > -1.0) return '#c05840';
  if (v > -2.5) return '#e03030';
  return '#ff1a1a';
}

// Deterministic wobble for mycelium control points
function wobble(i, scale) {
  return Math.sin(i * 2.618) * scale;
}

export default function PetriDish({ data, loading, error, ticker }) {
  if (loading) {
    return (
      <div className="petri-state">
        <span className="petri-spinner" />
        <span>Growing cultures…</span>
      </div>
    );
  }
  if (error || !data?.length) {
    return <div className="petri-state petri-empty">No culture data</div>;
  }

  const id = ticker.replace(/[^a-z0-9]/gi, '');
  const maxVol = Math.max(...data.map(d => d.volume));
  const maxAbsPct = Math.max(...data.map(d => Math.abs(d.changePercent)), 0.1);
  const coords = spiralCoords(data.length);

  const colonies = data.map((d, i) => ({
    ...coords[i],
    r: 8 + (d.volume / maxVol) * 26,
    color: colonyColor(d.changePercent),
    d,
    i,
  }));

  return (
    <div className="petri-wrap">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-label={`${ticker} weekly fungi chart`}
      >
        <defs>
          {/* Agar substrate gradient */}
          <radialGradient id={`agar-${id}`} cx="42%" cy="38%" r="62%">
            <stop offset="0%"   stopColor="#0d2010" />
            <stop offset="55%"  stopColor="#080e09" />
            <stop offset="100%" stopColor="#040704" />
          </radialGradient>

          {/* Per-colony glow/blur — organic softness */}
          <filter id={`blob-${id}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="blur" />
            <feColorMatrix
              in="blur" type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              result="mask"
            />
            <feComposite in="SourceGraphic" in2="mask" operator="in" />
          </filter>

          {/* Outer glow for colonies */}
          <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <clipPath id={`clip-${id}`}>
            <circle cx={CX} cy={CY} r={DISH_R - 3} />
          </clipPath>
        </defs>

        {/* ── Agar substrate ── */}
        <circle cx={CX} cy={CY} r={DISH_R} fill={`url(#agar-${id})`} />

        {/* Substrate depth rings */}
        {[0.32, 0.58, 0.84].map((f, i) => (
          <circle
            key={i} cx={CX} cy={CY} r={DISH_R * f}
            fill="none" stroke="rgba(28,56,32,0.45)" strokeWidth="0.6"
          />
        ))}

        <g clipPath={`url(#clip-${id})`}>

          {/* ── Mycelium filaments ── */}
          {colonies.map((c, i) => {
            if (i === 0) return null;
            const prev = colonies[i - 1];
            const mx = (prev.x + c.x) / 2 + wobble(i, 11);
            const my = (prev.y + c.y) / 2 + wobble(i + 3, 11);
            return (
              <path key={i}
                d={`M ${prev.x} ${prev.y} Q ${mx} ${my} ${c.x} ${c.y}`}
                fill="none"
                stroke="rgba(80,170,95,0.22)"
                strokeWidth="1.1"
                strokeDasharray="2.5 3.5"
              />
            );
          })}

          {/* Secondary micro-filaments for texture */}
          {colonies.map((c, i) => {
            if (i === 0) return null;
            const prev = colonies[i - 1];
            const mx = (prev.x + c.x) / 2 + wobble(i + 7, 16);
            const my = (prev.y + c.y) / 2 + wobble(i + 1, 16);
            return (
              <path key={`m2-${i}`}
                d={`M ${prev.x} ${prev.y} Q ${mx} ${my} ${c.x} ${c.y}`}
                fill="none"
                stroke="rgba(60,140,75,0.10)"
                strokeWidth="0.7"
                strokeDasharray="1.5 5"
              />
            );
          })}

          {/* ── Colonies (organic blobs via overlapping circles + blur) ── */}
          {colonies.map((c) => {
            // Bumps at fixed angular offsets for organic silhouette
            const bumps = [
              { a: 0.9,  rf: 0.62 },
              { a: 2.4,  rf: 0.55 },
              { a: 3.9,  rf: 0.60 },
              { a: 5.2,  rf: 0.50 },
            ];
            return (
              <g key={c.i} filter={`url(#blob-${id})`}>
                <circle cx={c.x} cy={c.y} r={c.r} fill={c.color} opacity={0.92} />
                {bumps.map((b, bi) => (
                  <circle
                    key={bi}
                    cx={c.x + Math.cos(b.a + c.i) * c.r * 0.52}
                    cy={c.y + Math.sin(b.a + c.i) * c.r * 0.52}
                    r={c.r * b.rf}
                    fill={c.color}
                    opacity={0.72}
                  />
                ))}
              </g>
            );
          })}

          {/* Spore dots scattered around each colony */}
          {colonies.map((c) =>
            [0, 1, 2].map((si) => {
              const sa = (c.i * 1.9 + si * 2.1);
              const sr = c.r * (1.35 + si * 0.22);
              return (
                <circle
                  key={`spore-${c.i}-${si}`}
                  cx={c.x + Math.cos(sa) * sr}
                  cy={c.y + Math.sin(sa) * sr}
                  r={1.2}
                  fill={c.color}
                  opacity={0.35}
                />
              );
            })
          )}
        </g>

        {/* ── Glass rim ── */}
        <circle cx={CX} cy={CY} r={DISH_R + 1.5}
          fill="none" stroke="rgba(60,100,65,0.4)" strokeWidth="1" />
        <circle cx={CX} cy={CY} r={DISH_R}
          fill="none" stroke="rgba(160,210,165,0.18)" strokeWidth="5" />
        <circle cx={CX} cy={CY} r={DISH_R - 4}
          fill="none" stroke="rgba(200,230,200,0.07)" strokeWidth="1.5" />

        {/* ── Day labels ── */}
        {colonies.map((c) => {
          const dx = c.x - CX;
          const dy = c.y - CY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const pad = c.r + 8;
          return (
            <text
              key={`lbl-${c.i}`}
              x={c.x + (dx / dist) * pad}
              y={c.y + (dy / dist) * pad}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="6.5"
              fill="rgba(140,200,148,0.6)"
              fontFamily="monospace"
            >
              {new Date(c.d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
            </text>
          );
        })}
      </svg>

      {/* ── Price-change bar chart ── */}
      <div className="petri-bars">
        {data.map((d, i) => {
          const pos = d.changePercent >= 0;
          const barH = Math.max(3, (Math.abs(d.changePercent) / maxAbsPct) * 34);
          return (
            <div key={i} className="petri-bar-col">
              <span className={`petri-pct ${pos ? 'pos' : 'neg'}`}>
                {pos ? '+' : ''}{d.changePercent.toFixed(1)}%
              </span>
              <div
                className="petri-bar"
                style={{ height: `${barH}px`, background: pos ? '#00c896' : '#ff4d6d' }}
              />
              <span className="petri-bar-day">
                {new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
