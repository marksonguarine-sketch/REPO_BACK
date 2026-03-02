import { GoogleGenAI, Type } from "@google/genai";
import { storage } from "./storage";
import { log } from "./index";

const ai = new GoogleGenAI({ apiKey: "AIzaSyDlFlj9C9gzOgwe9Ic-TIieK5I6FHW1Ek8" });

const GEMINI_MODEL = "gemini-2.5-flash";

async function getAllLogsContext(): Promise<string> {
  const homeDays = await storage.getDaysByCategory("home");
  const gymDays = await storage.getDaysByCategory("gym");
  const sortedHome = homeDays.sort((a: any, b: any) => a.dayNumber - b.dayNumber);
  const sortedGym = gymDays.sort((a: any, b: any) => a.dayNumber - b.dayNumber);

  let context = "=== JOHN'S WORKOUT LOGS ===\n\n";
  context += "--- HOME WORKOUTS ---\n";
  for (const d of sortedHome) {
    context += `Day ${d.dayNumber} [${d.status}]: ${d.exercises.join(", ")}\n`;
  }
  context += "\n--- GYM WORKOUTS ---\n";
  for (const d of sortedGym) {
    context += `Day ${d.dayNumber} [${d.status}]: ${d.exercises.join(", ")}\n`;
  }
  return context;
}

function getCurrentPHTime(): string {
  return new Date().toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function getCurrentPHTimestamp(): number {
  return Date.now();
}

function getSystemPrompt(): string {
  return `You are John's personal AI workout assistant in the "John's Lock-In Logs" app. You have full access to all workout data and can execute commands to manage workouts.

IMPORTANT RULES:
- You can save, update, delete, and manage workouts using the available functions
- When John wants to save or update a workout, ask him for the exercises if he hasn't provided them yet
- When John provides exercises, parse each line as a separate exercise entry
- Be supportive, motivating, and knowledgeable about fitness
- Keep responses concise but encouraging
- Use bold text (**text**) for emphasis
- After executing any action, confirm what you did and add a short motivating comment
- You can also manage browser memory (persistent instructions for the web chat AI)
- For status updates, "Logged" means the workout is done/completed
- When deleting, always confirm before executing unless John is explicit
- You can set reminders for John (birthdays, tasks, hydration, etc.)
- You can create and restore backups of all data
- When analyzing images, describe what you see and provide fitness-related feedback if relevant

CURRENT DATE AND TIME (Philippines timezone): ${getCurrentPHTime()}
CURRENT UNIX TIMESTAMP (milliseconds): ${getCurrentPHTimestamp()}

REMINDER RULES:
- When setting reminders, you MUST calculate the exact trigger_at_ms (Unix timestamp in milliseconds) for when the reminder should fire
- Use the CURRENT UNIX TIMESTAMP above as your reference point
- For "remind me in X seconds": trigger_at_ms = current_timestamp + (X * 1000)
- For "remind me in X minutes": trigger_at_ms = current_timestamp + (X * 60 * 1000)
- For "remind me in X hours": trigger_at_ms = current_timestamp + (X * 3600 * 1000)
- For "remind me in X days": trigger_at_ms = current_timestamp + (X * 86400 * 1000)
- For "remind me at 8 PM": calculate the ms timestamp for the next occurrence of 8 PM Philippine time
- For recurring reminders like "remind me every day at 8 PM", set is_recurring to true with interval_ms = 86400000 (24h in ms)
- Be PRECISE with timing — no approximations`;
}

const functionDeclarations = [
  {
    name: "save_workout",
    description: "Save a new workout day. Use when John wants to log/save a new workout day.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: "Workout category: 'home' or 'gym'" },
        day_number: { type: Type.INTEGER, description: "The day number (e.g. 16)" },
        exercises: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of exercises, each as a string like 'Diamond push-ups — 3×20'" },
      },
      required: ["category", "day_number", "exercises"],
    },
  },
  {
    name: "update_workout",
    description: "Update exercises for an existing workout day.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: "Workout category: 'home' or 'gym'" },
        day_number: { type: Type.INTEGER, description: "The day number" },
        exercises: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Updated list of exercises" },
      },
      required: ["category", "day_number", "exercises"],
    },
  },
  {
    name: "mark_status_done",
    description: "Mark a workout day as done/completed (status = 'Logged').",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: "Workout category: 'home' or 'gym'" },
        day_number: { type: Type.INTEGER, description: "The day number" },
      },
      required: ["category", "day_number"],
    },
  },
  {
    name: "delete_workout",
    description: "Delete a workout day entirely.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: "Workout category: 'home' or 'gym'" },
        day_number: { type: Type.INTEGER, description: "The day number" },
      },
      required: ["category", "day_number"],
    },
  },
  {
    name: "view_workout",
    description: "View a specific workout day's details.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: "Workout category: 'home' or 'gym'" },
        day_number: { type: Type.INTEGER, description: "The day number" },
      },
      required: ["category", "day_number"],
    },
  },
  {
    name: "view_all_workouts",
    description: "View all workout days for a category.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: "Workout category: 'home' or 'gym'" },
      },
      required: ["category"],
    },
  },
  {
    name: "get_stats",
    description: "Get overall workout progress statistics.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_intensity",
    description: "Get intensity chart data for a category.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: "Workout category: 'home' or 'gym'" },
      },
      required: ["category"],
    },
  },
  {
    name: "export_logs",
    description: "Export all workout logs for a category.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: "Workout category: 'home' or 'gym'" },
      },
      required: ["category"],
    },
  },
  {
    name: "save_browser_memory",
    description: "Save or update persistent memory/instructions for the web chat AI.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING, description: "The memory content/instructions to save" },
      },
      required: ["content"],
    },
  },
  {
    name: "view_browser_memory",
    description: "View the current browser/web chat memory.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "delete_browser_memory",
    description: "Delete the browser/web chat memory.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "clear_ai_memory",
    description: "Clear the Telegram AI conversation memory/history.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "set_reminder",
    description: "Set a reminder for John. He will receive a Telegram message at the specified time. You MUST calculate the exact trigger_at_ms Unix timestamp in milliseconds using the current timestamp provided in the system prompt.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        message: { type: Type.STRING, description: "The reminder message" },
        trigger_at_ms: { type: Type.NUMBER, description: "Exact Unix timestamp in milliseconds when the reminder should trigger. Calculate from the current timestamp in the system prompt." },
        is_recurring: { type: Type.BOOLEAN, description: "Whether this is a recurring reminder (e.g. 'every day at 8 PM'). Default false." },
        interval_ms: { type: Type.NUMBER, description: "For recurring reminders, the interval in milliseconds between each occurrence (e.g. 86400000 for daily). Only used if is_recurring is true." },
      },
      required: ["message", "trigger_at_ms"],
    },
  },
  {
    name: "list_reminders",
    description: "List all pending (unsent) reminders.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "delete_reminder",
    description: "Delete a specific reminder by ID.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reminder_id: { type: Type.INTEGER, description: "The reminder ID to delete" },
      },
      required: ["reminder_id"],
    },
  },
  {
    name: "create_backup",
    description: "Create a full backup of all data (workout logs, chat history, reminders, etc.) and return it as JSON.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_last_backup_info",
    description: "Get info about the last backup or restore operation.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

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

async function executeFunction(name: string, args: any): Promise<string> {
  try {
    switch (name) {
      case "save_workout": {
        const { category, day_number, exercises } = args;
        const existing = await storage.getDayByNumberAndCategory(day_number, category);
        if (existing) {
          return JSON.stringify({ error: `${category} Day ${day_number} already exists. Use update_workout to modify it.` });
        }
        const day = await storage.createDay({ dayNumber: day_number, status: "Logged", exercises, category });
        return JSON.stringify({ success: true, message: `${category} Day ${day_number} saved with ${exercises.length} exercises.`, day });
      }

      case "update_workout": {
        const { category, day_number, exercises } = args;
        const existing = await storage.getDayByNumberAndCategory(day_number, category);
        if (!existing) {
          return JSON.stringify({ error: `${category} Day ${day_number} not found. Use save_workout to create it.` });
        }
        const updated = await storage.updateDay(existing.id, { exercises, status: "Logged" });
        return JSON.stringify({ success: true, message: `${category} Day ${day_number} updated with ${exercises.length} exercises.`, day: updated });
      }

      case "mark_status_done": {
        const { category, day_number } = args;
        const existing = await storage.getDayByNumberAndCategory(day_number, category);
        if (!existing) {
          return JSON.stringify({ error: `${category} Day ${day_number} not found.` });
        }
        if (existing.status === "Logged") {
          return JSON.stringify({ success: true, message: `${category} Day ${day_number} is already marked as done/Logged.` });
        }
        await storage.updateDay(existing.id, { status: "Logged" });
        return JSON.stringify({ success: true, message: `${category} Day ${day_number} marked as Logged (done).` });
      }

      case "delete_workout": {
        const { category, day_number } = args;
        const existing = await storage.getDayByNumberAndCategory(day_number, category);
        if (!existing) {
          return JSON.stringify({ error: `${category} Day ${day_number} not found.` });
        }
        await storage.deleteDay(existing.id);
        return JSON.stringify({ success: true, message: `${category} Day ${day_number} deleted.` });
      }

      case "view_workout": {
        const { category, day_number } = args;
        const day = await storage.getDayByNumberAndCategory(day_number, category);
        if (!day) {
          return JSON.stringify({ error: `${category} Day ${day_number} not found.` });
        }
        return JSON.stringify({ success: true, day, intensity: calcIntensity(day.exercises) });
      }

      case "view_all_workouts": {
        const { category } = args;
        const allDays = await storage.getDaysByCategory(category);
        const sorted = allDays.sort((a: any, b: any) => a.dayNumber - b.dayNumber);
        return JSON.stringify({ success: true, category, total: sorted.length, days: sorted.map((d: any) => ({ dayNumber: d.dayNumber, status: d.status, exercises: d.exercises, intensity: calcIntensity(d.exercises) })) });
      }

      case "get_stats": {
        const homeDays = await storage.getDaysByCategory("home");
        const gymDays = await storage.getDaysByCategory("gym");
        const homeLogged = homeDays.filter((d: any) => d.status === "Logged").length;
        const gymLogged = gymDays.filter((d: any) => d.status === "Logged").length;
        const homeIntensity = homeDays.reduce((sum: number, d: any) => sum + calcIntensity(d.exercises), 0);
        const gymIntensity = gymDays.reduce((sum: number, d: any) => sum + calcIntensity(d.exercises), 0);
        const totalExercises = [...homeDays, ...gymDays].reduce((sum: number, d: any) => sum + d.exercises.length, 0);
        return JSON.stringify({
          success: true,
          home: { totalDays: homeDays.length, logged: homeLogged, totalIntensity: homeIntensity },
          gym: { totalDays: gymDays.length, logged: gymLogged, totalIntensity: gymIntensity },
          overall: { totalDays: homeDays.length + gymDays.length, totalExercises, combinedIntensity: homeIntensity + gymIntensity },
        });
      }

      case "get_intensity": {
        const { category } = args;
        const allDays = await storage.getDaysByCategory(category);
        const sorted = allDays.sort((a: any, b: any) => a.dayNumber - b.dayNumber);
        const data = sorted.map((d: any) => ({ dayNumber: d.dayNumber, intensity: calcIntensity(d.exercises) }));
        return JSON.stringify({ success: true, category, data });
      }

      case "export_logs": {
        const { category } = args;
        const allDays = await storage.getDaysByCategory(category);
        const sorted = allDays.sort((a: any, b: any) => a.dayNumber - b.dayNumber);
        return JSON.stringify({ success: true, category, total: sorted.length, days: sorted });
      }

      case "save_browser_memory": {
        const { content } = args;
        await storage.saveBrowserMemory(content);
        return JSON.stringify({ success: true, message: "Browser memory saved." });
      }

      case "view_browser_memory": {
        const memory = await storage.getBrowserMemory();
        return JSON.stringify({ success: true, memory: memory || "No browser memory set." });
      }

      case "delete_browser_memory": {
        await storage.deleteBrowserMemory();
        return JSON.stringify({ success: true, message: "Browser memory deleted." });
      }

      case "clear_ai_memory": {
        await storage.clearChatMemory();
        return JSON.stringify({ success: true, message: "Telegram AI conversation memory cleared." });
      }

      case "set_reminder": {
        const { message, trigger_at_ms, is_recurring, interval_ms } = args;
        const triggerAt = new Date(trigger_at_ms);
        const reminder = await storage.addReminder(message, triggerAt, is_recurring || false, interval_ms || 0);
        const timeStr = triggerAt.toLocaleString("en-US", { timeZone: "Asia/Manila", hour12: true, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
        const nowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila", hour12: true, hour: "numeric", minute: "2-digit", second: "2-digit" });
        return JSON.stringify({ success: true, message: `Reminder set: "${message}" — triggers at ${timeStr} (current time: ${nowStr})`, reminder, is_recurring: is_recurring || false });
      }

      case "list_reminders": {
        const reminders = await storage.getAllReminders();
        return JSON.stringify({ success: true, reminders: reminders.map((r: any) => ({ id: r.id, message: r.message, triggerAt: r.triggerAt })) });
      }

      case "delete_reminder": {
        const { reminder_id } = args;
        await storage.deleteReminder(reminder_id);
        return JSON.stringify({ success: true, message: `Reminder ${reminder_id} deleted.` });
      }

      case "create_backup": {
        const data = await storage.exportAllData();
        await storage.logBackup("download", `Full backup exported with ${JSON.stringify(data).length} bytes`);
        return JSON.stringify({ success: true, message: "Backup created. Sending as file...", data });
      }

      case "get_last_backup_info": {
        const lastBackup = await storage.getLastBackupLog();
        if (!lastBackup) {
          return JSON.stringify({ success: true, message: "No backup/restore operations recorded yet." });
        }
        return JSON.stringify({ success: true, lastBackup });
      }

      default:
        return JSON.stringify({ error: `Unknown function: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message || "Function execution failed" });
  }
}

export async function chatWithGeminiTelegram(userMessage: string, imageParts?: any[]): Promise<string> {
  try {
    const logsContext = await getAllLogsContext();
    const memory = await storage.getChatMemory();

    const contents: any[] = [];
    let lastRole = "";

    for (const m of memory) {
      const role = m.role === "user" ? "user" : "model";
      if (role === lastRole && contents.length > 0) {
        contents[contents.length - 1].parts[0].text += "\n" + m.content;
      } else {
        contents.push({ role, parts: [{ text: m.content }] });
        lastRole = role;
      }
    }

    const userParts: any[] = [{ text: userMessage }];
    if (imageParts && imageParts.length > 0) {
      userParts.push(...imageParts);
    }

    if (lastRole === "user" && contents.length > 0) {
      contents[contents.length - 1].parts.push(...userParts);
    } else {
      contents.push({ role: "user", parts: userParts });
    }

    await storage.addChatMemory("user", userMessage);

    let response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: `${getSystemPrompt()}\n\nCurrent workout data:\n${logsContext}`,
        tools: [{ functionDeclarations }],
      },
    });

    let maxIterations = 5;
    while (maxIterations > 0) {
      maxIterations--;
      const candidate = response.candidates?.[0];
      if (!candidate) break;

      const parts = candidate.content?.parts || [];
      const functionCallPart = parts.find((p: any) => p.functionCall);

      if (!functionCallPart || !functionCallPart.functionCall) break;

      const { name, args } = functionCallPart.functionCall;
      log(`Gemini function call: ${name}(${JSON.stringify(args)})`, "gemini");

      const result = await executeFunction(name, args || {});
      log(`Function result: ${result.substring(0, 200)}`, "gemini");

      contents.push({ role: "model", parts: [{ functionCall: { name, args: args || {} } }] });
      contents.push({ role: "user", parts: [{ functionResponse: { name, response: JSON.parse(result) } }] });

      response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: `${getSystemPrompt()}\n\nCurrent workout data:\n${await getAllLogsContext()}`,
          tools: [{ functionDeclarations }],
        },
      });
    }

    const responseText = response.text || "Done!";
    await storage.addChatMemory("model", responseText);

    return responseText;
  } catch (err: any) {
    log(`Gemini TG error: ${err.message}`, "gemini");
    return "Sorry, I couldn't process that right now. Try again in a moment.";
  }
}

export async function chatWithGeminiWeb(userMessage: string, sessionHistory: { role: string; content: string }[]): Promise<string> {
  try {
    const logsContext = await getAllLogsContext();
    const browserMem = await storage.getBrowserMemory();

    const contents: { role: string; parts: { text: string }[] }[] = [];
    for (const m of sessionHistory) {
      contents.push({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    let memoryContext = "";
    if (browserMem) {
      memoryContext = `\n\nIMPORTANT PERSISTENT INSTRUCTIONS FROM JOHN (always follow these):\n${browserMem}\n`;
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: `You are John's personal AI workout assistant in the "John's Lock-In Logs" app. You are chatting with a visitor on John's public workout tracking web app. Be friendly and helpful. Answer questions about John's workout progress, routines, and fitness journey based on the data. Keep responses short and engaging.${memoryContext}\n\nCurrent workout data:\n${logsContext}`,
        tools: [{ googleSearch: {} }],
      },
    });

    return response.text || "I couldn't generate a response.";
  } catch (err: any) {
    log(`Gemini web error: ${err.message}`, "gemini");
    return "Sorry, I couldn't process that right now. Try again!";
  }
}

export async function getGeminiComment(action: string, details: string): Promise<string> {
  try {
    const logsContext = await getAllLogsContext();

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `John just performed this action: ${action}\nDetails: ${details}\n\nGive a short, motivating comment (2-3 sentences max). Be specific about what he did.`,
      config: {
        systemInstruction: `You are John's personal AI workout assistant. Be supportive and motivating. Keep it brief.\n\nWorkout data:\n${logsContext}`,
      },
    });

    return response.text || "";
  } catch (err: any) {
    log(`Gemini comment error: ${err.message}`, "gemini");
    return "";
  }
}

export async function analyzeImageWithGemini(imageBuffer: Buffer, mimeType: string, prompt: string): Promise<string> {
  try {
    const base64 = imageBuffer.toString("base64");

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{
        role: "user",
        parts: [
          { text: prompt || "What do you see in this image? If it's fitness-related, provide relevant analysis." },
          { inlineData: { mimeType, data: base64 } },
        ],
      }],
      config: {
        systemInstruction: "You are John's personal AI workout assistant. Analyze images and provide helpful, fitness-focused commentary when relevant.",
      },
    });

    return response.text || "I couldn't analyze the image.";
  } catch (err: any) {
    log(`Gemini image error: ${err.message}`, "gemini");
    return "Sorry, I couldn't analyze that image right now.";
  }
}
