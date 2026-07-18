# Active Build - P1.3 Finished-image quality and refinement

**Updated:** 2026-07-18

**Application baseline:** `ef337b8e57ca350d89705c5130c4bc65e85364db`

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

- [x] Permit at most one automatic image repair after a critical finished-image verdict, preserving the failed attempt and review while enforcing the two-edit/two-review ceiling.

## Current slice - P1.3 direct conversational revision

- [x] Add one direct, durable visual revision action under the current design that appends exactly one reviewed version from one unambiguous one-room request, without a second confirmation step.

## Next slice - P1.3 seeded phase gate

- [ ] Freeze and run the complete seeded finished-image corpus and five owner revision scenarios required by the P1.3 gate, then record owner acceptance without weakening the zero-critical-miss requirement.

## Current non-goals

- Improving the legacy diagnosis, concept, product, or tabbed workspace.
- Substituting test or spike images for owner benchmark evidence.
- Reconstructing unknown prompts, settings, homeowner input, or clearances.
- Running the paid three-room comparison matrix.
- Building the implementation package or multi-room view.
- Broad refactors, analytics, authentication, billing, deployment, or provider changes.

## Handoff format

Replace the handoff below; do not append another log.

- **Outcome delivered:** Finished-image critical failures now receive at most one source-based repair and a second review, with every attempt append-only and no third edit. The current-design view also has a direct revision field: one concrete one-room request starts a replay-safe durable job immediately, edits the current design, reviews it against the original source, appends exactly one passing candidate in the normal path, records one revision event, and retains the parent as history. Vague, cross-room, preference-memory, and shopping requests stop before job creation.
- **Files or migrations changed:** `app/api/debug/room-state/[roomId]/route.ts`, `app/api/rooms/[roomId]/visual-revision/route.ts`, `components/rooms/autopilot-room-workspace.tsx`, `lib/ai/critic.ts`, `lib/ai/failure-fixtures.ts`, `lib/ai/jobs/first-design.ts`, `lib/ai/jobs/runners.ts`, `lib/ai/jobs/service.ts`, `lib/ai/jobs/visual-revision.ts`, `lib/ai/proposals.ts`, and `docs/ACTIVE_BUILD.md`; no migration was required or applied.
- **Focused verification:** `npm.cmd run typecheck` and `git diff --check` pass. Prior tagged normal, repairable, and terminal critical cycles proved the one-edit normal path and two-edit/two-review ceiling. A fresh tagged browser/API cycle proved a vague request returns `422` with no job; one actionable submission plus an immediate replay produced one completed job, one `pass` review, one new candidate, one revision row, one attempt render ID, a historical parent, preserved source-photo linkage, persisted owner instructions, and the same job ID on replay. The latest change remained visible after a real page reload.
- **Known limitation or blocker:** The frozen seeded critical-failure corpus and all five owner revision scenarios still need to run as the complete P1.3 phase gate. No external blocker affects the implemented revision path.
- **Next unchecked slice:** freeze and execute the full P1.3 seeded corpus plus five owner revision scenarios, then record the strict gate and owner decision.
