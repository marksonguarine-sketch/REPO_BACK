const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NETLIFY_URL = process.argv[2];

if (!TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN environment variable is required");
  process.exit(1);
}

if (!NETLIFY_URL) {
  console.error("Usage: npx tsx script/setup-telegram-webhook.ts https://your-site.netlify.app");
  process.exit(1);
}

const webhookUrl = `${NETLIFY_URL.replace(/\/$/, "")}/webhook/telegram`;

async function setupWebhook() {
  console.log(`Setting webhook to: ${webhookUrl}`);

  const deleteRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`);
  const deleteData = await deleteRes.json();
  console.log("Delete old webhook:", deleteData);

  const setRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message", "callback_query"],
    }),
  });
  const setData = await setRes.json();
  console.log("Set webhook:", setData);

  const infoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
  const infoData = await infoRes.json();
  console.log("Webhook info:", JSON.stringify(infoData, null, 2));
}

setupWebhook().catch(console.error);
