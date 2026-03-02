import { db } from "./db";
import { days, visitors, chatMemory, browserMemory } from "@shared/schema";
import { getMongoDb } from "./railway_db";

export async function migratePostgresToMongo() {
  console.log("Starting PostgreSQL → MongoDB migration...");
  const mongoDB = await getMongoDb();

  const allDays = await db.select().from(days);
  if (allDays.length > 0) {
    const daysCol = mongoDB.collection("days");
    const existingCount = await daysCol.countDocuments();
    if (existingCount === 0) {
      await daysCol.insertMany(allDays.map(d => ({
        id: d.id,
        dayNumber: d.dayNumber,
        status: d.status,
        exercises: d.exercises,
        category: d.category,
      })));
      console.log(`Migrated ${allDays.length} days`);
    } else {
      console.log(`Days already exist in MongoDB (${existingCount}), skipping`);
    }
  }

  const allVisitors = await db.select().from(visitors);
  if (allVisitors.length > 0) {
    const visitorsCol = mongoDB.collection("visitors");
    const existingCount = await visitorsCol.countDocuments();
    if (existingCount === 0) {
      await visitorsCol.insertMany(allVisitors.map(v => ({
        id: v.id,
        fingerprint: v.fingerprint,
        referrer: v.referrer,
        country: v.country,
        city: v.city,
        isUnique: v.isUnique,
        visitedAt: v.visitedAt,
      })));
      console.log(`Migrated ${allVisitors.length} visitors`);
    } else {
      console.log(`Visitors already exist in MongoDB (${existingCount}), skipping`);
    }
  }

  const allChat = await db.select().from(chatMemory);
  if (allChat.length > 0) {
    const chatCol = mongoDB.collection("chat_memory");
    const existingCount = await chatCol.countDocuments();
    if (existingCount === 0) {
      await chatCol.insertMany(allChat.map(c => ({
        id: c.id,
        role: c.role,
        content: c.content,
        createdAt: c.createdAt,
      })));
      console.log(`Migrated ${allChat.length} chat memories`);
    } else {
      console.log(`Chat memories already exist in MongoDB (${existingCount}), skipping`);
    }
  }

  const allBrowserMem = await db.select().from(browserMemory);
  if (allBrowserMem.length > 0) {
    const bmCol = mongoDB.collection("browser_memory");
    const existingCount = await bmCol.countDocuments();
    if (existingCount === 0) {
      await bmCol.insertMany(allBrowserMem.map(b => ({
        content: b.content,
        updatedAt: b.updatedAt,
      })));
      console.log(`Migrated ${allBrowserMem.length} browser memories`);
    } else {
      console.log(`Browser memories already exist in MongoDB (${existingCount}), skipping`);
    }
  }

  const maxDayId = allDays.length > 0 ? Math.max(...allDays.map(d => d.id)) : 0;
  const maxVisitorId = allVisitors.length > 0 ? Math.max(...allVisitors.map(v => v.id)) : 0;
  const maxChatId = allChat.length > 0 ? Math.max(...allChat.map(c => c.id)) : 0;

  const countersCol = mongoDB.collection("counters");
  await countersCol.updateOne({ _id: "days" as any }, { $set: { seq: maxDayId } }, { upsert: true });
  await countersCol.updateOne({ _id: "visitors" as any }, { $set: { seq: maxVisitorId } }, { upsert: true });
  await countersCol.updateOne({ _id: "chat_memory" as any }, { $set: { seq: maxChatId } }, { upsert: true });
  await countersCol.updateOne({ _id: "reminders" as any }, { $set: { seq: 0 } }, { upsert: true });

  console.log("Migration complete!");
}
