import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const days = pgTable("days", {
  id: serial("id").primaryKey(),
  dayNumber: integer("day_number").notNull().unique(),
  status: text("status").notNull(), // 'Logged' | 'Planned'
  exercises: text("exercises").array().notNull(), // Array of exercise strings
});

export const insertDaySchema = createInsertSchema(days).omit({ id: true });

export type Day = typeof days.$inferSelect;
export type InsertDay = z.infer<typeof insertDaySchema>;

export type CreateDayRequest = InsertDay;
export type UpdateDayRequest = Partial<InsertDay>;
export type DayResponse = Day;
export type DaysListResponse = Day[];
