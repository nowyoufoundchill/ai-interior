# Project Brain: AI Interior Atelier

## Product Intent
AI Interior Atelier is a private, premium virtual interior design studio for one household. The core loop is:

`Home -> Room -> Diagnosis -> 3 Concepts -> Lock one concept -> Products and Renders -> Design Chat`

Near-term Phase 2 direction: this visible owner flow is moving to a concept-first, render-first journey centered on approved direction and photo transformation, with products demoted to a supporting role after visual approval. The **Phase 1 flow reorder landed 2026-07-08** (tabs reordered, room opens on the render, "Approve direction" language). Strategy in [docs/PHASE2_PLAN_2026-07-08.md](/C:/Users/darre/Documents/AI%20Interior%20Designer/docs/PHASE2_PLAN_2026-07-08.md); the sequenced 9-phase execution program (all six E2E findings + the taste/trend brain) is [docs/PHASE2_BUILD_PLAN_2026-07-08.md](/C:/Users/darre/Documents/AI%20Interior%20Designer/docs/PHASE2_BUILD_PLAN_2026-07-08.md).

The flagship moment is transforming the owner's real room photos into concept-aligned renders. The locked concept is the contract that downstream products and renders must follow.

## Current Reality
- `docs/AI_Interior_Atelier_PRD_v3.md` supersedes v1 and v2 entirely and is the sole planning authority as of 2026-07-08. PRD v2 phases 0-6 (see below) were completed against the prior spec and are being carried forward, not redone, except where v3 changes the contract.
- The app is single-household and private-first. **Owner decision (2026-07-08): Supabase Auth is explicitly not needed** ("just me and my wife") — this overrides PRD v3 §3's auth line. `/login` remains a no-op redirect to `/dashboard`. Revisit only if the owner asks for multi-user access.
- PRD v3's delta over v2 — a real test harness (`AI_MODE` mock/live, `seed:test`/`teardown`, `test_run_id` residue tracking, `data-testid` coverage), a consolidated 6-style library, and five verification suites run as repo skills — is **built and the Release Gate (§12.4) has run to green** as of 2026-07-08. See `/reports/release-2026-07-08.md`.
- Chrome DevTools MCP (`chrome-devtools`, https://github.com/ChromeDevTools/chrome-devtools-mcp) is installed at user scope and connected per `claude mcp list`. The persisted `scripts/suites/*.mjs` (callable via `npm run suite:*`) use Playwright instead, since MCP browser tools are only invocable from an agent's own tool-calling loop, not a standalone script that must run unattended/repeatedly — prefer chrome-devtools MCP for ad hoc, in-conversation verification that isn't going into a reusable script.
- The room workspace now uses `current_stage` semantics and append-only artifact handling for new writes.
- The PRD-v2 alignment migration has been applied successfully to the live Supabase project through the GitHub workflow.
- The AI layer now uses `/lib/schemas`, `/lib/ai/gateway.ts`, and repo-backed versioned prompt files under `/prompts`.

## Repository
- GitHub origin: `https://github.com/nowyoufoundchill/ai-interior`
- Local path: `C:\Users\darre\Documents\AI Interior Designer`
- Local branch: `main`

## Deployment Logic
- Source of truth is the local repo.
- Normal workflow is: edit locally -> test locally -> commit -> push to `main`.
- GitHub is the integration hub for Vercel deploys and Supabase migration workflows.
- Vercel deploys the Next.js app only; it does not copy or host the database.
- Supabase remains the runtime backend for Postgres and Storage.
- Repo workflows under `.github/workflows/` own migration automation.
- `SUPABASE_DB_URL` in GitHub Actions must use the Supabase Transaction pooler connection string.

## Architecture Direction
- Next.js App Router + TypeScript + Tailwind.
- Supabase Postgres and Storage.
- Server-side model calls only.
- Planned AI provider split from PRD v2:
  - Anthropic for reasoning and native web search.
  - OpenAI for image edit rendering.
  - Tavily for sourcing search supplements, image URLs, and extraction.
- Current implementation centralizes model calls through `/lib/ai/gateway.ts`.
- Current provider reality:
  - Gateway logging, prompt loading, and provider routing are centralized.
  - Diagnosis, concept generation, product sourcing, and render prompt planning now default to Anthropic.
  - OpenAI remains the validated image-edit renderer.
  - Tavily is validated as a search/extract supplement for sourcing support.
  - Diagnosis and concept generation now run on a context brain + real critic pattern (see "Context Brain Layer" below); the other services are only partially upgraded to that same depth.
  - A hidden `/spike` workbench exercises Anthropic reasoning, OpenAI image edit validation, and Tavily enrichment without changing the production room workflow.

## Context Brain Layer (added 2026-07-06/07)
- Prompts are treated as a compact operating system (role, decision hierarchy, output contract), not the place design intelligence lives. This follows evidence from a 10-variant real-photo batch showing prompt wording alone moved tone but not judgment.
- Design intelligence lives as structured data under `/lib/ai/context-brain/` (property dossier, room intelligence, taste graph, design policy, and — added 2026-07-08 — `trend-intelligence.ts`) plus `/lib/ai/design-portfolio.ts` (annotated reference patterns) and a deepened `/lib/ai/style-library.ts`.
- **Trend intelligence** (`trend-intelligence.ts`) is the layer that makes the brain execute like a designer who reads the market: a `RegionalTrendBrief` is dated, sourced taste data (directional theses with their *mechanism*, material/palette vocabulary, sub-regional split, price-tier register, a `reject_now` genericness list) stamped with `sources` + `valid_through` so it can be trusted and refreshed rather than silently rotting. The first brief (`sc-luxury-2026`) is distilled from an owner-provided South Carolina 2026 luxury-interiors deep-research report. It is wired into diagnosis (current-market framing), concept generation, the concept critic (as blocking `reject_now_violations` + a `currency_score`, with one bounded regeneration), and the render director, and is **lower priority than room reality and the owner's taste graph** (per `design-policy.ts`) — it informs the point of view, never overrides a measurement or a diagnosed constraint. Price-tier register is set by `homes.value_band` (additive migration `006`); off-brief regions resolve to null (no invented trend). Refresh ritual documented in `docs/TREND_REFRESH.md`: append a new brief (never overwrite); the resolver auto-selects the newest by `authored` date.
- **Constraint engine** (Phase 3, `room-intelligence.ts` `deriveRoomConstraints` → `RoomIntelligence.constraint_set`): turns "don't block a door/window/walkway" into typed, release-blocking data (door-clearance + swing arcs, window-operation zones, circulation paths, camera/backdrop logic, named no-go zones), each with severity + provenance. Threaded (via the whole `room_intelligence` object) into diagnosis, concept generation, the concept critic (blocking `layout_violations`), and the render director.
- **Render director rebuild** (Phase 4, `renderPromptDirector` + `prompts/renders/compose-render-plan.v2.md`): full context brain + constraint set + a computed `objectBudget` (room size × concept restraint × tier register, fixing the "too full" render) drive a photographer/stylist-POV plan that names exact surfaces and what light does to materials. A gated **Render Critic** (`critiqueRender`, `score-render.v1`) reviews the plan against the constraint set/preservation/budget before it can present as "current" — blocking on door/path block, backlit call seat, architectural/camera drift, warping, or overfill; one bounded plan regeneration, then the score is floored on any residual blocking violation.
- **Concept coherence** (Phase 6, `concept-coherence.ts`): deterministic (no model call, runs in mock + hot path) guard against the approved direction ever being internally incoherent — detects garbled finish tokens (the `oceanwash` vs `limewash` class), materials/thesis contradiction, degenerate palette, duplicated narrative. Enforced at the approval gate (`select-moodboard` blocks an incoherent lock with an owner-facing message) with a bounded single-pass repair at edit/reharmonize.
- `/lib/ai/critic.ts` is a real, gateway-logged Critic (previously a hardcoded mock) scored against `/lib/ai/critic-rubric.ts`, including a concept-differentiation check with one bounded regeneration retry.
- This pattern is proven in production-like validation for Concept Director and is now also applied to Diagnosis with a dedicated diagnosis critic and bounded regeneration pass. Products, renders, and chat are only partially migrated.
- Real validation artifacts now closing the loop:
  - office batch completion: `spike/runs/batch/2026-07-07T04-27-41-099Z/summary.json`
  - Tavily direct validation: `spike/runs/tavily-phase0-2026-07-07T03-56-11-268Z.json`
  - OpenAI render validation: room `8e4ee483-596f-41ef-8ff1-a2f301db1f69`, render `fd65a8c9-1eb3-49f9-a782-c3de664c87a0`
- Owner feedback as of July 6, 2026: `generate-room-concepts.v2` is directionally good enough to continue with, provided OpenAI and Tavily remain available for their respective downstream tasks. With the provider validations above, that is now sufficient to close Phase 0.

## Current Data Model Notes
- Existing tables from the original foundation are still present.
- The additive v2 migration now exists both in-repo and live, and introduces:
  - `rooms.current_stage`
  - version/status metadata on `room_analyses`
  - version/status/origin metadata on `mood_boards`
  - mood board version tracking on `products` and `renders`
  - `design_preferences`
  - `chat_messages`
  - richer `ai_runs` metadata columns
- Current app behavior now preserves older diagnoses, concepts, products, and renders instead of deleting them on rerun.
- Additive migration `006_home_value_band.sql` adds nullable `homes.value_band` (property tier register for the trend brain). **Written but not yet applied to the live project** — apply via GitHub → Supabase before the live owner cycle; the app is graceful without it (defaults to the middle register) but the create-home form errors on the missing column until applied.

## Brand System (landed 2026-07-09 — gospel)
[brand-guidelines.html](/C:/Users/darre/Documents/AI%20Interior%20Designer/brand-guidelines.html) (V1.0, "Space, composed.") is the **single visual/verbal authority** for the app — colors, spacing, content, fonts, and feeling. It overrides prior visual conventions and extends PRD v3 §3/§11 for Suite 5 design judgment. Applied aggressively across the UI, prompts, and copy on 2026-07-09:
- **Identity:** the owner-facing brand is **"AI Interior Designer"** (serif wordmark with *Designer* italicized; descriptor "Intelligent Spaces, Composed"; monogram A*i*D). "AI Interior Atelier" is retired from owner-facing surfaces (internal names/prompt ids may still carry it).
- **Tokens** (`tailwind.config.ts`, namespace `atelier.*` retained): Paper `#FAF8F4` (ground), Ivory `#F5F1EA` (cards), Sand `#D9CFC0`, Taupe `#B8A99A` (muted labels), Ink `#1E1B17` (text — never #000), Charcoal `#171512` (dark ground), Brass `#A5824B` (**the only accent**), Pine `#23403C` (statement fields, ≤1/page), plus support text tones Umber `#5A5348` / Fawn `#8A8073`, caution Clay `#B06A52`, and `hairline` `rgba(30,27,23,.18)`. Old linen/moss/old-clay tokens are gone — do not reintroduce green/amber/rose semantic colors.
- **Type:** Playfair Display (weight 400 only, italics as the sole emphasis — one italic word per headline max) + Inter (300 body, 500 tracked labels), loaded via `next/font` CSS variables. No bold body text, no middle sizes: display/headline/eyebrow/body/caption.
- **Form language:** no rounded corners, no drop shadows, no filled pills, hairlines instead of boxes. Primitives live in `globals.css`: `.atelier-label/.atelier-eyebrow/.atelier-field/.atelier-card/.atelier-approved` (brass gallery frame via offset outline) `/.atelier-chip/.atelier-status[-approved|-stale]/.atelier-notice[-stale]/.atelier-empty/.atelier-btn[-dark]/.atelier-btn-line/.atelier-btn-quiet/.atelier-rise/.atelier-hover-img`. Buttons are outlined rectangles or brass-underline text links. Room tabs are tracked text links with a brass active underline.
- **Motion:** entrances fade+rise 24px/700ms ease-out (`.atelier-rise`), hovers 300–450ms, image hover scale 1.03/800ms. No bounce/spring, no spinners, no skeleton shimmer — imageless/loading states use Principle VIII (type as image, e.g. the A*i*D mark on charcoal).
- **Iconography:** none. Lucide removed from owner-facing components; typographic glyphs only (→, ✕).
- **Voice:** declarative, short, unhurried; sell the feeling, never the feature; **no exclamation points ever**; "AI" appears in the name and almost nowhere else. Enforced in UI copy and appended as standing rules to `prompts/chat/design-chat.v1.md` and `prompts/concepts/generate-room-concepts.v2.md`.
- **Imagery:** brand grade wired into the render director (`prompts/renders/compose-render-plan.v2.md` "Grade & finish"): warm grade only, lifted shadows, matte finishes, never glossy/synthetic — always subordinate to the source photo's real camera and light (preservation contract still outranks brand grade).
- Hidden `/debug` and `/spike` instruments got a token-compatibility pass only; they are exempt from full brand polish.

## UI Shape
- Room Detail is the primary workspace.
- Current room tabs (reordered 2026-07-08 to concept-→render-first): `Photos & Brief`, `Concepts`, `Renders`, `Chat`, `Products`, `Diagnosis` (diagnosis demoted to a supporting artifact). The workspace now **opens on the render** when one exists, not the upload tab. Approval language is "Approve/Change direction" (not "Lock/Unlock concept"); global nav is trimmed to Studio + Homes (no pipeline stages). See [docs/PHASE2_BUILD_PLAN_2026-07-08.md](/C:/Users/darre/Documents/AI%20Interior%20Designer/docs/PHASE2_BUILD_PLAN_2026-07-08.md) Phase 1.
- Phase 5/7 trust slice landed 2026-07-09: Products are gated after approved direction + render, persist only after source URL validation and server-side image re-host to `room-photos` via `cached_image_path`, and Product Critic receives the approved render as visual context. Chat now renders `chat_messages` as the visible thread, passes approved direction/current render/prior thread/last requested change into the turn, writes owner+designer messages with artifact references, and stays advisory only.
- **Editorial presentation layer landed 2026-07-09 (Phase 8):** concept cards use labeled palette strips (swatch + name + hex) and material swatch chips instead of anonymous dots; the approved direction gets a premium `.atelier-approved` treatment (brass frame + paper-gold wash); the render card is image-first (large "After" hero, small labeled "Before" thumbnail). Reusable classes (`.atelier-approved/.atelier-swatch/.atelier-chip/.atelier-eyebrow`) in `globals.css`. Every `data-testid` preserved.
- Hidden debug route: `/debug`.
- Hidden spike route: `/spike`.
- Home-level preferences UI does not exist yet even though the migration path is defined.
- The full interface redesign (typography, palette, spacing, hierarchy, concept presentation, render-page composition) landed 2026-07-09 as the Brand System application above; brand-guidelines.html is now the reference for any future visual work.

## Agent Rules
- Treat [docs/AI_Interior_Atelier_PRD_v3.md](/C:/Users/darre/Documents/AI%20Interior%20Designer/docs/AI_Interior_Atelier_PRD_v3.md) as the single product spec. v2 is historical context only.
- Do not reintroduce destructive delete-on-rerun behavior.
- Locked concepts must remain the only valid source for downstream product/render generation.
- Additive migrations only unless the owner explicitly approves destructive cleanup.
- Do not add a fourth AI provider without owner sign-off.
- Do not build Supabase Auth — owner explicitly declined it (2026-07-08); this is an intentional, permanent deviation from PRD v3 §3, not a gap to close.
- Keep secrets in `.env.local` or platform env configuration only.
- Apply Supabase changes through repo migrations, not dashboard-only edits.
- "Done" means the phase gate in PRD v3 §12.3 is green, not agent self-assessment. A phase is not complete because code was written and typechecks.

## Build status against PRD v2 (updated 2026-07-07)
Phases 2-6 of `BUILD_PLAN.md` are now implemented and pass the type gate (`tsc --noEmit` on a clean reconstruction; `next build` must be run on Windows). Highlights:
- Phase 2: append-only concept lock/unlock/edit/re-harmonize (`app/api/rooms/[roomId]/moodboards/[boardId]/route.ts` + `refineConcept`); shared `StatusBadge`/`StaleNotice`; diagnosis-first UI language.
- Phase 3: renders are in-place photo edits — photo-edit language throughout, per-edit instructions wired into `renderPromptDirector`, before/after UI, preservation/critic history.
- Phase 4: `productSourcingAgent` uses the full context brain + a real `Product Critic` (`critiqueProducts`); best-effort product image caching (`products.cached_image_path`); approve/reject controls; rationale-first, typed-dimension-aware prompt.
- Phase 5: `design_preferences` is now the primary taste source (home-level UI + API + taste-graph wiring, outranking brief fields); chat is advisory only and never mutates state (proposes + requires explicit confirmation); `design_memories` is no longer written or used as a taste source.
- Phase 6: RLS/API audit done; grant-based private model confirmed (all access server-side via service role; browser client unused). Added `004_prd_v2_access_hardening.sql` to close a default-grant gap on the PRD-v2 tables and prevent recurrence.

Remaining owner-side deploy actions: apply migration 004 via the GitHub->Supabase workflow + `verify:live`; run `npm run build` on Windows; commit from Windows (the sandbox mount is a stale snapshot this session).

## PRD v3 status (updated 2026-07-10 — Brand verification green)
All PRD v3 delta items remain built and verified after the 2026-07-09 Brand System redesign. `AI_MODE` mock/live harness, full `data-testid` coverage, the 6-style library, the debug state-assertion endpoint, and all 5 verification suites (`scripts/suites/*.mjs` + `.claude/skills/atelier-*`) exist and pass. The 2026-07-10 mock verification cycle ran green with a fresh `npm run seed:test` before every suite and teardown plus `npm run check:residue` clean after every suite: Suite 1 55/55, Suite 2 25/25, Suite 4 63/63, Suite 5 captured 32/32 screens and passed rubric review against PRD v3 §3/§11 as extended by `brand-guidelines.html` with zero named brand violations. Suite 3 live smoke was intentionally not rerun because provider-facing behavior did not change and the brand verification scope avoided live spend. Original Release Gate detail remains in `/reports/release-2026-07-08.md`.

**Still open, by explicit scope decision (not oversights):**
- No dedicated `.env.test` Supabase project — the harness runs against the same project as production, mitigated by `test_run_id` tagging (verified complete across every artifact table, including `ai_runs`, which had a real gap found and fixed this session) + teardown + a residue check confirmed clean after all 10 cycles run (8 mock + 2 live).
- No draggable before/after slider (PRD §8) — a static side-by-side comparison ships instead.
- Native web search / Tavily are not wired into the live production Product Scout route — only `/spike` exercises them; Suite 3 calls Tavily directly to prove connectivity. Wiring this in is a feature addition, not a bug fix.

## Known Gaps Against PRD v2 (historical — v2 is superseded)
- The `room_analyses` physical table rename remains deferred as a destructive migration; app-facing language is already diagnosis-first.
- API routes still have no per-user auth (single-household private mode, auth intentionally deferred). This must be revisited before any multi-tenant or public deployment.
- Product/render critics are logged but non-blocking (no auto-regeneration), matching the concept-critic convention; tightening these into gated loops is future work.
- `design_preferences` exists only in the new migration path, not in live UI behavior yet; the taste graph is currently bootstrapped from brief fields only, not from confirmed owner reactions.
- Chat still stores `revisions` and legacy memory records alongside the new `chat_messages` direction.
- The app still uses legacy naming such as `room_analyses` in multiple places.
- Multi-provider routing is now available and validated across the Phase 0 spike path, and the context-brain + real-critic pattern now covers both Diagnosis and Concept Director.
- Diagnosis-first naming cleanup still needs to happen in app language and storage naming where practical.
- Product sourcing and render planning now route to Anthropic by default, but neither has the same mature evaluator loop as Concept Director yet.
- Phase 0 is complete; the next meaningful delivery work is Phase 2 implementation and cleanup against PRD v2.

## Operational Notes
- `docs/AI_Interior_Atelier_PRD_v2.md` is intentionally local-only right now unless the owner says otherwise.
- Supabase CLI was not available in the local shell during this session. The live schema was updated through the repo's GitHub Actions migration workflow instead.
