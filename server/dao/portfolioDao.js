import { getDB } from '../db.js';
import { ObjectId } from 'mongodb';

const COL = 'portfolios';

export async function create({ name, assetClass, baseCurrency }) {
  const doc = { name, assetClass, baseCurrency, holdings: [], createdAt: new Date() };
  const result = await getDB().collection(COL).insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function getAll() {
  return getDB().collection(COL).find({}).sort({ createdAt: -1 }).toArray();
}

export async function getById(id) {
  return getDB().collection(COL).findOne({ _id: new ObjectId(id) });
}

export async function addHolding(id, { ticker, quantity, costBasis }) {
  const holding = { ticker: ticker.toUpperCase(), quantity: Number(quantity), costBasis: Number(costBasis), addedAt: new Date() };
  await getDB().collection(COL).updateOne(
    { _id: new ObjectId(id) },
    { $push: { holdings: holding } },
  );
  return holding;
}
