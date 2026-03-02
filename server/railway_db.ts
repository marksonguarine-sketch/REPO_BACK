import { MongoClient, Db, Collection, type Document } from "mongodb";
import { config, requireEnv } from "./config";

const MONGODB_URI = requireEnv(config.mongoUri, "MONGODB_URI");
const DB_NAME = config.mongoDbName;

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getMongoDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}

export async function getCollection<T extends Document>(name: string): Promise<Collection<T>> {
  const database = await getMongoDb();
  return database.collection<T>(name);
}

export async function closeMongoConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export { MONGODB_URI, DB_NAME };
