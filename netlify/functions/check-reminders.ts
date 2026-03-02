import type { Handler } from "@netlify/functions";
import { storage } from "../../server/storage";
import { config } from "../../server/config";

const OWNER_ID = config.telegramOwnerId;

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: OWNER_ID,
      text,
      parse_mode: "HTML",
    }),
  });
}

const handler: Handler = async () => {
  try {
    const claimed = await storage.claimDueReminders();
    for (const reminder of claimed) {
      const triggerStr = new Date(reminder.triggerAt).toLocaleString("en-US", { timeZone: "Asia/Manila", hour12: true, hour: "numeric", minute: "2-digit", second: "2-digit" });
      const nowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila", hour12: true, hour: "numeric", minute: "2-digit", second: "2-digit" });
      let msg = `\u23F0 <b>Reminder!</b>\n\n${esc(reminder.message)}\n\n<i>Scheduled: ${triggerStr} | Delivered: ${nowStr}</i>`;
      if (reminder.isRecurring) {
        msg += `\n\u{1F501} <i>Recurring \u2014 next one in ${Math.round(reminder.intervalMs / 60000)} min</i>`;
      }
      await sendTelegramMessage(msg);
      console.log(`Reminder sent: ${reminder.message}`);

      if (reminder.isRecurring && reminder.intervalMs > 0) {
        const nextTrigger = new Date(new Date(reminder.triggerAt).getTime() + reminder.intervalMs);
        await storage.rescheduleRecurringReminder(reminder.id, nextTrigger);
        console.log(`Recurring reminder rescheduled: ${reminder.message} -> ${nextTrigger.toISOString()}`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ checked: true, sent: claimed.length }),
    };
  } catch (err: any) {
    console.error("Reminder check error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

export { handler };
