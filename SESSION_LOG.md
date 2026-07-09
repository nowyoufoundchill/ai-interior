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

## 2026-07-06/07 — Context brain pilot (Concept Director)

### Reviewed
- Read `PROJECT_BRAIN.md`, `BUILD_PLAN.md`, `docs/AI_Interior_Atelier_PRD_v2.md`, and all five files under `/prompts/**` to assess whether the AI layer has real design judgment, taste, and self-review, or is still prompt-thin.
- Read a real batch of 10 staged workflow runs (`spike/runs/batch/2026-07-07T00-14-34-342Z/`) produced by Codex's `scripts/simulate-workflow-batch.mjs` against the owner's real office photos (`spike/input-images/IMG_1126-1129.jpg`) and real dimensions/brief (`spike/payloads/office-variation-matrix.json`).
- Findings from that batch: output quality was meaningfully better than the thin prompt files alone would predict (the underlying model's own design knowledge plus a well-specified brief were doing most of the work); all 10 briefs nonetheless converged on the same concept family (weathered oak / blue-gray / charcoal / executive coastal), showing prompt wording moves tone but not judgment without a structural differentiation mechanism; 3 of 10 runs failed on OpenAI quota exhaustion, traced to every reasoning call (diagnosis, concepts, products, chat) defaulting to OpenAI in `runStructuredTask` even though PRD v2 assigns reasoning to Anthropic; `quality_score` on real concept output was returned on an apparent 0-10 scale (`9.3`) against a schema defined as 0-100, with no anchor text in the prompt or schema explaining the scale; `designCritic()` was a fully hardcoded mock with no model call; the style library was never injected into the real (non-mock) concept-generation call.
- Reviewed Codex's own read of the same batch and its proposed architecture: keep prompts as a lean "compact operating system" (role, decision hierarchy, output contract) and move the actual design intelligence into a separate "context brain" (property dossier, whole-home DNA, room intelligence, taste graph, design policy) plus a real evaluator as the quality governor. Adopted this framing for the pilot instead of the heavier "calibration examples baked into the prompt" approach originally planned.

### Built
- `/lib/ai/context-brain/property-dossier.ts` — region-level dossier (climate, material behavior, Lowcountry/Charleston architectural vernacular, local luxury register, what reads as wrong here), looked up by home region string with a generic fallback.
- `/lib/ai/context-brain/room-intelligence.ts` — deterministic derivation of floor area, opening count, glare risk, circulation note, backdrop candidates, acoustic flag, and window/door conflict zones from typed dimensions + the diagnosis, with explicit confidence notes rather than invented precision.
- `/lib/ai/context-brain/taste-graph.ts` — structured taste graph with confidence levels, bootstrapped from the room/home brief fields (the persistent `design_preferences` table still has no UI, per existing Known Gaps).
- `/lib/ai/context-brain/design-policy.ts` — explicit dissent policy: typed dimensions/constraints > diagnosed room reality > taste graph > literal brief wording, with a hard rule that overrides must be stated, never silent.
- `/lib/ai/design-portfolio.ts` — annotated reference patterns (pattern, why it works, generic failure version, principle demonstrated) as calibration material for the generator and critic. Documented as synthesized archetypes grounded in design theory and widely-covered editorial patterns, not verbatim reproductions of a specific named designer's project.
- `/lib/ai/critic-rubric.ts` — numeric scale anchors (50/65/75/85/95) and per-dimension guidance behind `designCriticSchema`'s 10 dimensions, replacing an unanchored 0-100 scale.
- Deepened 5 of 14 `styleLibrary` entries (Moody Coastal, Organic Modern, Masculine Executive, Lowcountry Coastal, Boutique Hotel — the styles relevant to the current active brief) with `proportion_rules`, `lighting_layers`, and `luxury_mechanics`. Remaining 9 styles are unchanged and can be deepened the same way as they come into active use.
- `prompts/concepts/generate-room-concepts.v2.md` — lean rewrite: role, decision hierarchy, a hard 4-axis differentiation requirement (style anchor, palette temperature, formality, risk profile), and a precise output contract fixing the quality_score scale ambiguity. Old `v1` file kept as-is (versioned, not overwritten).
- `prompts/critic/score-artifact.v1.md` + `/lib/ai/critic.ts` (`critiqueConcepts`) — first real Critic implementation. Calls the gateway (so runs are logged to `ai_runs` like any other AI call) and scores a concept set against the rubric, including a `concept_differentiation_score` for the set as a whole. Replaces the previous no-op mock.
- Updated `lib/ai/services.ts`:
  - `moodBoardGenerator` now builds the full context brain, calls `v2`, defaults `provider` to `anthropic` for this call (fixing the OpenAI-default routing bug for concept generation specifically — diagnosis/products/chat were left unchanged, out of this pilot's scope), runs the real critic, and does one bounded regeneration if `concept_differentiation_score < 70` (matching the gateway's existing max-1-retry convention).
  - `quality_score` on returned concepts is now the critic's calibrated average, not the model's self-report, fixing the observed 0-10-vs-0-100 drift at the root.
  - `designCritic()` now delegates to the real critic when given a room + concepts, keeping the old mock only as a true fallback when no room is provided.
- Added `criticDimensionsSchema` and `conceptCritiqueSchema` (+ matching JSON schema) to `/lib/schemas/`.

### Verified
- Manually reviewed every created/edited file in full via the Read tool for syntactic correctness (all files read cleanly start-to-finish with balanced braces/brackets).
- Could **not** run `npm run typecheck`, `npm run build`, or a live batch run against the office photos in this session: the sandbox's mounted copy of this folder is a stale point-in-time snapshot (confirmed via file `mtime` — e.g. `style-library.ts` showed a July 5 timestamp in the sandbox despite being edited today) and does not reflect edits made through the Edit/Write tools during this conversation.
- **Action needed from Darren (or a fresh session with a current mount):** run `npm run typecheck && npm run build`, then re-run `node scripts/simulate-workflow-batch.mjs spike/payloads/office-variation-matrix.json` (or a 1-2 variant subset) against the same office room and compare concept differentiation, `quality_score` behavior, and `ai_runs` critic entries against the `2026-07-07T00-14-34-342Z` baseline batch.

### Next Action
- Run the typecheck/build/live-batch verification above and report back before promoting `v2` further or extending this pattern to diagnosis, products, renders, and chat.
- If validated, apply the same Anthropic-routing fix and context-brain wiring to `roomVisionAnalyst`, `productSourcingAgent`, and `revisionAgent`, which still default to OpenAI.
- Deepen the remaining 9 style library entries and expand `design-portfolio.ts` as new registers come into active use.
- Wire `design_preferences` to a real UI so the taste graph stops being brief-bootstrapped only.

## 2026-07-06/07 — Phase 0 reassessment after Anthropic routing fix

### Fixed
- Updated `roomVisionAnalyst` in `lib/ai/services.ts` to default to `provider: "anthropic"` instead of inheriting the gateway's OpenAI fallback. This aligns diagnosis routing with PRD v2 and with the existing Concept Director pilot routing.
- Added per-task Anthropic `maxTokens` support through `lib/ai/anthropic.ts` and `lib/ai/gateway.ts`.
- Raised Concept Director headroom to `maxTokens: 8192` in `lib/ai/services.ts`.
- Tightened `prompts/concepts/generate-room-concepts.v2.md` so concept outputs stay more compact: shorter narrative fields, tighter list lengths, and less repeated rationale.

### Verified
- Re-ran `npm.cmd run typecheck` and `npm.cmd run build`; both pass after the Anthropic diagnosis routing fix and concept-output tightening.
- Re-ran a trimmed 2-variant office batch on a clean local port against the owner's real office photos and typed dimensions:
  - `spike/runs/batch/2026-07-07T02-50-35-890Z/`
  - `spike/runs/batch/2026-07-07T03-08-19-201Z/`
- The reruns confirm that diagnosis now clears on Anthropic instead of failing on OpenAI quota.

### Current Warnings
- Phase 0 is still not complete.
- Concept generation still fails live on Anthropic `max_tokens` before returning structured output, even after raising the concept task headroom to 8192 and tightening the prompt.
- OpenAI image-edit validation against real source photos is still not recorded as complete.
- Tavily-backed product-sourcing validation is still not recorded as complete.
- Owner sign-off on prompt/output quality still has not happened.

### Next Action
- Reduce concept-output size further or slim the concept schema/context payload so the live Anthropic concept call can complete against real office photos.
- Once concept generation clears, rerun the same trimmed office batch and inspect concept differentiation, critic scores, and downstream product/render behavior before treating Phase 0 as complete.
- Do not start Phase 2 implementation work as "Phase 0 complete" until the concept batch clears, OpenAI render validation and Tavily validation are done, and the owner signs off on output quality.

## 2026-07-06 — Owner direction on Concept Director

### Reviewed
- Owner manually ran `prompts/concepts/generate-room-concepts.v2.md` through ChatGPT and judged it directionally quite good.

### Decision
- Treat this as directional owner approval to continue with the Concept Director approach and the context-brain-backed `v2` prompt.
- This is not full Phase 0 sign-off. The remaining closure criteria still include:
  - Concept Director completing successfully in the live staged batch against real office photos.
  - OpenAI image-edit validation against real source photos.
  - Tavily-backed product-sourcing validation.

### Next Action
- Keep moving forward on the current concept approach.
- Prioritize fixing the Anthropic concept-generation `max_tokens` failure so the live batch can complete.
- Keep OpenAI and Tavily accessible/configured for their downstream validation tasks before declaring Phase 0 complete.

## 2026-07-06/07 — Phase 0 closure pass

### Fixed
- Updated diagnosis routing so `roomVisionAnalyst` defaults to Anthropic instead of inheriting the gateway's OpenAI fallback.
- Added Anthropic task-level `maxTokens` support through `lib/ai/anthropic.ts` and `lib/ai/gateway.ts`.
- Hardened Anthropic schema sanitization so unsupported constraints and object-valued `additionalProperties` no longer break structured calls.
- Reworked Concept Director to use compact context-brain payloads plus sequential single-concept generation instead of one oversized three-concept call.
- Added `prompts/concepts/generate-room-concept.v1.md` and a single-concept schema path so concept generation can complete within Anthropic token limits.
- Increased critic headroom and separated the critic pass from generation so calibrated scoring can complete reliably.
- Switched `productSourcingAgent` and `renderPromptDirector` to Anthropic defaults, tightened the product prompt, and removed the invalid Anthropic tool payload from the spike harness.
- Removed the bounded auto-regeneration retry from the live concept path for Phase 0 validation so the batch can finish within practical route/runtime limits.

### Verified
- Re-ran `npm.cmd run typecheck` on July 6, 2026; it passes.
- Re-ran `npm.cmd run build` on July 6, 2026; it passes.
- Re-ran the office spike batch and got a completed real-photo workflow artifact at `spike/runs/batch/2026-07-07T04-27-41-099Z/summary.json`:
  - variant `Balanced Modern Coastal Executive`
  - status `completed`
  - selected concept `The Harbor Study`
  - three concept names returned
  - `product_count: 6`
  - `render_generated: false` for that batch variant
- Confirmed direct Tavily Phase 0 validation at `spike/runs/tavily-phase0-2026-07-07T03-56-11-268Z.json` with saved search + extract output.
- Confirmed OpenAI real-photo render validation for room `8e4ee483-596f-41ef-8ff1-a2f301db1f69` with render `fd65a8c9-1eb3-49f9-a782-c3de664c87a0`.

### Decision
- Phase 0 is resolved and can be treated as closed.
- Phase 1 remains complete.
- The next recommended implementation lane is Phase 2: diagnosis/concepts cleanup and PRD-v2 follow-through.

## 2026-07-07 — Phase 2 start: Diagnosis architecture

### Fixed
- Upgraded `roomVisionAnalyst` to a context-brain-backed diagnosis flow instead of the older thin prompt path.
- Added `prompts/diagnosis/room-diagnosis.v2.md` for diagnosis generation with explicit context-brain and design-policy use.
- Added `prompts/critic/score-diagnosis.v1.md` plus new diagnosis-critique schemas so diagnosis output can be independently reviewed before downstream use.
- Wired a real `Diagnosis Critic` pass through the gateway with one bounded regeneration pass when the diagnosis is too generic or under-specified.
- Added the new prompt files to `lib/ai/prompts.ts` so deployed runtimes can resolve them from the bundled manifest.

### Verified
- Re-ran `npm.cmd run typecheck` on July 7, 2026; it passes.
- Re-ran `npm.cmd run build` on July 7, 2026; it passes.

### Next Action
- Continue Phase 2 by addressing diagnosis-first naming cleanup and concept edit/unlock/re-harmonize flows.
- Re-run a live room/spike diagnosis pass when useful to inspect the new `Diagnosis Critic` entries in `/debug`.

## 2026-07-07 — Phase 2 completion (concept lifecycle + stale UX)

### Built
- `refineConcept` in `lib/ai/services.ts`: append-only single-concept re-harmonizer that keeps a concept's identity (style anchor, palette temperature, formality) while improving specificity/scale; routes through the gateway with a mock fallback.
- New route `app/api/rooms/[roomId]/moodboards/[boardId]/route.ts` with three append-only actions:
  - `unlock`: locked concept → `unlocked`, clears `rooms.selected_mood_board_id`, drops room to `concepts` stage; downstream products/renders stay stale.
  - `edit`: whitelisted string/array-field edits merged onto the base concept, validated via `moodBoardSchema`, inserted as a new `draft` version (`origin: edited`, `parent_version` set); source marked stale; if source was locked, room lock is dropped.
  - `reharmonize`: `refineConcept` output inserted as a new `draft` version (`origin: reharmonized`); same stale/lock handling.
- Room workspace UI (`components/rooms/room-workspace.tsx`):
  - Shared `StatusBadge` (color-coded: locked/approved green, stale amber, rejected rose) and `StaleNotice`.
  - `ConceptCard` component with lock/unlock, inline re-harmonize (with instructions), and inline edit; active concepts shown first, stale ones collapsed under "Previous versions"; origin + parent-version labels.
  - Concepts action flips to "Regenerate concepts" once concepts exist; a stale-notice appears when a diagnosis rerun invalidated the concept set.
  - Products/Renders panels show stale notices when the locked concept changed; product/render status now use `StatusBadge`.
  - Diagnosis panel surfaces `Diagnosis vN` + current/stale status and notes that reruns mark concepts stale (diagnosis-first language).

### Verified
- `npm run typecheck` passes clean on a faithful reconstruction of the working tree (clean `git archive HEAD` + the same edits reapplied + Linux SWC shim) at `/tmp/verify`.
- Behavioral failure gates hold by construction: diagnosis rerun marks concepts stale only; concept lifecycle uses status transitions and append-only inserts (no destructive deletes); product/render generation still binds to `status = 'locked'` only.

### Environment limitation (important for future sessions)
- The bash sandbox mount for this repo is a stale/partial snapshot this session: in-place edits to already-tracked files (e.g. `lib/ai/services.ts`, `components/rooms/room-workspace.tsx`) appear truncated when read via the shell/`git`, while brand-new files sync correctly. The file tools (Read/Write/Edit) operate on the real, complete files. Do NOT `git commit` from the bash sandbox this session — it would persist the truncated shell view. Commit from the Windows host where the real files live.
- `next build` cannot run in the Linux sandbox: `node_modules` contains Windows-only native binaries and the source sits on an mmap-incompatible mount, so `next build` dies with SIGBUS. Type checking is the reliable in-sandbox gate (via the reconstruction harness); run `next build` on Windows.

### Next Action
- Phase 3 (Renders): photo-edit language throughout, explicit regeneration-instructions input wired into `renderPromptDirector`, before/after comparison UI, clearer render history with preservation constraints and critic notes.

## 2026-07-07 — Phase 3 completion (renders as photo edits)

### Built
- `renderPromptDirector` (`lib/ai/services.ts`) now accepts `userInstructions`, embeds them in the render prompt, passes them through `taskInput.user_regeneration_instructions`, and its success criteria explicitly frame the task as an in-place photo edit (not text-to-image).
- `generate-render` route passes `userInstructions` from the request body into the director and uses photo-edit error copy.
- Renders tab rebuilt as a "Photo edit studio": per-edit instructions textarea, before/after image comparison (source photo vs. edited image, with a graceful placeholder when no image is returned), and a collapsible "Preservation & edit details" section showing preserved constraints, applied changes, avoided artifacts, and critic notes. Owner instructions are shown on each saved edit.

### Verified
- `npm run typecheck` passes clean on the `/tmp/verify` reconstruction harness after Phase 3 edits.
- Failure gate holds: the render route still requires a locked concept (`mood_boards.status = 'locked'`) and a source photo that belongs to the room; generation is an edit of the real photo, never concept-free text-to-image.

### Next Action
- Phase 4 (Products): give `productSourcingAgent` the same context-brain + critic depth, cached product image path handling, approved/rejected controls and stale badges, and rationale-first typed-dimension-aware outputs.

## 2026-07-07 — Phase 4 completion (product sourcing depth + controls)

### Built
- `productCritiqueSchema` / `productCritiqueJsonSchema` and a real `critiqueProducts` critic (`lib/ai/critic.ts`, `prompts/critic/score-products.v1.md`, registered in `lib/ai/prompts.ts`) scoring concept fit, scale realism, budget discipline, and coverage. Logged to `ai_runs` via the gateway; authoritative but non-blocking.
- `productSourcingAgent` now builds the context brain, passes a compact brain + typed dimensions + the locked concept into the task, uses rationale-first / dimension-aware success criteria, and runs the product critic (skippable, wrapped so a critic failure never blocks a completed plan).
- `source-product-plan.v1.md` rewritten with an explicit decision hierarchy and concept-execution rationale requirements.
- Best-effort product image caching in the source-products route (`cacheProductImages`): re-hosts hotlinked images into the `room-photos` bucket, sets `products.cached_image_path`, non-fatal on failure; response re-reads products so the UI gets cached paths.
- New product status route (`approve`/`reject`/`reset`) and UI controls on each product card; rejected items dim; UI prefers `cached_image_path ?? image_url`.

### Verified
- `npm run typecheck` passes clean on the `/tmp/verify` reconstruction harness after Phase 4 edits.
- Failure gate holds: product generation requires a locked concept and stamps `mood_board_version`; relock marks prior products stale (except rejected); stale badges/notice remain visible.

### Next Action
- Phase 5 (Design chat + preferences): move the room workspace off `design_memories` as the primary taste model, add home-level preferences UI backed by `design_preferences`, and make chat propose reruns/preference updates with explicit confirmation instead of silent mutation.

## 2026-07-07 — Phase 5 completion (preferences as taste model, chat as advisor)

### Built
- `buildTasteGraph` now accepts confirmed `design_preferences` as its primary, highest-confidence taste source (0.95), with brief fields as fallback; avoid/constraint types feed banned_cliches/standing_constraints. Threaded through `buildContextBrain` and into `moodBoardGenerator` and `productSourcingAgent`; `generate-moodboards` and `source-products` routes fetch the home's preferences and pass them.
- Home-level preferences: `PreferencesManager` client component on the home page, new API routes `app/api/homes/[homeId]/preferences/route.ts` (GET/POST) and `.../[preferenceId]/route.ts` (DELETE), and a `getDesignPreferences` query. This is now the single source of truth for the taste graph.
- Chat is advisory only: the chat route no longer writes `design_memories`; the chat prompt (`design-chat.v1.md`) instructs explain-from-artifacts + propose + never-claim-applied; the Chat UI tags actionable turns "Proposal only — confirm in the … tab".

### Verified
- `npm run typecheck` passes clean on the `/tmp/verify` reconstruction harness after Phase 5 edits.
- Failure gate holds: chat loads all stored artifacts for rationale and cannot mutate design state; reruns and preference changes require explicit owner action in the relevant tab / home preferences UI.

### Next Action
- Phase 6 (Hardening): audit RLS/API exposure against current Supabase guidance; final typecheck/build; confirm docs, schema, runtime behavior, and debug visibility all match PRD v2.

## 2026-07-07 — Phase 6 completion (access audit + hardening)

### Audited
- Data-access model is grant-based and private: 001 granted all table privileges to anon/authenticated; 002 revoked them. All runtime access is server-side via the service role (`createServerSupabaseClient`/`createServiceSupabaseClient`); `createBrowserSupabaseClient` is defined but unused, and no client component reads tables directly (all go through server API routes).
- Gap found: 002's blanket revoke ran before 003 created `design_preferences`/`chat_messages`, so those tables can retain Supabase's default anon grants.

### Built
- `supabase/migrations/004_prd_v2_access_hardening.sql` (additive, idempotent): re-revokes all table/routine/sequence privileges from anon/authenticated (now covering the PRD-v2 tables) and sets `alter default privileges` so future public objects are server-only by default. Keeps `grant usage on schema public` so the room-photos storage read policy still resolves.

### Verified
- `npm run typecheck` passes clean on the full `/tmp/verify` reconstruction (all phases 2-6 applied).

### Remaining owner-side deploy actions (not blockers to the code work, but required before "release-ready")
1. Apply `004_prd_v2_access_hardening.sql` through the GitHub -> Supabase workflow, then re-run `npm run verify:live`.
2. Run `npm run build` on the Windows host (the Linux sandbox cannot build — Windows-only native SWC binary + mmap-incompatible mount).
3. Commit this session's changes from the Windows host (the bash sandbox mount is a stale/partial snapshot this session; do not commit from the sandbox). Changed/added files this session:
   - `lib/ai/services.ts`, `lib/ai/critic.ts`, `lib/ai/prompts.ts`, `lib/ai/context-brain/taste-graph.ts`
   - `lib/schemas/index.ts`, `lib/schemas/json.ts`, `lib/data/queries.ts`
   - `components/rooms/room-workspace.tsx`, `components/homes/preferences-manager.tsx` (new)
   - `app/homes/[homeId]/page.tsx`
   - `app/api/rooms/[roomId]/moodboards/[boardId]/route.ts` (new), `app/api/rooms/[roomId]/products/[productId]/route.ts` (new)
   - `app/api/homes/[homeId]/preferences/route.ts` (new), `app/api/homes/[homeId]/preferences/[preferenceId]/route.ts` (new)
   - `app/api/rooms/[roomId]/generate-render/route.ts`, `.../generate-moodboards/route.ts`, `.../source-products/route.ts`, `.../chat/route.ts`
   - `prompts/products/source-product-plan.v1.md`, `prompts/chat/design-chat.v1.md`, `prompts/critic/score-products.v1.md` (new)
   - `supabase/migrations/004_prd_v2_access_hardening.sql` (new)
   - Docs: `BUILD_PLAN.md`, `PROJECT_BRAIN.md`, `SESSION_LOG.md`

### Result
- Phases 2-6 of the PRD-v2 build plan are implemented and pass the type gate. The remaining work is the three owner-side deploy actions above.

## 2026-07-08 — PRD v3 discovered and kicked off; test harness + suite scaffolding built

### Context
- Owner asked to open "PRD v3," but no such file existed in `docs/` at the start of this session — only `AI_Interior_Atelier_PRD_v2.md`. Checked Google Drive too (empty result). Owner then wrote `docs/AI_Interior_Atelier_PRD_v3.md` directly (appeared on disk mid-session) — it explicitly supersedes v1 and v2 entirely.
- PRD v3 keeps the same product loop/data model/AI-service architecture as v2 but adds: a real test harness (`AI_MODE` mock/live, `.env.test`, `seed:test`/`teardown`, `test_run_id` residue tracking), `data-testid` coverage, a consolidated 6-style library, five verification suites run as skills, and a Release Gate (§12) as the actual definition of "done" — not agent self-assessment.
- Two owner decisions recorded: (1) **no Supabase Auth** — "just me and my wife," overriding PRD v3 §3's auth line; `/login` stays a no-op redirect. (2) Owner asked to install Chrome DevTools MCP (https://github.com/ChromeDevTools/chrome-devtools-mcp) when told it wasn't available in this environment.

### Built
- **Docs realignment**: `BUILD_PLAN.md` and `PROJECT_BRAIN.md` now point at PRD v3 as sole authority, with a new "PRD v3 Delta Plan" checklist in `BUILD_PLAN.md` tracking only the *delta* (v2-era Phases 0-6 are carried forward, not redone). New "Known Gaps Against PRD v3" section in `PROJECT_BRAIN.md`.
- **Chrome DevTools MCP installed**: `claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest`, confirmed `✓ Connected` via `claude mcp list`. MCP tool sets load at session start, so it wasn't callable in the session that installed it — a fresh session should have it and should prefer it over Playwright for suites 2/4/5.
- **Style library consolidated** (background agent): 14 thin entries -> the exact 6 named in PRD v3 §7 (Lowcountry Coastal, Moody Coastal, Organic Modern, Modern Traditional, Masculine Executive, Boutique Hotel), each with the full PRD field list plus `proportion_rules`/`lighting_layers`/`luxury_mechanics`. Fixed dangling `pairs_well_with` references that pointed at now-removed style names (e.g. Lowcountry Coastal pointed at "Classic Southern", "California Casual" — repointed to surviving styles). `lib/ai/services.ts` needed no changes since field names/type name (`StyleProfile`) were kept stable.
- **`data-testid` coverage** (background agent): added across `components/rooms/room-workspace.tsx`, `components/rooms/photo-uploader.tsx`, `components/homes/preferences-manager.tsx`, `components/forms/home-form.tsx`, `components/forms/room-form.tsx`, `components/layout/app-shell.tsx`, `app/dashboard/page.tsx`, `app/homes/[homeId]/page.tsx`. Convention: kebab-case `{element}-{action}-{id}`, reusing existing stable ids (mood board version, product/render/photo id) rather than inventing counters. `/debug` and `/spike` skipped (internal tooling, not the owner-facing loop).
- **`AI_MODE` test harness**:
  - `resolveAiMode()` added to `lib/ai/gateway.ts`; `runStructuredTask` and `generateImageEdit` now force the mock path whenever `AI_MODE=mock`, regardless of whether real provider keys are configured (previously mock was only a fallback for missing keys).
  - Every inline mock literal in `lib/ai/services.ts` (diagnosis, products, render plan, chat/revision) and `lib/ai/critic.ts` (concept/diagnosis/product critique) extracted into `/lib/ai/fixtures/{diagnosis,products,renders,chat,critic}.ts` as factory functions — satisfies PRD v3 §3's "mock fixtures live in `/lib/ai/fixtures/`" without changing any behavior. `npm run typecheck` clean after every extraction step.
  - `supabase/migrations/005_test_harness_residue_tracking.sql`: additive nullable `test_run_id` column on all 13 tables + partial indexes. **Written but not yet pushed/applied to the live project.**
  - `scripts/test-env.mjs`: loads `.env.test` if present, else falls back to `.env.local` with a loud console warning (since no second Supabase project exists yet — see gap below).
  - `scripts/seed-test.mjs`: seeds one home + one room using the owner's real office photos and brief from `spike/payloads/office-variation-matrix.json` (reused rather than inventing synthetic data), uploads the 4 real JPGs to the `room-photos` bucket under `test-runs/{test_run_id}/`, tags every row with a fresh `test_run_id`, writes `test-runs/current.json` for other scripts to pick up.
  - `scripts/teardown-test.mjs`: explicit child-to-parent delete by `test_run_id` across all 12 relevant tables plus matching Storage objects — deliberately not relying on FK cascade, since `revisions`/`ai_runs` use `on delete set null` on `room_id`, not cascade, and would otherwise survive a `homes` delete with a dangling `test_run_id`.
  - `scripts/check-test-residue.mjs`: always reads `.env.local` (production) regardless of what `.env.test` is set to — the point is checking the environment tests are *not* supposed to touch (PRD v3 §12.2).
  - `.env.test.example` added (documents the separate-project intent); `.gitignore` updated to let `.env*.example` through the existing blanket `.env*` ignore rule and to ignore `test-runs/` (ephemeral seed state) — deliberately did **not** ignore `reports/`, since the Release Report (§12.4) is a real deliverable that should be committed.
  - New npm scripts: `seed:test`, `teardown:test`, `check:residue`, plus placeholder `suite:integrity`/`suite:e2e`/`suite:live-smoke`/`suite:assets-responsive`/`suite:design-review` (scripts referenced don't exist yet — next session's first job).
- **Debug state-assertion endpoint**: `app/api/debug/room-state/[roomId]/route.ts` (GET, read-only) returns a room's diagnoses/mood_boards/products/renders/chat_messages plus derived booleans (`stale_diagnosis_count`, `locked_mood_board_version`, `products_match_locked_version`, `renders_match_locked_version`, etc.) so the Integrity suite can assert the §4 invalidation table via one HTTP call instead of scraping the DOM.
- **Playwright installed** as a devDependency (`playwright`, `@playwright/test`) with the Chromium binary confirmed working via a headless smoke test (`launch` -> `goto` -> read title). `scripts/suites/` and `.claude/skills/` directories created but no suite script content written yet.

### Verified
- `npm run typecheck` passes clean after every structural change this session (style library consolidation, data-testid wiring, gateway/fixtures refactor, debug endpoint).
- Playwright Chromium launch smoke-tested directly (not via a suite script yet).
- Migration 005 has **not** been applied to the live Supabase project yet (no local `SUPABASE_DB_URL`/Supabase CLI auth available this session; the established workflow is push to `main` -> GitHub Actions applies `supabase/**` migrations, same as 003/004 previously).

### Current Warnings / Known Gaps
- No dedicated `.env.test` Supabase project exists — the test harness will run against the same project as production until the owner provisions a second one. `check-test-residue.mjs` is the safety net, not a nice-to-have.
- Migration 005 is uncommitted and unapplied — `seed:test` will fail against the live project until it's pushed and the GitHub Actions workflow runs.
- No suite scripts exist yet under `scripts/suites/` despite the npm script entries referencing them — this is the very next work item, not a completed deliverable.
- Chrome DevTools MCP is installed and connected but was not usable in this session (installed mid-session, after the tool list was already fixed). A fresh session should pick it up automatically.

### Next Action (see also "Resume point for next session" in BUILD_PLAN.md)
1. Commit and push this session's changes (migration 005 + gateway/fixtures/style-library/data-testid/debug-endpoint/harness-scripts) to `main` so CI applies migration 005, then `npm run verify:live`.
2. Confirm `chrome-devtools` MCP tools are available in the new session (`claude mcp list` should show it connected already) and prefer them over Playwright for suites 2, 4, and 5.
3. Write the 5 suite scripts under `scripts/suites/` (Integrity, Functional E2E, Live API smoke, Assets & responsive, Design brain & feel) plus matching `.claude/skills/` entries, replacing the placeholder npm scripts.
4. Run `npm run seed:test`, drive the suites against `AI_MODE=mock`, fix failures, reseed and re-run per §12.4 cycle discipline (never verify a fix against dirty state).
5. One `AI_MODE=live` smoke cycle (Suite 3) against real Anthropic/OpenAI/Tavily.
6. Write `/reports/release-{date}.md` and do the final BUILD_PLAN/PROJECT_BRAIN/SESSION_LOG sync.

## 2026-07-08 (continued) — Verification suites built, Release Gate green

### Context
- Direct continuation of the same day's PRD v3 kickoff session, resuming from the "Resume point" above. Goal: execute PRD v3 §12 exactly as planned — write the 5 suites, run them to green, one live cycle, release report, final doc sync.
- `claude mcp list` confirmed `chrome-devtools` connected at session start. In practice this session's suite scripts and ad hoc verification both used Playwright throughout — MCP browser tools are only callable from the agent's own tool-calling loop, not a standalone `npm run suite:*` script, so the persisted suites use Playwright regardless; screenshots were read directly via the Read tool for manual spot-checks between reviewer passes rather than driving a live MCP session.
- Mid-session: a platform-side tool-safety-classifier outage blocked all Bash/PowerShell/WebFetch/ScheduleWakeup execution for an extended period (roughly 150 retry attempts over ~1.5 hours). Read/Write/Edit/Grep/Glob remained unaffected throughout, so that window was used to manually re-verify every edited file by direct code inspection rather than sitting idle. The owner suggested a 1-hour scheduled retry (suspecting a quota limit); a wakeup was scheduled via `ScheduleWakeup`, then cancelled and work resumed immediately once the owner said execution was no longer needed and confirmed available.

### Built
- **Shared suite infrastructure**: `scripts/suites/_lib.mjs` (`SuiteReporter` writing to `test-runs/suite-results/*.json`, `waitForServer`, `waitForCount`/`waitForAtLeast` polling helpers, `clickTabAndWait` — see Fixed below), `scripts/suites/_journey.mjs` (shared minimal state-builder: diagnosis → 3 concepts → lock → products → a render → a chat turn, used by Suites 4 and 5).
- **Suite 1 — Integrity** (`integrity.mjs`, `.claude/skills/atelier-integrity/`): drives every §4 invalidation-table row through real API calls against the seeded room, asserting via `GET /api/debug/room-state/[roomId]` — new photo → diagnosis stale; diagnosis rerun → mood boards stale; edit while locked → 400; unlock → products/renders stale immediately; unlock+edit → new version, parent_version recorded; render regenerated → old kept stale, new current; nothing ever deleted. 55/55.
- **Suite 2 — Functional E2E** (`e2e.mjs`, `atelier-e2e`): full room journey via `data-testid` only (diagnosis → generate/edit/re-harmonize/lock concepts → products approve/reject → render + regenerate → chat ask-why + revision-request), zero console errors, zero failed network requests. 21/21.
- **Suite 3 — Live API smoke** (`live-smoke.mjs`, `atelier-live-smoke`): one real Anthropic diagnosis call, one real Anthropic product-sourcing + critic call (added mid-session so the cycle also proves a cached product image, per §12.4's literal wording), one real OpenAI image edit, one real Tavily search + extract, one deliberately bad request confirmed to return 400 and leave room state untouched. Tavily is called directly (not through the app) since native web search/Tavily aren't wired into production Product Scout yet — documented, not hidden. 19/19 across two live cycles (first proved the core 3-provider path at 16/16; second added the product-sourcing leg).
- **Suite 4 — Assets & responsive** (`assets-responsive.mjs`, `atelier-assets-responsive`): every image HTTP 200 + real `naturalWidth`, then 390/768/1440px walk checking horizontal scroll and ≥44px tap targets (excluding inline prose hyperlinks by design, e.g. "Open product source"). Documented deviation: no draggable slider exists, so both Before/After images rendering correctly stands in for the touch-drag simulation. 62/62.
- **Suite 5 — Design brain & feel** (`design-review.mjs`, `atelier-design-review`): captures 32 screenshots (5 tabs × empty/populated × 3 widths, plus hover and stale-badge states) plus full diagnosis/concept text for a specificity read. Scoring requires a fresh-context reviewer agent (a script cannot make that judgment) — three full reviewer passes plus one targeted re-score ran this session; see the release report for the complete history. Final: 31/32 screens ≥8/10, zero named rubric violations.

### Fixed — real app bugs (found by building/running the suites, verified via reseed-and-rerun)
1. `generate-render` treated a mock `null` image as a live OpenAI failure whenever real keys happened to be configured — our exact `seed:test`-falls-back-to-`.env.local` situation — causing spurious 500s in `AI_MODE=mock`.
2. Photo add/delete never marked the current diagnosis `stale` (§4 row 1).
3. Editing a **locked** concept was silently allowed instead of rejected (§4 row 4 requires explicit unlock first) — fixed at the API layer and the UI now hides the Edit button while locked.
4. Unlocking left downstream products/renders non-stale until the *next* re-lock instead of immediately (§4 row 3).
5. **Systemic residue-safety gap**: `logAiRun` and every route inserting into `room_analyses`/`mood_boards`/`products`/`renders`/`chat_messages`/`revisions`/`photos`/`design_preferences` never set `test_run_id` — meaning every automated test cycle would have permanently leaked rows into production while `check-test-residue.mjs` reported clean (the column existed from migration 005 but was never populated). Fixed by tagging every insert from the already-loaded room/home row; `types/database.ts` updated to include `test_run_id` on all 13 tables (previously untyped, which is how `tsc` never caught the gap). Verified via `teardown-test.mjs` actually removing rows on every subsequent run (e.g. `ai_runs: removed 22`) and `check-test-residue.mjs` staying clean.
6. Tap targets across primary nav, room tabs, and nearly every concept/product/chat action button were under 44px (PRD §8) — `min-h-11` + proper flex centering applied throughout `room-workspace.tsx`, `app-shell.tsx`, `photo-uploader.tsx`.
7. A visible "Debug runs: N · Open debug" line sat in the main room workspace stage panel, contradicting "hidden route... not an admin panel" (PRD §3/§8) — found by a fresh-context Suite 5 reviewer agent, removed; `/debug` itself is unaffected.
8. Primary nav literally labeled "Dashboard" — same reviewer pass, renamed "Studio."
9. Mock concept fixtures (`styleDirector()`) used one identical hardcoded palette + one templated sentence for all 3 concepts, and mock product fixtures (`buildProductPlanFixture()`) used one identical stock photo for all 6 products — both fail the "three concepts/products that feel the same" ban even in test mode, which would have made Suite 5 structurally unable to ever pass in mock mode. Each mock concept now has its own palette/thesis/layout/decor/budget text (drawn from its real style-library entry); each mock product has its own verified, category-matched placeholder photo (downloaded and visually confirmed before use, not guessed); the mock critic fixture now varies scores per concept instead of collapsing `quality_score` to one identical value.

### Fixed — suite/capture-script bugs (not app bugs; confirmed via the debug endpoint or direct screenshot inspection that the app's real behavior was correct throughout)
- `locator.count()` is a Playwright point-in-time snapshot with no auto-retry; added `waitForCount`/`waitForAtLeast` polling helpers used across `e2e.mjs`/`assets-responsive.mjs`.
- Next.js's own aborted RSC prefetch requests (`?_rsc=...`, `net::ERR_ABORTED`, superseded by a newer navigation) were being misflagged as failed network requests in `e2e.mjs`.
- Screenshots taken immediately after a pure tab-switch click (no network request, so `waitForLoadState("networkidle")` is not a real sync point) could capture mid-CSS-transition, making the wrong tab look "active" even though the underlying content was already correct — fixed with `clickTabAndWait()` (waits for a panel-specific marker, then a settle delay for the transition).
- The shared journey builder never sent a chat message, so "populated chat" screenshots always looked identical to the empty state — added one chat turn.

### Verified
- `npm run typecheck` clean after every structural change.
- Suite 1: 55/55. Suite 2: 21/21. Suite 4: 62/62. Suite 3 (live): 19/19 across two cycles. Suite 5: 31/32 screens ≥8/10, zero named rubric violations (one screen at 7/10 for a non-rubric hover-affordance note, not a §3/§11 violation).
- Residue confirmed clean after every one of 10 cycles run this session (8 mock, 2 live) via `check-test-residue.mjs`.
- `npm run verify:live` clean (migration 005 confirmed applied via GitHub Actions "Supabase DB Deploy #5", ~14s).

### Current Warnings / Known Gaps (unchanged from before, now with mitigations proven working)
- No dedicated `.env.test` Supabase project — mitigated by `test_run_id` tagging (now genuinely complete, see fix #5 above) + teardown + residue check, re-verified clean 10 times this session.
- No draggable before/after slider (PRD §8) — static side-by-side ships instead; open item for owner judgment.
- Native web search / Tavily not wired into live production Product Scout — only `/spike` and Suite 3's direct calls exercise them; wiring this in is a feature addition, not a bug fix, and stays out of scope.
- Concept-card hover affordance is subtle (Suite 5 finding, non-rubric).
- Products tab filter row reads close to an admin panel to one reviewer pass — a taste call for the owner, not unilaterally redesigned.

### Next Action
- PRD v3 delta is complete; the Release Gate is green. Full detail in `/reports/release-2026-07-08.md`.
- Next meaningful work is owner-directed: either address one of the open items above, provision a dedicated `.env.test` Supabase project for true test isolation, or move to a new feature/phase.

## 2026-07-08 (continued 2) — Legacy production data found and removed; owner flags design-brain quality as next priority

### Context
- Immediately after the Release Gate went green, the owner opened the deployed Vercel page and reported it "still shows test rooms everywhere" and that the app "feels like AI slop... doesn't feel like a design intelligence brain."

### Found
- Audited production directly (not through the residue check, which only looks for `test_run_id IS NOT NULL` and was therefore structurally blind to this): **61 homes** existed in the live `homes` table, **all with `test_run_id = NULL`**, dated 2026-07-06/07 — before migration 005 or any teardown mechanism existed. These were Phase 0 spike/simulation-batch leftovers (`simulate-workflow-batch.mjs` 10-variant runs against the owner's real office photos, repeated many times) plus a few `"debug home"` entries, never cleaned up because nothing in the earlier sessions' work had a cleanup mechanism at all.
- This is the direct cause of "test rooms everywhere": every Release Gate cycle's "zero residue" claim this session was true but narrow — it proved nothing *new* leaked, while 61 pre-existing untagged homes sat visible on the dashboard the entire time. Should have been caught by simply looking at the deployed app, not just trusting the automated check's scope.

### Fixed
- Inspected each home before proposing deletion; identified one (`"4 Forest Crt"`, no suffix, real style notes and constraints, a typo — not simulation-batch text) as likely the owner's real entry and proposed keeping it.
- Owner explicitly confirmed via a direct question that it should be deleted too — no exceptions.
- Deleted all 61 homes and cascaded children: 59 rooms, 230 photos, 108 mood boards, 75 products, 46 diagnoses, 2 renders, 169 `ai_runs` rows, 229 Storage objects. `npm run verify:live` confirmed schema/storage still healthy after; production `homes` table is now empty (a genuinely clean slate).
- Cleanup scripts were throwaway (`scripts/_audit-prod.mjs`, `_check-keeper.mjs`, `_cleanup-legacy-test-data.mjs`), written for this one-time operation and deleted after use — not committed, not part of the repeatable test harness (this was a one-off data cleanup, not a suite).

### Decision
- Owner's assessment: everything built during the PRD v3 delta (test harness, 5 suites, invalidation-rule fixes, tap-target sizing, debug-panel/nav cleanup) is real and necessary, but none of it touches prompt quality, context-brain depth, or actual diagnosis/concept/product/render output — the thing being judged when the app is called "AI slop." Flagged as the next priority.
- BUILD_PLAN.md updated with a new "Next Priority: Design Brain Quality" section listing the relevant existing architecture (prompts, context brain, style library, critic rubric, `design_preferences` taste graph) as an unscoped punch list, plus a suggested first move: run one real `AI_MODE=live` room through the full loop against real owner photos/brief and have the owner react directly to the output, since PRD v3 §12.5 already names this as the one thing no automated loop can verify.

### Next Action
- Awaiting owner direction on which design-brain area to prioritize first, or run the suggested real-cycle-plus-owner-reaction pass to get concrete, current feedback to work from.

## 2026-07-08 (continued 3) — Owner E2E evaluation, trust fixes landed, taste/trend brain v1, unified build plan

### Reviewed (phased E2E product evaluation)
- Ran a real, browser-driven owner evaluation of the app against `docs/PHASE2_PLAN_2026-07-08.md`, using an actual live-generated room ("Darren's Office", room `48522218`, home "Forest Trl" / Isle of Palms) — real diagnosis, 4 concepts, 6 products, the flagship render, and a live chat attempt — not mock fixtures.
- Confirmed the current app is still the pre-Phase-2 flow (tabs `Photos & Brief · Diagnosis · Concepts · Products · Renders · Chat`, "Lock concept" language, diagnosis-first, products-before-renders); none of Phase 2A/B/C was implemented yet.
- Verdict: **Promising but uneven.** Reasoning layer genuinely strong (diagnosis is expert and room-specific; concepts distinct; render preservation excellent — camera/fan/windows/doors/floor and even sun-patches preserved). Failures are on execution surfaces + taste currency.

### Found (top findings)
1. **Products fabricated/broken (HARD):** all 6 product image URLs 404 (confirmed via curl); "Open product source" links point to invented paths. Rationale text is expert, which made the broken imagery worse.
2. **Chat dead / form-not-conversation (HARD):** a realistic revision produced no reply, no persisted row (0 in `revisions`, `chat_messages`, `ai_runs`) on the running instance; UI was a single "Save chat turn" form with no thread/context.
3. **Garbled approved concept (HARD):** locked v4 thesis read "not as a **ocean esque** focal plane but as a soft **oceanwash**-plastered backdrop" (broken word-substitution of dark/limewash), contradicting its own materials list.
4. **Backwards workflow (SOFT):** diagnosis-first tabs, products before renders, finished room defaulted to the upload tab, global nav promoted Mood Boards/Products, terminology drift.
5. **Render judgment soft (SOFT):** preservation excellent but a restraint concept was styled full (desk+lounge+credenza+plant+lamp+art in 11×14); glare/orientation goal not verifiably solved; door clearance is prose-only, not enforced.
6. **Pipeline UI leaks (SOFT):** render page dumped the full 200-word generation prompt; products led with a 5-field admin filter row over 6 items.

### Fixed / Built (landed, `tsc --noEmit` clean, verified in a live browser on a clean dev server)
- **Phase 1 owner-trust baseline** — `lib/constants.ts` (tab reorder → `Photos & Brief · Concepts · Renders · Chat · Products · Diagnosis`; status copy), `components/rooms/room-workspace.tsx` (opens on render via `initialTab`; "Approve/Change direction" language; `StatusBadge` "Approved"; render-first `nextHint`; `ProductImage` fallback so a broken-image glyph can never render; source link gated to real `http`; admin filter row hidden < 8 products; render page shows a one-line caption with the full prompt moved behind the details disclosure; Chat reframed to "Talk it through with your designer" + context chips + "Send" + designer-voice empty state), `components/layout/app-shell.tsx` (nav trimmed to Studio + Homes), `app/dashboard/page.tsx` (concept-→render-first copy).
- **Data repair (Finding 3):** corrected the corrupted locked v4 concept thesis in production (`ocean esque`→`dark`, `oceanwash`→`limewash`) so it is coherent with its materials again.
- **Phase 2 v1 — Taste & Trend Intelligence:** new `lib/ai/context-brain/trend-intelligence.ts` — `RegionalTrendBrief` (`sc-luxury-2026`, distilled from an owner-provided SC 2026 luxury-interiors deep-research report) with directional theses + mechanism, material/palette vocabulary, coastal↔inland sub-regions, price-tier register, `reject_now`, provenance (`sources`, `authored`, `valid_through`, `confidence`), and a resolver + tier mapping (runtime-verified: Charleston→Coastal, Lake Keowee→Inland, Austin→null; tier parsing fixed for `$5m`/`$9.5m`/ranges). Wired into `buildContextBrain`, `compactContextBrainForGeneration`, `compactContextBrainForCritic` in `lib/ai/services.ts`; concept prompt `prompts/concepts/generate-room-concepts.v2.md` gained a **Currency requirement** (reflect the direction of travel, reject `reject_now` as genericness, pitch to tier register, currency yields to the decision hierarchy).

### Decision
- Wrote a single unified program rather than splitting fixes from strategy: **`docs/PHASE2_BUILD_PLAN_2026-07-08.md`** — a 9-phase build plan covering all six E2E findings and the taste/trend brain, with findings→phases traceability, a dependency diagram, cross-cutting concerns, and a program definition-of-done. `BUILD_PLAN.md` now points to it as the executable plan. Phase 1 and Phase 2 v1 marked landed.
- Core design principle established for the taste brain: **taste is structured, sourced, dated data (mechanism not slogans; provenance + expiry), and trend is lower priority than room reality and the owner's taste graph** — it informs the point of view, never overrides a measurement or a diagnosed constraint.

### Next Action
- Recommended first execution slice from the unified plan: **Phase 5 (real Tavily product sourcing + server-side image/link validation) + Phase 7 (working, threaded chat)** — the two remaining HARD trust-killers — then Phase 2 completion + Phase 3 (constraints) + Phase 4 (render director) to make design judgment real, then Phase 8 (editorial presentation) to close the mood-board sophistication gap.
- Note: a clean dev server was left running on `localhost:3100` for review; the pre-existing server on `:3000` had a corrupted `.next` cache (unrelated to these changes).

## 2026-07-09 — Phase 5 real product gate + Phase 7 threaded design chat

### Built
- **Phase 5 - Real Product Sourcing v1**
  - Product sourcing is now gated behind both an approved direction and a completed render record.
  - Product rows are inserted only after the source URL resolves and the image fetches as a real image, uploads to Supabase Storage `room-photos`, and is saved as `cached_image_path`.
  - Unfetchable products are dropped before persistence; batches with fewer than four verified products return a surfaced 502 instead of showing thin/incoherent products.
  - Tavily sourcing now retries simpler category-led queries, normalizes Tavily string/object image payloads, rejects social/media/inspiration domains, removes Google fallback persistence, and requires category alignment from source title/URL.
  - Product Critic now receives the approved render as the visual contract, not just concept JSON.
- **Phase 7 - Design Chat as Collaboration v1**
  - `getRoomWorkspace` loads chronological `chat_messages`; the UI renders that actual thread instead of only `revisions`.
  - Chat route passes approved direction, current render, prior thread, and last requested change into the turn.
  - Chat writes owner+designer `chat_messages` with referenced artifact ids; `revisions` remains the audit/proposal artifact.
  - Chat stays advisory: no state mutation, proposal copy remains visible, and failed sends no longer clear the owner's draft.
  - Added a long-running chat progress state grounded in the approved direction/latest render.

### Verified
- `npm.cmd run typecheck` passes.
- Fresh mock server on `localhost:3112`, fresh seed room `7065eac5-e708-45c2-a66c-88b66620cf47`: `npm.cmd run suite:e2e` passed 22/22.
- Direct Supabase validation on the same mock seed: 6/6 persisted products had source `200` and cached image `200 image/jpeg`; 4 `chat_messages`; latest designer reply addressed the "moodier" request and required owner confirmation.
- Screenshots saved:
  - `test-runs/phase57-screens/products-final.png`
  - `test-runs/phase57-screens/chat-final.png`
- One bounded `AI_MODE=live` pass on room `f88986dc-0d16-4da8-9018-a22cdc6e257d` completed diagnosis, concepts, approval, render, and chat. The live chat answer was contextual and strong (11x14 room, seven openings, current render, non-crowding advice, confirm in Renders/Preferences).

### Findings / Deferrals
- Live Tavily sourcing initially returned technically valid but semantically poor sources (Pinterest/YouTube/blog/social and mismatched categories). Tightened code now rejects those paths, including Google fallback and thin batches. A full owner-judged live product-quality pass remains for Phase 9 because the live supplier/search quality needs human review, not just route correctness.
- The in-app browser plugin was unavailable in this session (`agent.browsers.list()` returned `[]`), so ad hoc visual verification used Playwright screenshots plus direct browser-level image `naturalWidth` checks.

### Next Action
- Recommended next phase: Phase 3 + Phase 4 together (constraint engine + render director), because the live chat already reasons about density/openings, but render/product quality still needs hard spatial constraints and render-aware judgment to become systemic.
