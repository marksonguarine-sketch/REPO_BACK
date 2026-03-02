function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URL || "",
  mongoDbName: process.env.MONGODB_DB_NAME || process.env.MONGO_DB_NAME || "johns_lockin_logs",
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
  telegramOwnerId: parseNumber(
    process.env.TELEGRAM_OWNER_ID || process.env.TELEGRAM_CHAT_ID || process.env.OWNER_ID,
    7474049767
  ),
};

export function requireEnv(value: string, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
