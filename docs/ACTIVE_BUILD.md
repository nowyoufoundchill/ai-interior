# Active Build — P0.5 Guided Workflow and Recovery

**Updated:** 2026-07-12

**Application baseline:** P0.4 merge `21409999ecc9d321ce03b74d570d7ea83f07817e`; this documentation reset is the handoff to P0.5

**Accepted complete:** P0.0 through P0.4

**Current phase:** P0.6

**External blocker:** None

## P0.6 Objective

Prove the minimum homeowner workflow is reliable across fresh seeded runs before selecting P1 work. Automated checks must be repeatable and leave no test residue; live and owner-scored checks remain explicit release activities.

## Slice 1 - One configurable automated release runner

- [x] Run typecheck and production build once, then run the selected focused suites against mock mode.
- [x] Fresh-seed every suite so state never leaks between lifecycle boundaries.
- [x] Always run teardown and residue checks after each seeded suite.
- [x] Allow a comma-separated `P06_SUITES` subset for focused development while keeping a complete default gate.
- [ ] Run the complete automated P0.6 gate from a fresh isolated test project.

**Slice outcome:** one command owns the automated P0.6 lifecycle and fails closed when test isolation is unavailable.

Run `npm.cmd run verify:p0-6` for the complete gate, or set `P06_SUITES=integrity,p05Browser` for a focused subset.

## P0.5 Objective (completed)

Make the correct next step obvious from every persisted room state, restore durable work after refresh or navigation, and replace dead-end or alert-only failures with useful inline recovery.

This phase should produce visible homeowner clarity. It is not a general refactor or another infrastructure program.

## Slice 1 — One next-action resolver

- [x] Add a pure room-level `recommendedNextAction(state)` resolver.
- [x] Return one primary action, no more than two secondary actions, the target tab, and a short reason.
- [x] Cover at least these persisted states: no photos, ready for diagnosis, ready for concepts, concepts need approval, ready to render, batch active, partial batch failure, renders ready for review, stale downstream work, and terminal failure.
- [x] Add fast table-driven tests for the resolver without requiring a database, browser, or seeded environment.
- [x] Replace the independently computed room header hint, path step, initial tab, and panel-level primary action with this shared result.

**Slice outcome:** the same persisted room state recommends the same action everywhere.

## Slice 2 — Persisted progress across navigation

- [x] Load the latest active, retryable, or owner-actionable terminal room job with workspace data, including failed children of a partial batch.
- [x] Render one shared owner-facing progress/recovery treatment for diagnosis, render, batch, and confirmed chat work.
- [x] Restore progress automatically after refresh or reopen and poll only while work is active.
- [x] Surface a concise active/failing status on home and dashboard room cards.
- [x] Ensure duplicate clicks continue to resolve to the same logical job.

**Slice outcome:** navigation never makes running or failed work disappear.

## Slice 3 — Inline recovery and accessibility

- [x] Replace remaining alert-only generation failures in the room workflow with inline notices that preserve owner input.
- [x] Explain what failed, what was saved, and the next available action.
- [x] Explain stale artifacts and provide the correct rerun path.
- [x] Announce progress, completion, and failure through appropriate live regions.
- [x] Preserve or intentionally restore keyboard focus after completion and failure.
- [x] Browser-test success, retryable failure, terminal failure, duplicate click, refresh/reopen, and partial batch recovery.

**Slice outcome:** a homeowner can recover without refreshing, retyping, or interpreting internal terminology.

## Non-goals

- Analytics or telemetry instrumentation.
- First-render celebration or new motion treatments.
- Five concept directions or concept-editor expansion.
- Full six-room command-center redesign.
- Broad extraction of `room-workspace.tsx` or job runners without a slice-driven need.
- Re-running P0.0–P0.4 gates unless a changed dependency causes a focused regression.

## Phase gate

P0.5 is complete only when:

- every named lifecycle fixture resolves to the intended primary action;
- no room-generation failure is presented only through `alert()`;
- refresh at each active stage restores meaningful persisted progress;
- no successful action requires manual refresh;
- partial batch failure prioritizes retrying failed perspectives without touching successful siblings;
- stale work explains its cause and offers the correct next action;
- keyboard and screen-reader users receive progress and completion feedback without losing their place;
- the affected journey has zero new console errors and zero unexpected failed requests;
- typecheck and production build pass;
- the focused P0.5 browser/state suite passes from a fresh seed;
- teardown and residue checks pass.

Create fast focused tests with Slice 1. For the integrated gate, prefer one configurable verification runner; do not copy another phase-specific server/seed wrapper.

## Verification cadence

Per slice:

1. `npm.cmd run typecheck`
2. fast focused tests for changed logic
3. one affected browser path when UI changed

At phase close:

1. `npm.cmd run build`
2. focused P0.5 browser/API/persisted-state suite from a fresh seed
3. one functional E2E regression journey
4. teardown and `npm.cmd run check:residue`

The full responsive, accessibility, live-provider, and two-homeowner matrix belongs to P0.6.

## Handoff format

Replace this section at the end of each slice with five concise bullets:

- Outcome delivered
- Files or migration changed
- Focused verification
- Known limitation or blocker
- Next unchecked slice

Do not append a second narrative log.

## Slice 1 handoff

- Outcome delivered: one pure resolver now drives room reason, initial tab, path step, and panel action labels across the named persisted states.
- Files or migration changed: added `lib/room/recommended-next-action.ts` and its focused suite; room workspace queries now load recent durable jobs and batch child status.
- Focused verification: `npm.cmd run typecheck`; `npm.cmd run suite:recommended-next-action` (11 cases); `npm.cmd run build`.
- Known limitation or blocker: no blocker; the focused suite uses Node's experimental TypeScript stripping warning.
- Next unchecked slice: Slice 2 - Persisted progress across navigation.

## After P0.5

Run the P0.6 two-room household gate before selecting P1 work. Use the observed homeowner failures to choose the next investment among concept quality, editing, diagnosis, sourcing, six-room navigation, or polish; do not automatically execute every P1 phase in the historical order.

## Slice 2 handoff

- Outcome delivered: persisted active and recoverable room jobs remain visible across dashboard, home, room refresh, and reopen; active work polls and failed work offers inline retry/open recovery.
- Files or migration changed: extended `lib/data/queries.ts`, added `components/jobs/persisted-job-notice.tsx`, and updated dashboard, home, and room workspace surfaces.
- Focused verification: `npm.cmd run typecheck`; `npm.cmd run suite:recommended-next-action`; `npm.cmd run build`; `git diff --check`.
- Known limitation or blocker: no blocker; a browser-level persisted-state suite still belongs to the phase gate.
- Next unchecked slice: Slice 3 - Inline recovery and accessibility.

## Slice 3 progress handoff

- Outcome delivered: room-generation failures are inline and input-safe; stale artifacts expose rerun controls; progress, completion, and failure use live regions with focus restoration.
- Files or migration changed: updated `components/rooms/room-workspace.tsx`; no migration required.
- Focused verification: `npm.cmd run typecheck`; `npm.cmd run build`; `git diff --check`; local production server responds with HTTP 200.
- Known limitation or blocker: with `AI_MODE=mock`, `suite:jobs` ran 19/22; three stale-job checks race the background executor, and residue cleanup reports 65 pre-existing production test rows/objects from older runs. Browser coverage remains unchecked.
- Next unchecked slice: none in P0.5; run the phase gate and then select P0.6.

## Slice 3 browser-test handoff

- Outcome delivered: one focused browser/state suite covers success, retryable and terminal failure, duplicate submission, refresh/reopen, and partial-batch retry through owner-facing UI.
- Files or migration changed: added `scripts/suites/p05-browser.mjs` and the `suite:p05-browser` package script; no migration required.
- Focused verification: `npm.cmd run typecheck`; `npm.cmd run suite:p05-browser`; `npm.cmd run build`; `git diff --check`.
- Known limitation or blocker: the suite requires a fresh seeded mock run and the existing test-environment isolation policy.
- Next unchecked slice: none in P0.5; run the phase gate and then select P0.6.

## P0.6 Slice 1 handoff

- Outcome delivered: one configurable mock release runner now owns typecheck/build, fresh seeding, focused suites, teardown, and residue checks.
- Files or migration changed: added `scripts/verify-p0-6.mjs` and the `verify:p0-6` package script; no migration required.
- Focused verification: `node --check scripts/verify-p0-6.mjs`; `npm.cmd run typecheck`; `npm.cmd run build`; fail-closed preflight without `.env.test`.
- Known limitation or blocker: the gate uses the owner-acknowledged production test mode when `.env.test` is absent; teardown and residue remain mandatory.
- Next unchecked slice: run the complete automated P0.6 gate through the configured isolation mode.
