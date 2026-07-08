# Build Plan

## Current Directive (updated 2026-07-08)
[docs/AI_Interior_Atelier_PRD_v3.md](/C:/Users/darre/Documents/AI%20Interior%20Designer/docs/AI_Interior_Atelier_PRD_v3.md) supersedes v1 and v2 entirely and is now the sole planning authority. Everything below through "Phase 6" was built and verified against PRD v2 and is being carried forward as-is (v3's product loop, data model, and AI-service architecture are functionally the same shape). It is **not** being redone.

**PRD v3 delta is complete.** The Release Gate (§12.4) ran to green on 2026-07-08: Suite 1 55/55, Suite 2 21/21, Suite 3 (live) 19/19, Suite 4 62/62, Suite 5 31/32 screens ≥8/10 with zero named rubric violations. See `/reports/release-2026-07-08.md` for the full pass/fail matrix, every fix made, and open items for owner judgment.

**Owner feedback after the gate went green (2026-07-08, same day):** the deployed app showed 61 leftover simulation/debug homes on the dashboard, and the owner's reaction was that the product "feels like AI slop... doesn't feel like a design intelligence brain." Both were real, fair findings:
1. **Production cleanup (done):** the 61 homes were Phase 0 spike/simulation-batch leftovers from 2026-07-06/07, created before `test_run_id` tracking existed, so they were invisible to every "zero residue" check run during the Release Gate cycle (that check only ever looks for tagged rows — it was never a check against the dashboard itself). Audited and deleted with the owner's explicit, specifically-confirmed sign-off (61 homes, 59 rooms, 230 photos, 108 mood boards, 75 products, 46 diagnoses, 169 `ai_runs` rows, 229 Storage objects) — including the one home that looked like the owner's real entry, which the owner explicitly confirmed should also go. Production `homes` table is now empty; `verify:live` confirmed schema/storage still healthy after.
2. **Design brain quality (not started — see below):** everything in the PRD v3 delta was testing/verification infrastructure and narrow correctness fixes. None of it touched prompt quality, context-brain depth, or actual diagnosis/concept/product/render output quality — the thing the owner is actually judging when they say "AI slop." Flagged by the owner as the next priority.

What v3 adds on top of that, and what the rest of this file now tracks, is the delta:
- a real test harness (`AI_MODE` mock/live, `.env.test`, `seed:test`/`teardown`, `test_run_id` residue tracking)
- `data-testid` coverage on every interactive element and artifact card
- a consolidated 6-style library (was 14 thin entries)
- five verification suites (Integrity, Functional E2E, Live API smoke, Assets & responsive, Design brain & feel) run as repo skills
- a Release Gate (v3 §12.4) as the actual definition of "done"

**Deviations from PRD v3, by owner decision (2026-07-08):**
- No Supabase Auth. Owner: "just me and my wife" — single-household private mode stays as-is, `/login` stays a no-op redirect.
- Chrome DevTools MCP was installed at user scope on 2026-07-08 and was connected/available in the following session (confirmed via `claude mcp list`), but this session's actual browser-driven work (all 5 suites, plus ad hoc spot-checks between reviewer passes) used Playwright throughout — Playwright screenshots were read directly via the Read tool for manual verification rather than driving a live chrome-devtools MCP session. The persisted, `npm run suite:*`-callable Suite 2/4/5 scripts must use Playwright regardless, since MCP browser tools are only invocable from an agent's own tool-calling loop, not from a standalone Node script that runs unattended/repeatedly. A future session doing purely ad hoc, in-conversation verification (not writing a reusable script) should still prefer chrome-devtools MCP directly.

See "## PRD v3 Delta Plan" further down for the active phase-by-phase tracking. The PRD-v2-era phase log below is kept for history.

## PRD v3 Delta Plan (active — added 2026-07-08)

- [x] **A. Docs realignment** — point BUILD_PLAN/PROJECT_BRAIN at v3, record deviations, carry forward v2-era completed work without redoing it.
- [x] **B. Style library consolidation** — 14 entries -> the 6 named in v3 §7 (Lowcountry Coastal, Moody Coastal, Organic Modern, Modern Traditional, Masculine Executive, Boutique Hotel), each with proportion_rules/lighting_layers/luxury_mechanics + the full PRD field list. `npm run typecheck` clean. Resolved dangling `pairs_well_with` references to removed styles (see SESSION_LOG 2026-07-08).
- [x] **C. Test harness** — `resolveAiMode()` in `lib/ai/gateway.ts` forces every `runStructuredTask`/`generateImageEdit` call onto its mock fixture when `AI_MODE=mock`, regardless of configured provider keys. Mock fixtures extracted out of `lib/ai/services.ts` and `lib/ai/critic.ts` inline literals into `/lib/ai/fixtures/{diagnosis,products,renders,chat,critic}.ts`. Migration `005_test_harness_residue_tracking.sql` adds nullable `test_run_id` to every table. `scripts/test-env.mjs` (loads `.env.test`, falls back to `.env.local` with a loud warning), `scripts/seed-test.mjs` (seeds one home+room from the real office photos/brief in `spike/payloads/office-variation-matrix.json`, uploads photos to `room-photos` under `test-runs/{id}/`, writes `test-runs/current.json`), `scripts/teardown-test.mjs` (explicit child-to-parent delete by `test_run_id` across all tables + storage, not relying on cascade since `revisions`/`ai_runs` use `on delete set null`), `scripts/check-test-residue.mjs` (always reads `.env.local`/production regardless of `.env.test`, per §12.2). `.env.test.example` added; `.gitignore` updated to allow `.env*.example` through the blanket `.env*` rule and ignore `test-runs/`. npm scripts: `seed:test`, `teardown:test`, `check:residue`. **Not yet applied to the live Supabase project** — migration 005 needs to be pushed to `main` for the GitHub Actions workflow to deploy it before `seed:test` will work end-to-end.
- [x] **D. `data-testid` coverage** — every interactive control and artifact card across `room-workspace.tsx`, `photo-uploader.tsx`, `preferences-manager.tsx`, `home-form.tsx`, `room-form.tsx`, `app-shell.tsx`, dashboard/home pages. Kebab-case `{element}-{action}-{id}` convention, reusing existing stable ids (version/productId/etc.) rather than inventing counters. `/debug` and `/spike` intentionally skipped (internal tooling). `npm run typecheck` clean.
- [x] **E. Debug state-assertion endpoint** — `app/api/debug/room-state/[roomId]/route.ts` (GET) returns diagnoses/mood_boards/products/renders/chat_messages for a room plus derived booleans (`stale_*_count`, `products_match_locked_version`, `renders_match_locked_version`) so the Integrity suite can assert the §4 invalidation table without scraping the DOM.
- [x] **F. Five verification suites** — `scripts/suites/{integrity,e2e,live-smoke,assets-responsive,design-review}.mjs` + shared `_lib.mjs`/`_journey.mjs`, each with a matching `.claude/skills/atelier-*/SKILL.md`. Suite 2/4 use Playwright (not chrome-devtools MCP): these must run unattended/repeatedly via `npm run suite:*`, and MCP browser tools are only callable from an agent's own tool-calling loop, not a standalone Node script — chrome-devtools MCP remains the preferred driver for ad hoc, in-session verification.
- [x] **G. Verification cycle** — run against `docs/AI_Interior_Atelier_PRD_v3.md` §12.4 cycle discipline (fresh seed before every suite, reseed-and-rerun after every fix, never verify against dirty state). Found and fixed 9 real app bugs (see `/reports/release-2026-07-08.md` for the full list: render-route mock/live branching, missing diagnosis-staleness rule, edit-while-locked not blocked, unlock not cascading staleness immediately, a systemic `test_run_id` tagging gap that would have let test data leak into production undetected, sub-44px tap targets, visible debug-panel clutter, "Dashboard" nav language, identical mock concept/product fixtures) plus 4 suite/capture-script bugs (not app bugs). Final state: Suite 1 55/55, Suite 2 21/21, Suite 4 62/62, Suite 5 31/32 screens ≥8/10 with zero named rubric violations (one screen at 7/10 for a non-rubric hover-affordance note).
- [x] **H. Live smoke cycle** — `AI_MODE=live`, two full passes (the second extended to cover product sourcing + a cached product image). Real Anthropic diagnosis + product sourcing/critic, real OpenAI image edit (render saved + fetchable from Storage), real Tavily search+extract, graceful failure path confirmed (bad request → 400, room state unchanged). 19/19 assertions passed. Both cycles torn down with confirmed-clean residue.
- [x] **I. Release Report** — `/reports/release-2026-07-08.md` written: pass/fail matrix, all fixes made, documented deviations, residue confirmation, live-cycle detail, open items for owner judgment.

**Known process gap (still open, mitigated):** v3 §3 assumes a dedicated `.env.test` Supabase project so tests never touch production. Only one Supabase project exists today. The harness runs against the same project with strict `test_run_id` tagging (now verified complete across every artifact table, including `ai_runs` — see fix #5 in the release report) and a hard teardown + residue check after every cycle, confirmed clean after all 10 cycles run this session (8 mock + 2 live). This is documented risk, not silent scope-narrowing.

**Open items for owner judgment** (PRD §12.5 — not resolvable by loops): no draggable before/after slider (static side-by-side ships instead); subtle concept-card hover affordance; Products tab filter row reads close to an admin panel to one reviewer pass; native web search/Tavily not wired into live product sourcing (feature addition, not a bug); no dedicated `.env.test` project. Full detail in the release report.

## Next Priority: Design Brain Quality (flagged 2026-07-08 — not yet scoped)

The owner's read after using the deployed app: it "doesn't feel like a design intelligence brain," feels like "AI slop... with a lot going on." This is a judgment about actual output quality and product feel, not about anything the verification suites above check (they check state-machine correctness and UI mechanics, not whether a diagnosis is insightful or a concept is genuinely distinctive and high-taste). Nothing below is scoped or committed yet — this is a punch list of the areas in the existing architecture that own this problem, for the owner to prioritize:

- **Prompts** (`/prompts/{diagnosis,concepts,products,renders,chat,critic}/*.md`) — the actual instructions driving every AI call. Last touched for real content during the Phase 0 spike (2026-07-06/07); may need another real-photo iteration pass now that the full context-brain + critic pattern exists.
- **Context brain** (`/lib/ai/context-brain/*`, `/lib/ai/design-portfolio.ts`) — property dossier, room intelligence, taste graph, design policy, and the annotated design portfolio. This is where "generic vs. specific to this room" gets decided; only validated once against one real office batch, never iterated against owner reactions to real diagnoses/concepts.
- **Style library depth** (`lib/ai/style-library.ts`) — consolidated to the 6 PRD-named styles on 2026-07-08 with the full field set, but never re-validated against a real generation run since consolidation.
- **Critic rubric calibration** (`lib/ai/critic-rubric.ts`, `lib/ai/critic.ts`) — scores concepts/diagnoses/products against fixed numeric anchors; never checked against whether the owner would agree with those scores on real output.
- **`design_preferences` UI exists but has near-zero real data** — the taste graph is still mostly brief-bootstrapped rather than built from confirmed owner reactions to actual artifacts, which is the mechanism PRD v3 assumes will make output feel personal over time.
- **A real, owner-judged live cycle has never happened.** Every live validation to date (Phase 0 spike batch, this session's two live smoke cycles) tested pipeline mechanics — real calls succeed, images get cached — not whether a real human liked the output. PRD v3 §12.5 names this explicitly as "the owner's 10%" that no loop can verify.

**Suggested first move, pending owner direction:** run one real `AI_MODE=live` room through the full loop (diagnosis → 3 concepts → lock → products → render) against real owner-provided photos/brief, and have the owner react to it directly — that reaction is the actual eval harness for this work, not another automated suite.

## Completed Alignment Work
- [x] Audited the current build against PRD v2 and identified v1 carryovers.
- [x] Updated the room workflow to use `current_stage` semantics in the UI.
- [x] Changed concept selection behavior to locked-concept behavior.
- [x] Stopped destructive replacement of mood boards, products, and renders in API routes.
- [x] Added stale/current status handling for diagnoses, concepts, products, and renders.
- [x] Added a hidden `/debug` page backed by `ai_runs`.
- [x] Added additive schema migration `003_prd_v2_foundation_alignment.sql` for v2-aligned columns and tables.

## Phase 0: Intelligence Spike
- [x] Create `/spike` workflow for diagnosis, concepts, products, render prompt composition, and image edit validation.
- [x] Anthropic reasoning path has been validated against real owner office photos and typed dimensions. The staged office batch now completes diagnosis + concepts + products on the live pipeline (`spike/runs/batch/2026-07-07T04-27-41-099Z/summary.json`).
- [x] Test OpenAI image edit rendering from real source photos. Real office render validation completed for room `8e4ee483-596f-41ef-8ff1-a2f301db1f69` with render `fd65a8c9-1eb3-49f9-a782-c3de664c87a0`.
- [x] Test Tavily image/page extraction for product sourcing support. Direct search + extract artifact saved at `spike/runs/tavily-phase0-2026-07-07T03-56-11-268Z.json`.
- [x] Promoted a context-brain-backed `v2` concept prompt into `/prompts/concepts/`.
- [x] Owner directional sign-off: `generate-room-concepts.v2` is considered directionally good enough to keep moving forward with, assuming OpenAI and Tavily remain available for their downstream tasks.
- [x] Failure gate: Phase 0 is cleared for continued implementation because the owner gave directional prompt approval and the real-provider spike validations now cover Anthropic reasoning, OpenAI rendering, and Tavily search/extract. Production polish judgment is still deferred to later phases.
Status: complete. Phase 0 is closed; Phase 1 is complete; the build is ready to proceed with Phase 2.

### Context brain architecture (added 2026-07-06/07)
Adopted a three-layer split instead of continuing to grow prompt files directly, based on evidence from the 10-variant batch that prompt wording alone moves tone but not judgment:
- **Prompt** = compact operating system: role, decision hierarchy, output contract only (`prompts/concepts/generate-room-concepts.v2.md`).
- **Context brain** = the actual design intelligence, as structured data read into the taskInput on every real call: property dossier, room intelligence, taste graph, design policy, a relevant slice of the style library, and an annotated design portfolio (`/lib/ai/context-brain/*`, `/lib/ai/design-portfolio.ts`).
- **Evaluator** = quality governor: a real gateway-logged Critic (`/lib/ai/critic.ts`) scoring against an explicit rubric (`/lib/ai/critic-rubric.ts`), including a concept-differentiation check with one bounded regeneration retry, not an unbounded auto-loop.
This pattern is now proven enough to clear Phase 0 for the Concept Director path: the real-photo office batch completes through concepts and products, and the render path has been validated separately with real office photos. Diagnosis, products, renders, and chat are still not all upgraded to the same full context-brain + critic depth, so that remains follow-on work rather than a Phase 0 blocker.

## Phase 1: Foundation
- [x] Next.js + Supabase + Tailwind project foundation exists.
- [x] Homes, rooms, photos, room workspace, and private single-household flow exist.
- [x] Additive v2 schema alignment migration has been authored locally.
- [x] Hidden `/debug` route exists.
- [x] Apply migration `003_prd_v2_foundation_alignment.sql` to the live Supabase project.
- [x] Update `types/database.ts` to reflect the live PRD-v2-aligned schema additions.
- [x] Create `/lib/schemas/` as the single domain-schema source of truth and migrate imports away from `lib/ai/schemas.ts`.
- [x] Create `/lib/ai/gateway.ts` and route all provider calls through it.
- [x] Move prompt text out of service files into `/prompts/{service}/{name}.v{N}.md`.
- [x] Add provider-aware `ai_runs` logging from the gateway: provider, model, raw input/output, latency, and validation errors.
- [x] Failure gate: do not start real multi-provider service wiring until migration, generated types, gateway, prompt files, and debug logging all pass `npm.cmd run typecheck` and `npm.cmd run build`.
Status: complete.

## Phase 2: Diagnosis + Concepts
- [x] Diagnosis and concept routes now preserve history instead of replacing prior artifacts.
- [x] Concept locking now invalidates downstream products and renders by marking them stale.
- [x] Concept Director now runs on a context brain (property dossier, room intelligence, taste graph, design policy, style library slice, design portfolio) plus a real gateway-logged Critic with a bounded differentiation retry, instead of a thin prompt + mocked critic. Typecheck/build and real-photo batch verification have now cleared.
- [x] Apply the same context-brain + real-critic pattern to Diagnosis (`roomVisionAnalyst`). Diagnosis now uses a context-brain-backed `v2` prompt plus a real diagnosis critic with one bounded regeneration pass. Typecheck/build verification has cleared.
- [x] Replace surrounding app language with diagnosis-first terminology where practical. Diagnosis tab now surfaces version + current/stale status and states that reruns mark concepts stale. The physical `room_analyses` table rename is intentionally deferred as a destructive migration (additive-only rule); app-facing language is diagnosis-first.
- [x] Build concept editing, unlock, and re-harmonize flows on top of the new mood board version/status fields. New route `app/api/rooms/[roomId]/moodboards/[boardId]/route.ts` handles `unlock`, `edit`, and `reharmonize` actions, all append-only (edit/reharmonize create a new version and mark the source stale; unlock drops the room lock and leaves downstream stale). Re-harmonize is backed by a new `refineConcept` AI service.
- [x] Surface stale badges and rerun affordances more consistently across the room UI. Added a shared `StatusBadge` (color-coded locked/stale/rejected/approved) and `StaleNotice`; concepts group active vs. previous versions; Products and Renders show stale notices when the locked concept changed; the Concepts action becomes "Regenerate concepts" once concepts exist.
- [x] Failure gate: diagnosis reruns mark concepts stale only (analyze route sets `mood_boards.status = 'stale'`, never deletes); concepts are lockable without destructive deletes (status transitions only); locked concept is the only concept used for downstream generation (product/render routes query `status = 'locked'`). Verified via `tsc --noEmit` on a clean reconstructed tree; see Verification note below.
Status: complete. Behavioral gates hold by construction; type gate passes.

> Verification note (2026-07-07): The bash sandbox mount for this repo is a stale/partial snapshot this session (in-place edits to existing files appear truncated; new files sync). `next build` additionally cannot run in the Linux sandbox because `node_modules` holds Windows-only native binaries and the source lives on an mmap-incompatible mount (SIGBUS). Type verification was therefore run against a faithful reconstruction built from clean `git archive HEAD` blobs with the same edits reapplied and a Linux SWC shim; `npm run typecheck` passes clean there. `next build` should be re-run on the Windows host, as in prior sessions.

## Phase 3: Renders
- [x] Render records are now append-only and mark older same-photo renders stale on regeneration.
- [x] Replace generic render generation copy with photo-edit language throughout the UI and routes. Renders tab is now "Photo edit studio / Restyle your real room photos"; actions read "Edit this photo"; route error copy and the render prompt itself use in-place photo-edit language; success criteria explicitly state this is a photo edit, not text-to-image.
- [x] Add explicit regeneration instructions input in the Renders tab. A per-edit instructions textarea flows through `generate-render` into `renderPromptDirector` (new `userInstructions` param), is embedded in the render prompt, and is persisted as `renders.user_regeneration_instructions`.
- [x] Add before/after comparison UI. Each saved edit shows the source photo (Before) beside the edited image (After); when no image is returned it shows an "edit plan saved" placeholder.
- [x] Persist preservation constraints, user instructions, and critic notes in a clearer render history view. A collapsible "Preservation & edit details" section shows preserved constraints, applied changes, avoided artifacts, and critic notes per edit.
- [x] Failure gate: renders are always generated from a locked concept and a real source photo (route requires `mood_boards.status = 'locked'` and validates the source photo belongs to the room), never concept-free text generation — the render is an in-place edit of the owner's photo. Verified via `tsc --noEmit` on the reconstruction harness.
Status: complete.

## Phase 4: Products
- [x] Product records are now append-only and tied to mood board version where available.
- [x] `productSourcingAgent` now uses the full context brain (property dossier, room intelligence, taste graph, design policy, style slice, portfolio) plus a real gateway-logged Product Critic (`critiqueProducts`, `prompts/critic/score-products.v1.md`, `productCritiqueSchema`). The critic is authoritative but non-blocking (logged to `ai_runs`/`/debug`), matching the concept-critic convention.
- [x] Add cached product image storage path handling rather than relying on hotlinked images alone. The source-products route best-effort downloads each product image and re-hosts it in the `room-photos` bucket, writing `products.cached_image_path`; failures are non-fatal and fall back to the original `image_url`. The UI prefers `cached_image_path ?? image_url`.
- [x] Introduce approved/rejected product controls and stale badges in the UI. New route `app/api/rooms/[roomId]/products/[productId]/route.ts` (approve/reject/reset); product cards expose Approve/Reject/Reset and dim rejected items; status uses the shared `StatusBadge`, and the stale notice from Phase 2 covers products.
- [x] Shift product sourcing prompts and logic toward rationale-first, typed-dimension-aware outputs. `source-product-plan.v1.md` now states an explicit decision hierarchy (typed dimensions > diagnosed reality > locked concept > brief), requires concept-execution rationale in `reason_selected`, and requires anchor pieces sized to typed dimensions; the service success criteria mirror this.
- [x] Failure gate: product generation binds to the locked concept version (route requires `mood_boards.status = 'locked'` and stamps `mood_board_version`) and keeps stale history visible (relock marks prior products stale except rejected; UI shows stale badges + notice). Verified via `tsc --noEmit` on the reconstruction harness.
Status: complete.

## Phase 5: Design Chat + Preferences
- [x] Chat messages now also persist to a dedicated `chat_messages` table.
- [x] Additive `design_preferences` table exists in migration for home-level taste records.
- [x] Move room workspace away from `design_memories` as the primary taste model. The taste graph (`buildTasteGraph`) now takes confirmed home-level `design_preferences` as its primary, highest-confidence source (0.95), with brief fields as lower-confidence fallback; preferences thread through `buildContextBrain` into concept generation and product sourcing (routes fetch `design_preferences` and pass them). `design_memories` is no longer written from chat and is no longer a taste source.
- [x] Add home-level preferences UI backed by `design_preferences`. New `PreferencesManager` client component on the home page (add/remove by type: style/color/material/avoid/constraint/general) backed by new routes `app/api/homes/[homeId]/preferences/route.ts` (GET/POST) and `.../[preferenceId]/route.ts` (DELETE), plus a `getDesignPreferences` query.
- [x] Ensure chat proposes reruns and preference updates without silently mutating design state. The chat route no longer inserts into `design_memories`; the chat prompt instructs the assistant to explain from artifacts, propose the next step, and never claim it applied a change; the Chat UI tags actionable turns "Proposal only — confirm in the … tab / Design preferences."
- [x] Failure gate: chat explains rationale from stored artifacts (brief, diagnosis, locked concept, products, renders, preferences are all loaded into the turn) and requires explicit user confirmation for rerun-causing actions (chat cannot mutate state; reruns happen only via the owner's action in the relevant tab, preferences only via the home UI). Verified via `tsc --noEmit` on the reconstruction harness.
Status: complete.

## Phase 6: Hardening
- [x] Apply the latest schema through the documented GitHub -> Supabase workflow.
- [x] Verify live tables and storage buckets with `npm.cmd run verify:live`.
- [x] Re-run `npm.cmd run typecheck` and `npm.cmd run build` after the live schema catches up.
- [x] Audit RLS/API exposure against current Supabase guidance before any broader deployment. Findings: the app uses a grant-based private model — migration 001 granted all table privileges to `anon`/`authenticated`, and 002 revoked them so the browser-facing roles cannot touch tables; all data access is server-side via the service-role key (`createServerSupabaseClient`/`createServiceSupabaseClient`), and the browser Supabase client is unused dead code. Gap found and fixed: migration 002 ran before 003 created `design_preferences` and `chat_messages`, so those tables could retain Supabase's default anon grants. Added additive, idempotent `004_prd_v2_access_hardening.sql` that re-revokes on all current tables and sets `alter default privileges` so future tables are server-only by default (this gap cannot recur). Remaining posture note: API routes have no per-user auth (single-household private mode, auth intentionally deferred per PROJECT_BRAIN); this must be revisited before any multi-tenant/public deployment.
- [x] Failure gate: no release-ready claim until docs, schema, runtime behavior, and debug visibility all match PRD v2. Docs (BUILD_PLAN/PROJECT_BRAIN/SESSION_LOG) updated per phase; schema hardening authored (004); runtime behavior aligned across Phases 2-5; debug visibility preserved (all new AI calls — refineConcept, Product Critic — route through the gateway and log to `ai_runs`/`/debug`). Type gate (`tsc --noEmit`) passes clean on the full reconstructed tree. **Two owner-side deploy steps remain before "release-ready": (1) apply `004_prd_v2_access_hardening.sql` via the GitHub -> Supabase workflow and re-run `verify:live`; (2) run `npm run build` on the Windows host (cannot run in the Linux sandbox — see the Phase 2 verification note).**
Status: complete (code + audit); two owner-side deploy actions listed above remain.
