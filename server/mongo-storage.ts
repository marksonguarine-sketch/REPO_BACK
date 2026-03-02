import { getCollection, getMongoDb } from "./railway_db";
import { ObjectId } from "mongodb";
import type { IStorage } from "./storage";

interface MongoDay {
  _id?: ObjectId;
  id: number;
  dayNumber: number;
  status: string;
  exercises: string[];
  category: string;
}

interface MongoVisitor {
  _id?: ObjectId;
  id: number;
  fingerprint: string;
  referrer: string;
  country: string | null;
  city: string | null;
  isUnique: boolean;
  visitedAt: Date;
}

interface MongoChatMemory {
  _id?: ObjectId;
  id: number;
  role: string;
  content: string;
  createdAt: Date;
}

interface MongoBrowserMemory {
  _id?: ObjectId;
  content: string;
  updatedAt: Date;
}

interface MongoReminder {
  _id?: ObjectId;
  id: number;
  message: string;
  triggerAt: Date;
  sent: boolean;
  isRecurring: boolean;
  intervalMs: number;
  createdAt: Date;
}

interface MongoBackupLog {
  _id?: ObjectId;
  action: string;
  timestamp: Date;
  details: string;
}

async function getNextId(collectionName: string): Promise<number> {
  const db = await getMongoDb();
  const counters = db.collection("counters");
  const result = await counters.findOneAndUpdate(
    { _id: collectionName as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  return result?.seq || 1;
}

export class MongoStorage implements IStorage {
  async getDays() {
    const col = await getCollection<MongoDay>("days");
    const docs = await col.find({}).toArray();
    return docs.map(d => ({
      id: d.id,
      dayNumber: d.dayNumber,
      status: d.status,
      exercises: d.exercises,
      category: d.category,
    }));
  }

  async getDaysByCategory(category: string) {
    const col = await getCollection<MongoDay>("days");
    const docs = await col.find({ category }).toArray();
    return docs.map(d => ({
      id: d.id,
      dayNumber: d.dayNumber,
      status: d.status,
      exercises: d.exercises,
      category: d.category,
    }));
  }

  async getDay(id: number) {
    const col = await getCollection<MongoDay>("days");
    const doc = await col.findOne({ id });
    if (!doc) return undefined;
    return {
      id: doc.id,
      dayNumber: doc.dayNumber,
      status: doc.status,
      exercises: doc.exercises,
      category: doc.category,
    };
  }

  async getDayByNumberAndCategory(dayNumber: number, category: string) {
    const col = await getCollection<MongoDay>("days");
    const doc = await col.findOne({ dayNumber, category });
    if (!doc) return undefined;
    return {
      id: doc.id,
      dayNumber: doc.dayNumber,
      status: doc.status,
      exercises: doc.exercises,
      category: doc.category,
    };
  }

  async createDay(day: { dayNumber: number; status: string; exercises: string[]; category: string }) {
    const col = await getCollection<MongoDay>("days");
    const id = await getNextId("days");
    const newDay = { id, ...day };
    await col.insertOne(newDay as any);
    return newDay;
  }

  async updateDay(id: number, updates: Partial<{ dayNumber: number; status: string; exercises: string[]; category: string }>) {
    const col = await getCollection<MongoDay>("days");
    await col.updateOne({ id }, { $set: updates });
    const doc = await col.findOne({ id });
    return {
      id: doc!.id,
      dayNumber: doc!.dayNumber,
      status: doc!.status,
      exercises: doc!.exercises,
      category: doc!.category,
    };
  }

  async deleteDay(id: number) {
    const col = await getCollection<MongoDay>("days");
    await col.deleteOne({ id });
  }

  async addVisitor(fingerprint: string, referrer: string, country?: string, city?: string) {
    const col = await getCollection<MongoVisitor>("visitors");
    const existing = await col.findOne({ fingerprint });
    const isNew = !existing;
    const id = await getNextId("visitors");
    const visitor = {
      id,
      fingerprint,
      referrer,
      country: country || null,
      city: city || null,
      isUnique: isNew,
      visitedAt: new Date(),
    };
    await col.insertOne(visitor as any);
    const totalUnique = await col.countDocuments({ isUnique: true });
    return { visitor, isNew, totalUnique };
  }

  async getUniqueVisitorCount() {
    const col = await getCollection<MongoVisitor>("visitors");
    return await col.countDocuments({ isUnique: true });
  }

  async getChatMemory() {
    const col = await getCollection<MongoChatMemory>("chat_memory");
    const docs = await col.find({}).sort({ createdAt: 1 }).toArray();
    return docs.map(d => ({
      id: d.id,
      role: d.role,
      content: d.content,
      createdAt: d.createdAt,
    }));
  }

  async addChatMemory(role: string, content: string) {
    const col = await getCollection<MongoChatMemory>("chat_memory");
    const id = await getNextId("chat_memory");
    const entry = { id, role, content, createdAt: new Date() };
    await col.insertOne(entry as any);
    return entry;
  }

  async clearChatMemory() {
    const col = await getCollection<MongoChatMemory>("chat_memory");
    await col.deleteMany({});
  }

  async getBrowserMemory() {
    const col = await getCollection<MongoBrowserMemory>("browser_memory");
    const doc = await col.findOne({});
    return doc ? doc.content : null;
  }

  async saveBrowserMemory(content: string) {
    const col = await getCollection<MongoBrowserMemory>("browser_memory");
    const existing = await col.findOne({});
    if (existing) {
      await col.updateOne({ _id: existing._id }, { $set: { content, updatedAt: new Date() } });
    } else {
      await col.insertOne({ content, updatedAt: new Date() } as any);
    }
  }

  async deleteBrowserMemory() {
    const col = await getCollection<MongoBrowserMemory>("browser_memory");
    await col.deleteMany({});
  }

  async addReminder(message: string, triggerAt: Date, isRecurring: boolean = false, intervalMs: number = 0) {
    const col = await getCollection<MongoReminder>("reminders");
    const id = await getNextId("reminders");
    const reminder = { id, message, triggerAt, sent: false, isRecurring, intervalMs, createdAt: new Date() };
    await col.insertOne(reminder as any);
    return reminder;
  }

  async claimDueReminders(): Promise<any[]> {
    const col = await getCollection<MongoReminder>("reminders");
    const claimed: any[] = [];
    while (true) {
      const now = new Date();
      const doc = await col.findOneAndUpdate(
        { sent: false, triggerAt: { $lte: now } },
        { $set: { sent: true } },
        { returnDocument: "before" }
      );
      if (!doc) break;
      claimed.push({
        id: doc.id,
        message: doc.message,
        triggerAt: doc.triggerAt,
        isRecurring: doc.isRecurring || false,
        intervalMs: doc.intervalMs || 0,
      });
    }
    return claimed;
  }

  async getDueReminders() {
    const col = await getCollection<MongoReminder>("reminders");
    const now = new Date();
    const docs = await col.find({ sent: false, triggerAt: { $lte: now } }).toArray();
    return docs.map(d => ({
      id: d.id,
      message: d.message,
      triggerAt: d.triggerAt,
      sent: d.sent,
      isRecurring: d.isRecurring || false,
      intervalMs: d.intervalMs || 0,
      createdAt: d.createdAt,
    }));
  }

  async markReminderSent(id: number) {
    const col = await getCollection<MongoReminder>("reminders");
    await col.updateOne({ id }, { $set: { sent: true } });
  }

  async rescheduleRecurringReminder(id: number, nextTriggerAt: Date) {
    const col = await getCollection<MongoReminder>("reminders");
    await col.updateOne({ id }, { $set: { sent: false, triggerAt: nextTriggerAt } });
  }

  async getAllReminders() {
    const col = await getCollection<MongoReminder>("reminders");
    const docs = await col.find({ sent: false }).sort({ triggerAt: 1 }).toArray();
    return docs.map(d => ({
      id: d.id,
      message: d.message,
      triggerAt: d.triggerAt,
      sent: d.sent,
      isRecurring: d.isRecurring || false,
      intervalMs: d.intervalMs || 0,
      createdAt: d.createdAt,
    }));
  }

  async updateReminder(id: number, updates: Partial<{ message: string; triggerAt: Date; isRecurring: boolean; intervalMs: number }>) {
    const col = await getCollection<MongoReminder>("reminders");
    await col.updateOne({ id }, { $set: updates });
  }

  async getReminderById(id: number) {
    const col = await getCollection<MongoReminder>("reminders");
    const doc = await col.findOne({ id });
    if (!doc) return null;
    return { id: doc.id, message: doc.message, triggerAt: doc.triggerAt, sent: doc.sent, isRecurring: doc.isRecurring || false, intervalMs: doc.intervalMs || 0, createdAt: doc.createdAt };
  }

  async deleteReminder(id: number) {
    const col = await getCollection<MongoReminder>("reminders");
    await col.deleteOne({ id });
  }

  async logBackup(action: string, details: string) {
    const col = await getCollection<MongoBackupLog>("backup_logs");
    await col.insertOne({ action, timestamp: new Date(), details } as any);
  }

  async getLastBackupLog() {
    const col = await getCollection<MongoBackupLog>("backup_logs");
    const doc = await col.findOne({}, { sort: { timestamp: -1 } });
    if (!doc) return null;
    return { action: doc.action, timestamp: doc.timestamp, details: doc.details };
  }

  async exportAllData() {
    const db = await getMongoDb();
    const days = await (await db.collection("days")).find({}).toArray();
    const visitors = await (await db.collection("visitors")).find({}).toArray();
    const chatMemory = await (await db.collection("chat_memory")).find({}).toArray();
    const browserMemory = await (await db.collection("browser_memory")).find({}).toArray();
    const reminders = await (await db.collection("reminders")).find({}).toArray();
    const backupLogs = await (await db.collection("backup_logs")).find({}).toArray();
    const counters = await (await db.collection("counters")).find({}).toArray();

    const clean = (docs: any[]) => docs.map(d => {
      const { _id, ...rest } = d;
      return rest;
    });

    return {
      exportedAt: new Date().toISOString(),
      data: {
        days: clean(days),
        visitors: clean(visitors),
        chat_memory: clean(chatMemory),
        browser_memory: clean(browserMemory),
        reminders: clean(reminders),
        backup_logs: clean(backupLogs),
        counters: clean(counters),
      },
    };
  }

  async importAllData(data: any) {
    const db = await getMongoDb();
    const collections = ["days", "visitors", "chat_memory", "browser_memory", "reminders", "backup_logs", "counters"];

    for (const colName of collections) {
      const col = db.collection(colName);
      await col.deleteMany({});
      if (data[colName] && data[colName].length > 0) {
        await col.insertMany(data[colName]);
      }
    }
  }
}

export const mongoStorage = new MongoStorage();
