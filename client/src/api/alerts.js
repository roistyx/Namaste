const BASE = 'https://127.0.0.1:3001/api/alerts';

export async function getAlerts(limit = 50) {
  const res = await fetch(`${BASE}?limit=${limit}`);
  if (!res.ok) throw new Error(`Alerts fetch failed: ${res.status}`);
  return res.json(); // { alerts, count }
}

export async function dismissAlert(id) {
  const res = await fetch(`${BASE}/${id}/dismiss`, { method: 'POST' });
  if (!res.ok) throw new Error(`Dismiss failed: ${res.status}`);
  return res.json();
}
