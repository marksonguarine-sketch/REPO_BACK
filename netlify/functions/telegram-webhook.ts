import type { Handler, HandlerEvent } from "@netlify/functions";
import { handleTelegramWebhook } from "../../server/telegram";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    await handleTelegramWebhook(body);
    return { statusCode: 200, body: "ok" };
  } catch (err: any) {
    console.error("Telegram webhook error:", err);
    return { statusCode: 200, body: "ok" };
  }
};

export { handler };
