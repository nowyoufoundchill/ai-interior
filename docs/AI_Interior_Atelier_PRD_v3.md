# AI Interior Atelier — PRD v3 (Build & Verification Plan)

**Status:** Supersedes v1 and v2 entirely. Do not reference earlier versions.
**Audience for this document:** Coding agents (Claude Code and Codex) and the owner.
**Product owner:** Darren. Single-household personal tool for designing his new house.
**New in v3:** the app is not "done" when built — it is done when the Release Gate (§12) passes. Verification loops are part of the product, not an afterthought.

---

## 1. What this is

AI Interior Atelier is a private, premium virtual interior design studio for one household. The owner creates a home, adds rooms (photos + dimensions + design brief), receives a professional room diagnosis, generates three distinct mood board concepts, edits and locks one, then executes it: a web-sourced shoppable product plan with design rationale, and photorealistic renders of the owner's *actual room photos* transformed to match the locked concept.

The render is the flagship moment — "this is what your home could look like." The mood board and product plan are the alignment anchors that make occasional render imperfections acceptable.

This is a personal tool built with venture-grade architecture: clean schema, modular AI services, versioned everything — but personal-scale operations. No billing, no marketing pages, no multi-tenant hardening beyond what Supabase Auth gives for free.

### Product loop

```
Home → Room (photos + dimensions + brief)
     → Diagnosis
     → 3 Mood Board Concepts
     → Edit / Re-harmonize / LOCK one concept
     → Product Plan (web-sourced, rationale-first)   ┐ run in
     → Renders (photo-edit of owner's real photos)   ┘ either order
     → Design Chat (interrogate decisions, request re-runs)
```

---

## 2. Non-negotiable principles

1. **Design intelligence first.** Prompts are the product. They are developed and proven in Phase 0 before the app exists, live as versioned files in the repo, and the app is packaging around them.
2. **The mood board is the contract.** Once locked, it is the single source of design truth. Products and renders are always generated *from a specific locked mood board version*. Post-lock edits re-run downstream artifacts only; the mood board itself changes only via explicit unlock.
3. **Append-only state.** No artifact is ever mutated or auto-deleted. Changes create new versions; superseded downstream artifacts get a visible `stale` badge. Re-running is always an explicit user action, never a cascade.
4. **Rationale everywhere.** Every diagnosis finding, concept, product, and render stores *why*. The chat's core job is answering "why did you do that?" truthfully from stored rationale, and "change X and run again."
5. **Dimensions are user-entered, never inferred.** Vision models cannot reliably measure rooms. Room dimensions (and key feature dimensions the user chooses to add) are typed in and injected into every prompt.
6. **Accept known imperfections.** Renders may glitch architecture; sourced product links may die or be near-matches. These are accepted costs, mitigated by regeneration controls, cached product images, and the mood-board-as-anchor principle. Do not build heavy machinery to eliminate them.
7. **Verified means used.** No change is complete because an edit succeeded. It is complete when the app has been driven through a real browser, the state machine assertions hold, and the relevant suite in §12 is green. Agents declare "done" only via gates, never by self-assessment.

---

## 3. Build conventions (two-agent protocol)

This repo will be worked on by both Claude Code and Codex. To prevent divergence:

- **Single schema source of truth:** all domain types and Zod schemas live in `/lib/schemas/`. No agent defines a domain type anywhere else. Database types are generated from Supabase and re-exported here.
- **Single AI gateway:** all model calls go through `/lib/ai/gateway.ts`. It handles: provider routing, Zod validation of outputs, retries (max 1), and writing every call to `ai_runs` (prompt version, model, raw input, raw output, validation errors, latency, token counts, quality score if applicable). No direct `fetch` to model APIs anywhere else.
- **Versioned prompts:** every prompt is a file in `/prompts/{service}/{name}.v{N}.md` with a frontmatter header (version, model, date, notes). The gateway records which file version produced each run. Prompts are edited by creating a new version file, not overwriting.
- **Migrations only:** all schema changes via Supabase migration files in the repo. No dashboard-only changes.
- **Stack:** Next.js (App Router) + TypeScript + Tailwind. Supabase Auth, Postgres, Storage. Vercel deployment. Server-side model calls only; no keys in the client.
- **External APIs:** exactly three — Anthropic (reasoning + native web search), OpenAI (image edit for renders), Tavily (sourcing search with images + page extraction). See §5 routing table. Keys via `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `TAVILY_API_KEY` in `.env.local` / Vercel env; never committed, never exposed client-side. Agents must not introduce a fourth provider without owner sign-off.
- **UI register:** calm, editorial, premium. Generous whitespace, restrained type scale, muted palette, no dashboard-y clutter. This is a design studio, not an admin panel.

### Testability conventions (required from Phase 1)

- **`data-testid` on every interactive element** and every artifact card (photo, concept, product, render). Browser-automation loops must never rely on visual text or class names to find controls.
- **`AI_MODE` env flag:** `mock` (gateway returns canned, schema-valid outputs instantly — the default for all test loops) | `live` (real providers). Mock fixtures live in `/lib/ai/fixtures/` and are updated whenever schemas change.
- **Separate test environment:** all automated testing runs against a dedicated Supabase branch/project (`.env.test`), never against the owner's real data. Production is only ever *queried* by the residue check (§12.1), never written to by tests.
- **`seed:test` / `teardown` scripts:** `seed:test` creates a known state — one home, one room with the owner's real photos and typed dimensions — and returns a `test_run_id`. `teardown` removes everything carrying that id (rows and Storage objects).
- **`test_run_id` column** (nullable) on every table and a metadata key on every Storage upload. All rows/objects created by any automated flow carry it. This makes "no test records left" a query, not a habit.

---

## 4. Data model

Tables (all with `created_at` and nullable `test_run_id`; versioned tables are insert-only):

- `homes` — name, address/context notes, design preferences (freeform + structured)
- `rooms` — home_id, name, room_type, function notes, **dimensions** (length, width, ceiling height, units, plus optional named feature measurements as JSONB), design brief (structured JSONB), current_stage
- `photos` — room_id, storage path, label (wide shot / corner / detail / problem area), is_primary
- `diagnoses` — room_id, version, structured findings (schema §6.1), status (`current` | `stale`), source photo ids, brief snapshot
- `mood_boards` — room_id, version, parent_version (for edits/re-harmonize), structured concept (schema §6.2), origin (`generated` | `user_edit` | `reharmonized`), status (`draft` | `locked` | `unlocked` | `stale` | `rejected`)
- `products` — room_id, mood_board_id+version, structured item (schema §6.3), cached_image_path (Supabase Storage), status (`suggested` | `approved` | `rejected` | `stale`)
- `renders` — room_id, mood_board_id+version, source photo_id, render prompt, preservation constraints, user regeneration instructions, generated image path, status (`current` | `stale` | `rejected`)
- `chat_messages` — room_id, role, content, classified intent, referenced artifact ids
- `design_preferences` — home-level editable record of taste: loved styles, rejected styles, approved/disliked products, standing constraints ("keep the leather chair"). Plain, user-visible, user-editable. Replaces v1's Memory Agent.
- `ai_runs` — the gateway log (§3)

### State machine

A room's `current_stage` progresses: `empty → photos → diagnosed → concepts → concept_locked → executing` (products/renders in any order) — but stages are labels for UX guidance, not gates that destroy data.

**Invalidation rules (the only rules; agents must not invent others):**

| Upstream change | Downstream effect |
|---|---|
| New/changed photos or dimensions or brief | Diagnosis marked `stale` (kept). Nothing else touched until user re-runs. |
| Diagnosis re-run | Existing mood boards marked `stale` (kept). |
| Mood board unlocked + edited → new version | Products and renders tied to the old version marked `stale` (kept). New version must be re-locked before generating new downstream artifacts. |
| Mood board edit while locked | Not possible. Editing requires explicit unlock. |
| Render regenerated | Old render kept, new one becomes `current`. |

Stale artifacts render with a quiet badge ("based on an earlier concept") and a one-click re-run affordance. Nothing is deleted except by explicit user delete. **This table is executable:** every row is asserted by the Integrity suite (§12.1) on every verification cycle.

---

## 5. AI services (5, consolidated)

Each service: TypeScript input/output types, Zod schemas, one or more versioned prompt files, called only via the gateway. The Critic is a shared function, not a service.

### API stack and routing

Three external APIs, all called server-side through the gateway, all keys in env vars:

| Provider | Env var | Used for |
|---|---|---|
| **Anthropic API** | `ANTHROPIC_API_KEY` | All reasoning: Diagnosis, Concept Director (incl. re-harmonize), Product Scout reasoning, render prompt composition, Design Chat, Critic. Anthropic's built-in web search tool is the first-choice search for Product Scout. |
| **OpenAI API** | `OPENAI_API_KEY` | Image generation only: the image **edit** endpoint that transforms the owner's room photos into renders. |
| **Tavily API** | `TAVILY_API_KEY` | Product Scout supplements: search with image URLs (for caching product images to Supabase Storage) and page extraction (price, dimensions, availability from product pages). Free tier suffices at personal volume. |

Routing rules the agents must follow: no service calls a provider SDK directly — everything goes through `/lib/ai/gateway.ts`, which owns provider selection per task type. Sourcing search order: Anthropic native web search first; Tavily for image URLs and page extraction; if native search quality proves weak during the Phase 0 spike, flip sourcing search to Tavily entirely via gateway config — no service code changes. Every call to any of the three providers is logged to `ai_runs` with provider, model, and cost estimate.

### 5.1 Diagnosis Service
Input: photos, dimensions, brief, home preferences.
Output: structured room diagnosis (§6.1).
Merges v1's Room Vision Analyst + Design Brief Interpreter. Dimensions come from user input and are treated as ground truth; the vision pass identifies architecture, openings, light, existing items, constraints, opportunities, risks — never measurements.

### 5.2 Concept Director
Input: diagnosis, brief, home preferences, style library.
Output: exactly 3 mood board concepts (§6.2), deliberately distinct (the prompt must enforce differentiation on at least palette temperature, formality, and risk profile).
Also owns **re-harmonize**: given a concept with user-edited fields marked as locked constraints, regenerate the remaining fields for coherence. Merges v1's Style Director + Mood Board Generator.

### 5.3 Product Scout
Input: locked mood board version, diagnosis (for scale/constraints), dimensions, budget strategy, design_preferences.
Output: product plan (§6.3), sourced from the live web.
**Mechanism:** server-side call to an LLM with web search; design direction comes first, then the search finds real or near-match items at suggested vendors. Product images are downloaded and cached to Supabase Storage at save time (hotlinks rot; boards must not). Every item carries rationale, fit notes against the *typed-in dimensions*, and 1–2 alternatives. Known cost: some links will die or be close-but-not-exact; the product's promise is design direction + vendor pointer, not a guaranteed cart. Merges v1's Product Sourcing Agent + Scale and Fit Evaluator (scale fit is now arithmetic against user dimensions plus judgment, not vision guessing).

### 5.4 Render Director
Input: one source photo, locked mood board version, optional user instructions.
Output: render prompt object (§6.4) + generated image.
**Mechanism:** compose an edit prompt from mood board parameters (palette, materials, furniture direction, lighting, art, decor, plants) plus preservation constraints (windows, doors, architecture, camera angle) plus negative instructions; call the OpenAI image **edit** endpoint with the owner's photo as the base — never text-to-image from scratch. Store prompt, constraints, and image. UI: before/after slider, save, and **regenerate with instructions** ("darker walls", "keep the render but fix the window"). Architecture glitches are accepted; the loop is regenerate-until-happy, not perfection machinery.

### 5.5 Design Chat
Per-room persistent chat. Loads: brief, dimensions, current diagnosis, locked mood board, saved products, saved renders, design_preferences, recent revision history.
Classifies each message: `question | concept_revision | product_revision | render_revision | preferences_update`.
Two jobs it must do excellently:
1. **Explain decisions** — "why the olive tree and not bird of paradise?" answered from stored rationale, honestly.
2. **Drive re-runs** — "make it moodier" → proposes an unlock + specific field edits to the mood board (user confirms); "find a cheaper rug" → re-runs Product Scout for that category; "regenerate with darker walls" → calls Render Director with instructions. Chat never mutates state silently; it proposes, the user confirms, the append-only rules apply.
Whole-home consistency questions are deferred (§10).

### Shared: Critic function
A single scoring pass (`/lib/ai/critic.ts`) usable on any artifact: scores style clarity, room fit, scale realism, cohesion, luxury signal, practicality, budget alignment (subset relevant per artifact type) with one-line issues. Scores and issues are stored to `ai_runs` and shown in the debug panel and (subtly) on artifacts. **No auto-regeneration loop** — the owner is the regeneration loop; the critic is a second opinion, not a gate.

---

## 6. Core schemas (abridged — full Zod in `/lib/schemas/`)

### 6.1 Diagnosis
room summary · architecture notes · doors/windows (position + treatment, no measurements) · flooring · trim · ceiling · natural + existing lighting · existing items (keep/replace/undecided) · constraints · opportunities · uncertainties (things the AI cannot tell from photos — surfaced honestly) · design risks · recommended strategy.

### 6.2 Mood board concept
concept name · design thesis · style keywords · palette (named colors + hexes + temperature) · materials · furniture direction · layout direction (respecting typed dimensions) · lighting direction · art direction · decor direction · plant direction · budget strategy · why it works *for this room* · why the owner might reject it · risk profile. Every field individually editable in the UI; edits create a new version; re-harmonize available.

### 6.3 Product item
category · name · vendor · url (best-effort) · cached image · price (as-found, dated) · dimensions · material/finish · style-fit rationale · scale note vs. room dimensions · budget note · why selected · risks · 1–2 alternatives.

### 6.4 Render
source photo · mood board version · composed edit prompt · preservation constraints · transformation instructions · negative instructions · user regeneration instructions · image path · critic notes.

---

## 7. Style library

Six styles, authored deeply (not fourteen thinly). Initial set — owner may swap any:

1. Lowcountry Coastal
2. Moody Coastal
3. Organic Modern
4. Modern Traditional
5. Masculine Executive
6. Boutique Hotel

Each style: summary · colors · materials · furniture silhouettes · lighting types · art direction · plant direction · luxury signals · common mistakes · budget substitutions · pairs well with · clashes with.

The Concept Director uses this library as vocabulary and guardrails, not as templates: concepts must be interpretations of *this room, this brief, these constraints* — blending styles is expected. Library lives as structured data in the repo (`/lib/style-library/`), editable as the owner's taste sharpens.

---

## 8. UX requirements

**Room Detail is the workspace.** Tabs: Photos & Brief · Diagnosis · Concepts · Products · Renders · Chat. (Preferences lives at home level.)

Always visible in the room header: room name, current stage, locked concept name (if any), and a "what's next" hint. Stale badges wherever they apply.

Empty states guide the loop: "Add photos and dimensions to begin your diagnosis." → "Generate three design directions." → "Edit and lock a concept to unlock products and renders." → "Choose a source photo to see your room transformed."

**Mood board editor:** the concept renders as an editorial spec sheet; every field has an edit affordance (disabled while locked, with an Unlock action). Edited fields highlight; Re-harmonize button appears when edits exist; Lock finalizes.

**Mockup studio (Renders tab):** photo picker → generate → before/after slider → save / regenerate-with-instructions. History of all renders per photo, current one starred.

**Debug panel:** hidden route (`/debug`), owner-only: ai_runs table with prompt versions, raw I/O, validation errors, critic scores, token/cost estimates, failures. Also exposes a read-only state-assertion endpoint used by the Integrity suite (§12.1). This is the prompt-iteration workbench and is not optional.

**Responsive:** the full product loop must work at 390px (mobile), 768px (tablet), and 1440px (desktop). The owner will review renders from his phone; the before/after slider must be touch-usable.

---

## 9. Build phases

Every phase ends with its gate (§12.3). "Implement only the current phase" still applies; "the phase is done" now means "the phase's gate is green," never the agent's own judgment.

### Phase 0 — Intelligence spike (before any app code)
A `/spike` folder of scripts, run against the owner's real photos and typed dimensions:
1. Diagnosis prompt (Anthropic, vision) → 2. three-concepts prompt (Anthropic) → 3. product plan prompt (Anthropic native web search, with Tavily for image URLs + page extraction) → 4. render prompt composition (Anthropic) → OpenAI image edit call.
The spike doubles as validation of all three API integrations and the sourcing-search quality decision (§5 routing) before any app code exists.
Iterate each until the owner judges the output would impress him — his taste is the eval harness. Deliverable: proven prompt files that graduate into `/prompts/` as v1, plus notes on model choices and observed failure modes. **Do not start Phase 1 until the owner signs off on spike outputs.**

### Phase 1 — Foundation
Auth, homes, rooms (with dimensions + structured brief), photo upload/labeling, room workspace with tabs and empty states, full schema + migrations, AI gateway with mock service implementations wired to the proven schemas, debug panel skeleton, **and the test harness itself**: `.env.test` Supabase branch, `seed:test`/`teardown`, `AI_MODE`, `data-testid` coverage, mock fixtures. Premium editorial UI established here.

### Phase 2 — Diagnosis + Concepts (real)
Wire Diagnosis and Concept Director to real models using spike prompts. Mood board editor with edit/re-harmonize/lock and versioning. Invalidation rules implemented exactly per §4.

### Phase 3 — Renders
Render Director end-to-end: prompt composition, image edit call, before/after, regenerate-with-instructions, render history. This is the flagship; polish it.

### Phase 4 — Products
Product Scout with live web sourcing, image caching, product plan UI with rationale and approve/reject, alternatives.

### Phase 5 — Design Chat
Full chat with intent classification, rationale answering, and confirmed re-run flows.

### Phase 6 — Hardening + Release Gate
Debug panel completion, cost visibility per room, critic surfacing, empty-state and stale-state polish. Then run the full Release Gate (§12.4) to completion.

After each phase, the building agent summarizes: what was built, files created, migrations added, env vars needed, assumptions made, gate results, and recommended next step.

---

## 10. Explicitly deferred (do not build)

- Whole-Home Context Agent / cross-room consistency checks — revisit when a second room is in active design; `design_preferences` at home level is the placeholder.
- Real retailer catalogs, APIs, affiliate anything — personal tool; web sourcing suffices.
- Auto-regeneration on low critic scores — owner regenerates manually.
- Billing, teams, sharing, multi-tenancy beyond stock Supabase Auth.
- Memory extraction agent — replaced by the editable `design_preferences` record.

## 11. Quality bar

Output must feel specific to *this* room, *this* brief, *these* dimensions, and the owner's recorded taste — practical, cohesive, high-end, and always rationalized. Banned: generic "rug and plants" advice, vague design language, furniture that ignores the typed dimensions, ignoring windows/doors/budget, three concepts that feel the same, products without a why. When uncertain, the AI says so in `uncertainties` rather than confabulating. This section is the source text for the design-review rubric in §12.1 (Suite 5).

---

## 12. Verification loops & release gate

The owner does not check sixteen layers. The owner reads one report. This section defines how agents test, diagnose, and fix the app themselves using loops, and the single gate that defines "finished."

### 12.1 The five suites

Each suite is encoded as a skill in `/.claude/skills/` so it runs identically every cycle. All suites run against the test environment in `AI_MODE=mock` unless stated otherwise, starting from a fresh `seed:test`.

**Suite 1 — Integrity (`atelier-integrity`).**
Executes the §4 invalidation table as assertions via the debug state endpoint: perform each upstream change through the UI, then assert exactly the specified downstream effect — new version rows created, correct artifacts flagged `stale`, *nothing deleted*, no auto-regeneration fired, locked boards uneditable. Also asserts: all `ai_runs` rows pass Zod validation; append-only tables received no UPDATEs to content columns. Any deviation from the table is a failure even if the app "looks fine."

**Suite 2 — Functional E2E (`atelier-e2e`).**
Chrome DevTools MCP drives a real browser through the entire journey: sign in → create home → create room (dimensions + brief) → upload + label photos → run diagnosis → generate 3 concepts → edit a field → re-harmonize → lock → generate product plan → approve/reject a product → generate render → regenerate with instructions → chat: ask "why," then request a revision and confirm it. Every interactive element is actually clicked via its `data-testid`. Pass condition: flow completes; zero new console errors or warnings; zero failed network requests; every empty state and stale badge appears when it should.

**Suite 3 — Live API smoke (`atelier-live-smoke`).**
`AI_MODE=live`, run **once per cycle** (the only paid suite): one Anthropic reasoning call + one native web search, one Tavily search-with-images + one extract, one OpenAI image edit on one seeded photo. Asserts: schema-valid outputs, images returned and cached to Storage, `ai_runs` logged with provider/model/cost, graceful failure path exercised (one deliberately bad request must not corrupt room state).

**Suite 4 — Assets & responsive (`atelier-assets-responsive`).**
Every `<img>` on every screen: HTTP 200 **and** rendered natural width > 0 (catches broken-image icons that a 200 alone misses); every product's cached image exists in Storage; thumbnails present for photos, concepts, renders. Then re-walk the Suite 2 journey at 390px, 768px, and 1440px with screenshots at each step: no horizontal scroll, no overlapping/clipped elements, tap targets ≥ 44px, before/after slider draggable by touch simulation.

**Suite 5 — Design brain & feel (`atelier-design-review`).**
Two-agent pattern. The builder screenshots every screen and interaction state (hover, empty, stale, locked, mid-drag slider) at all three widths. A **fresh-context reviewer agent** — never the agent that wrote the code — scores each screenshot 1–10 against a rubric derived from §3 UI register and §11: calm/editorial/premium, not dashboard-y; concepts genuinely distinct; every product shows its why; copy is design-studio register, not SaaS register. It also reads one full mock diagnosis + concept set for specificity (references *this* room's features and dimensions, no generic advice). Pass: every screen ≥ 8/10 and zero rubric violations. Reviewer findings that recur are encoded back into the rubric/skills so the system stops producing them.

### 12.2 Residue rule (no test records, structurally)

Test data never touches production: automated flows run only against the test environment. The **residue assertion** closes the loop: at the end of every cycle, (a) `teardown` removes all rows and Storage objects carrying the cycle's `test_run_id` from the test environment, and (b) a read-only query against production confirms zero rows and zero Storage objects with any `test_run_id`. A nonzero result is a failing gate, not a cleanup chore.

### 12.3 Phase gates

Each build phase ends with a `/goal` whose exit criteria are deterministic. Templates (agents adapt IDs, not standards):

- **Phase 1:** `/goal Fresh seed → Suite 2 steps through auth/home/room/photos with mock AI, Suites 1 & 4 green for implemented surfaces, residue check clean. Stop after 6 tries.`
- **Phase 2:** `/goal Seeded room completes diagnosis → 3 concepts → edit → re-harmonize → lock in the browser; every §4 invalidation rule asserted true; Suites 1, 2 (through Concepts), 4, 5 green. Stop after 6 tries.`
- **Phase 3:** `/goal Render flow end-to-end incl. regenerate-with-instructions; Suite 3 passes the image-edit leg; before/after touch-usable at 390px. Stop after 6 tries.`
- **Phase 4:** `/goal Product plan generated, images cached, approve/reject working, alternatives shown; Suite 3 passes search + extract legs. Stop after 6 tries.`
- **Phase 5:** `/goal Chat answers a "why" from stored rationale and executes a confirmed revision re-run without silent mutation; Suite 1 green after the revision. Stop after 6 tries.`

The evaluator model checks the condition each time the agent tries to stop; "mostly works" cannot exit a gate.

### 12.4 The Release Gate

The single definition of finished, run in Phase 6:

```
/goal Release Gate: from a fresh seed, Suites 1–5 all green; zero console
errors; zero failed network requests; zero test residue in production;
design-review score ≥ 8/10 on every screen at 390/768/1440px; one full
AI_MODE=live cycle completes end-to-end including a saved render and a
cached product image; final report generated. Fix every failure and
re-run from a clean seed after each fix. Stop after 12 tries or green.
```

Cycle discipline: run suites → each failure becomes a fix task → fix → **reseed and re-run from the top** (a fix is never verified against dirty state). When the same failure class appears twice, encode the correction into the relevant skill or rubric before continuing — improve the system, not just the instance.

**Deliverable — the Release Report** (`/reports/release-{date}.md`): pass/fail matrix per suite per cycle; screenshots (all screens, three widths); residue query output; live-API latencies and cost; list of every fix made across cycles; open items that require owner judgment.

### 12.5 What loops cannot verify (owner's 10%)

- **Render aesthetics:** the pipeline is verified; whether a specific render earns the "oh ah" is stochastic and owner-judged. Regenerate-with-instructions is the remedy, not the gate.
- **Taste calibration:** the Suite 5 rubric is a proxy for the owner's taste. After the Release Gate, the owner does one manual pass; anything he dislikes is fed back into the rubric so future cycles catch it.
- **Live output quality drift:** mock mode keeps 11 of 12 cycles nearly free; Suite 3 spends real money once per cycle by design. Prompt-quality judgment on live outputs stays with the owner via the debug panel.

### 12.6 Standing loops (post-release, optional)

- **PR loop (build days):** `/loop 10m check the open PR, address review comments, fix failing CI.`
- **Link-rot routine (weekly, scheduled):** re-verify saved product URLs via Tavily extract; badge dead links in the UI and note replacements-needed in the report. This is the standing mitigation for §2.6's accepted sourcing cost.
