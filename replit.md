# Ebona Lock-In Logs

## Overview
Workout logging application for tracking home and gym workouts (D1-D15+). Features a Telegram bot for managing logs and a read-only web dashboard.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Framer Motion
- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **Bot**: node-telegram-bot-api (polling mode)

## Key Features
- **Home/Gym toggle** - Switch between workout categories
- **Intensity bar graph** - Visual daily intensity, scrollable
- **Daily intake section** - Supplement info (home view only)
- **Telegram bot** - 16 commands for CRUD operations
- **Web is read-only** - All editing done via Telegram

## Database Schema
- `days` table: id, day_number, status, exercises (text array), category (home/gym)

## File Structure
- `shared/schema.ts` - Drizzle schema + types
- `shared/routes.ts` - API contract with Zod
- `server/routes.ts` - Express routes + seed data
- `server/storage.ts` - Database storage layer
- `server/telegram.ts` - Telegram bot with all commands
- `client/src/pages/Home.tsx` - Main page
- `client/src/components/IntensityGraph.tsx` - Bar graph
- `client/src/components/DailyIntake.tsx` - Supplements
- `client/src/components/DayCard.tsx` - Day card (read-only)

## Environment Variables
- DATABASE_URL - PostgreSQL connection
- TELEGRAM_BOT_TOKEN - Telegram bot token
- TELEGRAM_OWNER_ID - Allowed Telegram user ID
- SESSION_SECRET - Express session secret

## Telegram Bot Commands
/start, /help, /commands, /save_home_d[N], /save_gym_d[N], /update_d[N]_home, /update_d[N]_gym, /view_home_d[N], /view_gym_d[N], /export_home_logs, /export_gym_logs, /delete_home_d[N], /delete_gym_d[N], /stats, /intensity_home, /intensity_gym
