import { getDB } from '../config/db.js';

const COLLECTION = 'va_portfolio_symbols';

/**
 * Upsert symbols into the registry. source is 'schwab' | 'fidelity' | 'public'.
 * Fire-and-forget safe — callers should .catch(() => {}).
 */
export async function addSymbols(symbols, source) {
  if (!symbols.length) return;
  const db  = getDB();
  const now = new Date();
  await Promise.all(
    symbols.map((sym) =>
      db.collection(COLLECTION).updateOne(
        { _id: sym },
        { $set: { updatedAt: now }, $addToSet: { sources: source } },
        { upsert: true },
      ),
    ),
  );
}

export async function getAllSymbols() {
  const db = getDB();
  const docs = await db.collection(COLLECTION).find({}).toArray();
  return docs.map((d) => d._id);
}
