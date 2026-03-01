import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(api.days.list.path, async (req, res) => {
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

  app.post(api.days.create.path, async (req, res) => {
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

  app.put(api.days.update.path, async (req, res) => {
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

  app.delete(api.days.delete.path, async (req, res) => {
    await storage.deleteDay(Number(req.params.id));
    res.status(204).send();
  });

  // Seed data if empty
  const existingDays = await storage.getDays();
  if (existingDays.length === 0) {
    const seedData = [
      {
        dayNumber: 1,
        status: "Logged",
        exercises: ["Diamond push-ups — 1×40", "Squats (25kg) — 1×30", "Dumbbell curls (10 lbs each arm) — 1×100"],
      },
      {
        dayNumber: 2,
        status: "Logged",
        exercises: ["Diamond push-ups — 1×20", "Normal push-ups — 1×20", "Squats (25kg) — 1×35", "Squats (25kg) — 1×30"],
      },
      {
        dayNumber: 3,
        status: "Logged",
        exercises: ["Squats (25kg) — 1×40", "Squats (25kg) — 1×40"],
      },
      {
        dayNumber: 4,
        status: "Logged",
        exercises: ["Back squats (25kg) — 1×70", "Back squats (25kg) — 1×80", "Walking — 1×2h"],
      },
      {
        dayNumber: 5,
        status: "Logged",
        exercises: ["Back squats (25kg) — 1×100", "Back squats (25kg) — 1×60", "Bicep curls (10 lbs each arm) — 2×100", "Bulgarian split squats (10 lbs each hand) — 1×15/leg", "Deep side push-ups — 1×20", "Diamond push-ups — 2×40", "Walking — 1×2h"],
      },
      {
        dayNumber: 6,
        status: "Logged",
        exercises: ["Jogging — 2×5m", "Plank — 1×1:00", "Plank — 1×0:40", "Sit-ups — 1×10", "Back squats (load) — 1×30", "Diamond push-ups — 1×20", "Walking — 1×2h"],
      },
      {
        dayNumber: 7,
        status: "Logged",
        exercises: ["Back squats (load) — 1×110", "Jogging (mouth closed) — 1×5m", "Diamond push-ups — 1×40", "Diamond push-ups — 1×20", "Walking — 1×2h"],
      },
      {
        dayNumber: 8,
        status: "Logged",
        exercises: ["Back squats — 1×120", "One-arm sack-of-rice lifts (25kg) — 1×5 (L)", "One-arm sack-of-rice lifts (25kg) — 1×5 (R)"],
      },
      {
        dayNumber: 9,
        status: "Logged",
        exercises: ["One-arm lifts to waist level (20kg) — 2×20/arm", "Back squats (20kg) — 1×139", "Deep squats — 1×3"],
      },
      {
        dayNumber: 10,
        status: "Logged",
        exercises: ["Rest — 1×day"],
      },
      {
        dayNumber: 11,
        status: "Logged",
        exercises: ["One-hand bent pull (20kg) — 2×30", "Lying sack lift to chest — 1×10", "Hip thrust (20kg) — 1×50", "Chest/lying lift — 1×20", "Hip thrust (20kg) — 1×50"],
      },
      {
        dayNumber: 12,
        status: "Logged",
        exercises: ["Walking — 1×1.5h", "Jog (mouth closed) — 1×7m", "Jog — 1×1m", "Plank — 2×1:00", "Bulgarian split squats (no load) — 1×30/side", "Diamond push-ups — 2×20", "Bulgarian split squats (no load) — 1×10/side", "Diamond push-ups — 1×20", "Diamond push-ups — 1×40", "Diamond push-ups — 1×30"],
      },
      {
        dayNumber: 13,
        status: "Logged",
        exercises: ["Back squats (20kg) — 1×150", "Deep reps — 1×5", "One-arm sack lifts (20kg) — 1×20/arm", "Walking (no load) — 1×1.5h", "Loaded walk (10kg backpack) — 1×1.5h", "Bulgarian squats (with backpack) — 1×40/side", "Diamond push-ups (with backpack) — 1×60", "Plank — 1×1:00"],
      },
      {
        dayNumber: 14,
        status: "Logged",
        exercises: ["Back squats (20kg) — 1×160", "Deep reps — 1×10", "Back squats (20kg) — 1×5", "Super deep reps — 1×15", "Loaded walk — 1×1h10m", "Bulgarian squats (with load) — 2×20", "Diamond push-ups (with load) — 2×20", "Plank — 1×1:00", "One-arm pulls (20kg sack) — 2×20/side"],
      },
      {
        dayNumber: 15,
        status: "Planned",
        exercises: ["Back squats (20kg) — 1×160", "Deep reps — 1×10", "Back squats (20kg) — 1×5", "Super deep reps — 1×15", "Loaded walk — 1×1h10m", "Bulgarian squats (with load) — 2×20", "Diamond push-ups (with load) — 2×20", "Plank — 1×1:00", "One-arm pulls (20kg sack) — 2×20/side"],
      }
    ];
    for (const day of seedData) {
      await storage.createDay(day);
    }
  }

  return httpServer;
}
