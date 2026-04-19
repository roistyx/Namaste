import { Router } from 'express';
import { getDB } from '../db.js';
import { addSymbols } from '../volume-alert/dao/symbolDao.js';
import {
  CLIENT_ID, CLIENT_SECRET,
  basicAuth, getAccessToken,
  setTokens, isAuthorized,
} from '../schwabClient.js';

const router = Router();

const AUTH_BASE   = 'https://api.schwabapi.com/v1/oauth';
const TRADER_BASE = 'https://api.schwabapi.com/trader/v1';

const REDIRECT_URI = process.env.SCHWAB_REDIRECT_URI || 'http://localhost:3001/api/schwab/callback';
const CLIENT_URL   = process.env.CLIENT_URL           || 'http://localhost:5173';

function sendError(res, err) {
  const status = err.status >= 400 && err.status < 500 ? err.status : 502;
  res.status(status).json({ error: err.message, detail: err.detail ?? null });
}

// ── Normalize Schwab → common position shape ──────────────────────────────────
function normalizeAccount(raw) {
  const sa = raw.securitiesAccount;

  const positions = (sa.positions || []).map((pos) => {
    const qty      = pos.longQuantity || 0;
    const price    = qty > 0 ? pos.marketValue / qty : 0;
    const costTotal = (pos.averagePrice || 0) * qty;
    const gainValue = pos.marketValue - costTotal;
    const gainPct   = costTotal > 0 ? (gainValue / costTotal) * 100 : 0;

    const assetType = pos.instrument.assetType;
    const instType  = pos.instrument.type;
    const type =
      assetType === 'COLLECTIVE_INVESTMENT' && instType === 'EXCHANGE_TRADED_FUND' ? 'ETF'         :
      assetType === 'MUTUAL_FUND'                                                   ? 'MUTUAL_FUND' :
      assetType === 'CASH_EQUIVALENT'                                               ? 'CASH_EQ'     :
      assetType === 'EQUITY'                                                        ? 'STOCK'       :
      assetType === 'OPTION'                                                        ? 'OPTION'      :
      assetType === 'FIXED_INCOME'                                                  ? 'BOND'        :
      assetType === 'CRYPTO'                                                        ? 'CRYPTO'      : 'STOCK';

    return {
      instrument: {
        symbol: pos.instrument.symbol,
        name:   pos.instrument.description || pos.instrument.symbol,
        type,
      },
      quantity:   String(qty),
      lastPrice:  { lastPrice: price },
      currentValue: pos.marketValue,
      positionDailyGain: (() => {
        const netChange = pos.instrument.netChange;
        if (netChange == null) return null;
        const gainValue = netChange * qty;
        const prevClose = price - netChange;
        const gainPct   = prevClose > 0 ? (netChange / prevClose) * 100 : 0;
        return { gainValue, gainPercentage: gainPct };
      })(),
      costBasis: costTotal > 0 ? {
        gainValue,
        gainPercentage: gainPct,
      } : null,
      openedAt: pos.instrument.cusip || pos.instrument.symbol,
    };
  });

  // Build equity breakdown
  const equityMap = {};
  for (const pos of positions) {
    const key =
      pos.instrument.type === 'ETF'         ? 'ETF'         :
      pos.instrument.type === 'MUTUAL_FUND' ? 'MUTUAL_FUND' :
      pos.instrument.type === 'BOND'        ? 'BONDS'       :
      pos.instrument.type === 'CRYPTO'      ? 'CRYPTO'      :
      pos.instrument.type === 'CASH_EQ'     ? 'CASH'        : 'STOCK';
    equityMap[key] = (equityMap[key] || 0) + pos.currentValue;
  }
  const cash = sa.currentBalances?.cashBalance || 0;
  if (cash > 0) equityMap['CASH'] = cash;

  const totalEquity = Object.values(equityMap).reduce((s, v) => s + v, 0);
  const equity = Object.entries(equityMap).map(([type, value]) => ({
    type,
    value: String(value),
    percentageOfPortfolio: totalEquity > 0 ? (value / totalEquity) * 100 : 0,
  }));

  const ACCOUNT_TYPE_MAP = { MARGIN: 'BROKERAGE', CASH: 'BROKERAGE', IRA: 'TRADITIONAL_IRA' };

  return {
    accountId:   sa.accountNumber,
    accountType: ACCOUNT_TYPE_MAP[sa.type] ?? sa.type,
    portfolio: {
      positions,
      equity,
      buyingPower: {
        buyingPower: sa.currentBalances?.buyingPower ?? sa.currentBalances?.availableFunds ?? 0,
      },
    },
  };
}

// ── GET /api/schwab/status ────────────────────────────────────────────────────
router.get('/status', (_req, res) => {
  res.json({
    authorized:  isAuthorized(),
    configured:  !!(CLIENT_ID && CLIENT_SECRET),
  });
});

// ── GET /api/schwab/auth — kick off OAuth flow ────────────────────────────────
router.get('/auth', (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: 'SCHWAB_CLIENT_ID and SCHWAB_CLIENT_SECRET are not configured.' });
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    scope:         'api',
  });
  res.redirect(`${AUTH_BASE}/authorize?${params}`);
});

// ── GET /api/schwab/callback — OAuth callback ─────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing authorization code.');

  try {
    const tokenRes = await fetch(`${AUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth()}`,
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      return res.status(tokenRes.status).send(`Token exchange failed: ${detail}`);
    }

    const data = await tokenRes.json();
    setTokens(data);

    res.redirect(`${CLIENT_URL}?schwab=connected`);
  } catch (err) {
    res.status(502).send(`OAuth error: ${err.message}`);
  }
});

// ── GET /api/schwab/account-numbers — returns [{accountNumber, hashValue}] ─────
router.get('/account-numbers', async (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: 'Schwab API credentials are not configured.' });
  }
  let token;
  try { token = await getAccessToken(); } catch (err) { return sendError(res, err); }

  try {
    const apiRes = await fetch(`${TRADER_BASE}/accounts/accountNumbers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!apiRes.ok) {
      let detail;
      try { detail = await apiRes.json(); } catch { detail = await apiRes.text(); }
      return sendError(res, Object.assign(new Error(`Schwab API ${apiRes.status}`), { status: apiRes.status, detail }));
    }
    res.json(await apiRes.json());
  } catch (err) {
    sendError(res, err);
  }
});

// ── GET /api/schwab/accounts/:accountHash/transactions ────────────────────────
const MAX_YEARS = 20;

async function fetchTransactionWindow(token, accountHash, windowStart, windowEnd) {
  const params = new URLSearchParams({ startDate: windowStart, endDate: windowEnd });
  const apiRes = await fetch(
    `${TRADER_BASE}/accounts/${accountHash}/transactions?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!apiRes.ok) {
    let detail;
    try { detail = await apiRes.json(); } catch { detail = await apiRes.text(); }
    throw Object.assign(new Error(`Schwab API ${apiRes.status}`), { status: apiRes.status, detail });
  }
  return apiRes.json();
}

// Merge two transaction arrays, deduplicating by activityId
function mergeTransactions(existing, incoming) {
  const seen = new Set(existing.map((t) => t.activityId));
  return [...existing, ...incoming.filter((t) => !seen.has(t.activityId))];
}

// Normalise a string for loose comparison
function normalise(s) {
  return (s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
}

// Return true if a transaction involves the given symbol or instrument name
function matchesSymbol(t, symbol, name) {
  // Direct symbol match (works for trades, transfers, etc.)
  if (t.transactionItem?.instrument?.symbol === symbol) return true;
  if (t.transferItems?.some((i) => i.instrument?.symbol === symbol)) return true;

  // Dividends only carry the fund name in `description` — match against it.
  // Require ALL significant words from the instrument name to appear in the
  // description so that e.g. "Vanguard Small-Cap ETF" doesn't match "Mega Cap ETF".
  if (t.type === 'DIVIDEND_OR_INTEREST' && name) {
    const desc  = normalise(t.description);
    const parts = normalise(name).split(' ').filter((w) => w.length > 2);
    if (parts.length > 0 && parts.every((w) => desc.includes(w))) return true;
  }

  return false;
}

router.get('/accounts/:accountHash/transactions', async (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: 'Schwab API credentials are not configured.' });
  }

  let token;
  try {
    token = await getAccessToken();
  } catch (err) {
    return sendError(res, err);
  }

  const { accountHash } = req.params;
  const { symbol, name } = req.query;

  try {
    const db = getDB();
    // Cache keyed by accountHash only — covers all symbols
    const col = db.collection('transaction_history');
    const cached = await col.findOne({ accountHash, perAccount: true });

    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Always refresh the past year to pick up new transactions
    const recentRaw = await fetchTransactionWindow(token, accountHash, oneYearAgo.toISOString(), now.toISOString());
    const recentItems = Array.isArray(recentRaw) ? recentRaw : [];

    let allTransactions;

    if (cached) {
      allTransactions = mergeTransactions(cached.transactions, recentItems);
      await col.updateOne(
        { accountHash, perAccount: true },
        { $set: { transactions: allTransactions, lastUpdated: now } },
      );
    } else {
      // No cache — paginate backwards year by year
      allTransactions = [...recentItems];
      let windowEnd = oneYearAgo;
      let consecutiveEmpty = 0;

      for (let i = 0; i < MAX_YEARS - 1; i++) {
        const windowStart = new Date(windowEnd);
        windowStart.setFullYear(windowStart.getFullYear() - 1);

        const batch = await fetchTransactionWindow(token, accountHash, windowStart.toISOString(), windowEnd.toISOString());
        const items = Array.isArray(batch) ? batch : [];
        allTransactions.push(...items);

        if (items.length === 0) {
          if (++consecutiveEmpty >= 2) break;
        } else {
          consecutiveEmpty = 0;
        }
        windowEnd = windowStart;
      }

      await col.updateOne(
        { accountHash, perAccount: true },
        { $set: { accountHash, perAccount: true, transactions: allTransactions, lastUpdated: now } },
        { upsert: true },
      );
    }

    // Filter by symbol in memory — reliable across all transaction types
    const filtered = symbol
      ? allTransactions.filter((t) => matchesSymbol(t, symbol, name))
      : allTransactions;

    res.set('Cache-Control', 'no-store').json(filtered);
  } catch (err) {
    sendError(res, err);
  }
});

// ── GET /api/schwab/positions ─────────────────────────────────────────────────
router.get('/positions', async (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: 'Schwab API credentials are not configured.' });
  }

  let token;
  try {
    token = await getAccessToken();
  } catch (err) {
    return sendError(res, err);
  }

  try {
    const apiRes = await fetch(`${TRADER_BASE}/accounts?fields=positions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!apiRes.ok) {
      let detail;
      try { detail = await apiRes.json(); } catch { detail = await apiRes.text(); }
      return sendError(res, Object.assign(new Error(`Schwab API ${apiRes.status}`), { status: apiRes.status, detail }));
    }

    const raw = await apiRes.json();
    const accounts = (Array.isArray(raw) ? raw : []).map(normalizeAccount);

    const symbols = accounts.flatMap((a) =>
      (a.portfolio.positions ?? [])
        .filter((p) => !['CASH_EQ', 'OPTION'].includes(p.instrument.type))
        .map((p) => p.instrument.symbol)
        .filter(Boolean),
    );
    addSymbols(symbols, 'schwab').catch(() => {});

    res.json({ accounts });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
