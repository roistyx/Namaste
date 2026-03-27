export async function getSchwabStatus() {
  const res = await fetch('/api/schwab/status');
  return res.json();
}

export async function getSchwabPositions() {
  const res = await fetch('/api/schwab/positions');
  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data?.error || `Server error: ${res.status}`);
    err.status = res.status;
    err.detail = data?.detail ?? null;
    throw err;
  }

  return data;
}
