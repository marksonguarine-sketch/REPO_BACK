import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";
import { log } from "./index";

const OWNER_ID = parseInt(process.env.TELEGRAM_OWNER_ID || "0", 10);

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

function calcIntensity(exercises: string[]): number {
  let score = 0;
  for (const ex of exercises) {
    const lower = ex.toLowerCase();
    if (lower.includes("rest")) continue;
    const setsReps = ex.match(/(\d+)\s*[x×]\s*(\d+)/i);
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
  let text = `\u{1F4C5} *Day ${day.dayNumber}* ${statusIcon} _${day.status}_\n`;
  text += `\u{1F4CA} Intensity: ${intensity}\n`;
  text += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
  day.exercises.forEach(ex => {
    text += `  \u2022 ${ex}\n`;
  });
  return text;
}

export function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    log("TELEGRAM_BOT_TOKEN not set, skipping bot startup", "telegram");
    return;
  }

  const bot = new TelegramBot(token, { polling: true });
  log("Telegram bot started with polling", "telegram");

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) {
      return bot.sendMessage(chatId, "\u26D4 Access denied. This bot is private.");
    }
    const welcomeText = `\u{1F3CB}\u{FE0F} *Welcome to Ebona Lock-In Bot!*\n\nYour personal workout log manager.\nUse /help to see all available commands.\n\n\u{1F4AA} Keep grinding!`;
    await bot.sendMessage(chatId, welcomeText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "\u{1F3E0} Home Logs", callback_data: "view_home" },
            { text: "\u{1F3CB}\u{FE0F} Gym Logs", callback_data: "view_gym" },
          ],
          [
            { text: "\u{1F4CB} Commands", callback_data: "show_help" },
          ],
        ],
      },
    });
  });

  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const helpText = `\u{1F4D6} *Ebona Lock-In Bot \u2014 Command Guide*

\u{1F527} *CORE COMMANDS*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/start \u2014 Welcome screen with quick actions
/help \u2014 This detailed command guide
/commands \u2014 Quick command list

\u{1F4DD} *LOG MANAGEMENT*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/save\\_home\\_d\\[N\\] \u2014 Save a new home workout for day N
  _Example: /save\\_home\\_d16_
/save\\_gym\\_d\\[N\\] \u2014 Save a new gym workout for day N
  _Example: /save\\_gym\\_d16_
/update\\_d\\[N\\]\\_home \u2014 Update existing home workout day N
  _Example: /update\\_d15\\_home_
/update\\_d\\[N\\]\\_gym \u2014 Update existing gym workout day N
  _Example: /update\\_d15\\_gym_

\u{1F4CA} *VIEW & EXPORT*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/view\\_home\\_d\\[N\\] \u2014 View specific home day
/view\\_gym\\_d\\[N\\] \u2014 View specific gym day
/export\\_home\\_logs \u2014 Export all home logs (ready to copy)
/export\\_gym\\_logs \u2014 Export all gym logs (ready to copy)

\u{1F5D1}\u{FE0F} *DELETE*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/delete\\_home\\_d\\[N\\] \u2014 Delete home day N
/delete\\_gym\\_d\\[N\\] \u2014 Delete gym day N

\u{1F4CA} *STATS*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/stats \u2014 View progress summary across both workouts
/intensity\\_home \u2014 See intensity chart for home workouts
/intensity\\_gym \u2014 See intensity chart for gym workouts

\u{1F4A1} *HOW TO LOG EXERCISES*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
When prompted, type each exercise on a new line:
\`\`\`
Back squats (30kg) \u2014 1\u00D7200
Diamond push-ups \u2014 2\u00D720
Plank \u2014 1\u00D71:00
\`\`\`

\u{1F4AA} Keep pushing, Ebona!`;

    await bot.sendMessage(chatId, helpText, { parse_mode: "Markdown" });
  });

  bot.onText(/\/commands/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const commandsList = `\u{1F4CB} *All Commands*

/start
/help
/commands
/save\\_home\\_d\\[N\\]
/save\\_gym\\_d\\[N\\]
/update\\_d\\[N\\]\\_home
/update\\_d\\[N\\]\\_gym
/view\\_home\\_d\\[N\\]
/view\\_gym\\_d\\[N\\]
/export\\_home\\_logs
/export\\_gym\\_logs
/delete\\_home\\_d\\[N\\]
/delete\\_gym\\_d\\[N\\]
/stats
/intensity\\_home
/intensity\\_gym

_Use /help for detailed explanations._`;
    await bot.sendMessage(chatId, commandsList, { parse_mode: "Markdown" });
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
    await bot.sendMessage(chatId, `\u{1F4DD} Please type your exercises for *Home Day ${dayNum}*:\n_(One per line)_`, { parse_mode: "Markdown" });
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
    await bot.sendMessage(chatId, `\u{1F4DD} Please type your exercises for *Gym Day ${dayNum}*:\n_(One per line)_`, { parse_mode: "Markdown" });
  });

  // UPDATE commands
  bot.onText(/\/update_d(\d+)_home/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const dayNum = parseInt(match![1]);
    const existing = await storage.getDayByNumberAndCategory(dayNum, "home");
    if (!existing) {
      await bot.sendMessage(chatId, `\u274C Home Day ${dayNum} not found. Use /save\\_home\\_d${dayNum} to create it.`, { parse_mode: "Markdown" });
      return;
    }
    userStates.set(chatId, { action: "update", category: "home", dayNumber: dayNum, dayId: existing.id });
    await bot.sendMessage(chatId, `\u{1F4DD} Please enter the updated exercises for *Home Day ${dayNum}*:\n_(One per line)_`, { parse_mode: "Markdown" });
  });

  bot.onText(/\/update_d(\d+)_gym/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const dayNum = parseInt(match![1]);
    const existing = await storage.getDayByNumberAndCategory(dayNum, "gym");
    if (!existing) {
      await bot.sendMessage(chatId, `\u274C Gym Day ${dayNum} not found. Use /save\\_gym\\_d${dayNum} to create it.`, { parse_mode: "Markdown" });
      return;
    }
    userStates.set(chatId, { action: "update", category: "gym", dayNumber: dayNum, dayId: existing.id });
    await bot.sendMessage(chatId, `\u{1F4DD} Please enter the updated exercises for *Gym Day ${dayNum}*:\n_(One per line)_`, { parse_mode: "Markdown" });
  });

  // VIEW commands
  bot.onText(/\/view_home_d(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const dayNum = parseInt(match![1]);
    const day = await storage.getDayByNumberAndCategory(dayNum, "home");
    if (!day) {
      return bot.sendMessage(chatId, `\u274C Home Day ${dayNum} not found.`);
    }
    await bot.sendMessage(chatId, `\u{1F3E0} *HOME WORKOUT*\n\n${formatDayLog(day)}`, { parse_mode: "Markdown" });
  });

  bot.onText(/\/view_gym_d(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const dayNum = parseInt(match![1]);
    const day = await storage.getDayByNumberAndCategory(dayNum, "gym");
    if (!day) {
      return bot.sendMessage(chatId, `\u274C Gym Day ${dayNum} not found.`);
    }
    await bot.sendMessage(chatId, `\u{1F3CB}\u{FE0F} *GYM WORKOUT*\n\n${formatDayLog(day)}`, { parse_mode: "Markdown" });
  });

  // EXPORT commands
  bot.onText(/\/export_home_logs/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const days = await storage.getDaysByCategory("home");
    const sorted = days.sort((a, b) => a.dayNumber - b.dayNumber);
    if (sorted.length === 0) {
      return bot.sendMessage(chatId, "\u274C No home logs found.");
    }
    let text = `\u{1F3E0} *HOME WORKOUT LOGS*\n(D1\u2013D${sorted[sorted.length - 1].dayNumber})\n\n`;
    sorted.forEach(day => {
      text += formatDayLog(day) + "\n";
    });
    if (text.length > 4000) {
      const chunks = [];
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
      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk, { parse_mode: "Markdown" });
      }
    } else {
      await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
    }
  });

  bot.onText(/\/export_gym_logs/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const days = await storage.getDaysByCategory("gym");
    const sorted = days.sort((a, b) => a.dayNumber - b.dayNumber);
    if (sorted.length === 0) {
      return bot.sendMessage(chatId, "\u274C No gym logs found.");
    }
    let text = `\u{1F3CB}\u{FE0F} *GYM WORKOUT LOGS*\n(D1\u2013D${sorted[sorted.length - 1].dayNumber})\n\n`;
    sorted.forEach(day => {
      text += formatDayLog(day) + "\n";
    });
    if (text.length > 4000) {
      const chunks = [];
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
      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk, { parse_mode: "Markdown" });
      }
    } else {
      await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
    }
  });

  // DELETE commands
  bot.onText(/\/delete_home_d(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const dayNum = parseInt(match![1]);
    const day = await storage.getDayByNumberAndCategory(dayNum, "home");
    if (!day) {
      return bot.sendMessage(chatId, `\u274C Home Day ${dayNum} not found.`);
    }
    await bot.sendMessage(chatId, `\u26A0\uFE0F Are you sure you want to delete *Home Day ${dayNum}*?`, {
      parse_mode: "Markdown",
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
    if (!day) {
      return bot.sendMessage(chatId, `\u274C Gym Day ${dayNum} not found.`);
    }
    await bot.sendMessage(chatId, `\u26A0\uFE0F Are you sure you want to delete *Gym Day ${dayNum}*?`, {
      parse_mode: "Markdown",
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

    const statsText = `\u{1F4CA} *YOUR PROGRESS STATS*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

\u{1F3E0} *Home Workouts*
  Days logged: ${homeLogged}/${homeDays.length}
  Total intensity: ${homeIntensity}

\u{1F3CB}\u{FE0F} *Gym Workouts*
  Days logged: ${gymLogged}/${gymDays.length}
  Total intensity: ${gymIntensity}

\u{1F4AA} *Overall*
  Total days: ${homeDays.length + gymDays.length}
  Total exercises: ${totalExercises}
  Combined intensity: ${homeIntensity + gymIntensity}

Keep going, Ebona! \u{1F525}`;

    await bot.sendMessage(chatId, statsText, { parse_mode: "Markdown" });
  });

  // INTENSITY commands
  bot.onText(/\/intensity_home/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const days = await storage.getDaysByCategory("home");
    const sorted = days.sort((a, b) => a.dayNumber - b.dayNumber);
    if (sorted.length === 0) return bot.sendMessage(chatId, "\u274C No home logs found.");
    let text = "\u{1F3E0} *Home Workout Intensity*\n\n";
    const maxIntensity = Math.max(...sorted.map(d => calcIntensity(d.exercises)));
    sorted.forEach(d => {
      const intensity = calcIntensity(d.exercises);
      const barLen = Math.max(1, Math.round((intensity / maxIntensity) * 15));
      const bar = "\u2588".repeat(barLen) + "\u2591".repeat(15 - barLen);
      text += `D${String(d.dayNumber).padStart(2, " ")} ${bar} ${intensity}\n`;
    });
    await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  });

  bot.onText(/\/intensity_gym/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    const days = await storage.getDaysByCategory("gym");
    const sorted = days.sort((a, b) => a.dayNumber - b.dayNumber);
    if (sorted.length === 0) return bot.sendMessage(chatId, "\u274C No gym logs found.");
    let text = "\u{1F3CB}\u{FE0F} *Gym Workout Intensity*\n\n";
    const maxIntensity = Math.max(...sorted.map(d => calcIntensity(d.exercises)));
    sorted.forEach(d => {
      const intensity = calcIntensity(d.exercises);
      const barLen = Math.max(1, Math.round((intensity / maxIntensity) * 15));
      const bar = "\u2588".repeat(barLen) + "\u2591".repeat(15 - barLen);
      text += `D${String(d.dayNumber).padStart(2, " ")} ${bar} ${intensity}\n`;
    });
    await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  });

  // CALLBACK QUERIES (inline button clicks)
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
      const days = await storage.getDaysByCategory("home");
      const sorted = days.sort((a, b) => a.dayNumber - b.dayNumber).slice(0, 5);
      let text = "\u{1F3E0} *Recent Home Workouts*\n\n";
      sorted.forEach(d => { text += formatDayLog(d) + "\n"; });
      text += "\n_Use /export\\_home\\_logs for full export_";
      await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
      return;
    }

    if (data === "view_gym") {
      await bot.answerCallbackQuery(query.id);
      const days = await storage.getDaysByCategory("gym");
      const sorted = days.sort((a, b) => a.dayNumber - b.dayNumber).slice(0, 5);
      let text = "\u{1F3CB}\u{FE0F} *Recent Gym Workouts*\n\n";
      sorted.forEach(d => { text += formatDayLog(d) + "\n"; });
      text += "\n_Use /export\\_gym\\_logs for full export_";
      await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
      return;
    }

    if (data === "show_help") {
      await bot.answerCallbackQuery(query.id);
      bot.emit("text", { ...query.message!, text: "/help", chat: query.message!.chat } as any);
      return;
    }

    // confirm_update_home_N or confirm_update_gym_N
    const confirmUpdate = data.match(/^confirm_update_(home|gym)_(\d+)$/);
    if (confirmUpdate) {
      await bot.answerCallbackQuery(query.id);
      const category = confirmUpdate[1];
      const dayNum = parseInt(confirmUpdate[2]);
      const existing = await storage.getDayByNumberAndCategory(dayNum, category);
      if (existing) {
        userStates.set(chatId, { action: "update", category, dayNumber: dayNum, dayId: existing.id });
        await bot.sendMessage(chatId, `\u{1F4DD} Please enter the updated exercises for *${category === "home" ? "Home" : "Gym"} Day ${dayNum}*:\n_(One per line)_`, { parse_mode: "Markdown" });
      }
      return;
    }

    // delete_confirm_ID
    const deleteConfirm = data.match(/^delete_confirm_(\d+)$/);
    if (deleteConfirm) {
      await bot.answerCallbackQuery(query.id);
      const dayId = parseInt(deleteConfirm[1]);
      try {
        await storage.deleteDay(dayId);
        await bot.sendMessage(chatId, "\u2705 Day deleted successfully!");
      } catch {
        await bot.sendMessage(chatId, "\u274C Failed to delete day.");
      }
      return;
    }

    await bot.answerCallbackQuery(query.id);
  });

  // MESSAGE handler for free-text input (save/update exercise data)
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return;
    if (!msg.text || msg.text.startsWith("/")) return;

    const state = userStates.get(chatId);
    if (!state) return;

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
        await bot.sendMessage(chatId, `\u2705 *${state.category === "home" ? "Home" : "Gym"} Day ${state.dayNumber}* saved successfully!\n\n${exercises.length} exercises logged.`, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "\u{1F4CB} View it", callback_data: `view_${state.category}` },
              ],
            ],
          },
        });
      } else if (state.action === "update") {
        await storage.updateDay(state.dayId!, {
          exercises,
          status: "Logged",
        });
        await bot.sendMessage(chatId, `\u2705 *${state.category === "home" ? "Home" : "Gym"} Day ${state.dayNumber}* updated successfully!\n\n${exercises.length} exercises logged.`, {
          parse_mode: "Markdown",
        });
      }
    } catch (err: any) {
      await bot.sendMessage(chatId, `\u274C Error: ${err.message || "Unknown error"}`);
    }

    userStates.delete(chatId);
  });

  return bot;
}
