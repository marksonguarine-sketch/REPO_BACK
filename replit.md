# John's Lock-In Logs

## Overview
Workout logging application for tracking home and gym workouts (D1-D15+). Features a Telegram bot with AI assistant (Gemini function calling) for managing logs via natural language, a read-only web dashboard with floating AI chat (persistent browser memory), visitor tracking with Telegram notifications, backup/restore system, and reminder system. All data stored in Railway MongoDB.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Framer Motion (static build for Netlify CDN)
- **Backend**: Express.js (Replit) / Netlify Functions (Netlify) + MongoDB (Railway)
- **Bot**: node-telegram-bot-api (Replit: polling) / Telegram Webhook (Netlify: serverless)
- **AI**: Google Gemini API (gemini-2.5-flash) with function calling + Google Search grounding
- **Image Gen**: gemini-2.0-flash-exp with responseModalities for image generation
- **Database**: Railway MongoDB (connection in `server/railway_db.ts`)

## Key Features
- **Home/Gym toggle** - Switch between workout categories
- **Intensity bar graph** - Visual daily intensity, scrollable (no number labels)
- **Daily intake section** - Supplement info (home view only)
- **Telegram bot** - 22+ commands for CRUD + status + AI chat + browser memory + backup + reminders
- **Gemini AI (Telegram)** - Function calling with 18 declared functions for natural language workout management, persistent chat memory, image analysis, web search
- **Gemini AI (Web)** - Conversational AI with session history + persistent browser memory + Google Search grounding
- **Web chat widget** - Enhanced floating chat with glassmorphic UI, quick prompts, message counter, scroll indicator, animated transitions
- **Chat popup** - "Try my web chat AI!" cursive handwritten popup with arrow, auto-dismiss on click or 5min
- **Visitor tracking** - Fingerprint-based unique visitor detection, geo-location, referrer detection
- **TG notifications** - New visitor alerts + web chat message forwarding to owner
- **Web is read-only** - All editing done via Telegram bot (or Gemini natural language in TG)
- **Write endpoints protected** - POST/PUT/DELETE require x-bot-secret header
- **Backup/Restore** - `/dl_backup` exports all data as JSON, upload .json to restore
- **Reminder system** - AI-driven reminders via natural language, 3-second polling, precise Unix timestamps, recurring support, numbered list display, edit/delete by number, atomic deduplication
- **Image analysis** - Send photos to TG bot for Gemini AI analysis
- **Image generation** - `/create_image [prompt]` using `gemini-2.0-flash-exp` model with responseModalities, supports reference images via photo caption

## Database (MongoDB - Railway)
Collections: `days`, `visitors`, `chat_memory`, `browser_memory`, `reminders`, `backup_logs`, `counters`
- `days`: id, dayNumber, status, exercises (string array), category (home/gym)
- `visitors`: id, fingerprint, referrer, country, city, isUnique, visitedAt
- `chat_memory`: id, role, content, createdAt (TG bot conversation history)
- `browser_memory`: content, updatedAt (persistent web chat context, single-doc upsert)
- `reminders`: id, message, triggerAt, sent, createdAt
- `backup_logs`: action, timestamp, details
- `counters`: auto-increment sequence tracking per collection

## File Structure
- `shared/schema.ts` - Drizzle schema (kept for Zod validation schemas)
- `shared/routes.ts` - API contract with Zod
- `server/railway_db.ts` - MongoDB connection (Railway)
- `server/mongo-storage.ts` - MongoStorage class (all CRUD + reminders + backup + export/import)
- `server/storage.ts` - IStorage interface + exports mongoStorage
- `server/migrate-to-mongo.ts` - One-time PostgreSQL → MongoDB migration
- `server/routes.ts` - Express routes + seed data + chat/visitor API
- `server/telegram.ts` - Telegram bot with all commands + AI + backup/restore + image support + reminders
- `server/gemini.ts` - Gemini AI service (TG: function calling + memory + image, Web: browser memory + search)
- `client/src/pages/Home.tsx` - Main page
- `client/src/components/IntensityGraph.tsx` - Bar graph
- `client/src/components/DailyIntake.tsx` - Supplements
- `client/src/components/DayCard.tsx` - Day card (read-only)
- `client/src/components/ChatWidget.tsx` - Floating AI chat
- `client/src/hooks/use-visitor.ts` - Visitor fingerprint tracking
- `client/src/hooks/use-days.ts` - Day data fetching (10s auto-refresh)

## Environment Variables
- DATABASE_URL - PostgreSQL connection (legacy, kept for migration)
- TELEGRAM_BOT_TOKEN - Telegram bot token
- SESSION_SECRET - Express session secret (also used as bot API secret)
- GEMINI_API_KEY - Google Gemini API key (hardcoded in gemini.ts)
- OWNER_ID hardcoded as 7474049767 in telegram.ts

## Telegram Bot Commands
/start, /help, /commands, /save_home_d[N], /save_gym_d[N], /update_d[N]_home, /update_d[N]_gym, /home_status_updated[N], /gym_status_updated[N], /view_home_d[N], /view_gym_d[N], /export_home_logs, /export_gym_logs, /delete_home_d[N], /delete_gym_d[N], /stats, /intensity_home, /intensity_gym, /ai [message], /clear_memory, /save_browser_memory, /dl_backup, /reminders
+ Photo upload (AI analysis), JSON file upload (backup restore)

## Gemini Function Calling (Telegram)
19 functions: save_workout, update_workout, delete_workout, view_workout, view_all_workouts, mark_status_done, get_stats, get_intensity, export_logs, save_browser_memory, view_browser_memory, delete_browser_memory, clear_ai_memory, set_reminder, list_reminders, delete_reminder, update_reminder, create_backup, get_last_backup_info

## API Endpoints
- GET /api/days?category=home|gym - List workout days
- GET /api/days/:id - Get specific day
- POST /api/days - Create day (protected)
- PUT /api/days/:id - Update day (protected)
- DELETE /api/days/:id - Delete day (protected)
- POST /api/visitor - Track visitor (fingerprint, referrer)
- POST /api/chat - Web AI chat (message, history)
- GET /health - Healthcheck endpoint

## Caching
- API responses: no-cache, no-store, must-revalidate headers
- HTML: no-cache headers
- Static assets: 1h maxAge

## Netlify Deployment
The app is fully Netlify-compatible with serverless functions.

### Files
- `netlify.toml` - Build config, redirects, function settings
- `netlify/functions/api.ts` - All API routes as a single serverless function
- `netlify/functions/telegram-webhook.ts` - Telegram webhook handler (replaces polling)
- `netlify/functions/check-reminders.ts` - Reminder checker (call via cron/external scheduler)
- `script/build-netlify.ts` - Frontend build script for Netlify
- `script/setup-telegram-webhook.ts` - Register webhook with Telegram after deploy
- `server/log.ts` - Standalone log utility (no circular deps for serverless)

### Netlify Environment Variables (set in Netlify dashboard)
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `SESSION_SECRET` - Bot API secret for write endpoints
- `GEMINI_API_KEY` - Google Gemini API key (also hardcoded in gemini.ts)
- `MONGODB_URI` - Railway MongoDB connection string (hardcoded in railway_db.ts)

### Setup Steps
1. Connect GitHub repo to Netlify
2. Set environment variables in Netlify dashboard
3. Deploy (build command: `npx tsx script/build-netlify.ts`)
4. After deploy, run: `npx tsx script/setup-telegram-webhook.ts https://your-site.netlify.app`
5. Set up a cron job (e.g., cron-job.org) to call `https://your-site.netlify.app/cron/check-reminders` every minute for reminders

### Key Differences from Replit
- No long-running process — all serverless
- Telegram uses webhook instead of polling (no conflict issues)
- Reminders checked via external cron, not setInterval
- Frontend served by Netlify CDN (fast)
- API routes redirected: `/api/*` → `/.netlify/functions/api/*`
- `sendOwnerNotification` uses direct HTTP API when no bot instance available

### Reminder Architecture (Serverless)
- `claimDueReminders()` uses atomic `findOneAndUpdate` in a loop — impossible to send duplicates
- Each invocation claims and sends in one shot, then reschedules recurring ones
- Cron frequency determines minimum reminder precision (1-min cron = ~1 min precision)

## Design
- Dark glassmorphic: --bg:#0b0f17, --accent:#7c5cff, --accent2:#38bdf8
- Glass panels with backdrop-blur, purple/cyan gradient accents
