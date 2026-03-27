# Cool Workout Bot

An open-source Telegram bot for tracking gym workouts. Log your sets, track weight progression, and view stats — all from Telegram.

**Try it:** [@coolworkoutbot](https://t.me/coolworkoutbot)

## Features

- **Custom workout templates** — create your own workout types (Push, Pull, Leg Day, etc.) with custom exercises
- **Set logging** — log sets one by one as `8x60` (reps x weight in kg), or just reps for bodyweight exercises
- **Per-exercise progression charts** — see your max weight over time for any exercise
- **Workout history** — view detailed logs of past sessions
- **Multi-language** — English and French
- **Multi-user** — each user has their own templates, settings, and workout data
- **Admin dashboard** — PIN-protected web UI to view all users and database state

## How It Works

1. Start the bot on Telegram
2. Choose your language
3. Use default workouts (Push/Pull) or create your own
4. Tap **New Workout** → pick a type → tap an exercise → type your sets
5. Check **Stats** for progression charts and history

## Tech Stack

- **Next.js** (App Router) — API routes + admin dashboard
- **Upstash Redis** — workout data, user templates, settings
- **Telegram Bot API** — webhook at `/api/telegram`, inline keyboards
- **QuickChart.io** — server-side chart rendering for progression graphs
- **Vercel** — deployment

## Self-Hosting

1. Clone the repo
2. Create a Telegram bot via [@BotFather](https://t.me/botfather)
3. Create an [Upstash Redis](https://upstash.com) database
4. Deploy to Vercel and set these env vars:
   - `TELEGRAM_BOT_TOKEN` — from BotFather
   - `KV_REST_API_URL` — Upstash Redis REST URL
   - `KV_REST_API_TOKEN` — Upstash Redis REST token
   - `APP_PIN` — password for the admin dashboard
5. Register the webhook:
   ```
   curl https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<YOUR_DOMAIN>/api/telegram
   ```

## Project Structure

```
src/
  app/
    api/telegram/   — Telegram webhook endpoint
    api/admin/      — Admin dashboard API
    api/auth/       — Admin PIN auth
    admin/          — Admin UI pages
  lib/
    bot.ts          — Bot logic (handlers, callbacks, state)
    templates.ts    — Per-user workout templates
    kv.ts           — Redis storage layer
    chart.ts        — Progression chart generation
    i18n.ts         — Translations (EN/FR)
    exercises.ts    — Default exercise definitions
    types.ts        — TypeScript types
```

## License

MIT
