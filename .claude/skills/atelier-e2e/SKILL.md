---
name: atelier-e2e
description: Run the current functional E2E suite through the room journey in a real browser using stable selectors and AI_MODE=mock.
---

# atelier-e2e

Runs against a **fresh `npm.cmd run seed:test` state** under `docs/OPERATIONS.md`.

## Preconditions

1. Test-bound dev server running in mock mode:
   ```
   npm.cmd run dev:test
   ```
2. `npm.cmd run seed:test` has just been run.
3. Playwright's Chromium browser is installed (`npx.cmd playwright install chromium` if not).

## Run

```
npm.cmd run suite:e2e
```

Equivalent to `node scripts/suites/e2e.mjs`.

## Driver choice

The script uses Playwright so it can run unattended and repeatably. Use an interactive browser for focused in-session verification that is not becoming a reusable suite.

## What it checks

Full journey via `data-testid` only, on the seeded room (home/room/photos already exist from `seed:test` — this suite does not create a new home/room through the raw UI, since that would create test data outside `seed:test`'s `test_run_id` teardown coverage):

- Diagnosis generation.
- Concept generation (exactly 3), inline edit, inline re-harmonize, lock.
- Locked concept no longer shows a direct Edit control (must unlock first — mirrors the Suite 1 integrity rule at the UI layer).
- Product generation, approve, reject.
- Render generation and regenerate-with-instructions (history kept — two render cards).
- Chat: a "why" question, then a structured revision proposal with explicit Apply and a durable result linked back into the thread.
- **Zero new console errors and zero failed network requests across the entire journey** — this is a hard pass/fail gate, checked in a `finally` block regardless of where an earlier assertion failed.

## Output

- Console pass/fail per assertion.
- `test-runs/suite-results/e2e.json`.

## On failure

Fix the app, then **reseed and re-run this suite from a clean state**.
