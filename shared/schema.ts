import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const days = pgTable("days", {
  id: serial("id").primaryKey(),
  dayNumber: integer("day_number").notNull(),
  status: text("status").notNull(),
  exercises: text("exercises").array().notNull(),
  category: text("category").notNull().default("home"),
});

export const visitors = pgTable("visitors", {
  id: serial("id").primaryKey(),
  fingerprint: text("fingerprint").notNull(),
  referrer: text("referrer").notNull().default("direct"),
  country: text("country"),
  city: text("city"),
  isUnique: boolean("is_unique").notNull().default(true),
  visitedAt: timestamp("visited_at").notNull().defaultNow(),
});

export const chatMemory = pgTable("chat_memory", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDaySchema = createInsertSchema(days).omit({ id: true });
export const insertVisitorSchema = createInsertSchema(visitors).omit({ id: true, visitedAt: true });
export const insertChatMemorySchema = createInsertSchema(chatMemory).omit({ id: true, createdAt: true });

export type Day = typeof days.$inferSelect;
export type InsertDay = z.infer<typeof insertDaySchema>;
export type Visitor = typeof visitors.$inferSelect;
export type ChatMemory = typeof chatMemory.$inferSelect;

export type CreateDayRequest = InsertDay;
export type UpdateDayRequest = Partial<InsertDay>;
export type DayResponse = Day;
export type DaysListResponse = Day[];
