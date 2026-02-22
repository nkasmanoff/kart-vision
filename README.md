# kart-vision

## Getting Started

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Environment Variables

Copy `.env` and add your values:

- `NEXT_PUBLIC_SUPABASE_URL` – Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – Supabase anon key
- `NEXT_PUBLIC_MOONDREAM_API_KEY` – Moondream API key (for video analysis)
- `NEXT_PUBLIC_MOONDREAM_FINETUNE_ID` – Moondream finetune ID (optional)
- `NEXT_PUBLIC_MOONDREAM_MODEL` – Model name (default: moondream3-preview)
- `NEXT_PUBLIC_MOONDREAM_STEP` – Finetune step (default: 40)

### Sessions (Supabase)

When signed in, the analyzer uses **sessions** to track your analyses. Each session = one video + its analysis (frames, races).

- **New Session** – Start fresh: upload a video and run analysis
- **Save Session** – Persist the current session to Supabase
- **Update Session** – Update an already-saved session
- **Load Session** – Pick a session from the dropdown to view its data

To enable sessions, run the migration in your Supabase project:

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. Run the contents of `supabase/migrations/20250222000000_create_analysis_sessions.sql`

---

You can also use `npm` or `yarn` instead of `pnpm` (e.g. `npm run dev` or `yarn dev`).
