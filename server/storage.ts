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
}

import { mongoStorage } from "./mongo-storage";
export const storage: IStorage & typeof mongoStorage = mongoStorage;
