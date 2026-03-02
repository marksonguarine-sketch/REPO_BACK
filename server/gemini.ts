import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { log } from "./index";

const ai = new GoogleGenAI({ apiKey: "AIzaSyDlFlj9C9gzOgwe9Ic-TIieK5I6FHW1Ek8" });

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

const SYSTEM_PROMPT = `You are John's personal AI workout assistant in the "John's Lock-In Logs" app. You have full access to all workout data. Be supportive, motivating, and knowledgeable about fitness. When John logs, edits, or completes a workout day, praise and comment on his progress. Keep responses concise but encouraging. Use bold text (**text**) for emphasis. Format lists cleanly. You know all about John's workout history and can analyze trends, suggest improvements, and celebrate milestones.`;

export async function chatWithGeminiTelegram(userMessage: string): Promise<string> {
  try {
    const logsContext = await getAllLogsContext();
    const memory = await storage.getChatMemory();

    const contents: { role: string; parts: { text: string }[] }[] = [];
    let lastRole = "";

    for (const m of memory) {
      const role = m.role === "user" ? "user" : "model";
      if (role === lastRole && contents.length > 0) {
        contents[contents.length - 1].parts[0].text += "\n" + m.content;
      } else {
        contents.push({
          role,
          parts: [{ text: m.content }],
        });
        lastRole = role;
      }
    }

    if (lastRole === "user" && contents.length > 0) {
      contents[contents.length - 1].parts[0].text += "\n" + userMessage;
    } else {
      contents.push({
        role: "user",
        parts: [{ text: userMessage }],
      });
    }

    await storage.addChatMemory("user", userMessage);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: `${SYSTEM_PROMPT}\n\nCurrent workout data:\n${logsContext}`,
      },
    });

    const responseText = response.text || "I couldn't generate a response.";
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: `${SYSTEM_PROMPT}\n\nYou are chatting with a visitor on John's public workout tracking web app. Be friendly and helpful. Answer questions about John's workout progress, routines, and fitness journey based on the data. Keep responses short and engaging.\n\nCurrent workout data:\n${logsContext}`,
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
      model: "gemini-2.5-flash",
      contents: `John just performed this action: ${action}\nDetails: ${details}\n\nGive a short, motivating comment (2-3 sentences max). Be specific about what he did.`,
      config: {
        systemInstruction: `${SYSTEM_PROMPT}\n\nWorkout data:\n${logsContext}`,
      },
    });

    return response.text || "";
  } catch (err: any) {
    log(`Gemini comment error: ${err.message}`, "gemini");
    return "";
  }
}
