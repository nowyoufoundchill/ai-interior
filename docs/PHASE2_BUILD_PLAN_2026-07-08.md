# Phase 2 Unified Build Plan — Design Intelligence & Owner Trust

**Date:** 2026-07-08
**Supersedes as the execution plan for:** `docs/PHASE2_PLAN_2026-07-08.md` (that doc is the strategy; this is the sequenced build).
**Planning authority above this:** `docs/AI_Interior_Atelier_PRD_v3.md`, `PROJECT_BRAIN.md`.

## Product truth this plan is built on

The reasoning layer is already strong (diagnosis, concept distinctiveness, render preservation are genuinely good). The product fails on **execution surfaces** — fabricated products, a dead chat, a corrupted approved concept, a backwards journey, pipeline-leaking UI — and on **taste currency** (concepts read as competent luxury, not *authored for this place, this year*). This program closes both gaps as one system, not as isolated patches.

**The bar:** does the full loop feel like a seasoned interior designer using excellent software? A phase is "done" only when its acceptance criteria pass against a fresh seed and, where noted, an owner reaction — not when code typechecks.

## Guiding principles (apply to every phase)

1. **Taste is structured, sourced, dated data** — not adjectives in a prompt. Every trend carries its *mechanism* (`because`), its *provenance* (`sources`), and its *expiry* (`valid_through`).
2. **Priority order is a hard rule** (`design-policy.ts`): typed dimensions/constraints > diagnosed room reality > owner taste graph > brief > trend intelligence. Trend informs the *point of view*; it never overrides a measurement or a diagnosed constraint.
3. **Never advertise quality we can't deliver.** No broken images, no fabricated links, no self-contradictory approved artifacts.
4. **The render is the flagship.** The journey, the copy, and the emphasis optimize for concept approval → photo transformation → refinement. Products are downstream support.
5. **Critics enforce, they don't just log.** "Generic," "regionally wrong," "blocks a door," "incoherent" become blocking conditions, not advisory notes.
6. **Additive only** — no destructive migrations or delete-on-rerun; locked/approved concept stays the sole downstream contract.

## Findings → phases traceability (nothing is dropped)

| Finding / goal | Owned by |
|---|---|
| 1. Products fabricated/broken (UI guard) | Phase 1 ✅ |
| 1. Products fabricated/broken (real sourcing) | Phase 5 |
| 2. Chat dead / form-not-conversation (UX) | Phase 1 ✅ |
| 2. Chat reliability + real thread | Phase 7 |
| 3. Garbled approved concept (data repair) | Phase 1 ✅ |
| 3. Concept coherence guard (systemic) | Phase 6 |
| 4. Backwards workflow / IA | Phase 1 ✅ |
| 5. Render judgment (density, glare, door clearance) | Phase 4 |
| 6. Pipeline UI on render page + filters | Phase 1 ✅ (baseline), Phase 8 (editorial depth) |
| Taste/trend brain ("a real designer") | Phase 2/3 |
| Mood-board presentation sophistication | Phase 8 |
| Long-running action UX (Stream E) | Cross-cutting, folded per phase |
| Owner-judged live cycle (Stream G) | Phase 9 |

---

## Phase 1 — Owner-Trust Baseline  ✅ *(landed 2026-07-08, this session)*

**Objective:** remove the most visible trust-killers and re-order the journey so the app reads concept-→render-first.

**Landed & verified (browser + `tsc`):**
- Tabs reordered → `Photos & Brief · Concepts · Renders · Chat · Products · Diagnosis`; room **opens on the render** when one exists (`room-workspace.tsx` `initialTab`).
- Approval language: "Lock/Unlock" → "Approve / Change direction"; badge "locked" → "Approved"; stage card "Approved direction… What's next: refine in chat, or source products"; `nextHint()` render-first.
- Global nav stripped of Mood Boards/Products (`app-shell.tsx`); dashboard copy concept-→render-first.
- `ProductImage` component: dead/absent images fall back to a labeled tile — the broken-image glyph can never render; source link gated to real `http` URLs; admin filter row hidden < 8 products.
- Render page: one-line human caption; raw prompt moved behind the details disclosure.
- Chat reframed to collaboration: "Talk it through with your designer," context chips, "Send" button, designer-voice empty state.
- Corrupted locked concept v4 data repaired (coherent with its materials again).

**Remaining tail in Phase 1 scope:** none blocking — deeper backend of products/chat/concept-guard are their own phases below.

**Acceptance criteria (met):** a returning owner lands on their render; no broken product imagery; approval reads decisive; no "Mood Boards/Products" in global nav.

---

## Phase 2 — Design Brain: Taste & Trend Intelligence  ✅ *(completed 2026-07-09)*

> All 5 completion tasks landed: `homes.value_band` (migration 006 + form/query/type wiring), diagnosis trend slice, `reject_now` as blocking critic governance with one bounded regeneration, sub-region style bias, and the documented refresh ritual (`docs/TREND_REFRESH.md`) + newest-brief resolver. Runtime-verified; live concept-read folded into the Phase 9 owner cycle. See SESSION_LOG 2026-07-09.

**Objective:** make the brain execute like a designer who *reads the market* — regional, current, sourced taste as data.

**Landed (this session):** `lib/ai/context-brain/trend-intelligence.ts` — `RegionalTrendBrief` (`sc-luxury-2026`) with directional theses + mechanism, material/palette vocabulary, coastal↔inland sub-regions, price-tier register, `reject_now`, provenance + `valid_through`; resolver + tier mapping (runtime-verified); wired into `buildContextBrain`, `compactContextBrainForGeneration`, `compactContextBrainForCritic`; concept prompt v2 updated with a **Currency requirement**.

**Tasks to complete the phase:**
1. **Home value-band data model.** Add `homes.value_band` (additive migration `006_home_value_band.sql`) so `resolveTierRegister` is exact instead of defaulting to the mid register. Surface it in `home-form.tsx` + `getHomes`/`getRoomWorkspace` queries + `types/database.ts`.
2. **Feed diagnosis too.** Add a compact trend slice to `compactContextBrainForDiagnosis` so the readout is framed in current-market terms (e.g., flags "all-white shell reads dated").
3. **Governance enforcement.** Make `reject_now` a first-class banned list in the critic rubric (`critic-rubric.ts`): a concept landing on a `reject_now` item scores as a *genericness failure*, not a taste preference. One bounded regeneration retry (mirror the existing differentiation retry).
4. **Style-library revalidation.** Re-run the 6-style library against a real generation now that trend intelligence is present; tune `selectRelevantStyles` so trend sub-region biases style selection (coastal vs. lake).
5. **Refresh ritual.** Document + scaffold an annual "trend refresh": a deep-research pass → distilled into a *new* brief (append, never overwrite) → resolver auto-selects newest → old briefs retained for audit. Optional: a scheduled routine that opens a refresh task each year.

**Acceptance criteria:**
- A concept run for a Charleston room visibly expresses ≥1 current thesis with its mechanism cited in `why_it_works`, and contains nothing on `reject_now`.
- Changing `value_band` changes the authorship register the concepts target.
- Off-brief regions (e.g. Austin) generate with no invented trend story (resolver returns null).

**Verification:** runtime resolver check across regions/bands (done for v1); one `AI_MODE=live` concept run read by the owner.

**Dependencies:** none (foundation). Phases 4, 6, 8 consume its output.

---

## Phase 3 — Constraint-Enforcing Room Intelligence  ✅ *(completed 2026-07-09)*

> `deriveRoomConstraints` → typed `RoomIntelligence.constraint_set` (door clearances + swing arcs, window-operation zones, circulation, camera/backdrop, named no-go zones, each with severity + provenance), threaded into concept gen + critic (blocking `layout_violations` + bounded regen) + render director. See SESSION_LOG 2026-07-09.

**Objective:** turn room understanding into **hard, machine-checkable constraints**, so "don't block a door/window/walkway" is a release-blocking rule, not prose (PHASE2_PLAN Stream B).

**Tasks:**
1. Expand `room-intelligence.ts` output into an explicit **constraint set**: door positions + swing arcs, circulation paths, desk/chair clearances, window operation zones, camera/backdrop logic for video-call rooms, and named **no-go zones**.
2. Thread the constraint set into concept generation, render planning, and the critic as typed data (not free text).
3. Add a formal **layout-violation** layer to `critic.ts` / `critic-rubric.ts`: a concept or render instruction set that places casework/seating in a no-go zone or blocks a diagnosed door is a **blocking** failure.

**Acceptance criteria:** render/concept planning explicitly names clear zones and forbidden zones; the system will not approve an instruction set that puts furniture in front of a diagnosed door or active path.

**Dependencies:** feeds Phase 4.

---

## Phase 4 — Render Director Rebuild + Judgment  ✅ *(completed 2026-07-09)*

> Full context brain + constraint set + computed `objectBudget` (size × restraint × tier) into a photographer/stylist-POV v2 prompt; gated Render Critic (`score-render.v1`) blocks door/path block, backlit call seat, architectural drift, warping, and overfill with one bounded plan regen + score floor. See SESSION_LOG 2026-07-09.

**Objective:** upgrade the flagship artifact to use the full brain and make mature spatial decisions (addresses Finding 5).

**Tasks:**
1. Build and pass a full `context_brain` into `renderPromptDirector()` — property dossier, room intelligence + **Phase 3 constraint set**, taste graph, **Phase 2 trend intelligence**, style-library lighting/luxury mechanics.
2. Replace the thin render prompt with a v2 written from a photographer/stylist POV; instructions must name the exact architectural surfaces being modified and what light does to materials.
3. **Furniture-density cap** driven by room size × concept restraint × `tier_register` — a "quiet/restraint" concept in an 11×14 room gets a small object budget, not desk+lounge+credenza+plant+lamp+art. Directly fixes the "too full" render.
4. **Glare/orientation check**: encode the diagnosis's desk-orientation goal as an explicit instruction and a critic check (user's back not to the bright window bank on call rooms).
5. Real **Render Critic** pass (blocking on door-clearance/warping/architectural drift) before the edit is presented as "current."
6. Preservation language stays for door/path clearance, architectural fidelity, no warped/duplicated objects.

**Acceptance criteria:** render prompts are visibly room/camera-aware and name specific surfaces; a restraint concept renders restrained; no render that blocks a door/path or backlights a call user can reach "current" state.

**Dependencies:** Phase 2 (trend), Phase 3 (constraints).

---

## Phase 5 — Real Product Sourcing  ✅ *(v1 landed 2026-07-09)*

> Tavily sourcing gated behind approved direction + render; products persist only after source-URL + image validation and re-host to `cached_image_path`; Product Critic sees the approved render. Live product-quality read remains a Phase 9 owner item. See SESSION_LOG 2026-07-09.

**Objective:** products become real, buyable, image-loading execution support (Finding 1, backend) — positioned *after* the render loop.

**Tasks:**
1. Finish the started Tavily sourcing path in `services.ts` (`sourceProductsWithTavily`): real product URLs + images from search/extract, not model-invented SKUs.
2. **Server-side image validation + caching**: download → re-host in `room-photos` (`cached_image_path`); a product whose image can't be fetched/validated is **not persisted** (or flagged `image_unverified`), so the UI never even needs its fallback for a "real" product.
3. **Source-link validation**: verify `url` resolves before persisting; drop or flag dead links.
4. **Product Critic ties to the approved render**: validate products visually/practically match the *approved room edit*, not just the concept JSON (PHASE2_PLAN Stream F).
5. Keep products gated behind an approved direction and demoted after renders in the journey (Phase 1 already reordered the tab).

**Acceptance criteria:** every persisted product resolves to a real page with a loading image; products read as "how to buy this room," validated against the render.

**Dependencies:** Phase 4 (approved render to validate against) is ideal but not strictly blocking.

---

## Phase 6 — Concept Coherence & Critic Enforcement  ✅ *(completed 2026-07-09)*

> Deterministic `concept-coherence.ts` (garbled finish token / materials contradiction / degenerate fields) enforced at the approval gate (`select-moodboard` blocks an incoherent lock) with a bounded single-pass repair at edit/reharmonize. Runtime-verified against the real `oceanwash` bug. See SESSION_LOG 2026-07-09.

**Objective:** the approved direction can never be incoherent or nonsense (Finding 3, systemic).

**Tasks:**
1. **Critic-on-edit gate**: route owner edits (`moodboards/[boardId]` `edit`/`reharmonize`) and `refineConcept` output through `critic.ts` before they can become the approved direction.
2. **Coherence checks**: thesis must not contradict its own `materials`/`palette` (the `oceanwash` vs `limewash` class of bug); flag broken tokens / self-contradiction; block approval on failure with a clear owner-facing message.
3. Bounded regeneration/repair pass rather than an unbounded loop.

**Acceptance criteria:** an edit that introduces material/thesis contradiction cannot reach "Approved"; the approved concept is always internally coherent.

**Dependencies:** none; complements Phase 2 governance.

---

## Phase 7 — Design Chat as Real Collaboration  ✅ *(v1 landed 2026-07-09)*

> Chat renders the real `chat_messages` thread; passes approved direction/current render/prior thread/last requested change into the turn; writes owner+designer messages; stays advisory (no silent mutation); long-running progress state. See SESSION_LOG 2026-07-09.

**Objective:** chat feels like collaborating with a designer and actually works (Finding 2, full).

**Tasks:**
1. **Reliability**: fix/verify the chat route end-to-end; a submitted turn always yields a visible reply or a surfaced error — never a silent no-op. Reconcile `revisions` vs `chat_messages` so the UI renders whatever the route writes.
2. **Real thread UI**: message history (owner + designer turns), newest-last, in the workspace — not a single-shot form. Context chips already landed (Phase 1); keep them live.
3. **Long-running UX (Stream E)**: streaming or clear progress state; force a reliable refresh on completion; timeout-aware messaging.
4. **Context injection**: approved direction, current render, last requested change all passed into the turn; proposals remain advisory (propose → owner confirms in the relevant tab), never silent mutation.

**Acceptance criteria:** a realistic revision request returns a contextual designer reply in a visible thread; no successful action ever looks hung; chat never mutates state on its own.

**Dependencies:** none.

---

## Phase 8 — Editorial Presentation Layer  ✅ *(completed 2026-07-09)*

> Annotated concept boards (labeled palette strips name+hex + material swatch chips), premium `.atelier-approved` state for the approved direction, image-first render hero, reusable design-language classes in `globals.css`. All `data-testid` preserved. Visual gate (Suite 5 + owner) folds into Phase 9. See SESSION_LOG 2026-07-09.

**Objective:** close the "sophistication gap" (the SC-2026 poster) — taste *presentation*, not just taste *knowledge*. Also the deep half of Finding 6.

**Tasks:**
1. **Annotated concept boards**: replace tiny unlabeled palette dots with labeled **palette strips** (name + hex) and **material swatches**; concept card reads like a studio review (name, short thesis, decisive palette/material story) sourced from concept data + Phase 2 `palette_direction`/`material_vocabulary`.
2. **Approved-direction premium state**: a distinct, final-feeling visual state for the chosen direction.
3. **Render page as hero**: image-first composition, refined typography/spacing/hierarchy; the caption (landed Phase 1) becomes part of an editorial layout.
4. **Design-language system**: luxury-neutral base tones, serif/sans pairing, spatial rhythm, mobile parity (PHASE2_PLAN Stream A2/A3). Component rules for headers, artifact cards, action bars, empty/waiting/approval states.
5. Optional design-reference mode (annotated boards, layout notes) — never replacing the clean hero render.

**Acceptance criteria:** a first-time viewer describes the app as polished, calm, editorial, expert-led *before* reading the AI output; concepts read as a professional board, not a data dump.

**Dependencies:** Phase 2 (palette/material data), Phase 4 (render), Phase 6 (coherent concepts).

---

## Phase 9 — Owner-Judged Live Cycle & Eval Harness  🟡 *(automated backstops landed 2026-07-09; owner live cycle pending)*

> Suite extensions landed (reject_now-absence, no-dead-image-product, render door-guard asserts; Integrity 55/55, E2E 25/25, residue clean). The owner-judged live cycle — the real gate — is prepped in `docs/PHASE9_OWNER_CYCLE.md` and awaits the owner (apply migration 006 first). See SESSION_LOG 2026-07-09.

**Objective:** measure the way the owner actually experiences the app (PHASE2_PLAN Stream G). This is the real gate.

**Tasks:**
1. Run one full `AI_MODE=live` cycle on a real room: brief → concepts → approve → render → refine in chat → products.
2. Capture owner reaction per artifact: concept quality, render preservation, render taste, design logic, workflow clarity, presentation.
3. Extend the existing suites where cheap (assert `reject_now` not present in concepts; assert no persisted product with a dead image; assert render critic blocks a door-blocking instruction) — but **owner reaction is the gate, not automated suites alone.**

**Acceptance criteria:** one end-to-end live cycle where the owner describes the app as feeling like a design intelligence system, not an AI pipeline — with a concrete list of what improved and what still failed.

**Dependencies:** Phases 2–8.

---

## Build order & dependency view

```
Phase 1 (done) ─┐
                ├─> Phase 2 (taste brain) ─┬─> Phase 4 (render director) ─┐
Phase 3 (constraints) ────────────────────┘                              │
Phase 5 (products) ─── best after Phase 4 ───────────────────────────────┤
Phase 6 (coherence) ── independent ──────────────────────────────────────┤
Phase 7 (chat) ─────── independent ──────────────────────────────────────┤
                Phase 2 + 4 + 6 ──> Phase 8 (presentation) ───────────────┤
                                                    all ──> Phase 9 (owner-judged gate)
```

**Recommended execution slices (owner-impact first, respecting deps):**
1. Phase 5 (real products) + Phase 7 (working chat) — kills the two remaining HARD trust-killers.
2. Phase 2 completion + Phase 3 + Phase 4 — makes the design *judgment* real (density, glare, doors) and current.
3. Phase 8 — makes it *look* like the studio it now is.
4. Phase 6 alongside — cheap safety.
5. Phase 9 — the gate.

## Cross-cutting

- **Long-running UX (Stream E):** every generate/edit action gets progress state + reliable post-completion refresh + timeout-aware messaging. Implement per phase as those actions are touched.
- **Data model:** additive migrations only — `006_home_value_band.sql` (Phase 2); any product `image_unverified` flag (Phase 5). No destructive renames.
- **Verification discipline (PRD v3 §12.4):** fresh seed before every suite; reseed-and-rerun after every fix; never verify against dirty state. Update `data-testid` coverage for new UI.

## Definition of done (program gate)

A real owner live cycle produces all of: the flow feels intuitive; concept approval is the main decision; the render preserves the room *and* respects circulation/door rules and its own restraint; the direction feels current and regionally right, not generic; products are real, buyable, and supportive; chat is a working collaboration; and the owner describes the app as a design intelligence system rather than an AI pipeline.
