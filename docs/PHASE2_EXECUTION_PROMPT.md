# Phase 2 Execution Prompt (open in a new Claude Code session)

Copy everything in the block below into a fresh session to execute the unified build plan. It is written to open cold — it points at the plan, sets the rules, and names the first slice. Swap the "Target for this session" line if you want a different phase.

---

You are executing the unified Phase 2 program for **AI Interior Atelier**, a private premium virtual interior-design studio for one household. You are an engineer *and* a design-product owner: "the route returned 200" is never success — the bar is "does this feel like a seasoned interior designer using excellent software."

## Read first (in this order)
1. `docs/PHASE2_BUILD_PLAN_2026-07-08.md` — the executable 9-phase program. This is your source of truth for scope, sequence, and acceptance criteria.
2. `docs/PHASE2_PLAN_2026-07-08.md` — the strategy behind it.
3. `PROJECT_BRAIN.md` — product intent, agent rules, current reality. Note the Context Brain Layer and the new `lib/ai/context-brain/trend-intelligence.ts`.
4. `BUILD_PLAN.md` (the "Landed 2026-07-08" list) and the latest `SESSION_LOG.md` entry — what already shipped so you don't redo it.

## Target for this session
**Phase 5 (Real Product Sourcing) + Phase 7 (Design Chat as Collaboration)** — the two remaining HARD owner-trust findings. If the owner names a different phase, do that one instead. Do the whole phase, not a fragment; if you must stop early, leave the tree building and documented.

## Non-negotiable operating rules
- **Priority order is a hard rule** (`lib/ai/context-brain/design-policy.ts`): typed dimensions/constraints > diagnosed room reality > owner taste graph > brief > trend intelligence. Never let a trend/taste move override a measurement or a diagnosed constraint.
- **Additive migrations only.** No destructive renames or delete-on-rerun. The approved (locked) concept stays the sole downstream contract.
- **Never advertise quality you can't deliver.** No broken images, no fabricated product URLs, no self-contradictory approved artifacts. A product whose image or link can't be validated must not be persisted as if it were real.
- **Do not add a 4th AI provider.** Keep Anthropic (reasoning), OpenAI (image edit), Tavily (sourcing).
- **Keep secrets in `.env.local`/platform env only.**

## How to work
1. Branch before committing (never commit straight to `main`). Commit only when the owner asks.
2. Implement against the phase's task list and acceptance criteria in the build plan.
3. **Verify in the real app, not just `tsc`.** Run `npm run typecheck`, then drive the actual flow in a browser (chrome-devtools MCP preferred) against a real or freshly seeded room. A pre-existing dev server may have a stale `.next` cache — if you hit `ENOENT _document.js`, start a clean `next dev` on a fresh port. Use `AI_MODE=mock` for UI/flow work; use one real `AI_MODE=live` pass only to judge output quality (it costs money — one pass, then tear down).
4. For data checks, read Supabase directly with the service-role key from `.env.local` (strip CRLF when parsing).
5. **Update `BUILD_PLAN.md`, `PROJECT_BRAIN.md`, and `SESSION_LOG.md`** as you go — mark phase items landed, record what shipped and how it was verified, note anything deferred. This is required, not optional.

## Phase 5 — done when
Every persisted product resolves to a real page with a loading image (Tavily sourcing finished; server-side image download/re-host to `room-photos` with `cached_image_path`; unfetchable images/dead links are dropped or flagged, never shown as real); the Product Critic validates products against the **approved render**, not just the concept JSON; products stay gated behind an approved direction and after the render step.

## Phase 7 — done when
A realistic revision request always returns a visible, contextual designer reply in a real message thread (reconcile `revisions` vs `chat_messages` so the UI renders whatever the route writes) — never a silent no-op; long-running turns show progress and refresh reliably on completion; the approved direction + current render + last requested change are passed into the turn; chat stays advisory (propose → owner confirms in the relevant tab), never mutating state on its own.

## Report back
End with: what landed, the exact acceptance criteria you verified and how (with screenshots/output), what you deferred and why, and the recommended next phase from the build plan.

---
