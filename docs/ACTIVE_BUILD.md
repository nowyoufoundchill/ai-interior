# Active Build — P0.6 Reliability Foundation Close

**Updated:** 2026-07-12

**Application baseline:** `9c3599358e44a7cc16c1e5eb5403b32c40e42b47`

**Accepted complete:** P0.0 through P0.5

**Current phase:** P0.6

**Next committed phase:** P1.1 — Three-Room Benchmark and Outcome Contract

**External blocker:** None

`PRODUCT.md` owns the replacement P1.1–P1.6 product and phase contract. This file owns only the current unchecked work and its immediate handoff.

## P0.6 objective

Close the already-built durability, recovery, and verification foundation before changing the homeowner journey. P0.6 proves that the existing system can run repeatably from a fresh configured seed and clean up after itself.

P0.6 is a reliability baseline. It does not certify the current diagnosis → concepts → render interface as the future product or as household-ready.

## Current slice — Run the complete automated gate

- [x] Provide one configurable release runner that performs typecheck and production build once.
- [x] Fresh-seed every selected suite so state does not leak across lifecycle boundaries.
- [x] Always run teardown and residue checks, including after failure.
- [x] Support focused `P06_SUITES` subsets while keeping the complete default gate.
- [x] Fail closed unless the configured test environment is isolated or the repository contains the explicit owner-approved production-test acknowledgment.
- [x] Run the complete default gate through the configured approved test mode.
- [x] Fix only failures that cross the P0 durability, recovery, accessibility, or test-isolation boundary.
- [x] Write one concise immutable gate report under `reports/` with commit, environment mode, suites, failures/retries, residue result, and final status.

Run:

```powershell
npm.cmd run verify:p0-6
```

For focused development only:

```powershell
$env:P06_SUITES="integrity,p05Browser"
npm.cmd run verify:p0-6
```

## P0.6 gate

P0.6 completes only when:

- typecheck and production build pass;
- the complete configured mock suite set passes from fresh tagged state;
- when the approved production project is used, every mutation carries the current `test_run_id`, teardown runs after every suite, and verified residue is zero;
- duplicate actions resolve to one logical durable job;
- refresh and reopen restore active and recoverable work;
- partial batch failure preserves successful perspectives and retries only failed work;
- failure and stale states provide plain-language recovery without losing owner input;
- required progress, completion, and failure announcements remain accessible;
- teardown completes and the residue check is zero;
- the immutable gate report exists.

Do not add legacy workflow UI, extra concepts, or new product behavior merely to make this gate larger. A failure outside the P0 boundary is recorded for the relevant P1 phase.

## Preserved foundation for P1

- Append-only artifact and version history.
- Durable, bounded, idempotent long-running work.
- Checkpointed paid output where supported.
- Refresh, reopen, retry, and duplicate-submit recovery.
- Successful batch siblings survive partial failure.
- Typed homeowner facts outrank inference.
- Service credentials and provider access remain server-side.
- Accessible progress and recovery are part of every future slice.

## Current non-goals

- Improving the legacy diagnosis, concept, product, or tabbed workspace.
- Adding five concepts or a full concept editor.
- Running the paid three-room comparison matrix.
- Building the brief compiler, image critic, implementation package, or multi-room view.
- Broad refactors, analytics, authentication, billing, deployment, or provider changes.

## Next phase preview — P1.1

After the P0.6 report is green, replace this file with the P1.1 active slices. P1.1 will:

1. place raw benchmark assets for `OPENPLAN-01`, `CHILDROOM-01`, and `GARAGE-01` under ignored `benchmarks/private/`, and commit only redacted manifests/checksums under `reports/`;
2. record original minimal homeowner inputs when available and mark missing input unknown rather than inventing it;
3. freeze the source-preservation and design-quality rubric from `PRODUCT.md`;
4. preserve the supplied ChatGPT images as fixed manual references with unknown historical settings where necessary, then capture controlled full-prompt, compact-brief, and current-pipeline candidates with the same source and current image model/settings;
5. record provider calls, tokens, elapsed time, and estimated cost;
6. select the shortest P1.2 pipeline that preserves or improves the delivered result.

Paid benchmark calls require a bounded plan and owner authorization. P1.1 measures before it optimizes; it does not improve prompts or rebuild the UI while establishing the baseline.

## Handoff format

Replace the handoff below; do not append another log.

- **Outcome delivered:** complete P0.6 reliability gate is green in the owner-approved production test mode; the runner now records an immutable report, avoids wildcard-port collisions, tears down the exact seeded run, and supports fresh failure-fixture/browser journeys.
- **Files or migrations changed:** `scripts/verify-p0-6.mjs`, `scripts/suites/failure-fixtures.mjs`, `scripts/suites/_journey.mjs`, `scripts/suites/p05-browser.mjs`; no migration.
- **Focused verification:** `node --check` for changed suites; focused `failureFixtures` gate green (29/29); focused browser gates green (`p05Browser` 22/22, `assetsResponsive` 57/57); complete `npm.cmd run verify:p0-6` green with typecheck/build, all seven suites, teardown, and zero residue.
- **Gate report:** [`reports/p0-6-gate-1783913623123-9c35993.md`](/C:/Users/darre/Documents/AI%20Interior%20Designer/reports/p0-6-gate-1783913623123-9c35993.md)
- **Known limitation or blocker:** none for P0.6. P1.1 remains the next committed phase.
- **Next unchecked slice:** replace this handoff with the P1.1 active slices after the green P0.6 report.
