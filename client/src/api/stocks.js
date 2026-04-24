const BASE = '/api/stocks';

export async function getStockProfile(ticker) {
  const res = await fetch(`${BASE}/profile/${encodeURIComponent(ticker)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error: ${res.status}`);
  return data;
}

export async function getStockFundamentals(ticker) {
  const res = await fetch(`${BASE}/fundamentals/${encodeURIComponent(ticker)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error: ${res.status}`);
  return data;
}

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
