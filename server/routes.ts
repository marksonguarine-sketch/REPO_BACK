import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { startTelegramBot, sendOwnerNotification } from "./telegram";
import { chatWithGeminiWeb } from "./gemini";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(api.days.list.path, async (req, res) => {
    const category = req.query.category as string | undefined;
    if (category) {
      const days = await storage.getDaysByCategory(category);
      return res.json(days);
    }
    const days = await storage.getDays();
    res.json(days);
  });

  app.get(api.days.get.path, async (req, res) => {
    const day = await storage.getDay(Number(req.params.id));
    if (!day) {
      return res.status(404).json({ message: 'Day not found' });
    }
    res.json(day);
  });

  const requireBotSecret = (req: any, res: any, next: any) => {
    const secret = req.headers["x-bot-secret"];
    if (secret !== process.env.SESSION_SECRET) {
      return res.status(403).json({ message: "Forbidden: use Telegram bot to manage logs" });
    }
    next();
  };

  app.post(api.days.create.path, requireBotSecret, async (req, res) => {
    try {
      const input = api.days.create.input.parse(req.body);
      const day = await storage.createDay(input);
      res.status(201).json(day);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.days.update.path, requireBotSecret, async (req, res) => {
    try {
      const input = api.days.update.input.parse(req.body);
      const day = await storage.updateDay(Number(req.params.id), input);
      if (!day) {
        return res.status(404).json({ message: 'Day not found' });
      }
      res.json(day);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.days.delete.path, requireBotSecret, async (req, res) => {
    const day = await storage.getDay(Number(req.params.id));
    if (!day) {
      return res.status(404).json({ message: 'Day not found' });
    }
    await storage.deleteDay(Number(req.params.id));
    res.status(204).send();
  });

  const existingHome = await storage.getDaysByCategory("home");
  if (existingHome.length === 0) {
    const homeSeed = [
      { dayNumber: 1, status: "Logged", category: "home", exercises: ["Diamond push-ups \u2014 1\u00D740", "Squats (25kg) \u2014 1\u00D730", "Dumbbell curls (10 lbs each arm) \u2014 1\u00D7100"] },
      { dayNumber: 2, status: "Logged", category: "home", exercises: ["Diamond push-ups \u2014 1\u00D720", "Normal push-ups \u2014 1\u00D720", "Squats (25kg) \u2014 1\u00D735", "Squats (25kg) \u2014 1\u00D730"] },
      { dayNumber: 3, status: "Logged", category: "home", exercises: ["Squats (25kg) \u2014 1\u00D740", "Squats (25kg) \u2014 1\u00D740"] },
      { dayNumber: 4, status: "Logged", category: "home", exercises: ["Back squats (25kg) \u2014 1\u00D770", "Back squats (25kg) \u2014 1\u00D780", "Walking \u2014 1\u00D72h"] },
      { dayNumber: 5, status: "Logged", category: "home", exercises: ["Back squats (25kg) \u2014 1\u00D7100", "Back squats (25kg) \u2014 1\u00D760", "Bicep curls (10 lbs each arm) \u2014 2\u00D7100", "Bulgarian split squats (10 lbs each hand) \u2014 1\u00D715/leg", "Deep side push-ups \u2014 1\u00D720", "Diamond push-ups \u2014 2\u00D740", "Walking \u2014 1\u00D72h"] },
      { dayNumber: 6, status: "Logged", category: "home", exercises: ["Jogging \u2014 2\u00D75m", "Plank \u2014 1\u00D71:00", "Plank \u2014 1\u00D70:40", "Sit-ups \u2014 1\u00D710", "Back squats (load) \u2014 1\u00D730", "Diamond push-ups \u2014 1\u00D720", "Walking \u2014 1\u00D72h"] },
      { dayNumber: 7, status: "Logged", category: "home", exercises: ["Back squats (load) \u2014 1\u00D7110", "Jogging (mouth closed) \u2014 1\u00D75m", "Diamond push-ups \u2014 1\u00D740", "Diamond push-ups \u2014 1\u00D720", "Walking \u2014 1\u00D72h"] },
      { dayNumber: 8, status: "Logged", category: "home", exercises: ["Back squats \u2014 1\u00D7120", "One-arm sack-of-rice lifts (25kg) \u2014 1\u00D75 (L)", "One-arm sack-of-rice lifts (25kg) \u2014 1\u00D75 (R)"] },
      { dayNumber: 9, status: "Logged", category: "home", exercises: ["One-arm lifts to waist level (20kg) \u2014 2\u00D720/arm", "Back squats (20kg) \u2014 1\u00D7139", "Deep squats \u2014 1\u00D73"] },
      { dayNumber: 10, status: "Logged", category: "home", exercises: ["Rest \u2014 1\u00D7day"] },
      { dayNumber: 11, status: "Logged", category: "home", exercises: ["One-hand bent pull (20kg) \u2014 2\u00D730", "Lying sack lift to chest \u2014 1\u00D710", "Hip thrust (20kg) \u2014 1\u00D750", "Chest/lying lift \u2014 1\u00D720", "Hip thrust (20kg) \u2014 1\u00D750"] },
      { dayNumber: 12, status: "Logged", category: "home", exercises: ["Walking \u2014 1\u00D71.5h", "Jog (mouth closed) \u2014 1\u00D77m", "Jog \u2014 1\u00D71m", "Plank \u2014 2\u00D71:00", "Bulgarian split squats (no load) \u2014 1\u00D730/side", "Diamond push-ups \u2014 2\u00D720", "Bulgarian split squats (no load) \u2014 1\u00D710/side", "Diamond push-ups \u2014 1\u00D720", "Diamond push-ups \u2014 1\u00D740", "Diamond push-ups \u2014 1\u00D730"] },
      { dayNumber: 13, status: "Logged", category: "home", exercises: ["Back squats (20kg) \u2014 1\u00D7150", "Deep reps \u2014 1\u00D75", "One-arm sack lifts (20kg) \u2014 1\u00D720/arm", "Walking (no load) \u2014 1\u00D71.5h", "Loaded walk (10kg backpack) \u2014 1\u00D71.5h", "Bulgarian squats (with backpack) \u2014 1\u00D740/side", "Diamond push-ups (with backpack) \u2014 1\u00D760", "Plank \u2014 1\u00D71:00"] },
      { dayNumber: 14, status: "Logged", category: "home", exercises: ["Back squats (20kg) \u2014 1\u00D7160", "Deep reps \u2014 1\u00D710", "Back squats (20kg) \u2014 1\u00D75", "Super deep reps \u2014 1\u00D715", "Loaded walk \u2014 1\u00D71h10m", "Bulgarian squats (with load) \u2014 2\u00D720", "Diamond push-ups (with load) \u2014 2\u00D720", "Plank \u2014 1\u00D71:00", "One-arm pulls (20kg sack) \u2014 2\u00D720/side"] },
      { dayNumber: 15, status: "Logged", category: "home", exercises: ["Back squats (20kg) \u2014 1\u00D7160", "Deep reps \u2014 1\u00D710", "Back squats (20kg) \u2014 1\u00D75", "Super deep reps \u2014 1\u00D715", "Loaded walk \u2014 1\u00D71h10m", "Bulgarian squats (with load) \u2014 2\u00D720", "Diamond push-ups (with load) \u2014 2\u00D720", "Plank \u2014 1\u00D71:00", "One-arm pulls (20kg sack) \u2014 2\u00D720/side"] },
    ];
    for (const day of homeSeed) {
      await storage.createDay(day);
    }
  }

  const existingGym = await storage.getDaysByCategory("gym");
  if (existingGym.length === 0) {
    const gymSeed = [
      { dayNumber: 1, status: "Logged", category: "gym", exercises: ["Back Squat: 25kg (55 lb) \u2014 3\u00D710", "Leg Press: 80kg (176 lb) \u2014 3\u00D712", "Leg Extension: 25kg (55 lb) \u2014 3\u00D715", "Diamond Push-ups \u2014 2\u00D715", "Walk: 30 min"] },
      { dayNumber: 2, status: "Logged", category: "gym", exercises: ["Back Squat: 30kg (66 lb) \u2014 4\u00D710", "Romanian Deadlift: 30kg (66 lb) \u2014 3\u00D712", "Walking Lunges (DB): 10kg each (22 lb each) \u2014 3\u00D712/leg", "Plank \u2014 2\u00D745 sec", "Walk: 45 min"] },
      { dayNumber: 3, status: "Logged", category: "gym", exercises: ["Back Squat: 35kg (77 lb) \u2014 4\u00D710", "Leg Press: 100kg (220 lb) \u2014 4\u00D712", "Seated Leg Curl: 25kg (55 lb) \u2014 3\u00D715", "Calf Raises: 60kg (132 lb) \u2014 4\u00D715", "Walk: 45 min"] },
      { dayNumber: 4, status: "Logged", category: "gym", exercises: ["Back Squat: 40kg (88 lb) \u2014 5\u00D78", "Bulgarian Split Squat (DB): 12.5kg each (28 lb each) \u2014 3\u00D710/leg", "Leg Extension: 30kg (66 lb) \u2014 4\u00D712", "Diamond Push-ups \u2014 3\u00D715", "Walk: 60 min"] },
      { dayNumber: 5, status: "Logged", category: "gym", exercises: ["Back Squat: 45kg (99 lb) \u2014 5\u00D78", "Romanian Deadlift: 45kg (99 lb) \u2014 4\u00D710", "Leg Press: 120kg (265 lb) \u2014 4\u00D712", "Cable Crunch \u2014 3\u00D715", "Walk: 60 min"] },
      { dayNumber: 6, status: "Logged", category: "gym", exercises: ["Back Squat: 50kg (110 lb) \u2014 4\u00D76", "Lat Pulldown: 40kg (88 lb) \u2014 4\u00D710", "Seated Row: 40kg (88 lb) \u2014 3\u00D710", "Incline DB Press: 12.5kg each (28 lb each) \u2014 3\u00D710", "Jog: 8 min"] },
      { dayNumber: 7, status: "Logged", category: "gym", exercises: ["Back Squat: 60kg (132 lb) \u2014 5\u00D76", "Leg Press: 140kg (309 lb) \u2014 4\u00D710", "Leg Extension: 35kg (77 lb) \u2014 4\u00D712", "Calf Raises: 80kg (176 lb) \u2014 4\u00D712", "Walk: 90 min"] },
      { dayNumber: 8, status: "Logged", category: "gym", exercises: ["Back Squat: 70kg (154 lb) \u2014 5\u00D75", "Romanian Deadlift: 60kg (132 lb) \u2014 4\u00D78", "Walking Lunges (DB): 15kg each (33 lb each) \u2014 3\u00D710/leg", "Plank \u2014 2\u00D760 sec", "Walk: 60 min"] },
      { dayNumber: 9, status: "Logged", category: "gym", exercises: ["Back Squat: 75kg (165 lb) \u2014 6\u00D74", "Leg Press: 160kg (353 lb) \u2014 4\u00D710", "Seated Leg Curl: 35kg (77 lb) \u2014 3\u00D712", "Cable Lateral Raise: 7.5kg (17 lb) \u2014 3\u00D715/side", "Walk: 60 min"] },
      { dayNumber: 10, status: "Logged", category: "gym", exercises: ["Back Squat: 80kg (176 lb) \u2014 3\u00D75 (lighter day)", "Bench Press: 50kg (110 lb) \u2014 4\u00D78", "Triceps Pushdown: 25kg (55 lb) \u2014 3\u00D712", "DB Curls: 12.5kg each (28 lb each) \u2014 3\u00D712", "Walk: 45 min"] },
      { dayNumber: 11, status: "Logged", category: "gym", exercises: ["Back Squat: 85kg (187 lb) \u2014 5\u00D74", "Romanian Deadlift: 70kg (154 lb) \u2014 4\u00D76", "Bulgarian Split Squat (DB): 17.5kg each (39 lb each) \u2014 3\u00D78/leg", "Hanging Knee Raises \u2014 3\u00D712", "Walk: 60 min"] },
      { dayNumber: 12, status: "Logged", category: "gym", exercises: ["Back Squat: 90kg (198 lb) \u2014 5\u00D73", "Leg Press: 180kg (397 lb) \u2014 4\u00D78", "Leg Extension: 40kg (88 lb) \u2014 4\u00D710", "Calf Raises: 100kg (220 lb) \u2014 4\u00D712", "Jog: 7 min"] },
      { dayNumber: 13, status: "Logged", category: "gym", exercises: ["Back Squat: 95kg (209 lb) \u2014 6\u00D73", "Seated Row: 50kg (110 lb) \u2014 4\u00D78", "Incline DB Press: 17.5kg each (39 lb each) \u2014 4\u00D78", "Face Pulls: 20kg (44 lb) \u2014 3\u00D715", "Walk: 90 min"] },
      { dayNumber: 14, status: "Logged", category: "gym", exercises: ["Back Squat: 100kg (220 lb) \u2014 5\u00D72 + 1\u00D7AMRAP (6 reps)", "Romanian Deadlift: 80kg (176 lb) \u2014 4\u00D75", "Walking Lunges (DB): 20kg each (44 lb each) \u2014 3\u00D78/leg", "Plank \u2014 2\u00D760 sec", "Walk: 120 min"] },
      { dayNumber: 15, status: "Logged", category: "gym", exercises: ["Back Squat: 110kg (243 lb) \u2014 1\u00D75 (PR set) + 3\u00D73 back-off at 95kg (209 lb)", "Leg Press: 200kg (441 lb) \u2014 4\u00D78", "Bulgarian Split Squat (DB): 22.5kg each (50 lb each) \u2014 3\u00D78/leg", "Diamond Push-ups \u2014 3\u00D715", "Loaded Walk: 60\u201390 min"] },
    ];
    for (const day of gymSeed) {
      await storage.createDay(day);
    }
  }

  app.post("/api/visitor", async (req, res) => {
    try {
      const { fingerprint, referrer } = req.body;
      if (!fingerprint) return res.status(400).json({ message: "fingerprint required" });

      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
      const ipStr = Array.isArray(ip) ? ip[0] : ip;

      let country = "Unknown";
      let city = "Unknown";
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ipStr.split(",")[0].trim()}?fields=country,city`);
        if (geoRes.ok) {
          const geoData = await geoRes.json() as any;
          if (geoData.country) country = geoData.country;
          if (geoData.city) city = geoData.city;
        }
      } catch {}

      const ref = referrer || "direct";
      const result = await storage.addVisitor(fingerprint, ref, country, city);

      let vendorName = "Direct Link";
      const refLower = ref.toLowerCase();
      if (refLower.includes("facebook") || refLower.includes("fb.")) vendorName = "Facebook";
      else if (refLower.includes("instagram")) vendorName = "Instagram";
      else if (refLower.includes("twitter") || refLower.includes("x.com")) vendorName = "Twitter/X";
      else if (refLower.includes("tiktok")) vendorName = "TikTok";
      else if (refLower.includes("google")) vendorName = "Google";
      else if (refLower.includes("youtube")) vendorName = "YouTube";
      else if (ref && ref !== "direct" && ref !== "") {
        try { vendorName = new URL(ref).hostname; } catch { vendorName = ref.substring(0, 50); }
      }

      const now = new Date();
      const timeStr = now.toLocaleString("en-US", { timeZone: "Asia/Manila", hour12: true, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });

      const notification = `\u{1F4F2} <b>New Visitor Alert!</b>
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u{1F310} Vendor: <b>${vendorName}</b>
\u{1F195} Unique?: <b>${result.isNew ? "Yes" : "No"}</b>
\u{1F4CD} Location: ${city}, ${country}
\u{1F552} Time: ${timeStr}
\u{1F465} Total unique visitors: <b>${result.totalUnique}</b>`;

      sendOwnerNotification(notification);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history } = req.body;
      if (!message) return res.status(400).json({ message: "message required" });
      const response = await chatWithGeminiWeb(message, history || []);

      const visitorMsg = `\u{1F4AC} <b>Web Chat Message</b>
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u{1F464} Visitor: ${message.substring(0, 500)}
\u{1F916} AI: ${response.substring(0, 500)}`;
      sendOwnerNotification(visitorMsg);

      res.json({ response });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  startTelegramBot();

  return httpServer;
}
