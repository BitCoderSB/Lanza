import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const URI = process.env.MONGODB_URI;
let client, db;

export async function connectDB() {
  if (db) return db;
  client = new MongoClient(URI);
  await client.connect();
  db = client.db(process.env.DB_NAME || 'PizarraDigital');
  return db;
}

export function getDB() {
  if (!db) {
    throw new Error('MongoDB no está conectado. Llama antes a connectDB()');
  }
  return db;
}
