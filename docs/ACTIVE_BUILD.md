# Active Build - P1.6 Personal household release gate

**Updated:** 2026-09-09

**Application baseline:** `ef337b8e57ca350d89705c5130c4bc65e85364db`

**Accepted complete:** P0.0 through P1.5

**Current phase:** P1.6

**Next committed phase:** P1.6 - Personal household release gate

**Release decision:** The owner explicitly requested pushing this upgrade to `main` for testing on the deployed app today, despite the OpenAI organization-verification requirement. Publish the tested upgrade; do not gate this release on a successful Sunburst image. The app preserves the compiled brief and displays an actionable verification error. Final P1.6 acceptance still requires the owner-scored three-room real-phone/live matrix and independent next-room choice.

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

## Completed slice - P1.5 real-room acceptance evidence

- [x] Reach three accepted, materially different real-room designs before final P1.5 acceptance.

## Completed slice - P1.5 scoped continuity implementation

- [x] Apply confirmed home decisions to each new first-design brief while keeping typed room facts and room-only exceptions scoped to that room.
- [x] Replace the text-only room list with a simple visual room index showing the correct source/latest design, persisted lifecycle state, and one-tap next action.
- [x] Prove six distinct seeded lifecycle states, navigation/reload persistence, three-room shared-decision inheritance, room-exception isolation, and zero cross-room artifact/job leakage.

## Completed reliability fix - direct room-photo uploads

- [x] Move browser photo bytes out of the Vercel request path and upload them directly to Supabase Storage with a short-lived, server-issued signed token.
- [x] Finalize only server-scoped objects that exist, are non-empty, and belong to the requested room; preserve the legacy multipart endpoint for existing automation compatibility.
- [x] Inherit `test_run_id` when creating rooms under tagged homes so browser-created test artifacts and Storage objects remain teardown-safe.
- [x] Prove the initial-intake flow with a 6 MB JPEG, including immediate workspace visibility and zero application-function photo-byte requests.

## Completed slice - P1.6 release matrix and technical gate

- [x] Freeze one redacted three-room owner evidence matrix, including real-phone timing and scoring, bounded live-provider ceilings, cost, preservation, revision, implementation-package, and next-room intent evidence.
- [x] Harden visible keyboard focus and live work status, and keep the first-result primary action in the phone viewport ahead of optional refinement.
- [x] Prove the current homeowner journey from phone intake through one reviewed design, one revision, acceptance, and one implementation package at 390, 768, and 1440 pixels with exact durable-operation counts, persistence, console/network health, teardown, and zero residue.
- [x] Run the integrated mock-mode technical release matrix from a production build across integrity, deterministic failures, finished-image review, five revision scenarios, implementation packages, whole-home persistence, direct large-photo upload, and the current P1.6 homeowner journey.

## Next slice - P1.6 owner phone and live-provider acceptance

- [ ] The owner completes and scores the frozen matrix for three materially different real rooms on an actual phone/browser without developer instruction, using the bounded live plan only after explicit authorization.
- [ ] Rerun `npm.cmd run verify:p1-6` after recording the redacted owner/live evidence; mark household-ready only if the frozen contract passes.

## Current non-goals

- Improving the legacy diagnosis, concept, product, or tabbed workspace outside the accepted-design implementation package.
- Substituting test or spike images for owner benchmark evidence.
- Reconstructing unknown prompts, settings, homeowner input, or clearances.
- Running the paid three-room comparison matrix.
- Building a complex multi-room command center or automated whole-home generation.
- Broad refactors, analytics, authentication, billing, deployment, or provider changes.

## Handoff format

Replace the handoff below; do not append another log.

- **Outcome delivered:** The owner's September 9 request explicitly authorizes this scoped provider/pipeline change. First designs and visual revisions now use `gpt-5.6-sol` to compile a strict `DesignRenderSpec` from source/supporting photos, typed geometry, room constraints, keep items, style and room memory. First designs also receive whole-home continuity; revisions receive the parent's compiled brief and current image. The renderer calls `/v1/images/edits` directly with `gpt-image-2.5-sunburst-2026-09-08`, an enforced Architecture Lock, PNG output, high quality and one image. Optional Concept mode uses `gpt-image-2.5-flare`; Designer Render remains the default.
- **Persistence and compatibility:** Specs and modes are checkpointed and stored with append-only renders; revisions preserve parent-render linkage and send the current image first and original architecture photo second. Older briefs remain readable. Finished-image reviews use the revised brief. Slow provider calls now refresh the active job heartbeat to avoid stale-job replay during a live edit. No database migration is required. Structured Responses requests preserve explicit low reasoning, high image detail and `store: false`; image model selection is separate from the general reasoning override. Existing independent Anthropic critics and legacy analysis/concept/chat services retain their provider roles. This is not a migration of every legacy reasoning service.
- **Files changed:** `lib/ai/openai.ts`, `render-contract.ts`, `services.ts`, `gateway.ts`, job executors/service, schema compatibility, a dedicated versioned render-spec prompt, first-design/revision APIs, optional render-mode controls, environment examples, and focused suites. The prompt loader now uses registered static assets; final deployment traces contain zero private benchmark, test-run or `.env.local` files. No commit, push or deployment was performed.
- **Focused verification:** Typecheck and final production build pass. `suite:openai-render-contract` passes 9/9; `verify:p1-3` passes finished-image review 21/21 and browser revisions 51/51 (`reports/p1-3-gate-1788973810167-5bf94f4.md`). The revised production prompt packaging was rechecked through the same five browser revision scenarios. Each mutation cycle uses fresh tagged test data with teardown and zero-residue checks. The existing middleware deprecation warning remains.
- **Live evidence and blocker:** One bounded test using the private `CHILDROOM-01` source produced a schema-valid Sol spec (returned model `gpt-5.6-sol`, 2,027 total tokens). The single Sunburst edit attempt was rejected: organization verification is required. The model-list endpoint misleadingly returned 404 for both Sunburst names and Flare; the image-edit endpoint supplied the actionable verification error. Private spec and response evidence are in ignored `benchmarks/private/sol-sunburst-smoke/`. No new image exists, so visual fidelity, Flare output, and complete live pipeline behavior are not certified. No model was silently substituted.
- **Next unchecked slice:** Push the tested upgrade to `main` and verify production deployment to the existing `ai-interior` project / `ai-interior-theta.vercel.app`, as explicitly requested by the owner. Preserve deployment secrets and verify image model overrides. The owner can then test on the app; image generation may require Verify Organization at `https://platform.openai.com/settings/organization/general` (up to 15 minutes propagation). After verification, retry the saved brief and inspect the real source/result pair. The independent P1.6 owner/live matrix remains pending.
