# Veri

Web app for importing public Pinterest boards, analyzing pins with AI, and finding shoppable product matches from retailers. Swipe through results and save your favorites.

I built this over spring break to help me find grad dresses and outfits for my summer vacation. Now available to the public at [tryveri.com](https://tryveri.com).

This is a Next.js app backed by Supabase (auth + database), OpenAI Vision (pin analysis), and Playwright + Browserbase (Pinterest scraping).

## Features

- Import public Pinterest boards by URL, including sections
- AI-powered pin analysis (category, style, colors, silhouette)
- Board-level style profiling for multi-pin searches
- Product search via text and image providers
- Tinder-style swipe deck for browsing results
- Save, undo, and manage favorite products
- Budget filters and default preferences
- Onboarding flow and in-app guided tours

## Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Database & Auth:** Supabase
- **AI:** OpenAI API (Vision)
- **Scraping:** Playwright Core, Browserbase
- **State:** Zustand
- **UI:** Tailwind CSS 4, shadcn, Framer Motion, Lucide

## Setup

```
npm install
```

Create a `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ENCRYPTION_SECRET=           # openssl rand -hex 32
OPENAI_API_KEY=your-openai-key
BROWSERBASE_API_KEY=         # optional, falls back to local Chromium
SHOPPING_PROVIDER_MODE=mock  # mock | text | image | full
TEXT_SHOPPING_PROVIDER_KEY=  # required for text/full mode
```

If not using Browserbase, install Chromium locally:

```
npx playwright install chromium
```

Apply Supabase migrations in order (`supabase/migrations/001` through `008`).

## Run

```
npm run dev
```

## Build

```
npm run build
```

On serverless (Vercel, etc.), `BROWSERBASE_API_KEY` is required for Pinterest import since local Chromium isn't available. The Pinterest import route uses `maxDuration = 300`, which requires Vercel Pro.

## Project Layout

```
src/
  app/
    (app)/            # Authenticated routes (boards, pins, results, saved, settings)
    (auth)/           # Login, onboarding
    api/              # API routes (pinterest, search, analysis, saved, preferences)
  components/
    swipe/            # Product swipe deck
    boards/           # Board cards
    pins/             # Pin cards, crop modal
    tour/             # Guided tours
    ui/               # shadcn primitives
  lib/
    services/         # Pinterest scraping, board sync, analysis, search orchestration
    providers/        # Shopping provider registry (mock, text, image)
    prompts/          # OpenAI prompt templates
    ranking/          # Result ranking and deduplication
    supabase/         # Client, server, admin, middleware
    config.ts         # Env validation (Zod)
  store/              # Zustand store
supabase/
  migrations/         # Database migrations (001–008)
```
