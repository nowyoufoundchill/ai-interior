---
name: atelier-live-smoke
description: Run PRD v3 Suite 3 (Live API smoke) — the one paid suite. One real call per provider (Anthropic, OpenAI image edit, Tavily), run once per cycle only, plus a graceful-failure check.
---

# atelier-live-smoke

**Costs real money. Run at most once per verification cycle.** Runs against a fresh `npm run seed:test` state, but against a dev server that is NOT in mock mode.

## Preconditions

1. Dev server running WITHOUT `AI_MODE=mock` (unset it, or `AI_MODE=live`):
   ```
   npm run dev
   ```
2. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `TAVILY_API_KEY` are all set in whichever env file `scripts/test-env.mjs` loads (`.env.test` if it exists, else `.env.local`).
3. `npm run seed:test` has just been run.

## Run

```
npm run suite:live-smoke
```

Equivalent to `node scripts/suites/live-smoke.mjs`.

## What it checks

- **Anthropic**: one real diagnosis call (`POST /analyze`) through the app. Asserts schema-shaped output and an `ai_runs` row with `provider=anthropic`, a real (non-mock) `model_name`, `status=completed`.
- **OpenAI image edit**: a locked concept is inserted directly (not via a full live 3-concept generation — that would burn 3+ extra Anthropic calls just to get a lockable board; concept generation itself is already exercised for real, in mock mode, every cycle by Suites 1/2), then `POST /generate-render` is called for real. Asserts a real generated image URL, that the image is fetchable from Storage, and a real `ai_runs` row with `provider=openai`.
- **Tavily**: one direct search-with-images call and one extract call (`lib/ai/tavily.ts`-equivalent raw requests). **Known gap, not papered over**: the production Product Scout route does not currently call Tavily or Anthropic native web search at all — only the Phase 0 `/spike` workbench does. This suite calls Tavily directly to prove provider connectivity/credentials still work, not to prove production wiring that doesn't exist yet.
- **Graceful failure path**: one deliberately bad render request (nonexistent `source_photo_id`) must be rejected with 400, not 500, and must leave room state (via the debug endpoint) completely unchanged.

## Output

- Console pass/fail per assertion.
- `test-runs/suite-results/live-smoke.json`.

## After running

Run `npm run teardown:test` and `npm run check:residue` immediately — this suite's real API responses (renders, ai_runs) are real Storage/DB writes like any other test cycle and must not be left in production.
