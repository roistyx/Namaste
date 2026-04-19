import { Router } from 'express';
import { getDB } from '../db.js';

const router = Router();

function parseNum(s) {
  if (!s || !s.trim()) return null;
  const n = parseFloat(s.replace(/[$%,<>+\s]/g, ''));
  return isNaN(n) ? null : n;
}

function detectType(name) {
  const n = name.toUpperCase();
  if (
    n.includes(' ETF') || n.includes('TRUST') || n.includes('FUND') ||
    n.includes('ISHARES') || n.includes('SPDR') || n.includes('WISDOMTREE') ||
    n.includes('GRANITESHARES') || n.includes('HARBOR') || n.includes('ABERDEEN') ||
    n.includes('STANDARD PHYSICAL')
  ) return 'ETF';

  const STOCKS = [
    'ALPHABET', 'NVIDIA', 'MICROSOFT', 'AMAZON', 'META PLATFORMS',
    'MASTERCARD', 'SANDISK', 'INTEL', 'AMD', 'CATERPILLAR', 'TAKE-TWO',
  ];
  if (STOCKS.some((s) => n.includes(s))) return 'STOCK';

  // Stash themed portfolios are ETF-based smart portfolios
  return 'ETF';
}

// Handles quoted fields with commas inside (e.g. "$5,548.03")
function parseRow(line) {
  const cols = [];
  let cur = '', inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { cols.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  cols.push(cur.trim());
  return cols;
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  const positions = [];

  for (let i = 1; i < lines.length; i++) {  // skip header
    const cols = parseRow(lines[i]);
    if (cols.length < 4) continue;

    const name         = cols[0]?.trim();
    const currentValue = parseNum(cols[2]);
    const perfPct      = parseNum(cols[3]);

    if (!name || currentValue == null) continue;

    positions.push({
      instrument:        { symbol: '', name, type: detectType(name) },
      quantity:          null,
      lastPrice:         { lastPrice: null },
      currentValue,
      positionDailyGain: null,
      costBasis:         perfPct != null ? { gainValue: null, gainPercentage: perfPct } : null,
    });
  }

  const equityMap = {};
  for (const pos of positions) {
    const key = pos.instrument.type;
    equityMap[key] = (equityMap[key] || 0) + pos.currentValue;
  }
  const totalEquity = Object.values(equityMap).reduce((s, v) => s + v, 0);
  const equity = Object.entries(equityMap).map(([type, value]) => ({
    type,
    value: String(value),
    percentageOfPortfolio: totalEquity > 0 ? (value / totalEquity) * 100 : 0,
  }));

  return { positions, equity, buyingPower: { buyingPower: 0 } };
}

async function getAllAccounts(db) {
  const docs = await db.collection('stash_positions')
    .find({ _id: { $ne: 'latest' } })
    .toArray();
  return docs.map((d) => ({
    accountId:   d.accountId,
    accountName: d.accountName,
    accountType: d.accountType,
    portfolio:   d.portfolio,
    uploadedAt:  d.uploadedAt,
  }));
}

router.get('/positions', async (_req, res) => {
  try {
    const accounts = await getAllAccounts(getDB());
    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload', async (req, res) => {
  try {
    const csv = req.body;
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'CSV text required' });

    const { accountId, accountName } = req.query;
    if (!accountId) return res.status(400).json({ error: 'accountId query param required' });

    const portfolio = parseCSV(csv);
    const now = new Date();

    const db = getDB();
    await db.collection('stash_positions').updateOne(
      { _id: accountId },
      { $set: { _id: accountId, accountId, accountName: accountName || accountId, accountType: 'BROKERAGE', portfolio, uploadedAt: now } },
      { upsert: true },
    );

    const accounts = await getAllAccounts(db);
    res.json({ accounts });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
