import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

let db;

export async function connectDB() {
  await client.connect();
  db = client.db('namaste');
  console.log('Connected to MongoDB');
}

export function getDB() {
  if (!db) throw new Error('Database not connected');
  return db;
}
