# John's Lock-In Logs

## Overview
Workout logging application for tracking home and gym workouts (D1-D15+). Features a Telegram bot with AI assistant (Gemini function calling) for managing logs via natural language, a read-only web dashboard with floating AI chat (persistent browser memory), and visitor tracking with Telegram notifications.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Framer Motion
- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **Bot**: node-telegram-bot-api (polling mode, HTML parse mode)
- **AI**: Google Gemini API (gemini-2.5-flash) with function calling

## Key Features
- **Home/Gym toggle** - Switch between workout categories
- **Intensity bar graph** - Visual daily intensity, scrollable (no number labels)
- **Daily intake section** - Supplement info (home view only)
- **Telegram bot** - 20 commands for CRUD + status + AI chat + browser memory
- **Gemini AI (Telegram)** - Function calling with 13 declared functions for natural language workout management, persistent chat memory
- **Gemini AI (Web)** - Conversational AI with session history + persistent browser memory from DB
- **Web chat widget** - Floating chat bubble with AI assistant for visitors
- **Visitor tracking** - Fingerprint-based unique visitor detection, geo-location, referrer detection
- **TG notifications** - New visitor alerts + web chat message forwarding to owner
- **Web is read-only** - All editing done via Telegram bot (or Gemini natural language in TG)
- **Write endpoints protected** - POST/PUT/DELETE require x-bot-secret header

## Database Schema
- `days` table: id, day_number, status, exercises (text array), category (home/gym)
- `visitors` table: id, fingerprint, referrer, country, city, is_unique, visited_at
- `chat_memory` table: id, role, content, created_at (TG bot conversation history)
- `browser_memory` table: id, content, updated_at (persistent web chat context, single-row upsert)

## File Structure
- `shared/schema.ts` - Drizzle schema + types
- `shared/routes.ts` - API contract with Zod
- `server/routes.ts` - Express routes + seed data + chat/visitor API
- `server/storage.ts` - Database storage layer (IStorage interface)
- `server/telegram.ts` - Telegram bot with all commands + AI + userStates
- `server/gemini.ts` - Gemini AI service (TG: function calling + memory, Web: browser memory from DB)
- `client/src/pages/Home.tsx` - Main page
- `client/src/components/IntensityGraph.tsx` - Bar graph
- `client/src/components/DailyIntake.tsx` - Supplements
- `client/src/components/DayCard.tsx` - Day card (read-only)
- `client/src/components/ChatWidget.tsx` - Floating AI chat
- `client/src/hooks/use-visitor.ts` - Visitor fingerprint tracking
- `client/src/hooks/use-days.ts` - Day data fetching (10s auto-refresh)

## Environment Variables
- DATABASE_URL - PostgreSQL connection
- TELEGRAM_BOT_TOKEN - Telegram bot token
- TELEGRAM_OWNER_ID - Allowed Telegram user ID (7474049767)
- SESSION_SECRET - Express session secret (also used as bot API secret)
- GEMINI_API_KEY - Google Gemini API key (hardcoded in gemini.ts)

## Telegram Bot Commands
/start, /help, /commands, /save_home_d[N], /save_gym_d[N], /update_d[N]_home, /update_d[N]_gym, /home_status_updated[N], /gym_status_updated[N], /view_home_d[N], /view_gym_d[N], /export_home_logs, /export_gym_logs, /delete_home_d[N], /delete_gym_d[N], /stats, /intensity_home, /intensity_gym, /ai [message], /clear_memory, /save_browser_memory

## Gemini Function Calling (Telegram)
13 functions: save_workout, update_workout, delete_workout, view_workout, view_all_workouts, mark_status_done, get_stats, get_intensity, export_logs, save_browser_memory, view_browser_memory, delete_browser_memory, get_workout_by_day

## API Endpoints
- GET /api/days?category=home|gym - List workout days
- GET /api/days/:id - Get specific day
- POST /api/days - Create day (protected)
- PUT /api/days/:id - Update day (protected)
- DELETE /api/days/:id - Delete day (protected)
- POST /api/visitor - Track visitor (fingerprint, referrer)
- POST /api/chat - Web AI chat (message, history)
## Design
- Dark glassmorphic: --bg:#0b0f17, --accent:#7c5cff, --accent2:#38bdf8
- Glass panels with backdrop-blur, purple/cyan gradient accents
