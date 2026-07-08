# Build Plan

## Current Directive
PRD v2 in [docs/AI_Interior_Atelier_PRD_v2.md](/C:/Users/darre/Documents/AI%20Interior%20Designer/docs/AI_Interior_Atelier_PRD_v2.md) supersedes all earlier planning. The build must now move toward:

- append-only artifacts
- locked concept as the design contract
- room stages of `empty -> photos -> diagnosed -> concepts -> concept_locked -> executing`
- hidden `/debug` prompt workbench
- eventual provider routing through a single AI gateway with versioned prompt files

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
