export interface IStorage {
  getDays(): Promise<any[]>;
  getDaysByCategory(category: string): Promise<any[]>;
  getDay(id: number): Promise<any | undefined>;
  getDayByNumberAndCategory(dayNumber: number, category: string): Promise<any | undefined>;
  createDay(day: { dayNumber: number; status: string; exercises: string[]; category: string }): Promise<any>;
  updateDay(id: number, updates: Partial<{ dayNumber: number; status: string; exercises: string[]; category: string }>): Promise<any>;
  deleteDay(id: number): Promise<void>;
  addVisitor(fingerprint: string, referrer: string, country?: string, city?: string): Promise<{ visitor: any; isNew: boolean; totalUnique: number }>;
  getUniqueVisitorCount(): Promise<number>;
  getChatMemory(): Promise<any[]>;
  addChatMemory(role: string, content: string): Promise<any>;
  clearChatMemory(): Promise<void>;
  getBrowserMemory(): Promise<string | null>;
  saveBrowserMemory(content: string): Promise<void>;
  deleteBrowserMemory(): Promise<void>;
  addReminder(message: string, triggerAt: Date, isRecurring?: boolean, intervalMs?: number): Promise<any>;
  claimDueReminders(): Promise<any[]>;
  getDueReminders(): Promise<any[]>;
  markReminderSent(id: number): Promise<void>;
  rescheduleRecurringReminder(id: number, nextTriggerAt: Date): Promise<void>;
  updateReminder(id: number, updates: Partial<{ message: string; triggerAt: Date; isRecurring: boolean; intervalMs: number }>): Promise<void>;
  getReminderById(id: number): Promise<any | null>;
  getAllReminders(): Promise<any[]>;
  deleteReminder(id: number): Promise<void>;
  getSupplements(): Promise<any[]>;
  addSupplement(name: string, amount: string, color: string): Promise<any>;
  updateSupplement(id: number, updates: Partial<{ name: string; amount: string; color: string }>): Promise<any | null>;
  deleteSupplement(id: number): Promise<void>;
  getSupplementByName(name: string): Promise<any | null>;
}

import { mongoStorage } from "./mongo-storage";
export const storage: IStorage & typeof mongoStorage = mongoStorage;
