import { getDB } from '../config/db.js';

const COLLECTION = 'va_volume';

export async function saveQuote(quote) {
  const db = getDB();
  return db.collection(COLLECTION).insertOne({ ...quote, ts: quote.ts || new Date() });
}

export async function getRecent(ticker, limit = 100) {
  const db = getDB();
  return db.collection(COLLECTION)
    .find({ ticker })
    .sort({ ts: -1 })
    .limit(limit)
    .toArray();
}

export async function getLatest(ticker) {
  const db = getDB();
  return db.collection(COLLECTION)
    .findOne({ ticker }, { sort: { ts: -1 } });
}
