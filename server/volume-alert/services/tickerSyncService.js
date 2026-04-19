import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDB } from '../config/db.js';
import { createLogger } from '../logger.js';

const log = createLogger('sync');

const TICKERS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../config/tickers.json',
);

/** Returns true for symbols Yahoo Finance can quote. */
function isQuotable(symbol) {
  if (!symbol || typeof symbol !== 'string') return false;
  if (symbol.includes('*')) return false;  // cash sweep placeholders (SPAXX**)
  if (/\d/.test(symbol))   return false;  // CUSIPs / mutual-fund codes with digits
  return true;
}

export async function syncTickers() {
  const db      = getDB();
  const symbols = new Set();

  // 1. Symbols registered by routes (Schwab + Public + Fidelity on-upload)
  const registered = await db.collection('va_portfolio_symbols').find({}).toArray();
  for (const doc of registered) {
    if (isQuotable(doc._id)) symbols.add(doc._id);
  }

  // 2. Fidelity positions (always fresh in MongoDB after each CSV upload)
  const fidelityDoc = await db.collection('fidelity_positions').findOne({ _id: 'latest' });
  for (const acct of fidelityDoc?.accounts ?? []) {
    for (const pos of acct.portfolio?.positions ?? []) {
      const sym = pos.instrument?.symbol;
      if (sym && isQuotable(sym)) symbols.add(sym);
    }
  }

  const tickers = [...symbols].sort();
  writeFileSync(TICKERS_PATH, JSON.stringify(tickers, null, 2));
  log.log(`${tickers.length} symbols → tickers.json`);
  return tickers;
}
