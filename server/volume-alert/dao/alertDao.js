import { getDB } from '../config/db.js';
import { ObjectId } from 'mongodb';

const COLLECTION = 'va_alerts';

export async function create(alert) {
  const db = getDB();
  const doc = {
    ticker:    alert.ticker,
    type:      alert.type,
    deviation: alert.deviation,
    price:     alert.price,
    volume:    alert.volume,
    avgVolume: alert.avgVolume ?? null,
    message:   alert.message,
    ts:        alert.ts || new Date(),
    dismissed: alert.dismissed ?? false,
    notified:  alert.notified ?? false,
  };
  const result = await db.collection(COLLECTION).insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function getActive(limit = 50) {
  const db = getDB();
  return db.collection(COLLECTION)
    .find({ dismissed: false })
    .sort({ ts: -1 })
    .limit(limit)
    .toArray();
}

export async function dismiss(id) {
  const db = getDB();
  const result = await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    { $set: { dismissed: true } }
  );
  return result.modifiedCount > 0;
}

export async function getRecentForTicker(ticker, type, sinceMs) {
  const db = getDB();
  return db.collection(COLLECTION)
    .find({ ticker, type, ts: { $gte: new Date(sinceMs) } })
    .sort({ ts: -1 })
    .toArray();
}
