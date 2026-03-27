import { Router } from 'express';

const router = Router();

const AUTH_BASE   = 'https://api.schwabapi.com/v1/oauth';
const TRADER_BASE = 'https://api.schwabapi.com/trader/v1';

const CLIENT_ID    = process.env.SCHWAB_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.SCHWAB_CLIENT_SECRET || '';
const REDIRECT_URI  = process.env.SCHWAB_REDIRECT_URI  || 'http://localhost:3001/api/schwab/callback';
const CLIENT_URL    = process.env.CLIENT_URL            || 'http://localhost:5173';

// ── Token cache ───────────────────────────────────────────────────────────────
const tokenCache = {
  accessToken:    null,
  refreshToken:   process.env.SCHWAB_REFRESH_TOKEN || null,
  accessExpiresAt: 0,
};

function basicAuth() {
  return Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
}

async function exchangeRefreshToken() {
  if (!tokenCache.refreshToken) {
    throw Object.assign(new Error('Not authorized — connect your Schwab account first'), { status: 401 });
  }

  const res = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: tokenCache.refreshToken,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 401) tokenCache.refreshToken = null; // token revoked
    throw Object.assign(
      new Error(`Schwab token refresh failed (${res.status})`),
      { status: res.status, detail },
    );
  }

  const data = await res.json();
  tokenCache.accessToken    = data.access_token;
  tokenCache.accessExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  if (data.refresh_token) tokenCache.refreshToken = data.refresh_token;
  return tokenCache.accessToken;
}

async function getAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.accessExpiresAt) {
    return tokenCache.accessToken;
  }
  return exchangeRefreshToken();
}

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
    const type =
      assetType === 'EQUITY'       ? 'EQUITY'  :
      assetType === 'OPTION'       ? 'OPTION'  :
      assetType === 'FIXED_INCOME' ? 'BOND'    :
      assetType === 'CRYPTO'       ? 'CRYPTO'  : 'EQUITY';

    return {
      instrument: {
        symbol: pos.instrument.symbol,
        name:   pos.instrument.description || pos.instrument.symbol,
        type,
      },
      quantity:   String(qty),
      lastPrice:  { lastPrice: price },
      currentValue: pos.marketValue,
      positionDailyGain: pos.currentDayProfitLoss != null ? {
        gainValue:       pos.currentDayProfitLoss,
        gainPercentage:  pos.currentDayProfitLossPercentage || 0,
      } : null,
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
      pos.instrument.type === 'EQUITY' ? 'STOCK'  :
      pos.instrument.type === 'BOND'   ? 'BONDS'  :
      pos.instrument.type === 'CRYPTO' ? 'CRYPTO' : 'STOCK';
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
    authorized:  !!tokenCache.refreshToken,
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
    tokenCache.accessToken     = data.access_token;
    tokenCache.refreshToken    = data.refresh_token;
    tokenCache.accessExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

    res.redirect(`${CLIENT_URL}?schwab=connected`);
  } catch (err) {
    res.status(502).send(`OAuth error: ${err.message}`);
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
    res.json({ accounts });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
