export async function getSchwabAccountNumbers() {
  const res = await fetch('/api/schwab/account-numbers');
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Server error: ${res.status}`);
  return data; // [{accountNumber, hashValue}]
}

export async function getSchwabStatus() {
  const res = await fetch('/api/schwab/status');
  return res.json();
}

export async function getSchwabTransactions(accountHash, symbol, name) {
  const params = new URLSearchParams({ symbol });
  if (name) params.set('name', name);
  const res = await fetch(`/api/schwab/accounts/${accountHash}/transactions?${params}`);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error || `Server error: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
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
