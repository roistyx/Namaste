export async function getPositions() {
  const res = await fetch('/api/positions');
  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error || `Server error: ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.detail = data?.detail ?? null;
    throw err;
  }

  return data;
}
