# Couple Food

Couple Food is a shared dinner list for two partners. Users create an account, connect with a partner through an invite code, and keep one shared list of food ideas, favorites, and eaten history.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example`:

   ```bash
   cp .env.example .env
   ```

3. Fill in Supabase values from `Project Settings -> API`:

   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

## Supabase Setup

For an existing Supabase project, run:

```sql
-- Supabase SQL Editor
-- Paste and run supabase/repair_schema.sql
```

The repair script creates or updates:

- `profiles`, `rooms`, `room_members`, and `foods`
- `memories` and `map_url` support for foods
- couple creation/joining RPC functions
- row level security policies
- avatar and memory photo storage policies
- food edit/history/favorite fields
- realtime publication entries for `foods`, `rooms`, `room_members`, and `memories`

## Map Link Resolver Function

Shortened Naver/Kakao map links are resolved server-side with a Supabase Edge Function:

- function path: `supabase/functions/resolve-map-link/index.ts`
- expected secret: `KAKAO_REST_API_KEY`

Set the secret in Supabase before deploying the function:

```bash
supabase secrets set KAKAO_REST_API_KEY=your-kakao-rest-api-key
```

Then deploy:

```bash
supabase functions deploy resolve-map-link --use-api
```

For a fresh project, `supabase/schema.sql` contains the full schema.

## Auth Testing Notes

If signup shows:

```text
email rate limit exceeded
```

that is a Supabase Auth email limit, not a frontend error. For development, use one of these options:

- Wait for the limit to reset.
- In Supabase Dashboard, go to `Authentication -> Sign In / Providers -> Email` and turn off email confirmation.
- Create test users manually in `Authentication -> Users -> Add user`, using auto-confirm if available.
- Configure custom SMTP in Supabase Auth settings.

## Verification

Run both checks before moving between development phases:

```bash
npm test
npm run build
```

`npm test` is a lightweight smoke check for critical app/schema wiring. `npm run build` verifies the production bundle.
