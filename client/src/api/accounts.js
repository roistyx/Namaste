export async function getAccountNames() {
  const res = await fetch('/api/account-names');
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json(); // [{accountId, name}]
}

export async function saveAccountName(accountId, name) {
  const res = await fetch(`/api/account-names/${accountId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}
