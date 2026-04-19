const BASE = 'https://127.0.0.1:3001/api/stash';

export async function getStashPositions() {
  const res = await fetch(`${BASE}/positions`);
  if (!res.ok) throw new Error(`Stash fetch failed: ${res.status}`);
  return res.json();
}

export async function uploadStashCSV(csvText, accountId, accountName) {
  const params = new URLSearchParams({ accountId, accountName });
  const res = await fetch(`${BASE}/upload?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: csvText,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}
