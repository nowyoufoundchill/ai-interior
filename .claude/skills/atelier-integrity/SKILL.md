---
name: atelier-integrity
description: Run PRD v3 Suite 1 (Integrity) — asserts the §4 invalidation table via the app's own API routes and the debug state endpoint, against a fresh seeded test room.
---

# atelier-integrity

Runs against a **fresh `npm run seed:test` state** (never dirty state — reseed before this suite per PRD v3 §12.4 cycle discipline).

## Preconditions

1. A dev server is running with `AI_MODE=mock` (this suite must never spend real provider money):
   ```
   AI_MODE=mock npm run dev
   ```
2. `npm run seed:test` has just been run (writes `test-runs/current.json`).

## Run

```
npm run suite:integrity
```

Equivalent to `node scripts/suites/integrity.mjs`.

## What it checks

Every row of the PRD v3 §4 invalidation table, driven through real API calls (not raw SQL) against the seeded room, then asserted via `GET /api/debug/room-state/[roomId]`:

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
