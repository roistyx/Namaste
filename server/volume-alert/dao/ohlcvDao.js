import { getDB } from '../config/db.js';

const COLLECTION = 'va_ohlcv';

export async function upsert(ticker, date, bar) {
  const db = getDB();
  return db.collection(COLLECTION).updateOne(
    { ticker, date },
    { $set: { ticker, date, ...bar } },
    { upsert: true }
  );
}

export async function getCandles(ticker, limit = 100) {
  const db = getDB();
  return db.collection(COLLECTION)
    .find({ ticker })
    .sort({ date: -1 })
    .limit(limit)
    .toArray();
}
