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
- [ ] Replace `room_analyses` naming and surrounding app language with diagnosis-first terminology where practical.
- [ ] Build concept editing, unlock, and re-harmonize flows on top of the new mood board version/status fields.
- [ ] Surface stale badges and rerun affordances more consistently across the room UI.
- [ ] Failure gate: diagnosis reruns must mark concepts stale only; concepts must be lockable without destructive deletes; locked concept must be the only concept used for downstream generation.

## Phase 3: Renders
- [x] Render records are now append-only and mark older same-photo renders stale on regeneration.
- [ ] Replace generic render generation copy with photo-edit language throughout the UI and routes.
- [ ] Add explicit regeneration instructions input in the Renders tab.
- [ ] Add before/after comparison UI.
- [ ] Persist preservation constraints, user instructions, and critic notes in a clearer render history view.
- [ ] Failure gate: renders must always be generated from a locked concept and a real source photo, never concept-free text generation.

## Phase 4: Products
- [x] Product records are now append-only and tied to mood board version where available.
- [ ] `productSourcingAgent` now defaults to Anthropic, but it still does not use the same full context brain or critic pass as Concept Director.
- [ ] Add cached product image storage path handling rather than relying on hotlinked images alone.
- [ ] Introduce approved/rejected product controls and stale badges in the UI.
- [ ] Shift product sourcing prompts and logic toward rationale-first, typed-dimension-aware outputs.
- [ ] Failure gate: product generation must always bind to the locked concept version and keep stale history visible.

## Phase 5: Design Chat + Preferences
- [x] Chat messages now also persist to a dedicated `chat_messages` table.
- [x] Additive `design_preferences` table exists in migration for home-level taste records.
- [ ] Move room workspace away from `design_memories` as the primary taste model.
- [ ] Add home-level preferences UI backed by `design_preferences`.
- [ ] Ensure chat proposes reruns and preference updates without silently mutating design state.
- [ ] Failure gate: chat must explain rationale from stored artifacts and require explicit user confirmation for rerun-causing actions.

## Phase 6: Hardening
- [x] Apply the latest schema through the documented GitHub -> Supabase workflow.
- [x] Verify live tables and storage buckets with `npm.cmd run verify:live`.
- [x] Re-run `npm.cmd run typecheck` and `npm.cmd run build` after the live schema catches up.
- [ ] Audit RLS/API exposure against current Supabase guidance before any broader deployment.
- [ ] Failure gate: no release-ready claim until docs, schema, runtime behavior, and debug visibility all match PRD v2.
