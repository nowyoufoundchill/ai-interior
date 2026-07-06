# AI Interior Atelier

A private virtual interior design studio for designing a home room by room. Phase 1 focuses on the foundation: homes, rooms, photo intake, room workspace tabs, database schema, storage, and mock design-intelligence service boundaries.

## Current Mode

This build is intentionally private single-household mode. There is no login wall because the app is for one household. The schema still includes `users` and `user_id` so Supabase Auth can be added later without redesigning the product.

## Setup

1. Create `.env.local` from `.env.example`.
2. Add your Supabase anon key:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ztakhixowbjhfoggwtll.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

3. Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor for project `ztakhixowbjhfoggwtll`.
4. Install dependencies and start the app:

```bash
npm install
npm run dev
```

## GitHub + Supabase

This repo is wired for GitHub Actions based Supabase migration checks and deploys:

- Pull requests touching `supabase/**` run `.github/workflows/supabase-db-check.yml`
- Pushes to `main` touching `supabase/**` run `.github/workflows/supabase-db-deploy.yml`

Configure the GitHub repository secret:

```text
SUPABASE_DB_URL=postgres://...your-session-pooler-or-direct-connection-string...
```

Get this from Supabase Dashboard -> Connect -> Session pooler connection string, or use the direct connection string if your network supports it.

If you also want Supabase's native GitHub integration:

1. In Supabase Dashboard, go to `Project Settings -> Integrations`.
2. Under GitHub Integration, authorize GitHub and choose `nowyoufoundchill/ai-interior`.
3. Set `Working directory` to `.` because the `supabase/` folder is at the repository root.
4. Enable `Deploy to production`.

This matches Supabase's documented GitHub integration flow and lets Supabase watch branch and PR changes in the repo.

## Phase 1 Includes

- Next.js App Router, TypeScript, Tailwind CSS.
- Supabase Postgres schema and Supabase Storage bucket setup.
- Dashboard, home creation, home detail, room creation, room detail workspace.
- Room tabs: Photos, Diagnosis, Mood Boards, Products, Renders, Chat, Memory.
- Photo upload, labels, checklist, relabel, delete.
- Mock routes for diagnosis, mood boards, product plan, render prompt, and room-aware chat.
- Modular AI service files with TypeScript types, Zod schemas, mock implementations, and `ai_runs` logging.

## Next Recommended Phase

Phase 2 should replace the mocked Room Vision Analyst with a real structured room analysis call, then save and display the validated diagnosis.
