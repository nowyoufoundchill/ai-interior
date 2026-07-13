---
name: atelier-integrity
description: Run the current artifact integrity and invalidation suite through the app's API routes and read-only debug state endpoint.
---

# atelier-integrity

> **Legacy P0 verification:** the current rows and invalidation routes remain useful transition evidence, but the accepted design version in `docs/PRODUCT.md` is the future downstream contract. Update these assertions with the P1 data transition; do not treat mood-board ceremony as permanent.

Runs against a **fresh `npm.cmd run seed:test` state** under `docs/OPERATIONS.md`; never verify against dirty seeded state.

## Preconditions

1. The test-bound dev server is running in mock mode (this suite must never spend real provider money):
   ```
   npm.cmd run dev:test
   ```
2. `npm.cmd run seed:test` has just been run (writes `test-runs/current.json`).

## Run

```
npm.cmd run suite:integrity
```

Equivalent to `node scripts/suites/integrity.mjs`.

## What it checks

Transitional regression rules for the currently implemented diagnosis/mood-board data model, driven through real API calls (not raw SQL) against the seeded room, then asserted via `GET /api/debug/room-state/[roomId]`:

- New photo → current diagnosis marked `stale`, kept (not deleted), nothing else touched.
- Diagnosis re-run → existing mood boards marked `stale`, kept.
- Editing a **locked** concept is rejected (400) — editing requires explicit unlock first.
- Unlock → downstream products/renders marked `stale` immediately (not deferred to the next lock).
- Unlock + edit → new mood board version created, source version kept and marked `stale`, `parent_version` recorded.
- Render regenerated for the same source photo → old render kept and marked `stale`, new one becomes `current`.
- No row is ever deleted across the whole cycle (row counts only grow).

## Output

- Console pass/fail per assertion.
- `test-runs/suite-results/integrity.json` (machine-readable, same shape as every other suite).
- Non-zero exit code if anything failed.

## On failure

Fix the underlying route/UI code (not the test), then **reseed and re-run this suite from a clean state** — never re-verify a fix against the same dirty seeded room. If the same failure class recurs across cycles, update this skill file's assertions, not just the fix.
