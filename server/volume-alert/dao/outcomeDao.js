import { getDB } from '../config/db.js';
import { ObjectId } from 'mongodb';

const COLLECTION = 'va_outcomes';

export async function create(outcome) {
  const db = getDB();
  return db.collection(COLLECTION).insertOne({ ...outcome, createdAt: new Date() });
}

export async function updateOutcome(id, update) {
  const db = getDB();
  return db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    { $set: update }
  );
}

export async function getPending() {
  const db = getDB();
  return db.collection(COLLECTION)
    .find({ resolved: { $ne: true } })
    .toArray();
}
