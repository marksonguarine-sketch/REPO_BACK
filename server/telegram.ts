import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";
import { log } from "./index";
import { chatWithGeminiTelegram, getGeminiComment } from "./gemini";

const OWNER_ID = parseInt(process.env.TELEGRAM_OWNER_ID || "0", 10);

let botInstance: TelegramBot | null = null;

export function getBotInstance(): TelegramBot | null {
  return botInstance;
}

interface UserState {
  action: string;
  category?: string;
  dayNumber?: number;
  dayId?: number;
}

const userStates = new Map<number, UserState>();

function isOwner(chatId: number): boolean {
  return chatId === OWNER_ID;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function calcIntensity(exercises: string[]): number {
  let score = 0;
  for (const ex of exercises) {
    const lower = ex.toLowerCase();
    if (lower.includes("rest")) continue;
    const setsReps = ex.match(/(\d+)\s*[x\u00D7]\s*(\d+)/i);
    if (setsReps) {
      score += parseInt(setsReps[1]) * parseInt(setsReps[2]);
    } else {
      score += 10;
    }
    const weight = ex.match(/(\d+)\s*kg/i);
    if (weight) {
      score += parseInt(weight[1]) * 0.5;
    }
  }
  return Math.round(score);
}

function formatDayLog(day: { dayNumber: number; status: string; exercises: string[]; category: string }): string {
  const intensity = calcIntensity(day.exercises);
  const statusIcon = day.status === "Logged" ? "\u2705" : "\u23F3";
  let text = `\u{1F4C5} <b>Day ${day.dayNumber}</b> ${statusIcon} <i>${esc(day.status)}</i>\n`;
  text += `\u{1F4CA} Intensity: ${intensity}\n`;
  text += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
  day.exercises.forEach(ex => {
    text += `  \u2022 ${esc(ex)}\n`;
  });
  return text;
}

function splitMessage(text: string): string[] {
  if (text.length <= 4000) return [text];
  const chunks: string[] = [];
  let current = "";
  const lines = text.split("\n");
  for (const line of lines) {
    if ((current + line + "\n").length > 3900) {
      chunks.push(current);
      current = line + "\n";
    } else {
      current += line + "\n";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function sendOwnerNotification(text: string) {
  if (botInstance && OWNER_ID) {
    try {
      await botInstance.sendMessage(OWNER_ID, text, { parse_mode: "HTML" });
    } catch (err: any) {
      log(`Failed to send notification: ${err.message}`, "telegram");
    }
  }
}

export function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    log("TELEGRAM_BOT_TOKEN not set, skipping bot startup", "telegram");
    return;
  }

  const bot = new TelegramBot(token, { polling: true });
  botInstance = bot;
  log("Telegram bot started with polling", "telegram");

  bot.setMyCommands([
    { command: "start", description: "Welcome screen" },
    { command: "help", description: "Detailed command guide" },
    { command: "commands", description: "Quick command list" },
    { command: "save_home_d", description: "Save home workout day N" },
    { command: "save_gym_d", description: "Save gym workout day N" },
    { command: "update_d", description: "Update day N (add _home or _gym)" },
    { command: "home_status_updated", description: "Mark home day N as done" },
    { command: "gym_status_updated", description: "Mark gym day N as done" },
    { command: "view_home_d", description: "View home day N" },
    { command: "view_gym_d", description: "View gym day N" },
    { command: "export_home_logs", description: "Export all home logs" },
    { command: "export_gym_logs", description: "Export all gym logs" },
    { command: "delete_home_d", description: "Delete home day N" },
    { command: "delete_gym_d", description: "Delete gym day N" },
    { command: "stats", description: "Progress summary" },
    { command: "intensity_home", description: "Home intensity chart" },
    { command: "intensity_gym", description: "Gym intensity chart" },
    { command: "ai", description: "Chat with AI assistant" },
    { command: "clear_memory", description: "Clear AI chat memory" },
    { command: "save_browser_memory", description: "Save web chat AI memory" },
  ]).catch(err => log(`Failed to set commands: ${err.message}`, "telegram"));

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) {
      return bot.sendMessage(chatId, "\u26D4 Access denied. This bot is private.");
    }
    const welcomeText = `\u{1F3CB}\u{FE0F} <b>Welcome to John's Lock-In Bot!</b>\n\nYour personal workout log manager.\nUse /help to see all available commands.\n\n\u{1F4AA} Keep grinding!`;
    await bot.sendMessage(chatId, welcomeText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "\u{1F3E0} Home Logs", callback_data: "view_home" },
            { text: "\u{1F3CB}\u{FE0F} Gym Logs", callback_data: "view_gym" },
          ],
          [{ text: "\u{1F4CB} Commands", callback_data: "show_help" }],
        ],
      },
    });
  });

  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const helpText = `\u{1F4D6} <b>John's Lock-In Bot \u2014 Command Guide</b>

\u{1F527} <b>CORE COMMANDS</b>
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/start \u2014 Welcome screen with quick actions
/help \u2014 This detailed command guide
/commands \u2014 Quick command list

\u{1F4DD} <b>LOG MANAGEMENT</b>
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/save_home_d[N] \u2014 Save a new home workout for day N
/save_gym_d[N] \u2014 Save a new gym workout for day N
/update_d[N]_home \u2014 Update existing home workout day N
/update_d[N]_gym \u2014 Update existing gym workout day N

\u2705 <b>STATUS UPDATES</b>
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/home_status_updated[N] \u2014 Mark home day N as done
/gym_status_updated[N] \u2014 Mark gym day N as done

\u{1F4CA} <b>VIEW &amp; EXPORT</b>
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/view_home_d[N] \u2014 View specific home day
/view_gym_d[N] \u2014 View specific gym day
/export_home_logs \u2014 Export all home logs
/export_gym_logs \u2014 Export all gym logs

\u{1F5D1}\u{FE0F} <b>DELETE</b>
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/delete_home_d[N] \u2014 Delete home day N
/delete_gym_d[N] \u2014 Delete gym day N

\u{1F4CA} <b>STATS</b>
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/stats \u2014 View progress summary
/intensity_home \u2014 Home intensity chart
/intensity_gym \u2014 Gym intensity chart

\u{1F916} <b>AI ASSISTANT</b>
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/ai [message] \u2014 Chat with AI (remembers conversations)
/clear_memory \u2014 Clear AI conversation memory
/save_browser_memory \u2014 Save persistent memory for web chat AI

\u{1F4AC} <b>NATURAL LANGUAGE</b>
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
Just type naturally! e.g.:
\u2022 "save my day 16 home"
\u2022 "mark gym day 5 as done"
\u2022 "update my d14 home"
\u2022 "delete home day 3"
\u2022 "show my stats"
\u2022 "update the memory in the web chat"

\u{1F4AA} Keep pushing, John!`;
    await bot.sendMessage(chatId, helpText, { parse_mode: "HTML" });
  });

  bot.onText(/\/commands/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const commandsList = `\u{1F4CB} <b>All Commands</b>

/start
/help
/commands
/save_home_d[N]
/save_gym_d[N]
/update_d[N]_home
/update_d[N]_gym
/home_status_updated[N]
/gym_status_updated[N]
/view_home_d[N]
/view_gym_d[N]
/export_home_logs
/export_gym_logs
/delete_home_d[N]
/delete_gym_d[N]
/stats
/intensity_home
/intensity_gym
/ai [message]
/clear_memory
/save_browser_memory

<i>Or just type naturally \u2014 AI understands!</i>
<i>Use /help for detailed explanations.</i>`;
    await bot.sendMessage(chatId, commandsList, { parse_mode: "HTML" });
  });

  // AI chat command
  bot.onText(/\/ai (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const userMessage = match![1];
    await bot.sendChatAction(chatId, "typing");
    const response = await chatWithGeminiTelegram(userMessage);
    const formatted = formatGeminiResponse(response);
    const chunks = splitMessage(formatted);
    for (const chunk of chunks) {
      await bot.sendMessage(chatId, chunk, { parse_mode: "HTML" });
    }
  });

  bot.onText(/\/clear_memory/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    await storage.clearChatMemory();
    await bot.sendMessage(chatId, "\u{1F9F9} AI conversation memory has been cleared!");
  });

  bot.onText(/\/save_browser_memory/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    userStates.set(chatId, { action: "browser_memory" });
    await bot.sendMessage(chatId, "\u{1F4DD} Please type the memory/instructions you want the web chat AI to always reference:\n\n<i>(This will be saved permanently and used in every web chat conversation)</i>", { parse_mode: "HTML" });
  });

  // STATUS UPDATE commands
  bot.onText(/\/home_status_updated(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const dayNum = parseInt(match![1]);
    const existing = await storage.getDayByNumberAndCategory(dayNum, "home");
    if (!existing) {
      return bot.sendMessage(chatId, `\u274C Home Day ${dayNum} not found.`);
    }
    if (existing.status === "Logged") {
      return bot.sendMessage(chatId, `\u2705 Home Day ${dayNum} is already marked as Logged!`);
    }
    await storage.updateDay(existing.id, { status: "Logged" });
    await bot.sendMessage(chatId, `\u2705 <b>Home Day ${dayNum}</b> has been marked as <b>Logged</b> (done)!`, { parse_mode: "HTML" });
    const comment = await getGeminiComment("Completed home workout", `Home Day ${dayNum} marked as done. Exercises: ${existing.exercises.join(", ")}`);
    if (comment) {
      await bot.sendMessage(chatId, `\u{1F916} ${formatGeminiResponse(comment)}`, { parse_mode: "HTML" });
    }
  });

  bot.onText(/\/gym_status_updated(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const dayNum = parseInt(match![1]);
    const existing = await storage.getDayByNumberAndCategory(dayNum, "gym");
    if (!existing) {
      return bot.sendMessage(chatId, `\u274C Gym Day ${dayNum} not found.`);
    }
    if (existing.status === "Logged") {
      return bot.sendMessage(chatId, `\u2705 Gym Day ${dayNum} is already marked as Logged!`);
    }
    await storage.updateDay(existing.id, { status: "Logged" });
    await bot.sendMessage(chatId, `\u2705 <b>Gym Day ${dayNum}</b> has been marked as <b>Logged</b> (done)!`, { parse_mode: "HTML" });
    const comment = await getGeminiComment("Completed gym workout", `Gym Day ${dayNum} marked as done. Exercises: ${existing.exercises.join(", ")}`);
    if (comment) {
      await bot.sendMessage(chatId, `\u{1F916} ${formatGeminiResponse(comment)}`, { parse_mode: "HTML" });
    }
  });

  // SAVE commands
  bot.onText(/\/save_home_d(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const dayNum = parseInt(match![1]);
    const existing = await storage.getDayByNumberAndCategory(dayNum, "home");
    if (existing) {
      await bot.sendMessage(chatId, `\u26A0\uFE0F Data already exists for Home Day ${dayNum}. Do you want to update it?`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "\u2705 Yes, update", callback_data: `confirm_update_home_${dayNum}` },
              { text: "\u274C No", callback_data: "cancel_action" },
            ],
          ],
        },
      });
      return;
    }
    userStates.set(chatId, { action: "save", category: "home", dayNumber: dayNum });
    await bot.sendMessage(chatId, `\u{1F4DD} Please type your exercises for <b>Home Day ${dayNum}</b>:\n<i>(One per line)</i>`, { parse_mode: "HTML" });
  });

  bot.onText(/\/save_gym_d(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const dayNum = parseInt(match![1]);
    const existing = await storage.getDayByNumberAndCategory(dayNum, "gym");
    if (existing) {
      await bot.sendMessage(chatId, `\u26A0\uFE0F Data already exists for Gym Day ${dayNum}. Do you want to update it?`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "\u2705 Yes, update", callback_data: `confirm_update_gym_${dayNum}` },
              { text: "\u274C No", callback_data: "cancel_action" },
            ],
          ],
        },
      });
      return;
    }
    userStates.set(chatId, { action: "save", category: "gym", dayNumber: dayNum });
    await bot.sendMessage(chatId, `\u{1F4DD} Please type your exercises for <b>Gym Day ${dayNum}</b>:\n<i>(One per line)</i>`, { parse_mode: "HTML" });
  });

  // UPDATE commands
  bot.onText(/\/update_d(\d+)_home/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const dayNum = parseInt(match![1]);
    const existing = await storage.getDayByNumberAndCategory(dayNum, "home");
    if (!existing) {
      await bot.sendMessage(chatId, `\u274C Home Day ${dayNum} not found. Use /save_home_d${dayNum} to create it.`);
      return;
    }
    userStates.set(chatId, { action: "update", category: "home", dayNumber: dayNum, dayId: existing.id });
    await bot.sendMessage(chatId, `\u{1F4DD} Please enter the updated exercises for <b>Home Day ${dayNum}</b>:\n<i>(One per line)</i>`, { parse_mode: "HTML" });
  });

  bot.onText(/\/update_d(\d+)_gym/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const dayNum = parseInt(match![1]);
    const existing = await storage.getDayByNumberAndCategory(dayNum, "gym");
    if (!existing) {
      await bot.sendMessage(chatId, `\u274C Gym Day ${dayNum} not found. Use /save_gym_d${dayNum} to create it.`);
      return;
    }
    userStates.set(chatId, { action: "update", category: "gym", dayNumber: dayNum, dayId: existing.id });
    await bot.sendMessage(chatId, `\u{1F4DD} Please enter the updated exercises for <b>Gym Day ${dayNum}</b>:\n<i>(One per line)</i>`, { parse_mode: "HTML" });
  });

  // VIEW commands
  bot.onText(/\/view_home_d(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const dayNum = parseInt(match![1]);
    const day = await storage.getDayByNumberAndCategory(dayNum, "home");
    if (!day) return bot.sendMessage(chatId, `\u274C Home Day ${dayNum} not found.`);
    await bot.sendMessage(chatId, `\u{1F3E0} <b>HOME WORKOUT</b>\n\n${formatDayLog(day)}`, { parse_mode: "HTML" });
  });

  bot.onText(/\/view_gym_d(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const dayNum = parseInt(match![1]);
    const day = await storage.getDayByNumberAndCategory(dayNum, "gym");
    if (!day) return bot.sendMessage(chatId, `\u274C Gym Day ${dayNum} not found.`);
    await bot.sendMessage(chatId, `\u{1F3CB}\u{FE0F} <b>GYM WORKOUT</b>\n\n${formatDayLog(day)}`, { parse_mode: "HTML" });
  });

  // EXPORT commands
  bot.onText(/\/export_home_logs/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const allDays = await storage.getDaysByCategory("home");
    const sorted = allDays.sort((a, b) => a.dayNumber - b.dayNumber);
    if (sorted.length === 0) return bot.sendMessage(chatId, "\u274C No home logs found.");
    let text = `\u{1F3E0} <b>HOME WORKOUT LOGS</b>\n(D1\u2013D${sorted[sorted.length - 1].dayNumber})\n\n`;
    sorted.forEach(day => { text += formatDayLog(day) + "\n"; });
    const chunks = splitMessage(text);
    for (const chunk of chunks) {
      await bot.sendMessage(chatId, chunk, { parse_mode: "HTML" });
    }
  });

  bot.onText(/\/export_gym_logs/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const allDays = await storage.getDaysByCategory("gym");
    const sorted = allDays.sort((a, b) => a.dayNumber - b.dayNumber);
    if (sorted.length === 0) return bot.sendMessage(chatId, "\u274C No gym logs found.");
    let text = `\u{1F3CB}\u{FE0F} <b>GYM WORKOUT LOGS</b>\n(D1\u2013D${sorted[sorted.length - 1].dayNumber})\n\n`;
    sorted.forEach(day => { text += formatDayLog(day) + "\n"; });
    const chunks = splitMessage(text);
    for (const chunk of chunks) {
      await bot.sendMessage(chatId, chunk, { parse_mode: "HTML" });
    }
  });

  // DELETE commands
  bot.onText(/\/delete_home_d(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const dayNum = parseInt(match![1]);
    const day = await storage.getDayByNumberAndCategory(dayNum, "home");
    if (!day) return bot.sendMessage(chatId, `\u274C Home Day ${dayNum} not found.`);
    await bot.sendMessage(chatId, `\u26A0\uFE0F Are you sure you want to delete <b>Home Day ${dayNum}</b>?`, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "\u{1F5D1}\uFE0F Yes, delete", callback_data: `delete_confirm_${day.id}` },
            { text: "\u274C Cancel", callback_data: "cancel_action" },
          ],
        ],
      },
    });
  });

  bot.onText(/\/delete_gym_d(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const dayNum = parseInt(match![1]);
    const day = await storage.getDayByNumberAndCategory(dayNum, "gym");
    if (!day) return bot.sendMessage(chatId, `\u274C Gym Day ${dayNum} not found.`);
    await bot.sendMessage(chatId, `\u26A0\uFE0F Are you sure you want to delete <b>Gym Day ${dayNum}</b>?`, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "\u{1F5D1}\uFE0F Yes, delete", callback_data: `delete_confirm_${day.id}` },
            { text: "\u274C Cancel", callback_data: "cancel_action" },
          ],
        ],
      },
    });
  });

  // STATS command
  bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const homeDays = await storage.getDaysByCategory("home");
    const gymDays = await storage.getDaysByCategory("gym");
    const homeLogged = homeDays.filter(d => d.status === "Logged").length;
    const gymLogged = gymDays.filter(d => d.status === "Logged").length;
    const homeIntensity = homeDays.reduce((sum, d) => sum + calcIntensity(d.exercises), 0);
    const gymIntensity = gymDays.reduce((sum, d) => sum + calcIntensity(d.exercises), 0);
    const totalExercises = [...homeDays, ...gymDays].reduce((sum, d) => sum + d.exercises.length, 0);
    const statsText = `\u{1F4CA} <b>YOUR PROGRESS STATS</b>
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

\u{1F3E0} <b>Home Workouts</b>
  Days logged: ${homeLogged}/${homeDays.length}
  Total intensity: ${homeIntensity}

\u{1F3CB}\u{FE0F} <b>Gym Workouts</b>
  Days logged: ${gymLogged}/${gymDays.length}
  Total intensity: ${gymIntensity}

\u{1F4AA} <b>Overall</b>
  Total days: ${homeDays.length + gymDays.length}
  Total exercises: ${totalExercises}
  Combined intensity: ${homeIntensity + gymIntensity}

Keep going, John! \u{1F525}`;
    await bot.sendMessage(chatId, statsText, { parse_mode: "HTML" });
  });

  // INTENSITY commands
  bot.onText(/\/intensity_home/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const allDays = await storage.getDaysByCategory("home");
    const sorted = allDays.sort((a, b) => a.dayNumber - b.dayNumber);
    if (sorted.length === 0) return bot.sendMessage(chatId, "\u274C No home logs found.");
    let text = "\u{1F3E0} <b>Home Workout Intensity</b>\n\n<code>";
    const maxIntensity = Math.max(...sorted.map(d => calcIntensity(d.exercises)));
    sorted.forEach(d => {
      const intensity = calcIntensity(d.exercises);
      const barLen = Math.max(1, Math.round((intensity / maxIntensity) * 15));
      const bar = "\u2588".repeat(barLen) + "\u2591".repeat(15 - barLen);
      text += `D${String(d.dayNumber).padStart(2, " ")} ${bar} ${intensity}\n`;
    });
    text += "</code>";
    await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  });

  bot.onText(/\/intensity_gym/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const allDays = await storage.getDaysByCategory("gym");
    const sorted = allDays.sort((a, b) => a.dayNumber - b.dayNumber);
    if (sorted.length === 0) return bot.sendMessage(chatId, "\u274C No gym logs found.");
    let text = "\u{1F3CB}\u{FE0F} <b>Gym Workout Intensity</b>\n\n<code>";
    const maxIntensity = Math.max(...sorted.map(d => calcIntensity(d.exercises)));
    sorted.forEach(d => {
      const intensity = calcIntensity(d.exercises);
      const barLen = Math.max(1, Math.round((intensity / maxIntensity) * 15));
      const bar = "\u2588".repeat(barLen) + "\u2591".repeat(15 - barLen);
      text += `D${String(d.dayNumber).padStart(2, " ")} ${bar} ${intensity}\n`;
    });
    text += "</code>";
    await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  });

  // CALLBACK QUERIES
  bot.on("callback_query", async (query) => {
    const chatId = query.message!.chat.id;
    if (!isOwner(chatId)) {
      await bot.answerCallbackQuery(query.id, { text: "Access denied" });
      return;
    }
    const data = query.data || "";

    if (data === "cancel_action") {
      userStates.delete(chatId);
      await bot.answerCallbackQuery(query.id, { text: "Got it!" });
      await bot.sendMessage(chatId, "Got it! \u{1F44D}");
      return;
    }

    if (data === "view_home") {
      await bot.answerCallbackQuery(query.id);
      const allDays = await storage.getDaysByCategory("home");
      const sorted = allDays.sort((a, b) => a.dayNumber - b.dayNumber);
      if (sorted.length === 0) { await bot.sendMessage(chatId, "\u274C No home logs found."); return; }
      let text = `\u{1F3E0} <b>HOME WORKOUT LOGS</b>\n(D1\u2013D${sorted[sorted.length - 1].dayNumber})\n\n`;
      sorted.forEach(d => { text += formatDayLog(d) + "\n"; });
      const chunks = splitMessage(text);
      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk, { parse_mode: "HTML" });
      }
      return;
    }

    if (data === "view_gym") {
      await bot.answerCallbackQuery(query.id);
      const allDays = await storage.getDaysByCategory("gym");
      const sorted = allDays.sort((a, b) => a.dayNumber - b.dayNumber);
      if (sorted.length === 0) { await bot.sendMessage(chatId, "\u274C No gym logs found."); return; }
      let text = `\u{1F3CB}\u{FE0F} <b>GYM WORKOUT LOGS</b>\n(D1\u2013D${sorted[sorted.length - 1].dayNumber})\n\n`;
      sorted.forEach(d => { text += formatDayLog(d) + "\n"; });
      const chunks = splitMessage(text);
      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk, { parse_mode: "HTML" });
      }
      return;
    }

    if (data === "show_help") {
      await bot.answerCallbackQuery(query.id);
      const helpMsg = { ...query.message!, text: "/help", chat: query.message!.chat } as any;
      bot.processUpdate({ update_id: 0, message: helpMsg });
      return;
    }

    const confirmUpdate = data.match(/^confirm_update_(home|gym)_(\d+)$/);
    if (confirmUpdate) {
      await bot.answerCallbackQuery(query.id);
      const category = confirmUpdate[1];
      const dayNum = parseInt(confirmUpdate[2]);
      const existing = await storage.getDayByNumberAndCategory(dayNum, category);
      if (existing) {
        userStates.set(chatId, { action: "update", category, dayNumber: dayNum, dayId: existing.id });
        await bot.sendMessage(chatId, `\u{1F4DD} Please enter the updated exercises for <b>${category === "home" ? "Home" : "Gym"} Day ${dayNum}</b>:\n<i>(One per line)</i>`, { parse_mode: "HTML" });
      }
      return;
    }

    const deleteConfirm = data.match(/^delete_confirm_(\d+)$/);
    if (deleteConfirm) {
      await bot.answerCallbackQuery(query.id);
      const dayId = parseInt(deleteConfirm[1]);
      try {
        const day = await storage.getDay(dayId);
        await storage.deleteDay(dayId);
        await bot.sendMessage(chatId, "\u2705 Day deleted successfully!");
        if (day) {
          const comment = await getGeminiComment("Deleted workout", `${day.category} Day ${day.dayNumber} deleted`);
          if (comment) {
            await bot.sendMessage(chatId, `\u{1F916} ${formatGeminiResponse(comment)}`, { parse_mode: "HTML" });
          }
        }
      } catch {
        await bot.sendMessage(chatId, "\u274C Failed to delete day.");
      }
      return;
    }

    await bot.answerCallbackQuery(query.id);
  });

  // MESSAGE handler for free-text input
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    if (!msg.text || msg.text.startsWith("/")) return;

    const state = userStates.get(chatId);
    if (!state) {
      await bot.sendChatAction(chatId, "typing");
      const response = await chatWithGeminiTelegram(msg.text);
      const formatted = formatGeminiResponse(response);
      const chunks = splitMessage(formatted);
      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk, { parse_mode: "HTML" });
      }
      return;
    }

    if (state.action === "browser_memory") {
      try {
        await storage.saveBrowserMemory(msg.text);
        await bot.sendMessage(chatId, "\u2705 <b>Browser memory saved!</b>\n\nThe web chat AI will now reference this in every conversation.", { parse_mode: "HTML" });
        const comment = await getGeminiComment("Saved browser memory", `Content: ${msg.text.substring(0, 200)}`);
        if (comment) {
          await bot.sendMessage(chatId, `\u{1F916} ${formatGeminiResponse(comment)}`, { parse_mode: "HTML" });
        }
      } catch {
        await bot.sendMessage(chatId, "\u274C Failed to save browser memory.");
      }
      userStates.delete(chatId);
      return;
    }

    const exercises = msg.text
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (exercises.length === 0) {
      await bot.sendMessage(chatId, "\u274C No exercises detected. Please enter at least one exercise.");
      return;
    }

    try {
      if (state.action === "save") {
        await storage.createDay({
          dayNumber: state.dayNumber!,
          status: "Logged",
          exercises,
          category: state.category!,
        });
        await bot.sendMessage(chatId, `\u2705 <b>${state.category === "home" ? "Home" : "Gym"} Day ${state.dayNumber}</b> saved successfully!\n\n${exercises.length} exercises logged.`, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "\u{1F4CB} View it", callback_data: `view_${state.category}` }]],
          },
        });
        const comment = await getGeminiComment(`Saved new ${state.category} workout`, `Day ${state.dayNumber}: ${exercises.join(", ")}`);
        if (comment) {
          await bot.sendMessage(chatId, `\u{1F916} ${formatGeminiResponse(comment)}`, { parse_mode: "HTML" });
        }
      } else if (state.action === "update") {
        await storage.updateDay(state.dayId!, { exercises, status: "Logged" });
        await bot.sendMessage(chatId, `\u2705 <b>${state.category === "home" ? "Home" : "Gym"} Day ${state.dayNumber}</b> updated successfully!\n\n${exercises.length} exercises logged.`, { parse_mode: "HTML" });
        const comment = await getGeminiComment(`Updated ${state.category} workout`, `Day ${state.dayNumber}: ${exercises.join(", ")}`);
        if (comment) {
          await bot.sendMessage(chatId, `\u{1F916} ${formatGeminiResponse(comment)}`, { parse_mode: "HTML" });
        }
      }
    } catch (err: any) {
      await bot.sendMessage(chatId, `\u274C Error: ${esc(err.message || "Unknown error")}`);
    }

    userStates.delete(chatId);
  });

  bot.on("polling_error", (err) => {
    log(`Polling error: ${err.message}`, "telegram");
  });

  return bot;
}

function formatGeminiResponse(text: string): string {
  let formatted = text;
  formatted = formatted.replace(/\*\*\*(.*?)\*\*\*/g, "<b><i>$1</i></b>");
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  formatted = formatted.replace(/\*(.*?)\*/g, "<i>$1</i>");
  formatted = formatted.replace(/`(.*?)`/g, "<code>$1</code>");
  return formatted;
}
