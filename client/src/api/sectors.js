const BASE = 'https://127.0.0.1:3001/api/sectors';

export async function getSectors(symbols) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols }),
  });
  if (!res.ok) throw new Error(`Sectors fetch failed: ${res.status}`);
  const data = await res.json();
  // Support both old flat map and new { sectors, sources } shape
  if (data && data.sectors) return data;
  return { sectors: data, sources: [] };
}
