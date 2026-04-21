const BASE = '/api/portfolios';

export async function getPortfolios() {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

export async function createPortfolio(name, assetClass, baseCurrency) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, assetClass, baseCurrency }),
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

export async function addHolding(portfolioId, ticker, quantity, costBasis) {
  const res = await fetch(`${BASE}/${portfolioId}/holdings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, quantity, costBasis }),
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}
