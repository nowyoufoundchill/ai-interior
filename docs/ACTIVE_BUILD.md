# Active Build - P1.3 Finished-image quality and refinement

**Updated:** 2026-07-18

**Application baseline:** `9c3599358e44a7cc16c1e5eb5403b32c40e42b47`

**Accepted complete:** P0.0 through P1.2

**Current phase:** P1.3

**Next committed phase:** P1.3 - Finished-image quality and conversational refinement

**External blocker:** None.

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

## P1.2 phase gate evidence

- [x] Owner accepted the reviewed first-design result as visually useful, preference-aligned, and ready to proceed through the responsive homeowner flow.

## Current slice - P1.3 finished-image review

- [x] Compare the actual source/result pair with the compiled brief and typed facts, persist a structured pass/warning/failure verdict on the append-only render, and prevent critical failures from becoming the current candidate.

## Next slice - P1.3 bounded repair

- [ ] Permit at most one automatic image repair after a critical finished-image verdict, preserving the failed attempt and review while enforcing the two-edit/two-review ceiling.

## Current non-goals

- Improving the legacy diagnosis, concept, product, or tabbed workspace.
- Substituting test or spike images for owner benchmark evidence.
- Reconstructing unknown prompts, settings, homeowner input, or clearances.
- Running the paid three-room comparison matrix.
- Building the implementation package or multi-room view.
- Conversational revision and the full seeded P1.3 corpus gate until the bounded repair path is complete.
- Broad refactors, analytics, authentication, billing, deployment, or provider changes.

## Handoff format

Replace the handoff below; do not append another log.

- **Outcome delivered:** Every new first design now receives a post-generation review that sees the real source image, finished image, compiled room program, and typed room facts. The structured verdict and evidence persist on the render. A critical result is saved as `review_failed`, ends with `finished_image_critical_violation`, and cannot replace or be accepted as the current candidate. Passing results remain candidates. The room view adds an accessible in-place Before/After switch and identifies reviewed results without exposing internal scoring.
- **Files or migrations changed:** `app/api/debug/room-state/[roomId]/route.ts`, `components/rooms/autopilot-room-workspace.tsx`, `lib/ai/critic.ts`, `lib/ai/failure-fixtures.ts`, `lib/ai/fixtures/critic.ts`, `lib/ai/jobs/first-design.ts`, `lib/schemas/index.ts`, `lib/schemas/json.ts`, `prompts/critic/review-finished-image.v1.md`, `docs/ACTIVE_BUILD.md`; no migration was required or applied.
- **Focused verification:** `npm.cmd run typecheck` passes. A tagged mock first-design run persisted a `pass` verdict with evidence and a quality score on one candidate. A second run using the deterministic critical finished-image fixture persisted one `review_failed` attempt, terminally failed with `finished_image_critical_violation`, and preserved the original candidate. Tagged teardown removed two jobs, two renders, two compiled artifacts, four AI runs, the room/home/photos, and four storage objects; `check:residue` reports zero residue. Browser verification on the existing accepted room confirms Before/After changes the displayed source/result label and pressed state with no console warnings or errors.
- **Known limitation or blocker:** Automatic repair and owner-authored conversational revisions are not implemented yet. The frozen seeded critical corpus and owner revision scenarios remain P1.3 phase-gate work.
- **Next unchecked slice:** implement one bounded automatic repair while preserving both attempts and enforcing the two-edit/two-review ceiling.
