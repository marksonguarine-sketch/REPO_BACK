import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from "./storage";
import { log } from "./index";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function getAllLogsContext(): Promise<string> {
  const homeDays = await storage.getDaysByCategory("home");
  const gymDays = await storage.getDaysByCategory("gym");
  const sortedHome = homeDays.sort((a, b) => a.dayNumber - b.dayNumber);
  const sortedGym = gymDays.sort((a, b) => a.dayNumber - b.dayNumber);

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

const SYSTEM_PROMPT = `You are John's personal AI workout assistant in the "John's Lock-In Logs" app. You have full access to all workout data. Be supportive, motivating, and knowledgeable about fitness. When John logs, edits, or completes a workout day, praise and comment on his progress. Keep responses concise but encouraging. Use bold text for emphasis. Format lists cleanly. You know all about John's workout history and can analyze trends, suggest improvements, and celebrate milestones.`;

export async function chatWithGeminiTelegram(userMessage: string): Promise<string> {
  try {
    const logsContext = await getAllLogsContext();
    const memory = await storage.getChatMemory();

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const historyParts: { role: string; parts: { text: string }[] }[] = [];

    for (const m of memory) {
      historyParts.push({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      });
    }

    const chat = model.startChat({
      history: historyParts,
      systemInstruction: `${SYSTEM_PROMPT}\n\nCurrent workout data:\n${logsContext}`,
    });

    await storage.addChatMemory("user", userMessage);
    const result = await chat.sendMessage(userMessage);
    const response = result.response.text();
    await storage.addChatMemory("model", response);

    return response;
  } catch (err: any) {
    log(`Gemini TG error: ${err.message}`, "gemini");
    return "Sorry, I couldn't process that right now. Try again in a moment.";
  }
}

export async function chatWithGeminiWeb(userMessage: string, sessionHistory: { role: string; content: string }[]): Promise<string> {
  try {
    const logsContext = await getAllLogsContext();

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const historyParts: { role: string; parts: { text: string }[] }[] = [];
    for (const m of sessionHistory) {
      historyParts.push({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      });
    }

    const chat = model.startChat({
      history: historyParts,
      systemInstruction: `${SYSTEM_PROMPT}\n\nYou are chatting with a visitor on John's public workout tracking web app. Be friendly and helpful. Answer questions about John's workout progress, routines, and fitness journey based on the data. Keep responses short and engaging.\n\nCurrent workout data:\n${logsContext}`,
    });

    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch (err: any) {
    log(`Gemini web error: ${err.message}`, "gemini");
    return "Sorry, I couldn't process that right now. Try again!";
  }
}

export async function getGeminiComment(action: string, details: string): Promise<string> {
  try {
    const logsContext = await getAllLogsContext();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `${SYSTEM_PROMPT}\n\nWorkout data:\n${logsContext}\n\nJohn just performed this action: ${action}\nDetails: ${details}\n\nGive a short, motivating comment (2-3 sentences max). Be specific about what he did.`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err: any) {
    log(`Gemini comment error: ${err.message}`, "gemini");
    return "";
  }
}
