import { Router } from 'express';
import { getDB } from '../db.js';
import { addSymbols } from '../volume-alert/dao/symbolDao.js';

const router = Router();

function parseNum(s) {
  if (!s || s === '--' || s.trim() === '') return null;
  const n = parseFloat(s.replace(/[$+%,]/g, ''));
  return isNaN(n) ? null : n;
}

function detectType(symbol, description) {
  const sym = symbol || '';
  const desc = (description || '').toUpperCase();

  if (sym.includes('*') || desc.includes('FDIC') || desc.includes('DEPOSIT SWEEP') || desc.includes('FCASH') || desc.includes('HELD IN FCASH')) {
    return 'CASH_EQ';
  }

  // Mutual fund tickers end in X (FSDAX, VUSUX) or contain digits (CUSIPs like 89651T804, NHX203606)
  if (/\d/.test(sym) || /^[A-Z]{4,}X$/.test(sym)) {
    return 'MUTUAL_FUND';
  }

  if (
    desc.includes(' ETF') ||
    desc.includes('ISHARES') ||
    desc.includes('SPDR') ||
    desc.includes('INVESCO') ||
    desc.includes('VANECK') ||
    desc.includes('WISDOMTREE') ||
    desc.includes('INDEX FUND')
  ) {
    return 'ETF';
  }

  return 'STOCK';
}

function mapAccountType(accountName) {
  const name = (accountName || '').toUpperCase();
  if (name.includes('ROTH'))        return 'ROTH_IRA';
  if (name.includes('TRADITIONAL')) return 'TRADITIONAL_IRA';
  if (name.includes('ROLLOVER'))    return 'ROLLOVER_IRA';
  if (name.includes('403'))         return '403B';
  if (name.includes('401'))         return '401A';
  if (name.includes('INDIVIDUAL') || name.includes('TOD')) return 'BROKERAGE';
  return accountName; // custom names (e.g. "Talia", "ACUITY INTL.")
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());

  const headerIdx = lines.findIndex(l => l.startsWith('Account Number'));
  if (headerIdx === -1) throw new Error('Invalid Fidelity CSV: header row not found');

  const headers = lines[headerIdx].split(',').map(h => h.trim());
  const accountsMap = {};

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    // Stop at disclaimer lines (quoted) or lines that don't start with an account token
    if (line.startsWith('"') || !/^[A-Z0-9]/i.test(line)) break;

    const cols = line.split(',').map(c => c.trim());
    if (cols.length < headers.length - 2) continue;

    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });

    const accountNum  = row['Account Number'];
    const accountName = row['Account Name'];
    const symbol      = row['Symbol'];
    const description = row['Description'];
    if (!accountNum) continue;

    if (!accountsMap[accountNum]) {
      accountsMap[accountNum] = {
        accountId:   accountNum,
        accountType: mapAccountType(accountName),
        cashBalance: 0,
        positions:   [],
      };
    }

    const type = detectType(symbol, description);

    if (type === 'CASH_EQ') {
      const val = parseNum(row['Current Value']);
      if (val) accountsMap[accountNum].cashBalance += val;
      continue;
    }

    const qty          = parseNum(row['Quantity']);
    const price        = parseNum(row['Last Price']);
    const currentValue = parseNum(row['Current Value']);
    if (!qty || !currentValue) continue;

    const dailyGainVal = parseNum(row["Today's Gain/Loss Dollar"]);
    const dailyGainPct = parseNum(row["Today's Gain/Loss Percent"]);
    const totalGainVal = parseNum(row["Total Gain/Loss Dollar"]);
    const totalGainPct = parseNum(row["Total Gain/Loss Percent"]);

    accountsMap[accountNum].positions.push({
      instrument:   { symbol, name: description, type },
      quantity:     String(qty),
      lastPrice:    { lastPrice: price ?? 0 },
      currentValue: currentValue,
      positionDailyGain: dailyGainVal != null ? { gainValue: dailyGainVal, gainPercentage: dailyGainPct ?? 0 } : null,
      costBasis:         totalGainVal != null ? { gainValue: totalGainVal, gainPercentage: totalGainPct ?? 0 } : null,
    });
  }

  const accounts = Object.values(accountsMap).map(acct => {
    const equityMap = {};
    for (const pos of acct.positions) {
      const key =
        pos.instrument.type === 'ETF'         ? 'ETF'         :
        pos.instrument.type === 'MUTUAL_FUND' ? 'MUTUAL_FUND' :
        pos.instrument.type === 'BOND'        ? 'BONDS'       :
        pos.instrument.type === 'CRYPTO'      ? 'CRYPTO'      : 'STOCK';
      equityMap[key] = (equityMap[key] || 0) + pos.currentValue;
    }
    if (acct.cashBalance > 0) equityMap['CASH'] = acct.cashBalance;

    const totalEquity = Object.values(equityMap).reduce((s, v) => s + v, 0);
    const equity = Object.entries(equityMap).map(([type, value]) => ({
      type,
      value: String(value),
      percentageOfPortfolio: totalEquity > 0 ? (value / totalEquity) * 100 : 0,
    }));

    return {
      accountId:   acct.accountId,
      accountType: acct.accountType,
      portfolio: {
        positions:   acct.positions,
        equity,
        buyingPower: { buyingPower: acct.cashBalance },
      },
    };
  });

  return { accounts };
}

// GET /api/fidelity/positions
router.get('/positions', async (_req, res) => {
  try {
    const doc = await getDB().collection('fidelity_positions').findOne({ _id: 'latest' });
    res.json(doc ? { accounts: doc.accounts, uploadedAt: doc.uploadedAt } : { accounts: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fidelity/upload  (body: CSV as plain text)
router.post('/upload', async (req, res) => {
  try {
    const csv = req.body;
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'CSV text required' });

    const data = parseCSV(csv);
    const now  = new Date();

    await getDB().collection('fidelity_positions').updateOne(
      { _id: 'latest' },
      { $set: { _id: 'latest', accounts: data.accounts, uploadedAt: now } },
      { upsert: true },
    );

    const symbols = data.accounts.flatMap((a) =>
      (a.portfolio.positions ?? []).map((p) => p.instrument.symbol).filter(Boolean),
    );
    addSymbols(symbols, 'fidelity').catch(() => {});

    res.json({ ...data, uploadedAt: now });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
