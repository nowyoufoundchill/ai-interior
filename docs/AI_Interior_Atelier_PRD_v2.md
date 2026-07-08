# AI Interior Atelier — PRD v2 (Build Plan)

**Status:** Supersedes v1 entirely. Do not reference v1.
**Audience for this document:** Coding agents (Claude Code and Codex) and the owner.
**Product owner:** Darren. Single-household personal tool for designing his new house.

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

---

## 4. Data model

Tables (all with `created_at`; versioned tables are insert-only):

- `homes` — name, address/context notes, design preferences (freeform + structured)
- `rooms` — home_id, name, room_type, function notes, **dimensions** (length, width, ceiling height, units, plus optional named feature measurements as JSONB), design brief (structured JSONB), current_stage
- `photos` — room_id, storage path, label (wide shot / corner / detail / problem area), is_primary
- `diagnoses` — room_id, version, structured findings (schema §6.1), status (`current` | `stale`), source photo ids, brief snapshot
- `mood_boards` — room_id, version, parent_version (for edits/re-harmonize), structured concept (schema §6.2), origin (`generated` | `user_edit` | `reharmonized`), status (`draft` | `locked` | `unlocked` | `stale` | `rejected`)
- `products` — room_id, mood_board_id+version, structured item (schema §6.3), cached_image_path (Supabase Storage), status (`suggested` | `approved` | `rejected` | `stale`)
- `renders` — room_id, mood_board_id+version, source photo_id, render prompt, preservation constraints, user regeneration instructions, generated image path, status (`current` | `stale` | `rejected`)
- `chat_messages` — room_id, role, content, classified intent, referenced artifact ids
- `design_preferences` — home-level editable record of taste: loved styles, rejected styles, approved/disliked products, standing constraints ("keep the leather chair"). Plain, user-visible, user-editable. This replaces v1's Memory Agent.
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

Stale artifacts render with a quiet badge ("based on an earlier concept") and a one-click re-run affordance. Nothing is deleted except by explicit user delete.

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
Whole-home consistency questions are deferred (see §10).

### Shared: Critic function
A single scoring pass (`/lib/ai/critic.ts`) usable on any artifact: scores style clarity, room fit, scale realism, cohesion, luxury signal, practicality, budget alignment (subset relevant per artifact type) with one-line issues. Scores and issues are stored to `ai_runs` and shown in the debug panel and (subtly) on artifacts. **No auto-regeneration loop** — for a personal tool, the owner is the regeneration loop; the critic is a second opinion, not a gate.

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

**Debug panel:** hidden route (`/debug`), owner-only: ai_runs table with prompt versions, raw I/O, validation errors, critic scores, token/cost estimates, failures. This is the prompt-iteration workbench and is not optional.

---

## 9. Build phases

### Phase 0 — Intelligence spike (before any app code)
A `/spike` folder of scripts, run against the owner's real photos and typed dimensions:
1. Diagnosis prompt (Anthropic, vision) → 2. three-concepts prompt (Anthropic) → 3. product plan prompt (Anthropic native web search, with Tavily for image URLs + page extraction) → 4. render prompt composition (Anthropic) → OpenAI image edit call.
The spike doubles as validation of all three API integrations and the sourcing-search quality decision (§5 routing) before any app code exists.
Iterate each until the owner judges the output would impress him — his taste is the eval harness. Deliverable: proven prompt files that graduate into `/prompts/` as v1, plus notes on model choices and observed failure modes. **Do not start Phase 1 until the owner signs off on spike outputs.**

### Phase 1 — Foundation
Auth, homes, rooms (with dimensions + structured brief), photo upload/labeling, room workspace with tabs and empty states, full schema + migrations, AI gateway with mock service implementations wired to the proven schemas, debug panel skeleton. Premium editorial UI established here.

### Phase 2 — Diagnosis + Concepts (real)
Wire Diagnosis and Concept Director to real models using spike prompts. Mood board editor with edit/re-harmonize/lock and versioning. Invalidation rules implemented exactly per §4.

### Phase 3 — Renders
Render Director end-to-end: prompt composition, image edit call, before/after, regenerate-with-instructions, render history. This is the flagship; polish it.

### Phase 4 — Products
Product Scout with live web sourcing, image caching, product plan UI with rationale and approve/reject, alternatives.

### Phase 5 — Design Chat
Full chat with intent classification, rationale answering, and confirmed re-run flows.

### Phase 6 — Hardening
Debug panel completion, cost visibility per room, critic surfacing, empty-state and stale-state polish.

After each phase, the building agent summarizes: what was built, files created, migrations added, env vars needed, assumptions made, recommended next step. **Implement only the current phase.**

---

## 10. Explicitly deferred (do not build)

- Whole-Home Context Agent / cross-room consistency checks — revisit when a second room is in active design; `design_preferences` at home level is the placeholder.
- Real retailer catalogs, APIs, affiliate anything — personal tool; web sourcing suffices.
- Auto-regeneration on low critic scores — owner regenerates manually.
- Billing, teams, sharing, multi-tenancy beyond stock Supabase Auth.
- Memory extraction agent — replaced by the editable `design_preferences` record.

## 11. Quality bar

Output must feel specific to *this* room, *this* brief, *these* dimensions, and the owner's recorded taste — practical, cohesive, high-end, and always rationalized. Banned: generic "rug and plants" advice, vague design language, furniture that ignores the typed dimensions, ignoring windows/doors/budget, three concepts that feel the same, products without a why. When uncertain, the AI says so in `uncertainties` rather than confabulating.

## 12. Addendum: the context brain (added 2026-07-06/07, does not replace §5)

A 10-variant batch run against real owner room photos (Isle of Palms office, `spike/runs/batch/2026-07-07T00-14-34-342Z/`) showed that changing prompt wording alone moved tone and framing but not underlying judgment — every variant converged on the same concept family regardless of brief phrasing. This refines (not replaces) §5's "prompts are the product" principle: the *prompt file* should stay a compact operating system (role, decision hierarchy, output contract), while the actual design intelligence lives as structured, versioned data read into every real call:

- **Property dossier** — region-level facts (climate, material behavior, architectural vernacular, local luxury register, what reads as wrong here). `/lib/ai/context-brain/property-dossier.ts`.
- **Room intelligence** — deterministic derivation of circulation, glare risk, backdrop candidates, and acoustic flags from typed dimensions + diagnosis. `/lib/ai/context-brain/room-intelligence.ts`.
- **Taste graph** — the owner's preferences with confidence levels and provenance, bootstrapped from the brief today, upgradeable to `design_preferences` once that table has a UI. `/lib/ai/context-brain/taste-graph.ts`.
- **Design dissent policy** — explicit priority order (dimensions/constraints > diagnosed room reality > taste graph > literal brief wording) with a hard rule that overrides must be stated, never silent. `/lib/ai/context-brain/design-policy.ts`.
- **Design portfolio** — annotated reference patterns (what excellent looks like vs. its generic failure version), grounded in design theory and documented editorial patterns rather than fabricated attributions to specific real designers' projects. `/lib/ai/design-portfolio.ts`.
- **Critic** — a real, gateway-logged evaluator scored against an explicit, anchored rubric (`/lib/ai/critic-rubric.ts`), replacing the previously hardcoded mock. Includes a concept-differentiation check with **one bounded regeneration retry** — consistent with §10's rejection of auto-regeneration loops; this is a single quality gate before the owner sees output, not a replacement for the owner's judgment as the eval harness.

This pattern is proven only for the Concept Director as of this writing (`prompts/concepts/generate-room-concepts.v2.md`) and is pending a typecheck/build/live-batch verification pass before being extended to Diagnosis, Product Scout, Render Director, and Design Chat. See `SESSION_LOG.md` (2026-07-06/07 entry) for what specifically was built and what remains to be verified.
