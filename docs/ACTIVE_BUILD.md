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

## Completed reliability fix - phone HDR photo ingestion

- [x] Identify why every live Sunburst edit of an owner phone photo returned `invalid_image_file` after organization verification cleared.
- [x] Strip the APP2 `MPF` multi-picture index and any appended sibling image from source JPEGs at the image-edit boundary, preserving EXIF orientation, ICC profile and primary scan bytes.
- [x] Give an unreadable source photo its own actionable, saved-work owner message instead of the generic no-response copy.
- [x] Record the applied normalizations on the persisted request body so job diagnostics show what was changed.
- [x] Prove the fix against the owner's real failing photo through the running application, end to end, at production quality.

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

- **Outcome delivered:** Live first designs from real phone photographs now succeed. After organization verification cleared, every Sunburst edit still failed with `invalid_image_file` ("Invalid image file or mode for image 1"). The cause was the source photograph, not the provider upgrade: modern iPhone HDR captures are multi-picture JPEG containers carrying an APP2 `MPF` index plus a gain-map image appended after the primary image's EOI, and the image-edit decoder rejects that container. `lib/ai/image-normalize.ts` removes the MPF index and any appended sibling image at the upload boundary; EXIF orientation, the ICC profile and every primary scan byte are preserved untouched, and non-JPEG or malformed input is returned unchanged. Because the fix sits at the provider boundary rather than at intake, photographs already in Storage are repaired without re-upload.
- **Diagnosis evidence:** Bisected marker by marker against the live endpoint using the owner's own `IMG-1221.jpeg`. Removing only the 88-byte APP2 `MPF` segment turned the identical 2.6 MB file from `400 invalid_image_file` into `200 OK`; dropping EXIF, ICC, AROT, the ISO 21496 gain-map metadata, or the appended image alone all still failed. Ruled out as causes: the model (`gpt-image-1` rejects the same file identically), the request shape (`image[]` vs `image`, `size` auto/fixed/omitted), file size and pixel dimensions. Both `gpt-image-2.5-sunburst` and the pinned `gpt-image-2.5-sunburst-2026-09-08` are present in the organization's model list; the pinned snapshot is retained. 6 of the 13 most recent stored photographs carry the MPF marker - every `IMG-*.jpeg` straight off a phone - while the older `spike/input-images/IMG_1126.jpg` suite fixture does not, which is why no existing suite caught this.
- **Files changed:** `lib/ai/image-normalize.ts` (new), `lib/ai/openai.ts` (normalize each source image before upload, record `source_image_normalizations` on the request body, add the unreadable-photo owner message), `scripts/suites/openai-render-contract.mjs` (synthetic multi-picture JPEG fixture and four new checks). No database migration, no intake change, no provider change, no quality change - `OPENAI_IMAGE_QUALITY` remains `high`.
- **Focused verification:** `npm.cmd run typecheck` and `npm.cmd run build` pass. `suite:openai-render-contract` passes 13/13, including that a multi-picture JPEG loses the MPF index and appended image while EXIF/ICC/scan bytes survive, that ordinary JPEG, PNG and malformed bytes are returned untouched, and that the edit request uploads the normalized bytes. Live proof at `quality: high`: job `41c47a8b-0867-436e-9849-248e4a315c2f` for room `16d0d669-5108-46d0-9b18-9e3aac16d31c` ran from the application in a real browser, cleared `creating your room design` on attempt 1, and completed in about three minutes through review and persistence, where the same photo had failed three times. It persisted candidate render `53424004-1a09-437b-a1d1-c41e07093850` bound to source photo `1b70e2b1`, quality score 88, `gpt-5.6-sol` + `gpt-image-2.5-sunburst-2026-09-08`, normalizations `dropped_app2_mpf_index` and `dropped_appended_image_bytes:290103`, 2,832 tokens on the direct boundary probe. The finished 1672x941 image retains the vaulted ceiling line, all four window openings, the existing chandelier, the door and its hardware.
- **Current blocker:** Production still runs the pre-fix code, so the deployed app at `ai-interior-theta.vercel.app` continues to fail on phone photographs. The fix is committed-ready but unpushed; pushing to `main` and deploying is an explicit stop condition and needs the owner's decision.
- **Next unchecked slice:** Owner decision on pushing this fix to `main` and deploying. After deployment, retry the saved room direction on an actual phone and continue the pending P1.6 owner/live acceptance matrix for three materially different real rooms.
