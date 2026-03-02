import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";
import { log } from "./log";
import { chatWithGeminiTelegram, getGeminiComment, analyzeImageWithGemini, generateImageWithGemini } from "./gemini";
import * as https from "https";
import * as http from "http";

const OWNER_ID = 7474049767;

let botInstance: TelegramBot | null = null;
let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function getBotInstance(): TelegramBot | null {
  return botInstance;
}

interface UserState {
  action: string;
  category?: string;
  dayNumber?: number;
  dayId?: number;
}

const pendingImageGen = new Map<number, { prompt: string; waitingForPhoto: boolean }>();

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

function formatGeminiResponse(text: string): string {
  let formatted = text;
  formatted = formatted.replace(/\*\*\*(.*?)\*\*\*/g, "<b><i>$1</i></b>");
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  formatted = formatted.replace(/\*(.*?)\*/g, "<i>$1</i>");
  formatted = formatted.replace(/`(.*?)`/g, "<code>$1</code>");
  return formatted;
}

export async function sendOwnerNotification(text: string) {
  if (botInstance && OWNER_ID) {
    try {
      await botInstance.sendMessage(OWNER_ID, text, { parse_mode: "HTML" });
      return;
    } catch (err: any) {
      log(`Failed to send notification via bot: ${err.message}`, "telegram");
    }
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token && OWNER_ID) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: OWNER_ID, text, parse_mode: "HTML" }),
      });
    } catch (err: any) {
      console.error(`Failed to send TG notification via HTTP: ${err.message}`);
    }
  }
}

async function checkReminders() {
  if (!botInstance) return;
  try {
    const claimed = await storage.claimDueReminders();
    for (const reminder of claimed) {
      const triggerStr = new Date(reminder.triggerAt).toLocaleString("en-US", { timeZone: "Asia/Manila", hour12: true, hour: "numeric", minute: "2-digit", second: "2-digit" });
      const nowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila", hour12: true, hour: "numeric", minute: "2-digit", second: "2-digit" });
      let msg = `\u23F0 <b>Reminder!</b>\n\n${esc(reminder.message)}\n\n<i>Scheduled: ${triggerStr} | Delivered: ${nowStr}</i>`;
      if (reminder.isRecurring) {
        msg += `\n\u{1F501} <i>Recurring — next one in ${Math.round(reminder.intervalMs / 60000)} min</i>`;
      }
      await botInstance.sendMessage(OWNER_ID, msg, { parse_mode: "HTML" });
      log(`Reminder sent: ${reminder.message}`, "telegram");

      if (reminder.isRecurring && reminder.intervalMs > 0) {
        const nextTrigger = new Date(new Date(reminder.triggerAt).getTime() + reminder.intervalMs);
        await storage.rescheduleRecurringReminder(reminder.id, nextTrigger);
        log(`Recurring reminder rescheduled: ${reminder.message} -> ${nextTrigger.toISOString()}`, "telegram");
      }
    }
  } catch (err: any) {
    log(`Reminder check error: ${err.message}`, "telegram");
  }
}

export async function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    log("TELEGRAM_BOT_TOKEN not set, skipping bot startup", "telegram");
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
    const kickRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-1&timeout=0`);
    const kickData = await kickRes.json() as any;
    if (kickData.result?.length) {
      const lastId = kickData.result[kickData.result.length - 1].update_id;
      await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastId + 1}&timeout=0`);
    }
    await new Promise(r => setTimeout(r, 2000));
  } catch (e: any) {
    log(`Pre-polling cleanup error (non-fatal): ${e.message}`, "telegram");
  }

  const bot = new TelegramBot(token, { polling: false });
  botInstance = bot;
  log("Telegram bot started (manual polling)", "telegram");

  let pollingOffset = 0;
  async function manualPoll() {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?offset=${pollingOffset}&timeout=15&allowed_updates=${encodeURIComponent(JSON.stringify(["message", "callback_query"]))}`
      );
      const data = await res.json() as any;
      if (data.ok && data.result?.length) {
        for (const update of data.result) {
          pollingOffset = update.update_id + 1;
          bot.processUpdate(update);
        }
      } else if (!data.ok && data.error_code === 409) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const kickRes2 = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-1&timeout=0`);
          const kickData2 = await kickRes2.json() as any;
          if (kickData2.ok && kickData2.result?.length) {
            pollingOffset = kickData2.result[kickData2.result.length - 1].update_id + 1;
          }
        } catch {}
      }
    } catch (e: any) {
      await new Promise(r => setTimeout(r, 2000));
    }
    setTimeout(manualPoll, 100);
  }
  manualPoll();

  reminderInterval = setInterval(checkReminders, 3000);
  checkReminders();

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
    { command: "dl_backup", description: "Download full data backup" },
    { command: "reminders", description: "List pending reminders" },
    { command: "create_image", description: "Generate an image with AI" },
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
Send a photo \u2014 AI will analyze it

\u{1F4BE} <b>BACKUP &amp; REMINDERS</b>
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/dl_backup \u2014 Download full data backup as JSON
Upload a .json file \u2014 Restore from backup
/reminders \u2014 List all pending reminders (numbered)

<b>Reminder AI Commands:</b>
\u2022 "remind me in 10 seconds to drink water"
\u2022 "remind me every day at 8 PM to workout"
\u2022 "display reminders" \u2014 shows numbered list
\u2022 "delete number 3" \u2014 deletes 3rd reminder
\u2022 "change number 2 to every hour"
\u2022 "edit reminder #5 message to take vitamins"

\u{1F3A8} <b>IMAGE GENERATION</b>
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/create_image [prompt] \u2014 Generate AI image
Send photo with caption /create_image [prompt] \u2014 Use reference image

\u{1F4AC} <b>NATURAL LANGUAGE</b>
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
Just type naturally! e.g.:
\u2022 "save my day 16 home"
\u2022 "mark gym day 5 as done"
\u2022 "remind me in 30 minutes to stretch"
\u2022 "show my stats"

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
/dl_backup
/reminders
/create_image [prompt]

<i>Or just type naturally \u2014 AI understands!</i>
<i>Send photos for AI analysis or with /create_image caption!</i>
<i>Upload .json files to restore backups!</i>`;
    await bot.sendMessage(chatId, commandsList, { parse_mode: "HTML" });
  });

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

  bot.onText(/\/dl_backup/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    await bot.sendChatAction(chatId, "upload_document");
    try {
      const data = await storage.exportAllData();
      const jsonStr = JSON.stringify(data, null, 2);
      const buffer = Buffer.from(jsonStr, "utf-8");
      const now = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
      await bot.sendDocument(chatId, buffer, {
        caption: `\u{1F4BE} Full backup — ${now}\n${(buffer.length / 1024).toFixed(1)} KB`,
      }, {
        filename: `lockin_backup_${now}.json`,
        contentType: "application/json",
      });
      await storage.logBackup("download", `Manual backup via TG, ${buffer.length} bytes`);
    } catch (err: any) {
      await bot.sendMessage(chatId, `\u274C Backup failed: ${esc(err.message)}`);
    }
  });

  bot.onText(/\/reminders/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const reminders = await storage.getAllReminders();
    if (reminders.length === 0) {
      return bot.sendMessage(chatId, "\u{1F4ED} No pending reminders. Ask the AI to set one!");
    }
    let text = `\u23F0 <b>Pending Reminders (${reminders.length})</b>\n\n`;
    reminders.forEach((r: any, idx: number) => {
      const timeStr = new Date(r.triggerAt).toLocaleString("en-US", { timeZone: "Asia/Manila", hour12: true, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
      const recurLabel = r.isRecurring ? ` \u{1F501} recurring` : "";
      let intervalLabel = "";
      if (r.isRecurring && r.intervalMs) {
        if (r.intervalMs < 60000) intervalLabel = ` (every ${Math.round(r.intervalMs / 1000)}s)`;
        else if (r.intervalMs < 3600000) intervalLabel = ` (every ${Math.round(r.intervalMs / 60000)} min)`;
        else if (r.intervalMs < 86400000) intervalLabel = ` (every ${Math.round(r.intervalMs / 3600000)} hr)`;
        else intervalLabel = ` (every ${Math.round(r.intervalMs / 86400000)} day)`;
      }
      text += `<b>${idx + 1}.</b> ${esc(r.message)}\n   \u{1F552} ${timeStr}${recurLabel}${intervalLabel}\n   <i>ID: #${r.id}</i>\n\n`;
    });
    text += `<i>Commands:\n\u2022 "delete number X" or "delete reminder #ID"\n\u2022 "change number X to every hour"\n\u2022 "edit reminder #ID message to ..."\n(Use /ai prefix)</i>`;
    await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  });

  bot.onText(/\/create_image(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const prompt = match![1]?.trim();

    if (!prompt) {
      await bot.sendMessage(chatId, "\u{1F3A8} <b>Image Generator</b>\n\nUsage:\n<code>/create_image [your prompt]</code>\n\nYou can also send a photo with the caption <code>/create_image [prompt]</code> to use it as a reference.\n\nExample:\n<code>/create_image a futuristic gym with neon lights</code>", { parse_mode: "HTML" });
      return;
    }

    pendingImageGen.set(chatId, { prompt, waitingForPhoto: false });
    await bot.sendChatAction(chatId, "upload_photo");

    try {
      const result = await generateImageWithGemini(prompt);
      if (!result) {
        await bot.sendMessage(chatId, "\u274C Image generation failed. Try a different prompt.");
        return;
      }

      if (result.text) {
        const formatted = formatGeminiResponse(result.text);
        await bot.sendMessage(chatId, formatted, { parse_mode: "HTML" });
      }

      if (result.imageBuffer) {
        await bot.sendPhoto(chatId, result.imageBuffer, { caption: `\u{1F3A8} Generated: ${prompt}` });
        log(`Image generated for prompt: ${prompt}`, "telegram");
      } else {
        await bot.sendMessage(chatId, "\u26A0\uFE0F AI responded but didn't generate an image. Try rephrasing your prompt.");
      }
    } catch (err: any) {
      await bot.sendMessage(chatId, `\u274C Image generation error: ${esc(err.message)}`);
      log(`Image generation error: ${err.message}`, "telegram");
    } finally {
      pendingImageGen.delete(chatId);
    }
  });

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

  bot.onText(/\/export_home_logs/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const allDays = await storage.getDaysByCategory("home");
    const sorted = allDays.sort((a: any, b: any) => a.dayNumber - b.dayNumber);
    if (sorted.length === 0) return bot.sendMessage(chatId, "\u274C No home logs found.");
    let text = `\u{1F3E0} <b>HOME WORKOUT LOGS</b>\n(D1\u2013D${sorted[sorted.length - 1].dayNumber})\n\n`;
    sorted.forEach((day: any) => { text += formatDayLog(day) + "\n"; });
    const chunks = splitMessage(text);
    for (const chunk of chunks) {
      await bot.sendMessage(chatId, chunk, { parse_mode: "HTML" });
    }
  });

  bot.onText(/\/export_gym_logs/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const allDays = await storage.getDaysByCategory("gym");
    const sorted = allDays.sort((a: any, b: any) => a.dayNumber - b.dayNumber);
    if (sorted.length === 0) return bot.sendMessage(chatId, "\u274C No gym logs found.");
    let text = `\u{1F3CB}\u{FE0F} <b>GYM WORKOUT LOGS</b>\n(D1\u2013D${sorted[sorted.length - 1].dayNumber})\n\n`;
    sorted.forEach((day: any) => { text += formatDayLog(day) + "\n"; });
    const chunks = splitMessage(text);
    for (const chunk of chunks) {
      await bot.sendMessage(chatId, chunk, { parse_mode: "HTML" });
    }
  });

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

  bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const homeDays = await storage.getDaysByCategory("home");
    const gymDays = await storage.getDaysByCategory("gym");
    const homeLogged = homeDays.filter((d: any) => d.status === "Logged").length;
    const gymLogged = gymDays.filter((d: any) => d.status === "Logged").length;
    const homeIntensity = homeDays.reduce((sum: number, d: any) => sum + calcIntensity(d.exercises), 0);
    const gymIntensity = gymDays.reduce((sum: number, d: any) => sum + calcIntensity(d.exercises), 0);
    const totalExercises = [...homeDays, ...gymDays].reduce((sum: number, d: any) => sum + d.exercises.length, 0);
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

  bot.onText(/\/intensity_home/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const allDays = await storage.getDaysByCategory("home");
    const sorted = allDays.sort((a: any, b: any) => a.dayNumber - b.dayNumber);
    if (sorted.length === 0) return bot.sendMessage(chatId, "\u274C No home logs found.");
    let text = "\u{1F3E0} <b>Home Workout Intensity</b>\n\n<code>";
    const maxIntensity = Math.max(...sorted.map((d: any) => calcIntensity(d.exercises)));
    sorted.forEach((d: any) => {
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
    const sorted = allDays.sort((a: any, b: any) => a.dayNumber - b.dayNumber);
    if (sorted.length === 0) return bot.sendMessage(chatId, "\u274C No gym logs found.");
    let text = "\u{1F3CB}\u{FE0F} <b>Gym Workout Intensity</b>\n\n<code>";
    const maxIntensity = Math.max(...sorted.map((d: any) => calcIntensity(d.exercises)));
    sorted.forEach((d: any) => {
      const intensity = calcIntensity(d.exercises);
      const barLen = Math.max(1, Math.round((intensity / maxIntensity) * 15));
      const bar = "\u2588".repeat(barLen) + "\u2591".repeat(15 - barLen);
      text += `D${String(d.dayNumber).padStart(2, " ")} ${bar} ${intensity}\n`;
    });
    text += "</code>";
    await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  });

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
      const sorted = allDays.sort((a: any, b: any) => a.dayNumber - b.dayNumber);
      if (sorted.length === 0) { await bot.sendMessage(chatId, "\u274C No home logs found."); return; }
      let text = `\u{1F3E0} <b>HOME WORKOUT LOGS</b>\n(D1\u2013D${sorted[sorted.length - 1].dayNumber})\n\n`;
      sorted.forEach((d: any) => { text += formatDayLog(d) + "\n"; });
      const chunks = splitMessage(text);
      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk, { parse_mode: "HTML" });
      }
      return;
    }

    if (data === "view_gym") {
      await bot.answerCallbackQuery(query.id);
      const allDays = await storage.getDaysByCategory("gym");
      const sorted = allDays.sort((a: any, b: any) => a.dayNumber - b.dayNumber);
      if (sorted.length === 0) { await bot.sendMessage(chatId, "\u274C No gym logs found."); return; }
      let text = `\u{1F3CB}\u{FE0F} <b>GYM WORKOUT LOGS</b>\n(D1\u2013D${sorted[sorted.length - 1].dayNumber})\n\n`;
      sorted.forEach((d: any) => { text += formatDayLog(d) + "\n"; });
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

    const confirmRestore = data.match(/^confirm_restore$/);
    if (confirmRestore) {
      await bot.answerCallbackQuery(query.id);
      const state = userStates.get(chatId);
      if (state && state.action === "restore_pending") {
        try {
          const backupData = (state as any).backupData;
          await storage.importAllData(backupData);
          await storage.logBackup("restore", `Restored from TG upload`);
          await bot.sendMessage(chatId, "\u2705 <b>Backup restored successfully!</b>\n\nAll data has been replaced with the backup.", { parse_mode: "HTML" });
        } catch (err: any) {
          await bot.sendMessage(chatId, `\u274C Restore failed: ${esc(err.message)}`);
        }
        userStates.delete(chatId);
      }
      return;
    }

    await bot.answerCallbackQuery(query.id);
  });

  bot.on("photo", async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;

    const photo = msg.photo![msg.photo!.length - 1];
    const caption = msg.caption || "";

    try {
      const fileInfo = await bot.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
      const response = await fetch(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());

      const ext = fileInfo.file_path?.split(".").pop()?.toLowerCase() || "jpg";
      const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
      const mimeType = mimeMap[ext] || "image/jpeg";

      if (caption.startsWith("/create_image")) {
        const prompt = caption.replace("/create_image", "").trim() || "Transform this image creatively";
        await bot.sendChatAction(chatId, "upload_photo");

        const result = await generateImageWithGemini(prompt, { buffer, mimeType });
        if (!result) {
          await bot.sendMessage(chatId, "\u274C Image generation failed. Try a different prompt.");
          return;
        }
        if (result.text) {
          const formatted = formatGeminiResponse(result.text);
          await bot.sendMessage(chatId, formatted, { parse_mode: "HTML" });
        }
        if (result.imageBuffer) {
          await bot.sendPhoto(chatId, result.imageBuffer, { caption: `\u{1F3A8} Generated: ${prompt}` });
          log(`Image generated with reference for prompt: ${prompt}`, "telegram");
        } else {
          await bot.sendMessage(chatId, "\u26A0\uFE0F AI responded but didn't generate an image. Try rephrasing.");
        }
        return;
      }

      await bot.sendChatAction(chatId, "typing");
      const aiResponse = await analyzeImageWithGemini(buffer, mimeType, caption || "Analyze this image");
      const formatted = formatGeminiResponse(aiResponse);
      const chunks = splitMessage(formatted);
      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk, { parse_mode: "HTML" });
      }
    } catch (err: any) {
      await bot.sendMessage(chatId, `\u274C Failed to process image: ${esc(err.message)}`);
    }
  });

  bot.on("document", async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;

    const doc = msg.document!;
    if (!doc.file_name?.endsWith(".json")) return;

    await bot.sendChatAction(chatId, "typing");

    try {
      const fileInfo = await bot.getFile(doc.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
      const response = await fetch(fileUrl);
      const text = await response.text();
      const parsed = JSON.parse(text);

      if (!parsed.data || !parsed.exportedAt) {
        await bot.sendMessage(chatId, "\u274C This doesn't look like a valid Lock-In Logs backup file.");
        return;
      }

      const dataKeys = Object.keys(parsed.data);
      const summary = dataKeys.map(k => `${k}: ${Array.isArray(parsed.data[k]) ? parsed.data[k].length : "?"} records`).join("\n");

      (userStates as any).set(chatId, { action: "restore_pending", backupData: parsed.data });

      await bot.sendMessage(chatId, `\u{1F4E6} <b>Backup file detected</b>\n\nExported: ${parsed.exportedAt}\nContents:\n<code>${summary}</code>\n\n\u26A0\uFE0F This will <b>replace all current data</b>. Continue?`, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "\u2705 Yes, restore", callback_data: "confirm_restore" },
              { text: "\u274C Cancel", callback_data: "cancel_action" },
            ],
          ],
        },
      });
    } catch (err: any) {
      await bot.sendMessage(chatId, `\u274C Failed to process file: ${esc(err.message)}`);
    }
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    if (!msg.text || msg.text.startsWith("/")) return;
    if (msg.photo || msg.document) return;

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

const webhookStates = new Map<number, UserState & { backupData?: any }>();

async function tgApi(method: string, body: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as any;
}

async function tgSend(chatId: number, text: string, opts?: any) {
  return tgApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...opts });
}

async function tgSendPhoto(chatId: number, photoBuffer: Buffer, caption?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const formData = new FormData();
  formData.append("chat_id", String(chatId));
  formData.append("photo", new Blob([photoBuffer]), "image.png");
  if (caption) formData.append("caption", caption);
  await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: formData });
}

async function tgAction(chatId: number, action: string) {
  return tgApi("sendChatAction", { chat_id: chatId, action });
}

async function tgGetFile(fileId: string): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const res = await tgApi("getFile", { file_id: fileId });
  if (res?.result?.file_path) {
    return `https://api.telegram.org/file/bot${token}/${res.result.file_path}`;
  }
  return null;
}

async function tgAnswerCallback(callbackQueryId: string) {
  return tgApi("answerCallbackQuery", { callback_query_id: callbackQueryId });
}

async function tgSendDocument(chatId: number, content: string, filename: string, caption?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const formData = new FormData();
  formData.append("chat_id", String(chatId));
  formData.append("document", new Blob([content], { type: "application/json" }), filename);
  if (caption) formData.append("caption", caption);
  await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: formData });
}

export async function handleTelegramWebhook(update: any) {
  try {
    if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message?.chat?.id;
      if (!chatId || !isOwner(chatId)) return;
      const data = query.data;

      if (data === "cancel_action") {
        webhookStates.delete(chatId);
        await tgSend(chatId, "\u274C Action cancelled.");
        await tgAnswerCallback(query.id);
        return;
      }

      if (data === "confirm_restore") {
        const state = webhookStates.get(chatId) as any;
        if (state?.action === "restore_pending" && state.backupData) {
          await tgAction(chatId, "typing");
          await storage.importAllData(state.backupData);
          await tgSend(chatId, "\u2705 <b>Backup restored!</b>\n\nAll data has been replaced with the backup contents.");
          webhookStates.delete(chatId);
        }
        await tgAnswerCallback(query.id);
        return;
      }

      if (data?.startsWith("view_")) {
        const cat = data.replace("view_", "");
        const days = await storage.getDaysByCategory(cat);
        if (days.length === 0) {
          await tgSend(chatId, `\u{1F4ED} No ${cat} logs yet.`);
        } else {
          let text = `\u{1F4CB} <b>${cat === "home" ? "Home" : "Gym"} Workout Logs</b>\n\n`;
          for (const d of days) {
            text += formatDayLog(d) + "\n";
          }
          const chunks = splitMessage(text);
          for (const chunk of chunks) {
            await tgSend(chatId, chunk);
          }
        }
        await tgAnswerCallback(query.id);
        return;
      }

      if (data?.startsWith("confirm_update_")) {
        const parts = data.replace("confirm_update_", "").split("_");
        const cat = parts[0];
        const dayNum = parseInt(parts[1]);
        const existing = await storage.getDayByNumberAndCategory(dayNum, cat);
        if (existing) {
          webhookStates.set(chatId, { action: "update", category: cat, dayNumber: dayNum, dayId: existing.id });
          await tgSend(chatId, `\u{1F4DD} Send the updated exercises for <b>${cat === "home" ? "Home" : "Gym"} Day ${dayNum}</b>\n\n<i>One exercise per line</i>`);
        }
        await tgAnswerCallback(query.id);
        return;
      }

      if (data?.startsWith("delete_confirm_")) {
        const parts = data.replace("delete_confirm_", "").split("_");
        const cat = parts[0];
        const dayNum = parseInt(parts[1]);
        const existing = await storage.getDayByNumberAndCategory(dayNum, cat);
        if (existing) {
          await storage.deleteDay(existing.id);
          await tgSend(chatId, `\u{1F5D1}\uFE0F <b>${cat === "home" ? "Home" : "Gym"} Day ${dayNum}</b> deleted.`);
        }
        await tgAnswerCallback(query.id);
        return;
      }

      await tgAnswerCallback(query.id);
      return;
    }

    const msg = update.message;
    if (!msg) return;
    const chatId = msg.chat?.id;
    if (!chatId || !isOwner(chatId)) {
      if (chatId) await tgSend(chatId, "\u26D4 Access denied. This bot is private.");
      return;
    }

    if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1];
      const caption = msg.caption || "";
      const fileUrl = await tgGetFile(photo.file_id);
      if (!fileUrl) return;

      const response = await fetch(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = fileUrl.split(".").pop()?.toLowerCase() || "jpg";
      const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
      const mimeType = mimeMap[ext] || "image/jpeg";

      if (caption.startsWith("/create_image")) {
        const prompt = caption.replace("/create_image", "").trim() || "Transform this image creatively";
        await tgAction(chatId, "upload_photo");
        const result = await generateImageWithGemini(prompt, { buffer, mimeType });
        if (!result) {
          await tgSend(chatId, "\u274C Image generation failed.");
          return;
        }
        if (result.text) await tgSend(chatId, formatGeminiResponse(result.text));
        if (result.imageBuffer) await tgSendPhoto(chatId, result.imageBuffer, `\u{1F3A8} Generated: ${prompt}`);
        else await tgSend(chatId, "\u26A0\uFE0F AI responded but didn't generate an image.");
        return;
      }

      await tgAction(chatId, "typing");
      const aiResponse = await analyzeImageWithGemini(buffer, mimeType, caption || "Analyze this image");
      const formatted = formatGeminiResponse(aiResponse);
      const chunks = splitMessage(formatted);
      for (const chunk of chunks) {
        await tgSend(chatId, chunk);
      }
      return;
    }

    if (msg.document) {
      const doc = msg.document;
      if (!doc.file_name?.endsWith(".json")) return;
      await tgAction(chatId, "typing");
      const fileUrl = await tgGetFile(doc.file_id);
      if (!fileUrl) return;
      const response = await fetch(fileUrl);
      const text = await response.text();
      const parsed = JSON.parse(text);
      if (!parsed.data || !parsed.exportedAt) {
        await tgSend(chatId, "\u274C Not a valid backup file.");
        return;
      }
      const dataKeys = Object.keys(parsed.data);
      const summary = dataKeys.map((k: string) => `${k}: ${Array.isArray(parsed.data[k]) ? parsed.data[k].length : "?"} records`).join("\n");
      webhookStates.set(chatId, { action: "restore_pending", backupData: parsed.data } as any);
      await tgSend(chatId, `\u{1F4E6} <b>Backup file detected</b>\n\nExported: ${parsed.exportedAt}\nContents:\n<code>${summary}</code>\n\n\u26A0\uFE0F This will <b>replace all current data</b>. Continue?`, {
        reply_markup: { inline_keyboard: [[{ text: "\u2705 Yes, restore", callback_data: "confirm_restore" }, { text: "\u274C Cancel", callback_data: "cancel_action" }]] },
      });
      return;
    }

    const text = msg.text;
    if (!text) return;

    if (text.startsWith("/start")) {
      await tgSend(chatId, `\u{1F3CB}\uFE0F <b>Welcome to John's Lock-In Bot!</b>\n\nYour personal workout log manager.\nUse /help to see all available commands.\n\n\u{1F4AA} Keep grinding!`);
      return;
    }

    const saveHomeMatch = text.match(/^\/save_home_d(\d+)/);
    if (saveHomeMatch) {
      const dayNum = parseInt(saveHomeMatch[1]);
      const existing = await storage.getDayByNumberAndCategory(dayNum, "home");
      if (existing) {
        await tgSend(chatId, `\u26A0\uFE0F Home Day ${dayNum} already exists. Use /update_d${dayNum}_home to update.`);
        return;
      }
      webhookStates.set(chatId, { action: "save", category: "home", dayNumber: dayNum });
      await tgSend(chatId, `\u{1F4DD} Send exercises for <b>Home Day ${dayNum}</b>\n\n<i>One exercise per line</i>`);
      return;
    }

    const saveGymMatch = text.match(/^\/save_gym_d(\d+)/);
    if (saveGymMatch) {
      const dayNum = parseInt(saveGymMatch[1]);
      const existing = await storage.getDayByNumberAndCategory(dayNum, "gym");
      if (existing) {
        await tgSend(chatId, `\u26A0\uFE0F Gym Day ${dayNum} already exists. Use /update_d${dayNum}_gym to update.`);
        return;
      }
      webhookStates.set(chatId, { action: "save", category: "gym", dayNumber: dayNum });
      await tgSend(chatId, `\u{1F4DD} Send exercises for <b>Gym Day ${dayNum}</b>\n\n<i>One exercise per line</i>`);
      return;
    }

    const updateHomeMatch = text.match(/^\/update_d(\d+)_home/);
    if (updateHomeMatch) {
      const dayNum = parseInt(updateHomeMatch[1]);
      const existing = await storage.getDayByNumberAndCategory(dayNum, "home");
      if (!existing) {
        await tgSend(chatId, `\u274C Home Day ${dayNum} not found.`);
        return;
      }
      await tgSend(chatId, `\u{1F4C5} Current <b>Home Day ${dayNum}</b>:\n${formatDayLog(existing)}\n\n\u{1F504} Want to update?`, {
        reply_markup: { inline_keyboard: [[{ text: "\u2705 Yes", callback_data: `confirm_update_home_${dayNum}` }, { text: "\u274C Cancel", callback_data: "cancel_action" }]] },
      });
      return;
    }

    const updateGymMatch = text.match(/^\/update_d(\d+)_gym/);
    if (updateGymMatch) {
      const dayNum = parseInt(updateGymMatch[1]);
      const existing = await storage.getDayByNumberAndCategory(dayNum, "gym");
      if (!existing) {
        await tgSend(chatId, `\u274C Gym Day ${dayNum} not found.`);
        return;
      }
      await tgSend(chatId, `\u{1F4C5} Current <b>Gym Day ${dayNum}</b>:\n${formatDayLog(existing)}\n\n\u{1F504} Want to update?`, {
        reply_markup: { inline_keyboard: [[{ text: "\u2705 Yes", callback_data: `confirm_update_gym_${dayNum}` }, { text: "\u274C Cancel", callback_data: "cancel_action" }]] },
      });
      return;
    }

    const homeStatusMatch = text.match(/^\/home_status_updated(\d+)/);
    if (homeStatusMatch) {
      const dayNum = parseInt(homeStatusMatch[1]);
      const existing = await storage.getDayByNumberAndCategory(dayNum, "home");
      if (!existing) { await tgSend(chatId, `\u274C Home Day ${dayNum} not found.`); return; }
      await storage.updateDay(existing.id, { status: "Logged" });
      await tgSend(chatId, `\u2705 <b>Home Day ${dayNum}</b> marked as <b>Logged</b>!`);
      return;
    }

    const gymStatusMatch = text.match(/^\/gym_status_updated(\d+)/);
    if (gymStatusMatch) {
      const dayNum = parseInt(gymStatusMatch[1]);
      const existing = await storage.getDayByNumberAndCategory(dayNum, "gym");
      if (!existing) { await tgSend(chatId, `\u274C Gym Day ${dayNum} not found.`); return; }
      await storage.updateDay(existing.id, { status: "Logged" });
      await tgSend(chatId, `\u2705 <b>Gym Day ${dayNum}</b> marked as <b>Logged</b>!`);
      return;
    }

    const viewHomeMatch = text.match(/^\/view_home_d(\d+)/);
    if (viewHomeMatch) {
      const dayNum = parseInt(viewHomeMatch[1]);
      const existing = await storage.getDayByNumberAndCategory(dayNum, "home");
      if (!existing) { await tgSend(chatId, `\u274C Home Day ${dayNum} not found.`); return; }
      await tgSend(chatId, formatDayLog(existing));
      return;
    }

    const viewGymMatch = text.match(/^\/view_gym_d(\d+)/);
    if (viewGymMatch) {
      const dayNum = parseInt(viewGymMatch[1]);
      const existing = await storage.getDayByNumberAndCategory(dayNum, "gym");
      if (!existing) { await tgSend(chatId, `\u274C Gym Day ${dayNum} not found.`); return; }
      await tgSend(chatId, formatDayLog(existing));
      return;
    }

    if (text.startsWith("/export_home_logs")) {
      const days = await storage.getDaysByCategory("home");
      if (days.length === 0) { await tgSend(chatId, "\u{1F4ED} No home logs."); return; }
      let t = `\u{1F3E0} <b>All Home Logs</b>\n\n`;
      for (const d of days) t += formatDayLog(d) + "\n";
      const chunks = splitMessage(t);
      for (const chunk of chunks) await tgSend(chatId, chunk);
      return;
    }

    if (text.startsWith("/export_gym_logs")) {
      const days = await storage.getDaysByCategory("gym");
      if (days.length === 0) { await tgSend(chatId, "\u{1F4ED} No gym logs."); return; }
      let t = `\u{1F3CB}\uFE0F <b>All Gym Logs</b>\n\n`;
      for (const d of days) t += formatDayLog(d) + "\n";
      const chunks = splitMessage(t);
      for (const chunk of chunks) await tgSend(chatId, chunk);
      return;
    }

    const deleteHomeMatch = text.match(/^\/delete_home_d(\d+)/);
    if (deleteHomeMatch) {
      const dayNum = parseInt(deleteHomeMatch[1]);
      const existing = await storage.getDayByNumberAndCategory(dayNum, "home");
      if (!existing) { await tgSend(chatId, `\u274C Home Day ${dayNum} not found.`); return; }
      await tgSend(chatId, `\u26A0\uFE0F Delete <b>Home Day ${dayNum}</b>?`, {
        reply_markup: { inline_keyboard: [[{ text: "\u2705 Yes", callback_data: `delete_confirm_home_${dayNum}` }, { text: "\u274C Cancel", callback_data: "cancel_action" }]] },
      });
      return;
    }

    const deleteGymMatch = text.match(/^\/delete_gym_d(\d+)/);
    if (deleteGymMatch) {
      const dayNum = parseInt(deleteGymMatch[1]);
      const existing = await storage.getDayByNumberAndCategory(dayNum, "gym");
      if (!existing) { await tgSend(chatId, `\u274C Gym Day ${dayNum} not found.`); return; }
      await tgSend(chatId, `\u26A0\uFE0F Delete <b>Gym Day ${dayNum}</b>?`, {
        reply_markup: { inline_keyboard: [[{ text: "\u2705 Yes", callback_data: `delete_confirm_gym_${dayNum}` }, { text: "\u274C Cancel", callback_data: "cancel_action" }]] },
      });
      return;
    }

    if (text.startsWith("/stats")) {
      const homeDays = await storage.getDaysByCategory("home");
      const gymDays = await storage.getDaysByCategory("gym");
      const totalHome = homeDays.length;
      const totalGym = gymDays.length;
      const homeIntensity = homeDays.reduce((sum: number, d: any) => sum + calcIntensity(d.exercises), 0);
      const gymIntensity = gymDays.reduce((sum: number, d: any) => sum + calcIntensity(d.exercises), 0);
      const visitors = await storage.getUniqueVisitorCount();
      const t = `\u{1F4CA} <b>Progress Stats</b>\n\n\u{1F3E0} Home: ${totalHome} days (Total intensity: ${homeIntensity})\n\u{1F3CB}\uFE0F Gym: ${totalGym} days (Total intensity: ${gymIntensity})\n\u{1F465} Unique visitors: ${visitors}`;
      await tgSend(chatId, t);
      return;
    }

    if (text.startsWith("/intensity_home") || text.startsWith("/intensity_gym")) {
      const cat = text.includes("home") ? "home" : "gym";
      const days = await storage.getDaysByCategory(cat);
      if (days.length === 0) { await tgSend(chatId, `\u{1F4ED} No ${cat} data.`); return; }
      const sorted = days.sort((a: any, b: any) => a.dayNumber - b.dayNumber);
      const max = Math.max(...sorted.map((d: any) => calcIntensity(d.exercises)));
      let t = `\u{1F4CA} <b>${cat === "home" ? "Home" : "Gym"} Intensity</b>\n\n`;
      for (const d of sorted) {
        const intensity = calcIntensity(d.exercises);
        const barLen = max > 0 ? Math.round((intensity / max) * 15) : 0;
        t += `D${d.dayNumber} ${"█".repeat(barLen)}${"░".repeat(15 - barLen)} ${intensity}\n`;
      }
      await tgSend(chatId, `<pre>${t}</pre>`);
      return;
    }

    if (text.startsWith("/ai ")) {
      const userMsg = text.replace("/ai ", "").trim();
      await tgAction(chatId, "typing");
      const response = await chatWithGeminiTelegram(userMsg);
      const formatted = formatGeminiResponse(response);
      const chunks = splitMessage(formatted);
      for (const chunk of chunks) await tgSend(chatId, chunk);
      return;
    }

    if (text.startsWith("/clear_memory")) {
      await storage.clearChatMemory();
      await tgSend(chatId, "\u2705 AI conversation memory cleared.");
      return;
    }

    if (text.startsWith("/save_browser_memory")) {
      webhookStates.set(chatId, { action: "browser_memory" });
      await tgSend(chatId, "\u{1F4DD} Send the persistent instructions/memory for the web chat AI.");
      return;
    }

    if (text.startsWith("/dl_backup")) {
      await tgAction(chatId, "typing");
      const data = await storage.exportAllData();
      const backup = { exportedAt: new Date().toISOString(), data };
      const content = JSON.stringify(backup, null, 2);
      await tgSendDocument(chatId, content, `lockin_backup_${new Date().toISOString().split("T")[0]}.json`, "\u{1F4E6} Full data backup");
      return;
    }

    if (text.startsWith("/reminders")) {
      const reminders = await storage.getAllReminders();
      if (reminders.length === 0) {
        await tgSend(chatId, "\u{1F4ED} No pending reminders.");
        return;
      }
      let t = `\u23F0 <b>Pending Reminders (${reminders.length})</b>\n\n`;
      reminders.forEach((r: any, idx: number) => {
        const timeStr = new Date(r.triggerAt).toLocaleString("en-US", { timeZone: "Asia/Manila", hour12: true, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
        const recurLabel = r.isRecurring ? ` \u{1F501} recurring` : "";
        let intervalLabel = "";
        if (r.isRecurring && r.intervalMs) {
          if (r.intervalMs < 60000) intervalLabel = ` (every ${Math.round(r.intervalMs / 1000)}s)`;
          else if (r.intervalMs < 3600000) intervalLabel = ` (every ${Math.round(r.intervalMs / 60000)} min)`;
          else if (r.intervalMs < 86400000) intervalLabel = ` (every ${Math.round(r.intervalMs / 3600000)} hr)`;
          else intervalLabel = ` (every ${Math.round(r.intervalMs / 86400000)} day)`;
        }
        t += `<b>${idx + 1}.</b> ${esc(r.message)}\n   \u{1F552} ${timeStr}${recurLabel}${intervalLabel}\n   <i>ID: #${r.id}</i>\n\n`;
      });
      await tgSend(chatId, t);
      return;
    }

    const createImageMatch = text.match(/^\/create_image\s*(.*)/);
    if (createImageMatch) {
      const prompt = createImageMatch[1]?.trim();
      if (!prompt) {
        await tgSend(chatId, "\u{1F3A8} <b>Image Generator</b>\n\nUsage:\n<code>/create_image [your prompt]</code>");
        return;
      }
      await tgAction(chatId, "upload_photo");
      const result = await generateImageWithGemini(prompt);
      if (!result) { await tgSend(chatId, "\u274C Image generation failed."); return; }
      if (result.text) await tgSend(chatId, formatGeminiResponse(result.text));
      if (result.imageBuffer) await tgSendPhoto(chatId, result.imageBuffer, `\u{1F3A8} Generated: ${prompt}`);
      else await tgSend(chatId, "\u26A0\uFE0F AI responded but didn't generate an image.");
      return;
    }

    if (text.startsWith("/help") || text.startsWith("/commands")) {
      await tgSend(chatId, `\u{1F4CB} <b>Commands</b>\n\n/save_home_dN, /save_gym_dN\n/update_dN_home, /update_dN_gym\n/view_home_dN, /view_gym_dN\n/delete_home_dN, /delete_gym_dN\n/home_status_updatedN, /gym_status_updatedN\n/export_home_logs, /export_gym_logs\n/stats, /intensity_home, /intensity_gym\n/ai [message]\n/clear_memory, /save_browser_memory\n/dl_backup, /reminders\n/create_image [prompt]\n\n<i>Or just type naturally!</i>`);
      return;
    }

    if (text.startsWith("/")) return;

    const state = webhookStates.get(chatId);
    if (!state) {
      await tgAction(chatId, "typing");
      const response = await chatWithGeminiTelegram(text);
      const formatted = formatGeminiResponse(response);
      const chunks = splitMessage(formatted);
      for (const chunk of chunks) await tgSend(chatId, chunk);
      return;
    }

    if (state.action === "browser_memory") {
      await storage.saveBrowserMemory(text);
      await tgSend(chatId, "\u2705 <b>Browser memory saved!</b>");
      webhookStates.delete(chatId);
      return;
    }

    const exercises = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    if (exercises.length === 0) {
      await tgSend(chatId, "\u274C No exercises detected.");
      return;
    }

    try {
      if (state.action === "save") {
        await storage.createDay({ dayNumber: state.dayNumber!, status: "Logged", exercises, category: state.category! });
        await tgSend(chatId, `\u2705 <b>${state.category === "home" ? "Home" : "Gym"} Day ${state.dayNumber}</b> saved! ${exercises.length} exercises.`);
      } else if (state.action === "update") {
        await storage.updateDay(state.dayId!, { exercises, status: "Logged" });
        await tgSend(chatId, `\u2705 <b>${state.category === "home" ? "Home" : "Gym"} Day ${state.dayNumber}</b> updated! ${exercises.length} exercises.`);
      }
    } catch (err: any) {
      await tgSend(chatId, `\u274C Error: ${esc(err.message || "Unknown error")}`);
    }
    webhookStates.delete(chatId);
  } catch (err: any) {
    console.error("Webhook handler error:", err);
  }
}
