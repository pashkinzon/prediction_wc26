# World Cup 2026 Predictor

A minimal local-first score prediction game for a private World Cup 2026 pool.

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL, usually `http://127.0.0.1:5173`.

## Local MVP behavior

- Match data lives in `src/data/mockMatches.ts`.
- Select a hardcoded player and enter their 4-digit PIN before using the app.
- Current local players are `Pasha` / `6743` and `Fedor` / `1708`.
- The temporary player/PIN list lives in `src/App.tsx`; later this should move to Supabase.
- Predictions are saved in browser `localStorage`.
- Prediction reactions are saved in browser `localStorage`.
- Predictions lock when the effective current time is at or after the match kickoff.
- Other users' predictions are hidden until the match has started.
- After kickoff, players can react to other players' visible predictions.
- Finished matches show points and feed the leaderboard.

## Testing match states

Use the "Current time override" helper in the More tab.

- Set a time before a kickoff to keep that match editable.
- Set a time at or after kickoff to lock predictions and reveal saved predictions.
- Clear the helper with Reset to use the real current time again.

The mock data includes scheduled, live, and finished matches so you can test all states without external services.

## Scoring

Only the best matching rule applies:

- Exact score: 5 points
- Correct goal difference: 3 points
- Correct winner or draw: 2 points
- Anything else: 0 points

Exact score gives 5 total points, not 5 + 3 + 2.

## Confidence Bets

Each player gets one golden prediction per group/round in the local MVP.

- Mark a prediction as `Gold Pick` before saving.
- A gold pick doubles the points from the single scoring rule that applies.
- Example: an exact score normally gives 5 points; a gold exact score gives 10.
- Saving a new gold pick in the same group moves the gold pick from the old match to the new one.

## Beginner-friendly structure

```text
src/components       UI components
src/data             local mock matches
src/hooks            small reusable hooks
src/types            shared TypeScript types
src/utils/scoring.ts scoring and leaderboard logic
src/utils/storage.ts localStorage helpers
```

## Future Phase 2: Supabase plan

Supabase can provide shared storage:

- `players`: nickname plus simple private PIN/code hash
- `matches`: normalized fixture data
- `predictions`: user, match, home score, away score, timestamps
- Leaderboard can be calculated either in app code from stored predictions or with a Supabase view/RPC.

The app reads Supabase config from Vite environment variables:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_key
```

For this project, run `supabase-setup.sql` once in the Supabase SQL editor after creating the base tables. It adds local MVP policies and seeds the mock matches.

Suggested schema notes:

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  nickname text unique not null,
  pin_hash text not null,
  created_at timestamptz default now()
);

create table matches (
  id text primary key,
  home_team text not null,
  away_team text not null,
  kickoff_time timestamptz not null,
  status text not null,
  final_home_score int,
  final_away_score int
);

create table predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  match_id text references matches(id),
  home_score int not null,
  away_score int not null,
  updated_at timestamptz default now(),
  unique (user_id, match_id)
);
```

## Future Phase 3: football-data.org plan

Use football-data.org through a backend/server route, not directly from the frontend.

- Endpoint idea: `/v4/competitions/WC/matches`
- Send the API key as `X-Auth-Token`.
- Store the API key in a server environment variable.
- Never expose the API key in browser code.
- Fetch real fixtures/results from the backend, then update Supabase `matches`.

For Render, this can become either a small Node backend plus Vite frontend or a static frontend calling a secure API service.
