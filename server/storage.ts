import { db } from "./db";
import {
  days,
  visitors,
  chatMemory,
  type CreateDayRequest,
  type UpdateDayRequest,
  type DayResponse,
  type Visitor,
  type ChatMemory,
} from "@shared/schema";
import { eq, and, count } from "drizzle-orm";

export interface IStorage {
  getDays(): Promise<DayResponse[]>;
  getDaysByCategory(category: string): Promise<DayResponse[]>;
  getDay(id: number): Promise<DayResponse | undefined>;
  getDayByNumberAndCategory(dayNumber: number, category: string): Promise<DayResponse | undefined>;
  createDay(day: CreateDayRequest): Promise<DayResponse>;
  updateDay(id: number, updates: UpdateDayRequest): Promise<DayResponse>;
  deleteDay(id: number): Promise<void>;
  addVisitor(fingerprint: string, referrer: string, country?: string, city?: string): Promise<{ visitor: Visitor; isNew: boolean; totalUnique: number }>;
  getUniqueVisitorCount(): Promise<number>;
  getChatMemory(): Promise<ChatMemory[]>;
  addChatMemory(role: string, content: string): Promise<ChatMemory>;
  clearChatMemory(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getDays(): Promise<DayResponse[]> {
    return await db.select().from(days);
  }

  async getDaysByCategory(category: string): Promise<DayResponse[]> {
    return await db.select().from(days).where(eq(days.category, category));
  }

  async getDay(id: number): Promise<DayResponse | undefined> {
    const [day] = await db.select().from(days).where(eq(days.id, id));
    return day;
  }

  async getDayByNumberAndCategory(dayNumber: number, category: string): Promise<DayResponse | undefined> {
    const [day] = await db.select().from(days).where(
      and(eq(days.dayNumber, dayNumber), eq(days.category, category))
    );
    return day;
  }

  async createDay(day: CreateDayRequest): Promise<DayResponse> {
    const [newDay] = await db.insert(days).values(day).returning();
    return newDay;
  }

  async updateDay(id: number, updates: UpdateDayRequest): Promise<DayResponse> {
    const [updated] = await db.update(days)
      .set(updates)
      .where(eq(days.id, id))
      .returning();
    return updated;
  }

  async deleteDay(id: number): Promise<void> {
    await db.delete(days).where(eq(days.id, id));
  }

  async addVisitor(fingerprint: string, referrer: string, country?: string, city?: string): Promise<{ visitor: Visitor; isNew: boolean; totalUnique: number }> {
    const [existing] = await db.select().from(visitors).where(eq(visitors.fingerprint, fingerprint));
    const isNew = !existing;

    const [visitor] = await db.insert(visitors).values({
      fingerprint,
      referrer,
      country: country || null,
      city: city || null,
      isUnique: isNew,
    }).returning();

    const [result] = await db.select({ count: count() }).from(visitors).where(eq(visitors.isUnique, true));
    return { visitor, isNew, totalUnique: result.count };
  }

  async getUniqueVisitorCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(visitors).where(eq(visitors.isUnique, true));
    return result.count;
  }

  async getChatMemory(): Promise<ChatMemory[]> {
    return await db.select().from(chatMemory).orderBy(chatMemory.createdAt);
  }

  async addChatMemory(role: string, content: string): Promise<ChatMemory> {
    const [entry] = await db.insert(chatMemory).values({ role, content }).returning();
    return entry;
  }

  async clearChatMemory(): Promise<void> {
    await db.delete(chatMemory);
  }
}

export const storage = new DatabaseStorage();
