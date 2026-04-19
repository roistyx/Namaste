/**
 * Shared Schwab API client — token management + market data fetch.
 * Imported by both routes/schwab.js (trader API) and volume-alert services (market data API).
 * Node module caching ensures a single tokenCache instance across all importers.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const ENV_PATH = resolve(fileURLToPath(import.meta.url), '../.env');

const AUTH_BASE    = 'https://api.schwabapi.com/v1/oauth';
const MARKET_BASE  = 'https://api.schwabapi.com/marketdata/v1';

export const CLIENT_ID     = process.env.SCHWAB_CLIENT_ID     || '';
export const CLIENT_SECRET = process.env.SCHWAB_CLIENT_SECRET || '';

// ── Token cache (singleton) ───────────────────────────────────────────────────
const tokenCache = {
  accessToken:     null,
  refreshToken:    process.env.SCHWAB_REFRESH_TOKEN || null,
  accessExpiresAt: 0,
};

export function basicAuth() {
  return Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
}

export function persistRefreshToken(token) {
  try {
    const env     = readFileSync(ENV_PATH, 'utf8');
    const updated = env.replace(/^SCHWAB_REFRESH_TOKEN=.*$/m, `SCHWAB_REFRESH_TOKEN=${token}`);
    writeFileSync(ENV_PATH, updated);
  } catch (e) {
    console.error('Failed to persist refresh token:', e.message);
  }
}

/** Called by the OAuth callback after a successful token exchange. */
export function setTokens(data) {
  tokenCache.accessToken     = data.access_token;
  tokenCache.refreshToken    = data.refresh_token;
  tokenCache.accessExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  if (data.refresh_token) persistRefreshToken(data.refresh_token);
}

export function isAuthorized() {
  return !!tokenCache.refreshToken;
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
    if (res.status === 400 || res.status === 401) tokenCache.refreshToken = null;
    throw Object.assign(
      new Error(`Schwab token refresh failed (${res.status})`),
      { status: res.status, detail },
    );
  }

  const data = await res.json();
  tokenCache.accessToken     = data.access_token;
  tokenCache.accessExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  if (data.refresh_token) {
    tokenCache.refreshToken = data.refresh_token;
    persistRefreshToken(data.refresh_token);
  }
  return tokenCache.accessToken;
}

export async function getAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.accessExpiresAt) {
    return tokenCache.accessToken;
  }
  return exchangeRefreshToken();
}

// ── Market Data API ───────────────────────────────────────────────────────────

/** Authenticated GET to /marketdata/v1{path} with optional query params. */
export async function marketFetch(path, params) {
  const token = await getAccessToken();
  const qs    = params ? `?${new URLSearchParams(params)}` : '';
  const res   = await fetch(`${MARKET_BASE}${path}${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Schwab market data ${path} → ${res.status}`);
  return res.json();
}
