# Session Log

## 2026-07-05

### Reviewed
- Inspected the AI Interior Atelier project structure.
- Confirmed the app is Next.js + Supabase with Phase 1 scaffolding.
- Reviewed README, schema docs, migration, AI service mocks, Supabase clients, room workspace, API routes, and package scripts.
- Compared the current build against `docs/AI_Interior_Atelier_PRD_v2.md` to identify v1 carryovers in schema, workflow, and UI language.

### Fixed
- Initialized `C:\Users\darre\Documents\AI Interior Designer` as its own Git repo instead of inheriting `C:\Users\darre\.git`.
- Added GitHub origin: `https://github.com/nowyoufoundchill/ai-interior`.
- Set branch to `main`.
- Created `.env.local` with Supabase values provided by the owner. The file is ignored by Git.
- Added review-agent checkpoints and failure gates to every phase in `BUILD_PLAN.md`.
- Created the live `room-photos` Supabase Storage bucket.
- Moved photo upload, relabel, and delete through the room photos API route using the server service key so browser uploads are not blocked by storage RLS in private mode.
- Updated server Supabase helper to require `SUPABASE_SERVICE_ROLE_KEY` for private server-side reads/writes.
- Added OpenAI Responses API integration for room diagnosis, mood boards, product sourcing with web search, render prompt planning, render image generation, and revision chat.
- Added product filters/details, render image display, memory confirm/edit/delete controls, and auditable memory edit/delete revision records.
- Added `scripts/verify-live.mjs` and `npm run verify:live`.
- Added `002_private_server_access_hardening.sql` to remove broad anon/authenticated table mutation grants for public deployment hardening.
- Added GitHub Actions workflows for Supabase migration dry-run on pull requests and migration deploy on pushes to `main`.
- Confirmed the repository workflow model: local development -> GitHub push -> Vercel app redeploy -> Supabase runtime connectivity, with GitHub Actions handling Supabase migrations from `supabase/**`.
- Verified that the repo secret `SUPABASE_DB_URL` works when set to the Supabase Transaction pooler connection string. GitHub workflow `Supabase DB Check` passed after switching away from the direct IPv6-only host.
- Updated `PROJECT_BRAIN.md` and `README.md` so future agents have the exact deployment, ownership, and migration logic in-repo.
- Fixed Supabase TypeScript build blockers:
  - Added `Relationships` keys to table types in `types/database.ts`.
  - Switched browser Supabase helper to typed `@supabase/supabase-js` client in `lib/supabase/browser.ts`.
  - Cast revision state payloads to JSON in `app/api/rooms/[roomId]/chat/route.ts`.
- Replaced the old phase-oriented build plan with a PRD-v2-aligned `BUILD_PLAN.md`.
- Rewrote `PROJECT_BRAIN.md` to reflect PRD v2 as the sole product spec, the new state of the codebase, and the remaining gaps.
- Updated `docs/schema.md` to document the additive PRD-v2 alignment migration path.
- Added `supabase/migrations/003_prd_v2_foundation_alignment.sql` with additive schema changes for:
  - `rooms.current_stage`
  - version/status metadata on `room_analyses` and `mood_boards`
  - mood board version and status metadata on `products` and `renders`
  - richer `ai_runs` metadata columns
  - new `design_preferences` and `chat_messages` tables
- Updated room API routes so reruns are append-only instead of destructive:
  - diagnoses now version and stale prior current diagnoses
  - concept generation no longer deletes older concepts
  - locking a concept marks prior downstream products/renders stale
  - render regeneration marks prior current renders for the same source photo stale
- Updated the room workspace UI to PRD-v2-style tabs and stage language:
  - `Photos & Brief`, `Diagnosis`, `Concepts`, `Products`, `Renders`, `Chat`
  - locked concept in the header
  - visible next-step hint
  - concept/product/render status badges
- Added hidden route `/debug` backed by `ai_runs`.
- Updated dashboard/home cards and live verification script to use the new stage model and table set.
- Fixed `001_initial_schema.sql` to replay safely against the already-initialized live database and updated the GitHub Supabase workflows to run non-interactively with `--yes`.
- Confirmed the GitHub workflow rerun for commit `74cea28` succeeded and that the live Supabase project now includes:
  - `design_preferences`
  - `chat_messages`
  - `rooms.current_stage`
  - version/status metadata on `room_analyses` and `mood_boards`
- Refactored AI schemas into `/lib/schemas/`.
- Added `/lib/ai/gateway.ts` as the central structured-call and image-edit gateway with centralized `ai_runs` logging.
- Moved prompt instructions into versioned files under `/prompts/`.
- Updated AI services and room API routes so model calls now flow through the gateway rather than direct service-level OpenAI calls.
- Added Phase 0 spike infrastructure:
  - hidden `/spike` workbench page
  - `POST /api/spike/run` orchestration route
  - Anthropic structured-output adapter for spike reasoning runs
  - Tavily search/extract helper for product-sourcing enrichment
  - saved spike artifacts under `spike/runs/*.json`
- Added provider-aware model fallback logic so Anthropic spike runs do not inherit OpenAI-only prompt model names.
- Added Anthropic schema sanitization for structured-output compatibility during spike execution.
- Fixed prompt loading for deployed server runtimes by resolving known prompt files from a bundled manifest in `/lib/ai/prompts.ts` instead of relying on `process.cwd()` file access alone.
- Tightened the diagnosis service success criteria so the function reinforces typed dimensions as ground truth, visual evidence limits, and downstream usefulness for concepts, scale, lighting, and renders.
- Revised `prompts/diagnosis/room-diagnosis.v1.md` to a fuller diagnosis brief and set its declared model to `gpt-5.4-mini-2026-03-17`.

### Verified
- `npm.cmd run typecheck` passes.
- `npm.cmd run build` passes.
- Re-ran `npm.cmd run build` after the brain/session documentation update; it still passes on July 5, 2026.
- Re-ran both `npm.cmd run typecheck` and `npm.cmd run build` after the PRD-v2 alignment changes; both pass on July 5, 2026.
- Re-ran `npm.cmd run verify:live` after the GitHub migration fix; the live schema and storage checks all pass on July 5, 2026.
- Re-ran `npm.cmd run typecheck` and `npm.cmd run build` after the gateway/prompt/schema refactor; both pass on July 5, 2026.
- Re-ran `npm.cmd run typecheck` and `npm.cmd run build` after the Phase 0 spike implementation; both pass on July 5, 2026.
- Re-ran `npm.cmd run typecheck` and `npm.cmd run build` after the prompt-loader deploy fix; both pass on July 5, 2026.
- Re-ran `npm.cmd run typecheck` after tightening the diagnosis prompt/service contract; it passes on July 5, 2026.
- OpenAI env is configured as server-only `OPENAI_API_KEY`; the previous `NEXT_PUBLIC_OPENAI_API_KEY` name was removed.
- `room-photos` storage bucket exists and is public.

### Current Warnings
- Next.js previously warned about multiple lockfiles because the app was inheriting the parent user repo/root. Recheck after the app-local Git initialization.
- Direct anon upload to Storage is blocked by RLS; current app upload path uses the server route with the service key.
- `docs/AI_Interior_Atelier_PRD_v2.md` exists locally and is intentionally untracked.
- No live room/photo data exists in Supabase yet, so the spike has not been validated against owner room data from the app.
- `TAVILY_API_KEY` is not configured locally yet, so Tavily validation remains blocked.
- Phase 0 cannot be marked complete yet because real owner-photo validation and owner sign-off on outputs have not happened.
- The codebase still has major PRD-v2 follow-up gaps: no concept edit/unlock/re-harmonize flow, no home-level preferences UI, and no before/after render comparison.

### Next Action
- Use the documented local -> GitHub -> Vercel -> Supabase workflow for further implementation.
- Run `/spike` with owner room-photo URLs and typed dimensions, add `TAVILY_API_KEY`, and review the saved artifacts plus `/debug` logs before promoting any prompt versions.

