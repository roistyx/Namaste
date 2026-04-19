import { getDB } from '../config/db.js';

const COLLECTION = 'va_model_registry';

export async function upsert(ticker, data) {
  const db = getDB();
  return db.collection(COLLECTION).updateOne(
    { ticker },
    { $set: { ticker, ...data, updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function get(ticker) {
  const db = getDB();
  return db.collection(COLLECTION).findOne({ ticker });
}

export async function getAll() {
  const db = getDB();
  return db.collection(COLLECTION).find({}).toArray();
}
