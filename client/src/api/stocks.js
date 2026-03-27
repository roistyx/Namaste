const BASE = '/api/stocks';

export async function getMostActive() {
  const res = await fetch(`${BASE}/active`);
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

export async function getSentiment(ticker) {
  const res = await fetch(`${BASE}/sentiment/${ticker}`);
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

export async function getWeeklyData(ticker) {
  const res = await fetch(`${BASE}/weekly/${ticker}`);
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}
