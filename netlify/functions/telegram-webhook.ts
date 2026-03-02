import type { Handler, HandlerEvent } from "@netlify/functions";
import { handleTelegramWebhook } from "../../server/telegram";

function parseEventBody(event: HandlerEvent): any {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(raw || "{}");
}

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "GET") {
    return { statusCode: 200, body: "telegram-webhook-ok" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = parseEventBody(event);
    await handleTelegramWebhook(body);
    return { statusCode: 200, body: "ok" };
  } catch (err: any) {
    console.error("Telegram webhook error:", err);
    return { statusCode: 200, body: "ok" };
  }
};

export { handler };
