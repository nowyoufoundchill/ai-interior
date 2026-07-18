# Active Build - P1.2 Designer Autopilot

**Updated:** 2026-07-13

**Application baseline:** `9c3599358e44a7cc16c1e5eb5403b32c40e42b47`

**Accepted complete:** P0.0 through P0.6

**Current phase:** P1.2

**Next committed phase:** P1.2 - Designer Autopilot: minimal input to one design

**External blocker:** None for the durable first-design operation. The remaining P1.2 quality and owner-preference gate requires owner review and authorized benchmark evidence; it is not inferred from mock verification.

`PRODUCT.md` owns the stable P1.1-P1.6 product and phase contract. This file owns only the current unchecked work and its immediate handoff.

## P1.1 completion record

Establish reproducible, private evidence for the three required room benchmarks before optimizing the homeowner journey, prompts, or pipeline. This phase records evidence; it does not run an unapproved paid comparison or change the owner-facing workflow.

The supplied manual results are fixed comparison evidence, not gold standards. Unknown original inputs, historical model settings, and unmeasured clearances remain explicitly unknown.

## P1.1 completion checklist

- [x] Place the supplied source photographs under ignored `benchmarks/private/<CASE_ID>/` and record redacted SHA-256 checksums.
- [x] Place the supplied `GARAGE-01` fixed manual reference image and original prompt under ignored private storage; record only their redacted checksums and provenance.
- [x] Place the supplied `OPENPLAN-01` original homeowner request and Sol system prompt under ignored private storage; record only their redacted checksums and provenance.
- [x] Place the supplied `CHILDROOM-01` fixed manual reference image under ignored private storage and record only its redacted checksum.
- [x] Place the supplied `OPENPLAN-01` fixed manual reference image and final prompt under ignored private storage; record only their redacted checksums and provenance.
- [x] Confirm the original `CHILDROOM-01` conversation is not supplied; record its absence and the minimal homeowner input as `unknown` rather than reconstructing either.
- [x] Record the existing original minimal homeowner input when available; record `unknown` rather than reconstructing it when absent.
- [x] Produce a redacted manifest/checksum record under `reports/` for each case, including asset checksums, prompt provenance, fixed architecture, required program, unknowns, historical settings, and current-pipeline baseline consumption.
- [x] Confirm raw assets, conversations, and prompt text remain private and that committed reports contain only permitted redacted evidence.
- [x] Freeze the blind finished-image scoring procedure, rubric, hard failures, uncertainty rule, and controlled-comparison requirements before generation.
- [x] Record owner direction that photo-observed physical facts are preservation constraints while room type/program remains flexible.
- [x] Inspect existing persisted current-pipeline consumption evidence; record only observed calls, tokens, elapsed time, and estimated cost, or retain `not_recorded` when no evidence exists.
- [x] Run the owner-authorized, privacy-safe controlled image set: three available full-prompt edits and three compact-brief edits using the same configured image model/settings, with no retries.
- [x] Complete blind scoring of the completed source/result pairs and record owner preference without candidate-path information.

Do not substitute existing spike fixtures for these supplied room cases, recreate manual evidence, or run provider calls while the private materials are absent.

## P1.1 gate

P1.1 completes only when:

- all three private evidence sets and redacted manifests are reproducible;
- owner-reviewed preservation/program checklists are recorded before generation;
- fixed manual-reference evidence and current-application consumption are recorded rather than guessed;
- the controlled comparison's shared model/settings and blind scoring procedure are frozen before optimization; and
- any paid multi-path comparison has an owner-approved bounded call plan.

## P1.2 first-design intake

- [x] Trace the existing first-design browser-to-job path and implement the smallest progressive intake that collects a usable room photo and plain-language outcome before compiling the one-design request.

## Current slice - P1.2 first-design operation

- [x] Connect the successful progressive intake to the versioned brief compiler and one durable first-design job.

## Current slice - P1.2 durable operation verification

- [x] Run the first-design operation against the configured tagged test project after its `generation_jobs` schema cache is available.

## Current slice - P1.2 phase gate evidence

- [ ] Complete the owner-reviewed visual-quality, preference, and responsive gate evidence required to accept P1.2.

## Current non-goals

- Improving the legacy diagnosis, concept, product, or tabbed workspace.
- Substituting test or spike images for owner benchmark evidence.
- Reconstructing unknown prompts, settings, homeowner input, or clearances.
- Running the paid three-room comparison matrix.
- Building the brief compiler, image critic, implementation package, or multi-room view.
- Broad refactors, analytics, authentication, billing, deployment, or provider changes.

## Handoff format

Replace the handoff below; do not append another log.

- **Outcome delivered:** P1.2 now sends the intake directly into one durable existing render-lane job, marked `operation: first_design` so it works with migration 008's deployed job-type constraint without a production migration. The job compiles and persists a versioned room program, creates one image edit, persists one candidate design, and preserves checkpoints for recovery. Status polling reschedules a saved queued job after an interrupted callback; claim semantics keep that recovery idempotent. The result-first room screen shows the source image or latest candidate, one status, and the single primary action; `Keep this design` promotes that candidate without deleting history.
- **Files or migrations changed:** `components/forms/room-autopilot-intake.tsx`, `components/rooms/autopilot-room-workspace.tsx`, `app/homes/[homeId]/rooms/new/page.tsx`, `app/rooms/[roomId]/page.tsx`, `app/api/rooms/[roomId]/first-design/route.ts`, `app/api/rooms/[roomId]/designs/[renderId]/accept/route.ts`, `app/api/rooms/[roomId]/jobs/route.ts`, `app/api/rooms/[roomId]/jobs/[jobId]/route.ts`, `app/api/rooms/[roomId]/photos/route.ts`, `lib/ai/jobs/first-design.ts`, `lib/ai/jobs/runners.ts`, `lib/ai/jobs/service.ts`, `lib/ai/services.ts`, `lib/schemas/index.ts`, `lib/schemas/json.ts`, `tsconfig.json`, `docs/ACTIVE_BUILD.md`; no migration was applied.
- **Focused verification:** `npm.cmd run typecheck` passes. Tagged mock verification starts one first-design request and immediately repeats it; both resolve to one active durable job. The completed job references one persisted compiled brief and one candidate render. Tagged teardown removes that job, compiler artifact, render, photos, room, home, and storage objects; `check:residue` reports zero residue. Browser verification confirms a source-photo-first viewport and one visible `Design my room` action. The existing durable-job suite reaches the table after restarting the local mock server; its stale-heartbeat assertions remain affected by the local/database clock mismatch and are outside this first-design change.
- **Known limitation or blocker:** P1.2's owner-reviewed visual-quality, preference, and responsive gate evidence remains required. It includes authorized benchmark work and owner reactions, so it cannot be claimed from mock runs or inferred.
- **Next unchecked slice:** complete the bounded owner-reviewed P1.2 phase gate evidence; do not run paid benchmark calls without the existing authorization.
