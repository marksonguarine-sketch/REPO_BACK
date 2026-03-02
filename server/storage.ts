import { db } from "./db";
import {
  days,
  type CreateDayRequest,
  type UpdateDayRequest,
  type DayResponse
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getDays(): Promise<DayResponse[]>;
  getDaysByCategory(category: string): Promise<DayResponse[]>;
  getDay(id: number): Promise<DayResponse | undefined>;
  getDayByNumberAndCategory(dayNumber: number, category: string): Promise<DayResponse | undefined>;
  createDay(day: CreateDayRequest): Promise<DayResponse>;
  updateDay(id: number, updates: UpdateDayRequest): Promise<DayResponse>;
  deleteDay(id: number): Promise<void>;
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
}

export const storage = new DatabaseStorage();
