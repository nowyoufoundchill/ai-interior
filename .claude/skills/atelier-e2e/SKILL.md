---
name: atelier-e2e
description: Run PRD v3 Suite 2 (Functional E2E) — drives a real browser through the full room journey (diagnosis, concepts, edit/re-harmonize/lock, products, renders, chat) using only data-testid selectors, AI_MODE=mock.
---

# atelier-e2e

Runs against a **fresh `npm run seed:test` state**.

## Preconditions

1. Dev server running with `AI_MODE=mock`:
   ```
   AI_MODE=mock npm run dev
   ```
2. `npm run seed:test` has just been run.
3. Playwright's Chromium browser is installed (`npx playwright install chromium` if not).

## Run

```
npm run suite:e2e
```

Equivalent to `node scripts/suites/e2e.mjs`.

## Driver choice

The script uses Playwright, not chrome-devtools MCP: this suite must be re-runnable unattended as part of `npm run suite:e2e` / the verification cycle, and MCP browser tools are only callable from an agent's own tool-calling loop, not from a standalone Node script. When a human agent is doing ad hoc, one-off browser verification in-session (not running this script), prefer chrome-devtools MCP per `BUILD_PLAN.md`.

## What it checks

Full journey via `data-testid` only, on the seeded room (home/room/photos already exist from `seed:test` — this suite does not create a new home/room through the raw UI, since that would create test data outside `seed:test`'s `test_run_id` teardown coverage):

- Diagnosis generation.
- Concept generation (exactly 3), inline edit, inline re-harmonize, lock.
- Locked concept no longer shows a direct Edit control (must unlock first — mirrors the Suite 1 integrity rule at the UI layer).
- Product generation, approve, reject.
- Render generation and regenerate-with-instructions (history kept — two render cards).
- Chat: a "why" question, then a revision-request turn tagged "Proposal only" (chat never silently mutates state).
- **Zero new console errors and zero failed network requests across the entire journey** — this is a hard pass/fail gate, checked in a `finally` block regardless of where an earlier assertion failed.

## Output

- Console pass/fail per assertion.
- `test-runs/suite-results/e2e.json`.

## On failure

Fix the app, then **reseed and re-run this suite from a clean state**.
