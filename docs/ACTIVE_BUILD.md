# Active Build - P1.5 Whole-home continuity and multi-room persistence

**Updated:** 2026-07-18

**Application baseline:** `ef337b8e57ca350d89705c5130c4bc65e85364db`

**Accepted complete:** P0.0 through P1.4

**Current phase:** P1.5

**Next committed phase:** P1.5 - Whole-home continuity and multi-room persistence

**External blocker:** P1.5 requires at least three accepted real-room designs for final acceptance. The read-only production count is currently two. The scoped continuity implementation and deterministic six-room gate are complete; a third real-room candidate exists but must be accepted by the owner rather than by automation.

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

## Completed slice - P1.3 seeded phase gate

- [x] Freeze and run the complete seeded finished-image corpus and five owner revision scenarios required by the P1.3 gate, then record owner acceptance without weakening the zero-critical-miss requirement.

## Completed slice - P1.4 implementation-ready room package

- [x] Bind one provenance-aware room plan and furnishing schedule to the accepted design, exposing honest measurement and field-verification tasks before product sourcing expands.

## Next slice - P1.5 real-room acceptance evidence

- [ ] Reach three accepted, materially different real-room designs before final P1.5 acceptance.

## Completed slice - P1.5 scoped continuity implementation

- [x] Apply confirmed home decisions to each new first-design brief while keeping typed room facts and room-only exceptions scoped to that room.
- [x] Replace the text-only room list with a simple visual room index showing the correct source/latest design, persisted lifecycle state, and one-tap next action.
- [x] Prove six distinct seeded lifecycle states, navigation/reload persistence, three-room shared-decision inheritance, room-exception isolation, and zero cross-room artifact/job leakage.

## Completed reliability fix - direct room-photo uploads

- [x] Move browser photo bytes out of the Vercel request path and upload them directly to Supabase Storage with a short-lived, server-issued signed token.
- [x] Finalize only server-scoped objects that exist, are non-empty, and belong to the requested room; preserve the legacy multipart endpoint for existing automation compatibility.
- [x] Inherit `test_run_id` when creating rooms under tagged homes so browser-created test artifacts and Storage objects remain teardown-safe.
- [x] Prove the initial-intake flow with a 6 MB JPEG, including immediate workspace visibility and zero application-function photo-byte requests.

## Current non-goals

- Improving the legacy diagnosis, concept, product, or tabbed workspace outside the accepted-design implementation package.
- Substituting test or spike images for owner benchmark evidence.
- Reconstructing unknown prompts, settings, homeowner input, or clearances.
- Running the paid three-room comparison matrix.
- Building a complex multi-room command center or automated whole-home generation.
- Broad refactors, analytics, authentication, billing, deployment, or provider changes.

## Handoff format

Replace the handoff below; do not append another log.

- **Outcome delivered:** P1.5 implementation is complete. Confirmed home decisions now enter every first-design compiler as explicit shared context, while each room's typed facts, existing items, and exceptions remain local and higher priority. The home page is now a calm visual room index with the correct source photograph or latest design, plain-language persisted state, and one-tap next action. Active and failed work remains visible after navigation and reload. Room-photo intake now sends image bytes directly from the browser to signed Supabase Storage, preventing large photos from being rejected by the Vercel function request limit and leaving a room stuck asking for its first photo.
- **Files or migrations changed:** scoped whole-home memory compiler; first-design job/compiler integration; room-index lifecycle derivation; enriched home query; home preference and visual room-index UI; signed-upload authorization route; verified photo-finalization route; shared browser upload client; all three room-photo intake surfaces; tagged-room inheritance; `scripts/suites/p15-continuity-logic.mjs`; `scripts/suites/p15-whole-home.mjs`; `scripts/suites/photo-upload-direct.mjs`; `scripts/verify-p1-5.mjs`; package scripts; `reports/p1-5-gate-1784416122819-ffc31c4.md`; and this handoff. No migration or production schema change was required.
- **Focused verification:** `npm.cmd run verify:p1-5` passes the technical gate from a production build. Scoped logic proves three materially different room types inherit identical shared decisions without room-only leakage. The browser/data journey passed 27/27 checks across six lifecycle states, correct source/result binding, one-tap actions, reload persistence, cross-room isolation, and zero console/application-network failures. `npm.cmd run suite:photo-upload-direct` passed 8/8 with a 6 MB JPEG through the real new-room intake: the application received only two small JSON requests, the browser uploaded the complete object directly to signed Storage, the tagged photo row was persisted, and the workspace displayed it immediately. TypeScript and the production build pass. Fresh tagged teardowns and the independent residue gate passed across every tracked table and Storage after both browser runs.
- **Known limitation or blocker:** Final P1.5 acceptance remains owner-blocked at two of three accepted, materially different real rooms. A third untagged real-room candidate is persisted for `Master`, but automation did not mark it accepted. The technical gate report records `REAL-ROOM ACCEPTANCE PENDING`.
- **Next unchecked slice:** The owner reviews and either accepts the existing `Master` candidate or accepts another materially different real-room design. Then rerun `npm.cmd run verify:p1-5`; when the read-only count reaches three, mark the P1.5 precondition and phase gate complete and advance to P1.6.
