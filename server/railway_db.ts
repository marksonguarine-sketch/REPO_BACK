import { MongoClient, Db, Collection } from "mongodb";

const MONGODB_URI = "mongodb://mongo:StUaVOddeiqFbDsJuEpjzsIGiHhtepbY@gondola.proxy.rlwy.net:33565";
const DB_NAME = "johns_lockin_logs";

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
