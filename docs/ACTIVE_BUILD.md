# Active Build - P1.2 Designer Autopilot

**Updated:** 2026-07-13

**Application baseline:** `9c3599358e44a7cc16c1e5eb5403b32c40e42b47`

**Accepted complete:** P0.0 through P0.6

**Current phase:** P1.2

**Next committed phase:** P1.2 - Designer Autopilot: minimal input to one design

**External blocker:** None. P1.1 benchmark evidence is complete. The current pipeline remains unavailable for private benchmark sources because it would require the public photo bucket; this is recorded baseline evidence, not a P1.1 blocker.

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

- [ ] Connect the successful progressive intake to the versioned brief compiler and one durable first-design job.

## Current non-goals

- Improving the legacy diagnosis, concept, product, or tabbed workspace.
- Substituting test or spike images for owner benchmark evidence.
- Reconstructing unknown prompts, settings, homeowner input, or clearances.
- Running the paid three-room comparison matrix.
- Building the brief compiler, image critic, implementation package, or multi-room view.
- Broad refactors, analytics, authentication, billing, deployment, or provider changes.

## Handoff format

Replace the handoff below; do not append another log.

- **Outcome delivered:** P1.2's first-design intake replaces the legacy room dossier with one image, one plain-language outcome, an optional room name, and one `Design my room` action. It creates the room only once during an upload attempt, retains that draft for retry if the photo upload fails, and rejects non-image files before storage.
- **Files or migrations changed:** `components/forms/room-autopilot-intake.tsx`, `app/homes/[homeId]/rooms/new/page.tsx`, `app/api/rooms/[roomId]/photos/route.ts`, `tsconfig.json`, `docs/ACTIVE_BUILD.md`; no migration.
- **Focused verification:** `npm.cmd run typecheck` passes. Browser verification against an existing local home confirms the first-design page renders the minimal photo/outcome/optional-name intake and one visible `Design my room` action. Submission was intentionally not exercised because the available local data store is not a fresh tagged test run; no unscoped room or storage object was created.
- **Known limitation or blocker:** an isolated or freshly tagged seeded test database is still needed for a mutation-level browser check. Current-pipeline benchmark lanes remain unavailable because private local sources would require the public photo bucket. Unknown physical clearances remain unverified.
- **Next unchecked slice:** connect a successful intake submit to the versioned brief compiler and one durable first-design job, then exercise it against a freshly tagged test database.
