const BASE = 'https://127.0.0.1:3001/api/apex';

export async function getApexStatus() {
  const res = await fetch(`${BASE}/status`);
  if (!res.ok) throw new Error(`Apex status failed: ${res.status}`);
  return res.json();
}

export async function clearApexSessions() {
  const res = await fetch(`${BASE}/cookies`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Clear sessions failed: ${res.status}`);
  return res.json();
}

export async function saveApexCookie(cookie) {
  const res = await fetch(`${BASE}/cookie`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cookie }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed: ${res.status}`);
  }
  return res.json();
}

export async function getApexPositions() {
  const res = await fetch(`${BASE}/positions`);
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    const err  = new Error(body.error || 'unauthorized');
    err.code   = body.error; // 'not_connected' | 'session_expired'
    throw err;
  }
  if (!res.ok) throw new Error(`Apex positions failed: ${res.status}`);
  return res.json();
}
