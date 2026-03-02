import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { storage } from "../../server/storage";
import { chatWithGeminiWeb } from "../../server/gemini";
import { sendOwnerNotification } from "../../server/telegram";

function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function getPath(event: HandlerEvent): string {
  const path = event.path || "/";
  const prefixes = ["/.netlify/functions/api", "/api"];
  for (const prefix of prefixes) {
    if (path === prefix) return "/";
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  }
  return path;
}

function parseBody(event: HandlerEvent): any {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      },
      body: "",
    };
  }

  const path = getPath(event);
  const method = event.httpMethod;

  try {
    if (path === "/days" && method === "GET") {
      const category = event.queryStringParameters?.category;
      if (category) {
        const days = await storage.getDaysByCategory(category);
        return json(200, days);
      }
      const days = await storage.getDays();
      return json(200, days);
    }

    const dayMatch = path.match(/^\/days\/(\d+)$/);
    if (dayMatch) {
      const id = Number(dayMatch[1]);

      if (method === "GET") {
        const day = await storage.getDay(id);
        if (!day) return json(404, { message: "Day not found" });
        return json(200, day);
      }

      if (method === "PUT") {
        const body = parseBody(event);
        const day = await storage.updateDay(id, body);
        if (!day) return json(404, { message: "Day not found" });
        return json(200, day);
      }

      if (method === "DELETE") {
        const day = await storage.getDay(id);
        if (!day) return json(404, { message: "Day not found" });
        await storage.deleteDay(id);
        return { statusCode: 204, body: "" };
      }
    }

    if (path === "/days" && method === "POST") {
      const body = parseBody(event);
      const day = await storage.createDay(body);
      return json(201, day);
    }

    if (path === "/visitor" && method === "POST") {
      const body = parseBody(event);
      const { fingerprint, referrer } = body;
      if (!fingerprint) return json(400, { message: "fingerprint required" });

      const ip = event.headers["x-forwarded-for"] || event.headers["client-ip"] || "";
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

      try { await sendOwnerNotification(notification); } catch {}
      return json(200, { ok: true });
    }

    if (path === "/chat" && method === "POST") {
      const body = parseBody(event);
      const { message, history } = body;
      if (!message) return json(400, { message: "message required" });
      const response = await chatWithGeminiWeb(message, history || []);

      const visitorMsg = `\u{1F4AC} <b>Web Chat Message</b>
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u{1F464} Visitor: ${message.substring(0, 500)}
\u{1F916} AI: ${response.substring(0, 500)}`;
      try { await sendOwnerNotification(visitorMsg); } catch {}

      return json(200, { response });
    }

    if (path === "/supplements" && method === "GET") {
      const supplements = await storage.getSupplements();
      return json(200, supplements);
    }

    if (path === "/health" && method === "GET") {
      return json(200, { status: "ok" });
    }

    return json(404, { message: "Not found" });
  } catch (err: any) {
    console.error("API error:", err);
    return json(500, { message: err.message || "Internal Server Error" });
  }
};

export { handler };
