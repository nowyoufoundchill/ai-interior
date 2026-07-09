# Phase 9 — Owner-Judged Live Cycle (the real gate)

Everything in Phases 2–8 is built, typechecks, and passes the automated mock
suites (Integrity 55/55, Functional E2E 25/25 including the new governance
asserts). **None of that is the gate.** Per PRD v3 §12.5 and the program
definition-of-done, the gate is one real `AI_MODE=live` cycle that the owner
reacts to. This is the one thing no automated loop can verify, and it needs the
owner — it is deliberately left for you, not self-assessed.

## Before you run it
1. **Apply migration 006** (`homes.value_band`) via the GitHub → Supabase
   workflow (same as 003/004/005), then `npm run verify:live`. Until then the
   app runs fine but every home defaults to the middle tier register, and
   creating a home through the form will fail on the missing column. *(The mock
   suites don't touch it — they seed via direct insert without value_band.)*
2. Confirm `.env.local` has live Anthropic + OpenAI + Tavily keys.
3. Pick a real room with real photos + typed dimensions in a **covered region**
   (Charleston / Lowcountry / Isle of Palms / Lake Keowee) so the trend brain
   actually resolves a brief. An off-brief region (e.g. Austin) is a valid test
   too — it should generate with *no* invented trend story.

## Run the full loop live
`AI_MODE=live`, then walk the room end to end:
brief → diagnosis → 3 concepts → **approve one** → render → refine in chat →
products.

## What to react to, per artifact (capture the owner's words)
- **Diagnosis:** does it read the room in current-market terms where honest
  (e.g. flags an all-white shell as reading dated) without prescribing the
  redesign?
- **Concepts:** does at least one visibly express a current 2026 SC thesis
  *with its mechanism cited* in `why_it_works`, contain nothing on `reject_now`,
  and target the right authorship register for the value band? Do the three
  differ in real structure, not just name? (Check `/debug` for the critic's
  `reject_now_violations` / `currency_score` / `layout_violations`.)
- **Approval coherence:** try to approve a deliberately garbled edit (introduce
  an "oceanwash"-type token) — it must be **blocked** with a clear message.
- **Render (flagship):** is it room/camera-aware and restrained — a restraint
  concept renders *restrained*, not desk+lounge+credenza+plant+lamp+art in an
  11×14? No blocked door/path; a call-room seat not backlit against the window
  bank? (Check `/debug` for the Render Critic's `blocking_violations`.)
- **Products:** every one resolves to a real page with a loading image, and
  reads as "how to buy this room," validated against the approved render.
- **Chat:** a realistic revision returns a contextual designer reply in the
  visible thread; nothing mutates state silently.
- **Presentation:** before reading any AI text, does the app read as polished,
  calm, editorial, expert-led? Do concepts read as a studio board (labeled
  palette strips + material swatches, premium approved state) not a data dump?

## The gate
One end-to-end live cycle where the owner describes the app as a **design
intelligence system, not an AI pipeline** — with a concrete list of what
improved and what still failed. Record that list back into `SESSION_LOG.md` and
open follow-up work from the failures.

## Automated backstops already in place (not a substitute for the above)
- Integrity suite asserts the §4 invalidation table (55/55).
- E2E suite drives the full journey + governance asserts: no concept lands on a
  `reject_now` cliché, no dead-image product persists, every render instruction
  set carries a door-preservation guard (25/25).
- Runtime-verified: trend resolver (region → sub-region, value band → tier,
  off-brief → null), constraint engine (door/no-go/camera-backdrop derivation),
  coherence gate (blocks + repairs the oceanwash class).
