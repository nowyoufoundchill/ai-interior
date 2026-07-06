# AI Interior Atelier

A private virtual interior design studio for designing a home room by room. The foundation app exists, and Phase 0 now has a dedicated spike harness for validating prompts and provider behavior before treating any AI output as production-quality.

## Current Mode

This build is intentionally private single-household mode. There is no login wall because the app is for one household. The schema still includes `users` and `user_id` so Supabase Auth can be added later without redesigning the product.

## Setup

1. Create `.env.local` from `.env.example`.
2. Add your env values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ztakhixowbjhfoggwtll.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
TAVILY_API_KEY=your-tavily-key
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

## Exact Workflow

The intended deployment flow is:

1. Make changes locally in `C:\Users\darre\Documents\AI Interior Designer`.
2. Run local verification such as `npm run build` and any feature-specific checks.
3. Commit and push to GitHub (`nowyoufoundchill/ai-interior`).
4. Vercel sees the GitHub change and redeploys the Next.js application.
5. GitHub Actions sees changes under `supabase/**` and runs the Supabase migration workflow.
6. The deployed Vercel app then talks to the live Supabase project at runtime.

Important distinctions:

- Vercel deploys app code from GitHub. It does not copy or own the database.
- Supabase remains the live database and storage backend.
- Database schema changes belong in `supabase/migrations/`, not in ad hoc dashboard-only edits.
- The GitHub secret `SUPABASE_DB_URL` should use the **Transaction pooler** connection string so GitHub-hosted runners can connect over IPv4.

For future AI agents working in this repo:

- treat GitHub as the shared deployment hub
- treat Vercel as app hosting only
- treat Supabase as the runtime backend and schema owner
- keep untracked planning docs local unless explicitly requested for commit

## Phase 0 Spike

- Hidden workbench route: `/spike`
- Full-chain spike API route: `POST /api/spike/run`
- Saved artifacts: `spike/runs/*.json`
- Current use: paste a payload with real photo URLs, typed dimensions, and design brief, then validate diagnosis, concepts, products, render planning, and image edit behavior in one run.

Notes:

- Anthropic powers the spike reasoning flow when `ANTHROPIC_API_KEY` is configured.
- OpenAI powers the image-edit validation when `OPENAI_API_KEY` is configured.
- Tavily enrichment is attempted only when `TAVILY_API_KEY` is configured.
- The spike is the prompt workbench, not the production room workflow.

## Foundation Includes

- Next.js App Router, TypeScript, Tailwind CSS.
- Supabase Postgres schema and Supabase Storage bucket setup.
- Dashboard, home creation, home detail, room creation, room detail workspace.
- Room tabs: Photos, Diagnosis, Mood Boards, Products, Renders, Chat, Memory.
- Photo upload, labels, checklist, relabel, delete.
- Mock routes for diagnosis, mood boards, product plan, render prompt, and room-aware chat.
- Modular AI service files with TypeScript types, Zod schemas, mock implementations, and `ai_runs` logging.

## Next Recommended Step

Run `/spike` against the owner's real room photos and typed dimensions, add `TAVILY_API_KEY`, and use the saved artifacts plus `/debug` logs to decide whether the current prompt files are good enough to graduate as approved v1 prompts.
