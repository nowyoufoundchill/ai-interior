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
