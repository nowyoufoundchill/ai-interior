# Build Plan

## Phase 1: Stabilize Foundation
- [x] Confirm project structure and architecture.
- [x] Make app folder its own Git repo.
- [x] Add GitHub origin.
- [x] Create local Supabase env file.
- [x] Fix TypeScript build blockers.
- [x] Verify typecheck and production build.
- [ ] Verify live Supabase schema and storage bucket. Corrected live read check indicates all public tables are missing from the PostgREST schema until migrations are applied; `room-photos` bucket has been created.
- [ ] Run local dev server and test the app flow manually after migration.
- [ ] Review agent: foundation reviewer verifies schema, env handling, local app flow, storage upload path, and Git hygiene.
- [ ] Failure gate: do not enter Phase 2 unless `npm.cmd run typecheck`, `npm.cmd run build`, Supabase tables, `room-photos` bucket, server photo upload/delete, and dashboard -> home -> room navigation all pass.
- [ ] Commit current stable foundation.
- [ ] Push `main` to GitHub.

## Phase 2: Real Room Diagnosis
- [x] Add OpenAI env contract.
- [x] Choose room analysis model and image input format.
- [x] Implement real `roomVisionAnalyst` behind the existing service boundary.
- [x] Include uploaded room photo URLs in analysis input.
- [x] Validate model output with `roomAnalysisSchema`.
- [ ] Persist diagnosis in `room_analyses`.
- [ ] Log prompt/input/output metadata to `ai_runs`.
- [ ] Add user-facing error states for failed analysis.
- [ ] Test with at least one real room and complete photo set.
- [ ] Review agent: AI diagnosis reviewer verifies prompt shape, image inputs, Zod validation, fallback behavior, persistence, and user-facing failure states.
- [ ] Failure gate: do not enter Phase 3 unless mock fallback still works without `OPENAI_API_KEY`, real analysis works with valid credentials/photos, invalid model output is rejected safely, `ai_runs` logs success/failure metadata, and typecheck/build pass.

## Phase 3: Concepts and Product Plan
- [x] Replace mock mood board generator with real structured concept generation.
- [x] Use room analysis, whole-home context, and design brief as inputs.
- [x] Improve mood board UI with stronger visual concept assets.
- [x] Replace placeholder products with real product sourcing strategy.
- [x] Add product filtering by budget, dimensions, retailer, and risk.
- [ ] Review agent: concept/product reviewer verifies concept distinctness, whole-home consistency, product rationale, filtering correctness, and source-risk disclosure.
- [ ] Failure gate: do not enter Phase 4 unless three validated concepts generate from real room context, selected concepts persist correctly, product plans include dimensions/budget/risk data, filtering does not hide required items incorrectly, and typecheck/build pass.

## Phase 4: Render Workflow
- [x] Generate render prompts from selected source photo and mood board.
- [x] Connect image generation or external render workflow.
- [x] Store render output URL and critique.
- [ ] Add revision loop for render changes.
- [ ] Review agent: render workflow reviewer verifies prompt preservation constraints, source-photo selection, output storage, critique scoring, and revision loop behavior.
- [ ] Failure gate: do not enter Phase 5 unless render prompts preserve room architecture/camera constraints, generated or external outputs are stored and displayed, critique data is persisted, revision requests update the render workflow predictably, and typecheck/build pass.

## Phase 5: Memory and Auth
- [x] Convert chat revisions into durable design memories.
- [x] Add memory controls for edit/delete/confirm.
- [ ] Add Supabase Auth if multi-user access is needed.
- [ ] Add RLS policies before any public or multi-user deployment. Hardening migration exists but live application is pending database credentials.
- [ ] Review agent: memory/auth reviewer verifies memory extraction quality, user controls, Auth boundary decisions, RLS policy coverage, and no private data leakage.
- [ ] Failure gate: do not consider the app release-ready unless memory edits/deletes are auditable, Auth is either intentionally deferred or fully wired, RLS policies protect all user-scoped data before multi-user/public use, and typecheck/build pass.

