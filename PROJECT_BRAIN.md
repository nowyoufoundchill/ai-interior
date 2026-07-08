# Project Brain: AI Interior Atelier

## Product Intent
AI Interior Atelier is a private, premium virtual interior design studio for one household. The core loop is:

`Home -> Room -> Diagnosis -> 3 Concepts -> Lock one concept -> Products and Renders -> Design Chat`

The flagship moment is transforming the owner's real room photos into concept-aligned renders. The locked concept is the contract that downstream products and renders must follow.

## Current Reality
- `docs/AI_Interior_Atelier_PRD_v3.md` supersedes v1 and v2 entirely and is the sole planning authority as of 2026-07-08. PRD v2 phases 0-6 (see below) were completed against the prior spec and are being carried forward, not redone, except where v3 changes the contract.
- The app is single-household and private-first. **Owner decision (2026-07-08): Supabase Auth is explicitly not needed** ("just me and my wife") — this overrides PRD v3 §3's auth line. `/login` remains a no-op redirect to `/dashboard`. Revisit only if the owner asks for multi-user access.
- PRD v3 adds requirements with no v2 equivalent: a real test harness (`AI_MODE` mock/live, `.env.test`, `seed:test`/`teardown`, `test_run_id` residue tracking, `data-testid` coverage), a consolidated 6-style library (currently 14 thin entries), and five verification suites run as repo skills, culminating in a Release Gate (v3 §12).
- Chrome DevTools MCP (`chrome-devtools`, https://github.com/ChromeDevTools/chrome-devtools-mcp) was installed at user scope on 2026-07-08 (`claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest`) and shows connected via `claude mcp list`. MCP tool sets load at session start, so it was not callable in the session that installed it. Any fresh session should have it available and should prefer it for suites 2/4/5; this session used Playwright (installed as a devDependency) as the interim driver — same intent (real browser, real clicks, real screenshots), different mechanism.
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
  - Diagnosis, concept generation, product sourcing, and render prompt planning now default to Anthropic.
  - OpenAI remains the validated image-edit renderer.
  - Tavily is validated as a search/extract supplement for sourcing support.
  - Diagnosis and concept generation now run on a context brain + real critic pattern (see "Context Brain Layer" below); the other services are only partially upgraded to that same depth.
  - A hidden `/spike` workbench exercises Anthropic reasoning, OpenAI image edit validation, and Tavily enrichment without changing the production room workflow.

## Context Brain Layer (added 2026-07-06/07)
- Prompts are treated as a compact operating system (role, decision hierarchy, output contract), not the place design intelligence lives. This follows evidence from a 10-variant real-photo batch showing prompt wording alone moved tone but not judgment.
- Design intelligence lives as structured data under `/lib/ai/context-brain/` (property dossier, room intelligence, taste graph, design policy) plus `/lib/ai/design-portfolio.ts` (annotated reference patterns) and a deepened `/lib/ai/style-library.ts`.
- `/lib/ai/critic.ts` is a real, gateway-logged Critic (previously a hardcoded mock) scored against `/lib/ai/critic-rubric.ts`, including a concept-differentiation check with one bounded regeneration retry.
- This pattern is proven in production-like validation for Concept Director and is now also applied to Diagnosis with a dedicated diagnosis critic and bounded regeneration pass. Products, renders, and chat are only partially migrated.
- Real validation artifacts now closing the loop:
  - office batch completion: `spike/runs/batch/2026-07-07T04-27-41-099Z/summary.json`
  - Tavily direct validation: `spike/runs/tavily-phase0-2026-07-07T03-56-11-268Z.json`
  - OpenAI render validation: room `8e4ee483-596f-41ef-8ff1-a2f301db1f69`, render `fd65a8c9-1eb3-49f9-a782-c3de664c87a0`
- Owner feedback as of July 6, 2026: `generate-room-concepts.v2` is directionally good enough to continue with, provided OpenAI and Tavily remain available for their respective downstream tasks. With the provider validations above, that is now sufficient to close Phase 0.

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
- Treat [docs/AI_Interior_Atelier_PRD_v3.md](/C:/Users/darre/Documents/AI%20Interior%20Designer/docs/AI_Interior_Atelier_PRD_v3.md) as the single product spec. v2 is historical context only.
- Do not reintroduce destructive delete-on-rerun behavior.
- Locked concepts must remain the only valid source for downstream product/render generation.
- Additive migrations only unless the owner explicitly approves destructive cleanup.
- Do not add a fourth AI provider without owner sign-off.
- Do not build Supabase Auth — owner explicitly declined it (2026-07-08); this is an intentional, permanent deviation from PRD v3 §3, not a gap to close.
- Keep secrets in `.env.local` or platform env configuration only.
- Apply Supabase changes through repo migrations, not dashboard-only edits.
- "Done" means the phase gate in PRD v3 §12.3 is green, not agent self-assessment. A phase is not complete because code was written and typechecks.

## Build status against PRD v2 (updated 2026-07-07)
Phases 2-6 of `BUILD_PLAN.md` are now implemented and pass the type gate (`tsc --noEmit` on a clean reconstruction; `next build` must be run on Windows). Highlights:
- Phase 2: append-only concept lock/unlock/edit/re-harmonize (`app/api/rooms/[roomId]/moodboards/[boardId]/route.ts` + `refineConcept`); shared `StatusBadge`/`StaleNotice`; diagnosis-first UI language.
- Phase 3: renders are in-place photo edits — photo-edit language throughout, per-edit instructions wired into `renderPromptDirector`, before/after UI, preservation/critic history.
- Phase 4: `productSourcingAgent` uses the full context brain + a real `Product Critic` (`critiqueProducts`); best-effort product image caching (`products.cached_image_path`); approve/reject controls; rationale-first, typed-dimension-aware prompt.
- Phase 5: `design_preferences` is now the primary taste source (home-level UI + API + taste-graph wiring, outranking brief fields); chat is advisory only and never mutates state (proposes + requires explicit confirmation); `design_memories` is no longer written or used as a taste source.
- Phase 6: RLS/API audit done; grant-based private model confirmed (all access server-side via service role; browser client unused). Added `004_prd_v2_access_hardening.sql` to close a default-grant gap on the PRD-v2 tables and prevent recurrence.

Remaining owner-side deploy actions: apply migration 004 via the GitHub->Supabase workflow + `verify:live`; run `npm run build` on Windows; commit from Windows (the sandbox mount is a stale snapshot this session).

## Known Gaps Against PRD v3 (new, added 2026-07-08)
- No test harness: no `AI_MODE` flag, no mock fixtures, no `.env.test`, no `seed:test`/`teardown`, no `test_run_id` column anywhere.
- No `data-testid` coverage on interactive elements or artifact cards.
- No debug state-assertion endpoint (needed for the Integrity suite to assert the §4 invalidation table).
- Style library has 14 thin entries; PRD v3 §7 wants 6 deep ones (Lowcountry Coastal, Moody Coastal, Organic Modern, Modern Traditional, Masculine Executive, Boutique Hotel).
- No verification suites/skills exist yet (Integrity, Functional E2E, Live API smoke, Assets & responsive, Design brain & feel) and no Release Gate has ever run.
- No separate test Supabase project/branch exists; only one set of live credentials is configured in `.env.local`. Until a second Supabase project is provisioned, the test harness will run against the same project with strict `test_run_id` tagging + teardown rather than true environment isolation — flagged as a real residue risk until a dedicated test project exists.

## Known Gaps Against PRD v2 (historical — v2 is superseded)
- The `room_analyses` physical table rename remains deferred as a destructive migration; app-facing language is already diagnosis-first.
- API routes still have no per-user auth (single-household private mode, auth intentionally deferred). This must be revisited before any multi-tenant or public deployment.
- Product/render critics are logged but non-blocking (no auto-regeneration), matching the concept-critic convention; tightening these into gated loops is future work.
- `design_preferences` exists only in the new migration path, not in live UI behavior yet; the taste graph is currently bootstrapped from brief fields only, not from confirmed owner reactions.
- Chat still stores `revisions` and legacy memory records alongside the new `chat_messages` direction.
- The app still uses legacy naming such as `room_analyses` in multiple places.
- Multi-provider routing is now available and validated across the Phase 0 spike path, and the context-brain + real-critic pattern now covers both Diagnosis and Concept Director.
- Diagnosis-first naming cleanup still needs to happen in app language and storage naming where practical.
- Product sourcing and render planning now route to Anthropic by default, but neither has the same mature evaluator loop as Concept Director yet.
- Phase 0 is complete; the next meaningful delivery work is Phase 2 implementation and cleanup against PRD v2.

## Operational Notes
- `docs/AI_Interior_Atelier_PRD_v2.md` is intentionally local-only right now unless the owner says otherwise.
- Supabase CLI was not available in the local shell during this session. The live schema was updated through the repo's GitHub Actions migration workflow instead.
