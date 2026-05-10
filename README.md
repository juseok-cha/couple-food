# Couple Food

Couple Food is a small web app I built for couples who keep asking the same question:

> "What should we eat today?"

Instead of saving restaurant ideas in scattered chats, notes, map links, and screenshots, Couple Food gives two people one shared dinner list. Each partner can add places, save favorites, mark restaurants as visited, and keep memories from meals they had together.

## Live Website

Try the hosted app here: [couple-food-select.netlify.app](https://couple-food-select.netlify.app)

## What This App Does

- Create an account with email and password.
- Create a couple invite code and share it with a partner.
- Join the same shared food list as a couple.
- Add restaurants or food ideas with category, notes, price level, favorites, and map links.
- Search and filter the list when choosing what to eat.
- Randomly pick a dinner option.
- Mark a place as visited.
- Save memories with a photo and note after eating together.
- See updates in realtime when the partner adds or changes something.

## Why I Built It

This project started from a very simple idea: choosing food together should feel fun, not repetitive.

Many couples already have a private list of places they want to try, but that list usually lives across multiple apps. I wanted Couple Food to feel more personal than a generic todo list or restaurant tracker. The app is designed around two people, one shared space, and small moments like inviting a partner, picking dinner, and saving memories after a meal.

## How The Website Was Created

The development process was split into clear phases so the app could grow from a basic prototype into something closer to a real product.

### Phase 1: Make It Safe

The first goal was to make the core couple flow reliable.

I rebuilt the app around login/signup, partner invites, and one shared dinner list. I also added Supabase database protection so one user cannot join multiple couples and each couple can only have two members. Direct client-side room creation was replaced with safer Supabase RPC functions.

### Phase 2: Make It Feel Like A Couple App

After the basic flow worked, I focused on making the app feel more personal.

This phase added nickname/profile setup, partner status, clearer invite states, invite sharing, and realtime updates when a partner joins. I also cleaned up the wording so the product felt like a couple app instead of a generic "room" tool.

### Phase 3: Make The Dinner List Useful

Next, I improved the actual food list.

I added editing, categories, notes, price levels, favorites, search, filters, eaten history, and a better random picker. This turned the app from a simple shared list into something useful after many food ideas have been added.

### Phase 4: Polish And Quality

The final development phase focused on reliability and setup.

I added a lightweight smoke test, improved error messages, documented the Supabase setup, added password reset support, and verified the production build. I also added support for memories, photo uploads, mobile polish, and map link resolution.

## Tech Stack

- React
- Vite
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions
- Netlify/Vercel-friendly SPA routing

## Project Structure

```text
src/
  components/       Reusable UI components
  lib/              Supabase client, data API, map helpers
  pages/            Login, home, room, and password update pages

supabase/
  schema.sql        Full schema for a fresh project
  repair_schema.sql SQL repair/setup script for an existing project
  functions/        Edge Functions

scripts/
  quality-check.mjs Lightweight smoke test
```

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Fill in Supabase values from `Project Settings -> API`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
```

Start the app:

```bash
npm run dev
```

## Supabase Setup

For an existing Supabase project, open the Supabase SQL Editor and run:

```sql
-- Paste and run supabase/repair_schema.sql
```

The repair script creates or updates:

- `profiles`, `rooms`, `room_members`, `foods`, and `memories`
- couple creation/joining RPC functions
- row level security policies
- avatar and memory photo storage policies
- food edit/history/favorite fields
- realtime publication entries

For a fresh project, `supabase/schema.sql` contains the full schema.

## Map Link Resolver

Shortened Naver/Kakao map links are resolved server-side with a Supabase Edge Function:

```text
supabase/functions/resolve-map-link/index.ts
```

Set the Kakao REST API key before deploying the function:

```bash
supabase secrets set KAKAO_REST_API_KEY=your-kakao-rest-api-key
supabase functions deploy resolve-map-link --use-api
```

## Verification

Run these checks before deployment:

```bash
npm test
npm run build
```

`npm test` checks critical app/schema wiring. `npm run build` verifies the production bundle.

## Auth Testing Notes

If signup shows `email rate limit exceeded`, that is a Supabase Auth email limit, not a frontend error.

For development, you can:

- Wait for the limit to reset.
- Turn off email confirmation in Supabase Auth settings.
- Create test users manually in `Authentication -> Users`.
- Configure custom SMTP in Supabase.

## Current Status

The main application code is complete and the local checks pass. The remaining production work is to apply the Supabase SQL to the hosted project, deploy the Edge Function, set production environment variables, and run a final two-user hosted test.
