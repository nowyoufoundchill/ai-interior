# Trend Refresh Ritual

The design brain's taste currency lives in `lib/ai/context-brain/trend-intelligence.ts`
as dated, sourced `RegionalTrendBrief` data — not adjectives in a prompt. Taste
rots: what reads current in 2026 will read dated in a few years. This document
is the annual (or on-demand) procedure to refresh it **without losing history**.

## Principle: append, never overwrite

A trend brief is a provenance record. You do not edit `sc-luxury-2026` in place
when the market moves — you author a **new** brief (`sc-luxury-2028`, etc.) and
keep the old one. The resolver (`resolveRegionalTrendBrief`) auto-selects the
**newest** brief whose `region_match` matches the home region (sorted by the
`authored` date), so appending a newer brief automatically supersedes the old
one while the old one stays queryable for audit.

This is the same discipline the rest of the system uses (append-only concepts,
no destructive migrations): the brain should be able to explain *why* it thought
something was current at a point in time.

## Procedure

1. **Deep-research pass.** Commission or run a fresh trend report for the region
   and year (the first brief was distilled from an owner-provided South Carolina
   2026 luxury-interiors deep-research report). Cover: direction of travel with
   *mechanism* (why it reads expensive/current), material + palette vocabulary,
   sub-regional splits, the price-tier register, and — critically — what now
   **reads dated** (`reject_now`).

2. **Distill into a new brief object.** Add a new entry to `TREND_BRIEFS` with:
   - a fresh `brief_id` (e.g. `sc-luxury-2028`),
   - a new `authored` ISO date and a new `valid_through` year,
   - `sources` (the makers/reports/paint-of-the-year anchors, not vibes),
   - every field the type requires — `directional_theses` must carry `because`
     and `instead_of`, not just `move`.
   Keep the existing brief exactly as-is.

3. **Verify resolution.** Confirm `resolveRegionalTrendBrief("<region>")` now
   returns the new `brief_id` for in-region addresses, still returns `null` for
   off-brief regions (so we never invent a trend story), and that staleness
   flags correctly once `valid_through` passes.

4. **Read one real generation.** Run one `AI_MODE=live` concept pass for an
   in-region room and confirm the concepts express a current thesis with its
   mechanism and contain nothing on the new `reject_now`.

## Staleness safety net

Even without a refresh, the resolver still returns the newest matching brief but
sets `is_stale = true` once the current year passes `valid_through`, and the
compacted slices stamp `as_of: "... STALE — refresh"` so the pipeline (and any
reader of `/debug`) can see the taste layer is past its expiry and down-weight
it. Staleness is a prompt to run this ritual, not a silent failure.

## Optional: scheduled reminder

A scheduled Claude Code routine (see the `schedule` skill) can open a
"trend refresh" task each year near the `valid_through` boundary so the ritual
is not forgotten. This is a reminder to do the human research pass — it does not
auto-author a brief, because authoring taste from an un-reviewed model pass would
defeat the provenance guarantee.
