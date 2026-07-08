---
name: atelier-assets-responsive
description: Run PRD v3 Suite 4 (Assets & responsive) — checks every image loads with real pixel dimensions, then re-walks the room tabs at 390/768/1440px checking for horizontal scroll, clipped controls, and tap target size.
---

# atelier-assets-responsive

Runs against a **fresh `npm run seed:test` state**. Builds its own diagnosis/concepts/locked-concept/products/render state first (via `scripts/suites/_journey.mjs`), then checks assets and layout.

## Preconditions

Same as `atelier-e2e`: dev server on `AI_MODE=mock`, fresh seed, Playwright Chromium installed.

## Run

```
npm run suite:assets-responsive
```

## What it checks

- Every `<img>` on every tab: HTTP 200 **and** rendered `naturalWidth > 0` (catches broken-image icons a 200 alone misses).
- At 390 / 768 / 1440px, for every tab: no horizontal scroll (`scrollWidth <= clientWidth`), and every visible `button[data-testid]`/`a[data-testid]` is ≥44×44px.
- Screenshots saved to `test-runs/screenshots/assets-responsive/`.

## Known, documented deviation

PRD v3 §8 specifies a draggable before/after slider on the Renders tab; the shipped UI is a static side-by-side Before/After comparison instead (see `components/rooms/room-workspace.tsx` `RendersPanel`). This suite checks both images render with a non-zero bounding box at every width instead of simulating a touch drag. This is flagged as an open item for owner judgment in the release report, not silently passed as equivalent.

## Output

- Console pass/fail per assertion.
- `test-runs/suite-results/assets-responsive.json`.
- Screenshots for manual spot-check.

## On failure

Fix the app, then **reseed and re-run from a clean state**.
