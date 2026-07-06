# Project Brain: AI Interior Atelier

## Product Intent
AI Interior Atelier is a private, premium virtual interior design studio for one household. The core loop is:

`Home -> Room -> Diagnosis -> 3 Concepts -> Lock one concept -> Products and Renders -> Design Chat`

The flagship moment is transforming the owner&apos;s real room photos into concept-aligned renders. The locked concept is the contract that downstream products and renders must follow.

## Current Reality
- The codebase started from a v1-style model and is being migrated toward PRD v2.
- PRD v2 is the only planning authority now.
- The app is still single-household and private-first.
- Auth is still effectively deferred in the product experience.
- The room workspace now uses `current_stage` semantics and append-only artifact handling for new writes.
- The PRD-v2 alignment migration has been applied successfully to the live Supabase project through the GitHub workflow.
- The AI layer now uses `/lib/schemas`, `/lib/ai/gateway.ts`, and repo-backed versioned prompt files under `/prompts`.

## Repository
- GitHub origin: `https://github.com/nowyoufoundchill/ai-interior`
- Local path: `C:\Users\darre\Documents\AI Interior Designer`
- Local branch: `main`

## Deployment Logic
- Source of truth is the local repo.
- Normal workflow is: edit locally -> test locally -> commit -> push to `main`.
- GitHub is the integration hub for Vercel deploys and Supabase migration workflows.
- Vercel deploys the Next.js app only; it does not copy or host the database.
- Supabase remains the runtime backend for Postgres and Storage.
- Repo workflows under `.github/workflows/` own migration automation.
- `SUPABASE_DB_URL` in GitHub Actions must use the Supabase Transaction pooler connection string.

## Architecture Direction
- Next.js App Router + TypeScript + Tailwind.
- Supabase Postgres and Storage.
- Server-side model calls only.
- Planned AI provider split from PRD v2:
  - Anthropic for reasoning and native web search.
  - OpenAI for image edit rendering.
  - Tavily for sourcing search supplements, image URLs, and extraction.
- Current implementation centralizes model calls through `/lib/ai/gateway.ts`.
- Current provider reality:
  - Gateway logging, prompt loading, and provider routing are centralized.
  - The production room routes still default to the existing OpenAI-backed flow.
  - A hidden `/spike` workbench now exercises Anthropic reasoning, OpenAI image edit validation, and optional Tavily enrichment without changing the production room workflow.

## Current Data Model Notes
- Existing tables from the original foundation are still present.
- The additive v2 migration now exists both in-repo and live, and introduces:
  - `rooms.current_stage`
  - version/status metadata on `room_analyses`
  - version/status/origin metadata on `mood_boards`
  - mood board version tracking on `products` and `renders`
  - `design_preferences`
  - `chat_messages`
  - richer `ai_runs` metadata columns
- Current app behavior now preserves older diagnoses, concepts, products, and renders instead of deleting them on rerun.

## UI Shape
- Room Detail is the primary workspace.
- Current room tabs: `Photos & Brief`, `Diagnosis`, `Concepts`, `Products`, `Renders`, `Chat`.
- Hidden debug route: `/debug`.
- Hidden spike route: `/spike`.
- Home-level preferences UI does not exist yet even though the migration path is defined.

## Agent Rules
- Treat [docs/AI_Interior_Atelier_PRD_v2.md](/C:/Users/darre/Documents/AI%20Interior%20Designer/docs/AI_Interior_Atelier_PRD_v2.md) as the single product spec.
- Do not reintroduce destructive delete-on-rerun behavior.
- Locked concepts must remain the only valid source for downstream product/render generation.
- Additive migrations only unless the owner explicitly approves destructive cleanup.
- Do not add a fourth AI provider without owner sign-off.
- Keep secrets in `.env.local` or platform env configuration only.
- Apply Supabase changes through repo migrations, not dashboard-only edits.

## Known Gaps Against PRD v2
- Concept edit/unlock/re-harmonize flows are not built yet.
- `design_preferences` exists only in the new migration path, not in live UI behavior yet.
- Chat still stores `revisions` and legacy memory records alongside the new `chat_messages` direction.
- The app still uses legacy naming such as `room_analyses` in multiple places.
- Tavily is not configured locally yet, so product-sourcing supplementation in the spike cannot be fully validated.
- Multi-provider routing is now available for the spike harness, but the production room routes are intentionally not switched over yet.

## Operational Notes
- `docs/AI_Interior_Atelier_PRD_v2.md` is intentionally local-only right now unless the owner says otherwise.
- Supabase CLI was not available in the local shell during this session. The live schema was updated through the repo's GitHub Actions migration workflow instead.
