import { Router } from 'express';
import { getDB } from '../db.js';

const router  = Router();
const API_BASE = 'https://api.apexclearing.com';

const ACCOUNTS = [
  { id: '6TL23401', name: 'Stash Personal',         accountType: 'BROKERAGE'       },
  { id: '6SC83605', name: 'Stash Smart Portfolio',   accountType: 'BROKERAGE'       },
  { id: '6SX15928', name: "Stash Talia's Portfolio", accountType: 'BROKERAGE'       },
  { id: '6SQ56409', name: 'Stash Traditional IRA',   accountType: 'TRADITIONAL_IRA' },
];

function sanitizeCookie(raw) {
  return raw
    .replace(/^cookie[:\s]*/i, '')
    .trim()
    .replace(/[^\x00-\x7F]/g, '');
}

function extractJwtSub(cookie) {
  const match = cookie.match(/(?:^|;\s*)apex_jwt=([^;]+)/);
  if (!match) return null;
  try {
    const payload = match[1].split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return decoded.jti ?? decoded.sub ?? null;
  } catch { return null; }
}

function apexHeaders(rawCookie) {
  return {
    'Cookie':     rawCookie,
    'Accept':     'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3.1 Safari/605.1.15',
    'Origin':     'https://public-apps.apexclearing.com',
    'Referer':    'https://public-apps.apexclearing.com/',
  };
}

function detectType(description = '') {
  const d = description.toUpperCase();
  if (
    d.includes(' ETF') || d.includes('FUND') || d.includes('INDEX') ||
    d.includes('TRUST') || d.includes('SHARES') || d.includes('PORTFOLIO') ||
    d.includes('SPDR') || d.includes('ISHARES') || d.includes('VANGUARD') ||
    d.includes('INVESCO') || d.includes('WISDOMTREE') || d.includes('GRANITESHARES') ||
    d.includes('ABRDN') || d.includes('ROBO') || d.includes('BITWISE') ||
    d.includes('HARBOR') || d.includes('FIRST TRUST')
  ) return 'ETF';
  return 'STOCK';
}

function buildGlMap(glData) {
  const map = {};
  for (const lot of (glData?.lot ?? [])) {
    const sym = lot.security?.symbol;
    if (!sym) continue;
    const gain = (lot.stGainLoss ?? 0) + (lot.ltGainLoss ?? 0);
    if (!map[sym]) map[sym] = { totalGain: 0, marketValue: 0 };
    map[sym].totalGain   += gain;
    map[sym].marketValue += lot.marketValue ?? 0;
  }
  return map;
}

function normalizeAccount({ id, name, accountType }, positions, buyingPower, glData) {
  const glMap      = buildGlMap(glData);
  const normalized = [];

  for (const group of (positions ?? [])) {
    for (const pos of (group.positions ?? [])) {
      if (!pos.symbol) continue;
      const qty      = pos.tradeQuantity ?? 0;
      const price    = pos.price         ?? 0;
      const mktVal   = pos.marketValue   ?? 0;
      const dayChange = pos.dayChange    ?? null;
      const prevVal   = dayChange != null ? mktVal - dayChange : null;
      const dayChangePct = (dayChange != null && prevVal > 0)
        ? (dayChange / prevVal) * 100 : null;

      const gl           = glMap[pos.symbol] ?? null;
      const totalGain    = gl ? gl.totalGain : null;
      const rawCostBasis = (gl && gl.marketValue > 0) ? gl.marketValue - gl.totalGain : null;
      const totalGainPct = (rawCostBasis != null && rawCostBasis > 0)
        ? (totalGain / rawCostBasis) * 100 : null;

      normalized.push({
        instrument:        { symbol: pos.symbol, name: pos.description || pos.symbol, type: detectType(pos.description) },
        quantity:          String(qty),
        lastPrice:         { lastPrice: price },
        currentValue:      mktVal,
        positionDailyGain: dayChange != null ? { gainValue: dayChange, gainPercentage: dayChangePct } : null,
        costBasis:         totalGain != null  ? { gainValue: totalGain, gainPercentage: totalGainPct } : null,
      });
    }
  }

  const equityMap = {};
  for (const pos of normalized) {
    equityMap[pos.instrument.type] = (equityMap[pos.instrument.type] || 0) + pos.currentValue;
  }
  const totalEquity = Object.values(equityMap).reduce((s, v) => s + v, 0);
  const equity = Object.entries(equityMap).map(([type, value]) => ({
    type,
    value: String(value),
    percentageOfPortfolio: totalEquity > 0 ? (value / totalEquity) * 100 : 0,
  }));

  return {
    accountId:   id,
    accountName: name,
    accountType,
    portfolio: { positions: normalized, equity, buyingPower: { buyingPower: buyingPower ?? 0 } },
  };
}

async function getStoredCookies(db) {
  // Migrate legacy single-cookie doc if present
  const legacy = await db.collection('apex_session').findOne({ _id: 'session' });
  if (legacy?.cookie) {
    const existing = await db.collection('apex_session').findOne({ _id: 'sessions' });
    if (!existing) {
      await db.collection('apex_session').updateOne(
        { _id: 'sessions' },
        { $set: { _id: 'sessions', cookies: [legacy.cookie], updatedAt: legacy.updatedAt ?? new Date() } },
        { upsert: true },
      );
    }
    await db.collection('apex_session').deleteOne({ _id: 'session' });
  }
  const doc = await db.collection('apex_session').findOne({ _id: 'sessions' });
  return doc?.cookies ?? [];
}

async function getCachedPositions(db) {
  const doc = await db.collection('apex_positions').findOne({ _id: 'cache' });
  return doc ?? null;
}

// ── GET /api/apex/status ──────────────────────────────────────────────────────
router.get('/status', async (_req, res) => {
  try {
    const cookies = await getStoredCookies(getDB());
    res.json({ connected: cookies.length > 0, sessionCount: cookies.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/apex/cookie — add a session ─────────────────────────────────────
router.post('/cookie', async (req, res) => {
  try {
    let { cookie } = req.body;
    if (!cookie || typeof cookie !== 'string') {
      return res.status(400).json({ error: 'cookie value required' });
    }
    cookie = sanitizeCookie(cookie);
    const jti = extractJwtSub(cookie);

    const db  = getDB();
    const doc = await db.collection('apex_session').findOne({ _id: 'sessions' });
    let cookies = doc?.cookies ?? [];

    // Replace existing entry with same JWT identity, otherwise append
    if (jti) {
      const idx = cookies.findIndex((c) => extractJwtSub(c) === jti);
      if (idx >= 0) cookies[idx] = cookie;
      else cookies.push(cookie);
    } else {
      cookies.push(cookie);
    }

    await db.collection('apex_session').updateOne(
      { _id: 'sessions' },
      { $set: { _id: 'sessions', cookies, updatedAt: new Date() } },
      { upsert: true },
    );
    res.json({ ok: true, sessionCount: cookies.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/apex/cookies — clear all sessions ─────────────────────────────
router.delete('/cookies', async (_req, res) => {
  try {
    await getDB().collection('apex_session').deleteOne({ _id: 'sessions' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/apex/positions ───────────────────────────────────────────────────
router.get('/positions', async (_req, res) => {
  const db = getDB();
  try {
    const cookies = await getStoredCookies(db);
    if (cookies.length === 0) {
      const cached = await getCachedPositions(db);
      if (cached) return res.json({ accounts: cached.accounts, cached: true, cachedAt: cached.savedAt });
      return res.status(401).json({ error: 'not_connected' });
    }

    const cached      = await getCachedPositions(db);
    const cacheMap    = Object.fromEntries((cached?.accounts ?? []).map((a) => [a.accountId, a]));
    const freshMap    = {};
    const expiredJtis = new Set();

    for (const acct of ACCOUNTS) {
      for (const cookie of cookies) {
        const jti = extractJwtSub(cookie);
        if (jti && expiredJtis.has(jti)) continue;

        try {
          const headers = apexHeaders(cookie);
          const [posRes, balRes, glRes] = await Promise.all([
            fetch(`${API_BASE}/margin-provider/api/v1/positions/${acct.id}`, { headers }),
            fetch(`${API_BASE}/cash-balances/api/v2/available/${acct.id}`,   { headers }),
            fetch(`${API_BASE}/taxman/api/v1/gainloss/${acct.id}/unrealized?fromdate=19000101&page=1&pagesize=10000`, { headers }),
          ]);

          if (posRes.status === 401) { if (jti) expiredJtis.add(jti); continue; }
          if (posRes.status === 403) continue;
          if (!posRes.ok) continue;

          const posData     = await posRes.json();
          const buyingPower = balRes.ok ? (await balRes.json()).openBalance ?? 0 : 0;
          const glData      = glRes.ok  ? (await glRes.json()) : null;
          freshMap[acct.id] = normalizeAccount(acct, posData, buyingPower, glData);
          break;
        } catch {
          // network error — try next cookie
        }
      }
    }

    // Remove expired cookies from DB
    if (expiredJtis.size > 0) {
      const remaining = cookies.filter((c) => {
        const jti = extractJwtSub(c);
        return !jti || !expiredJtis.has(jti);
      });
      await db.collection('apex_session').updateOne(
        { _id: 'sessions' },
        { $set: { cookies: remaining, updatedAt: new Date() } },
      );
    }

    // Merge: fresh data takes priority; fall back to cache for accounts not fetched
    const accounts = ACCOUNTS
      .map((a) => freshMap[a.id] ?? cacheMap[a.id] ?? null)
      .filter(Boolean);

    const allFromCache = accounts.length > 0 && accounts.every((a) => !freshMap[a.accountId]);
    const cachedAt     = allFromCache ? (cached?.savedAt ?? null) : null;

    if (Object.keys(freshMap).length === 0 && accounts.length === 0) {
      const remainingCookies = cookies.filter((c) => {
        const jti = extractJwtSub(c);
        return !jti || !expiredJtis.has(jti);
      });
      if (remainingCookies.length === 0) {
        return res.status(401).json({ error: 'session_expired' });
      }
    }

    // Update cache with any freshly fetched accounts
    if (Object.keys(freshMap).length > 0) {
      const mergedForCache = ACCOUNTS
        .map((a) => freshMap[a.id] ?? cacheMap[a.id] ?? null)
        .filter(Boolean);
      await db.collection('apex_positions').updateOne(
        { _id: 'cache' },
        { $set: { _id: 'cache', accounts: mergedForCache, savedAt: new Date() } },
        { upsert: true },
      );
    }

    res.json({ accounts, ...(cachedAt ? { cached: true, cachedAt } : {}) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
