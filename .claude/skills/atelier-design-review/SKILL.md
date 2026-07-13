---
name: atelier-design-review
description: Capture the legacy P0 owner-facing states at three widths and review mechanical/brand regressions without treating the old workflow as the P1 product contract.
---

# atelier-design-review

> **Legacy P0 capture only:** this records the currently implemented tabbed journey. It is not part of `verify:p0-6`, does not define the replacement P1 experience in `docs/PRODUCT.md`, and must not trigger work that preserves obsolete tabs or concept ceremony. P1.2 replaces this contract.

Runs against a **fresh `npm.cmd run seed:test` state**. Two phases: mechanical capture (scriptable), then judgment (requires a fresh-context agent — a script cannot do this part).

## Phase 1 — Capture (scriptable)

Preconditions: dev server on `AI_MODE=mock`, fresh seed, Playwright Chromium installed.

```
npm.cmd run suite:design-review
```

Equivalent to `node scripts/suites/design-review.mjs`. Captures, at 390/768/1440px:

- Empty states: Diagnosis, Concepts, Products, Renders, Chat tabs before anything is generated.
- Populated states: same tabs after diagnosis → 3 concepts → lock → products → a render.
- A hover state on a concept card.
- A stale state: diagnosis re-run after a concept was locked, so the concept set shows its stale badge.

Output: `test-runs/screenshots/design-review/*.png`, a `manifest.json` (file/width/tab/state for every screenshot), and `state-snapshot.json` (the room's debug-endpoint state for cross-reference).

**Known deviation**: no draggable before/after slider exists (see `atelier-assets-responsive`), so no "mid-drag slider" state is captured — the Before/After side-by-side state stands in for it.

## Phase 2 — Score (requires a fresh subagent)

The orchestrating agent must:

1. Read `test-runs/screenshots/design-review/manifest.json`.
2. Spawn a **fresh-context** subagent (it must not be the agent that wrote the room-workspace UI code — that agent's read of its own work is not independent) with:
   - The list of screenshot file paths from the manifest.
   - The legacy-capture rubric: image loading, no clipping/overflow, readable hierarchy, usable tap targets, calm brand execution, and no raw provider/model/error terminology.
   - Instructions to score each screen 1–10 and separately record gaps against the new deliverable-forward contract as expected migration work, not P0 failures.
3. Take the subagent's per-screenshot scores and violations, and write them to `test-runs/suite-results/design-review.json` in the same shape the other suites use (`{ suite, ranAt, total, passed, failed, checks: [{description, passed, detail}] }`) — one `check` per screenshot, `passed = score >= 8 with zero violations`.

## Pass condition

Every screen scores ≥8/10 on the legacy-capture rubric. Do not fail or expand P0 because the old workflow differs from the replacement product contract.

## On failure

Fix only a regression against the legacy-capture rubric, then **reseed and re-run both phases from a clean state**. Product-contract migration belongs to the active P1 slice.
