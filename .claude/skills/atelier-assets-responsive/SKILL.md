---
name: atelier-assets-responsive
description: Run the current asset and responsive suite at 390, 768, and 1440 pixels, checking images, overflow, clipping, and tap targets.
---

# atelier-assets-responsive

> **Legacy P0 verification:** this builds the current diagnosis/concept journey only to verify the existing application's assets and responsive behavior during P0.6. It is not the P1 product contract; update the fixture journey with P1.2 rather than preserving obsolete tabs.

Runs against a **fresh `npm.cmd run seed:test` state**. Builds its own diagnosis/concepts/locked-concept/products/render state first (via `scripts/suites/_journey.mjs`), then checks assets and layout.

## Preconditions

Same as `atelier-e2e`: dev server on `AI_MODE=mock`, fresh seed, Playwright Chromium installed.

## Run

```
npm.cmd run suite:assets-responsive
```

## What it checks

- Every `<img>` on every tab: HTTP 200 **and** rendered `naturalWidth > 0` (catches broken-image icons a 200 alone misses).
- At 390 / 768 / 1440px, for every tab: no horizontal scroll (`scrollWidth <= clientWidth`), and every visible `button[data-testid]`/`a[data-testid]` is ≥44×44px.
- Screenshots saved to `test-runs/screenshots/assets-responsive/`.

## Known, documented deviation

The shipped render comparison is a static Before/After presentation rather than a draggable slider. This suite checks both images render with non-zero bounds at every width. The product contract does not require a slider unless a future active phase adds one.

## Output

- Console pass/fail per assertion.
- `test-runs/suite-results/assets-responsive.json`.
- Screenshots for manual spot-check.

## On failure

Fix the app, then **reseed and re-run from a clean state**.
