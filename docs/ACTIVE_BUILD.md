# Active Build - P1.4 Implementation-ready room package

**Updated:** 2026-07-18

**Application baseline:** `ef337b8e57ca350d89705c5130c4bc65e85364db`

**Accepted complete:** P0.0 through P1.3

**Current phase:** P1.4

**Next committed phase:** P1.4 - Implementation-ready room package

**Approval gate:** The additive `implementation_packages` migration is created but intentionally not applied to the configured production project without explicit owner approval.

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

## Current slice - P1.4 implementation-ready room package

- [ ] Bind one provenance-aware room plan and furnishing schedule to the accepted design, exposing honest measurement and field-verification tasks before product sourcing expands.

## Current non-goals

- Improving the legacy diagnosis, concept, product, or tabbed workspace outside the accepted-design implementation package.
- Substituting test or spike images for owner benchmark evidence.
- Reconstructing unknown prompts, settings, homeowner input, or clearances.
- Running the paid three-room comparison matrix.
- Building the multi-room view.
- Broad refactors, analytics, authentication, billing, deployment, or provider changes.

## Handoff format

Replace the handoff below; do not append another log.

- **Outcome delivered:** P1.4 code is ready for its configured-project gate. An accepted render now compiles into an append-only, versioned implementation package with placement guidance, a ten-item furnishing schedule, explicit product classifications, provenance on every implementation claim, linked field tasks for unknown dimensions, a reconciled budget range, and an installation sequence. Accepting a newer design stales rather than deletes the prior package. Replay-safe job routing, persistence, owner-facing measure/buy/do-next UI, teardown, residue detection, and a full browser gate are implemented.
- **Files or migrations changed:** Added `supabase/migrations/20260718162713_implementation_packages.sql`, the implementation schema/compiler/fixture/job/route/prompt, and `scripts/suites/p14-implementation-package.mjs` plus `scripts/verify-p1-4.mjs`; extended typed database access, room queries/page/workspace, accepted-design invalidation, debug state, job dispatch, package scripts, teardown, and residue checks. P1.3's previously completed uncommitted files remain in the same working tree.
- **Focused verification:** `npm.cmd run typecheck`, `npm.cmd run build`, `git diff --check`, and both P1.4 script syntax checks pass. The ten deterministic sourcing URLs all return HTTP 200 under Node fetch with redirects, including the exact links the browser gate will sample. The migration is not applied, so the tagged persistence/browser/residue gate has not been run yet.
- **Known limitation or blocker:** Applying a migration to the configured production Supabase project requires explicit owner approval. The local migration-list check could not connect because no local Supabase database is running. The phase also requires an owner usefulness rating of at least 8/10 after the complete package is visible; the verifier records this from `P14_OWNER_USEFULNESS_RATING` and does not invent it.
- **Next unchecked slice:** With explicit approval, apply the additive `implementation_packages` migration, run `npm.cmd run verify:p1-4` with a fresh tagged mock-AI seed and the owner's usefulness rating, confirm zero residue, then mark P1.4 accepted complete.
