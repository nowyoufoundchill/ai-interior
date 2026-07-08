---
name: atelier-design-review
description: Run PRD v3 Suite 5 (Design brain & feel) — screenshot every screen/state at three widths, then have a fresh-context reviewer agent score each against the §3/§11 rubric. Two-phase; the second phase requires spawning a subagent.
---

# atelier-design-review

Runs against a **fresh `npm run seed:test` state**. Two phases: mechanical capture (scriptable), then judgment (requires a fresh-context agent — a script cannot do this part).

## Phase 1 — Capture (scriptable)

Preconditions: dev server on `AI_MODE=mock`, fresh seed, Playwright Chromium installed.

```
npm run suite:design-review
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
   - The rubric: PRD v3 §3 UI register ("calm, editorial, premium... no dashboard-y clutter") and §11 quality bar ("specific to this room... banned: generic 'rug and plants' advice, vague design language, furniture that ignores typed dimensions, three concepts that feel the same, products without a why").
   - Instructions to score each screen 1–10 and flag any rubric violation by name.
3. Take the subagent's per-screenshot scores and violations, and write them to `test-runs/suite-results/design-review.json` in the same shape the other suites use (`{ suite, ranAt, total, passed, failed, checks: [{description, passed, detail}] }`) — one `check` per screenshot, `passed = score >= 8 with zero violations`.

## Pass condition

Every screen scores ≥8/10 with zero rubric violations (PRD v3 §12.1 Suite 5). Reviewer findings that recur across cycles must be encoded back into this rubric description, not just fixed once — the system should stop reproducing the same class of finding.

## On failure

Fix the UI/copy, then **reseed and re-run both phases from a clean state**.
