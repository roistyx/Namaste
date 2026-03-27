import { Router } from 'express';

const router = Router();
const BASE = 'https://api.public.com';
const SECRET = process.env.PUBLIC_API_SECRET || '';

// ── Token cache (tokens live 60 min) ─────────────────────────────────────────
const tokenCache = { value: null, expiresAt: 0 };

async function getAccessToken() {
  // Reuse if more than 60s of life remains
  if (tokenCache.value && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.value;
  }

  const res = await fetch(`${BASE}/userapiauthservice/personal/access-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ validityInMinutes: 60, secret: SECRET }),
  });

  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`Public auth failed (${res.status})`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  const { accessToken } = await res.json();
  tokenCache.value = accessToken;
  tokenCache.expiresAt = Date.now() + 60 * 60 * 1000;
  return accessToken;
}

// ── Authenticated GET ─────────────────────────────────────────────────────────
async function publicGet(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let detail;
    try { detail = await res.json(); } catch { detail = await res.text(); }
    const err = new Error(`Public API ${res.status} — ${path}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  return res.json();
}

// ── Error response helper ─────────────────────────────────────────────────────
function sendError(res, err) {
  // Forward 4xx as-is; map 5xx / network errors to 502
  const status = err.status >= 400 && err.status < 500 ? err.status : 502;
  res.status(status).json({ error: err.message, detail: err.detail ?? null });
}

// ── GET /api/positions ────────────────────────────────────────────────────────
// Returns all accounts with their portfolio data (positions, equity, buying power).
router.get('/', async (req, res) => {
  if (!SECRET) {
    return res.status(500).json({ error: 'PUBLIC_API_SECRET is not configured on the server.' });
  }

  let token;
  try {
    token = await getAccessToken();
  } catch (err) {
    return sendError(res, err);
  }

  // Fetch account list
  let accountList;
  try {
    const data = await publicGet('/userapigateway/trading/account', token);
    accountList = data.accounts ?? [];
  } catch (err) {
    return sendError(res, err);
  }

  if (!accountList.length) {
    return res.json({ accounts: [] });
  }

  // Fetch all portfolios in parallel
  const portfolios = await Promise.all(
    accountList.map(async (acct) => {
      try {
        const portfolio = await publicGet(
          `/userapigateway/trading/${acct.accountId}/portfolio/v2`,
          token,
        );
        return { ...acct, portfolio };
      } catch (err) {
        // Return partial data rather than failing the whole request
        return { ...acct, portfolio: null, portfolioError: err.message };
      }
    }),
  );

  res.json({ accounts: portfolios });
});

export default router;
