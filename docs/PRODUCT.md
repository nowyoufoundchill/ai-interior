# AI Interior Designer — Product and Experience Contract

**Status:** Stable product, experience, and roadmap authority

**Product:** Private interior-design application for one household

**Owner-facing name:** AI Interior Designer

## Product promise

Turn a small amount of homeowner input and real room photographs into one decisive, designer-quality transformation, then carry that design forward into revisions, planning, sourcing, and the next room.

The intended outcome is a personal alternative to Decorilla-, Havenly-, or Spacejoy-style online design service: not a designer marketplace, but a complete private path from brief to visual recommendation to an honest implementation package.

The experience should be as easy to begin as producing a room design in the ChatGPT iPhone app. The application earns its place beyond a chat window through:

- persistent rooms and design versions;
- whole-home design memory;
- reliable, guided revisions;
- source-versus-result architecture checks;
- implementation guidance;
- honest product sourcing and alternatives.

This is not a prompt editor, a concept-management system, or an interface for supervising an AI pipeline.

## North-star outcome

```text
Describe the room
  → See a credible transformation
  → Request changes naturally
  → Keep the design
  → Plan and source it
  → Continue through the home
```

Every screen after the brief must move the homeowner toward a usable deliverable. Diagnosis, prompt compilation, design reasoning, quality review, jobs, and provider calls are internal machinery unless a concise detail is needed for trust or recovery.

The flagship artifact is always the transformation of the homeowner's real room photograph.

## Product principles

### One room, one current visual, one next action

The source photograph or latest design is the dominant room content. One primary action is obvious; no more than two secondary actions compete with it.

### Image before explanation

At 390, 768, and 1440 pixels, the source or latest design and its primary action begin in the first usable viewport. Introductory copy, workflow diagrams, stage cards, repeated briefs, and internal terminology must not push the deliverable below the fold.

### Minimal input, maximum responsible inference

The application uses photographs, the home profile, and prior accepted rooms to infer what it safely can. It asks only for information that materially changes the result. Typed homeowner facts outrank inference, and unknown measurements remain unknown.

### One recommendation by default

A completed brief produces one strong design recommendation. Another direction is generated only when the homeowner asks for one. A material ambiguity triggers a targeted question, not an unsolicited alternative. There is no required concept count.

### Progressive disclosure

Briefs, dimensions, constraints, designer notes, previous versions, quality details, and processing history remain available without competing with the visual.

### Output quality must justify system complexity

Intermediate calls and artifacts earn their place only when they measurably improve the delivered image, revision fidelity, reliability, or implementation package. Prompt length, evaluator count, and workflow depth are not product outcomes.

### Preserve trust

The application distinguishes among:

- visual inspiration;
- spatially plausible design guidance;
- dimension-verified placement;
- manufacturer-specified products.

It never presents visual inference as measurement, a rendered object as an exact purchasable item, or a concept image as a construction plan.

## Intended homeowner journey

### 1. Establish the home once

The home profile holds durable context:

- location and architectural character;
- household members and relevant needs;
- broad aesthetic preferences and dislikes;
- budget philosophy;
- materials, colors, and existing elements to carry across rooms.

This context is inherited rather than repeatedly collected.

### 2. Brief a room simply

Normal required input is limited to one usable room photograph and one plain-language outcome. Occupants, functions, keep/remove items, access constraints, budget, and dimensions are optional inputs requested progressively only when they would materially improve or unblock the result. The homeowner does not need to select from a long style taxonomy or write a professional design prompt.

The final intake action is **Design my room**.

### 3. Generate one recommendation

One durable action:

1. reads the real source image and household context;
2. inventories fixed architecture and named keep items;
3. compiles a room-specific design program;
4. determines functions, zones, priorities, style, materials, and lighting;
5. creates one recommended photo edit;
6. compares the finished image with the source once the P1.3 review capability is available;
7. delivers the result or asks a targeted question when an essential decision is unresolved.

These internal stages do not require separate homeowner approvals.

### 4. Review and refine in place

The generated image appears immediately with:

- before/after and fullscreen controls;
- **Keep this design**;
- **Try another direction** as a secondary action;
- a conversational field for changes such as “make it warmer,” “add more storage,” or “use less furniture.”

Submitting an unambiguous, reversible one-room visual revision authorizes one append-only revision job. It does not require a second proposal-and-apply ceremony. Ambiguous requests, standing-preference changes, multi-room effects, or actions that invalidate an approved implementation package must explain their scope before execution.

### 5. Approve and implement

Keeping a design establishes the accepted design version. It unlocks only the deliverables supported by available evidence:

- room placement guidance;
- important measurements and clearances;
- a furnishing and material schedule;
- exact product matches when verified;
- visually similar alternatives when exact matching is unavailable;
- budget ranges and tradeoffs;
- field-verification tasks;
- installation sequence and caveats.

### 6. Continue through the home

New rooms inherit the home's accepted visual language while preserving their own occupants, functions, constraints, photographs, and version history.

## Room workspace contract

### Always visible

- compact home and room identity;
- source photograph or latest design;
- current plain-language status;
- before/after when both images exist;
- one primary next action;
- revision composer when a design exists;
- a clear recovery action when work fails.

### Available on demand

- room brief and dimensions;
- saved photographs;
- fixed architecture and constraints;
- designer notes and assumptions;
- previous versions;
- room plan;
- products, cost, and sourcing confidence;
- technical details needed for troubleshooting.

### Not part of the default room screen

- a large title-and-brief hero;
- a separate stage card;
- a “What happens next” workflow explanation;
- a separate diagnosis destination;
- a mandatory concepts destination;
- a separate chat destination;
- repeated brief or dimension content;
- tabs that mirror internal pipeline stages;
- terms such as “diagnosis-backed concept directions,” provider, model, or job.

Concepts become design versions. Conversation is attached to the current visual. Products and plans appear only when they exist or are the next useful deliverable.

## Owner-facing room states

| State | What the homeowner sees | Primary action |
|---|---|---|
| Brief incomplete | Source photo and the minimum missing information | Complete brief |
| Ready to design | Source photo and concise brief summary | Design my room |
| Needs information | Source photo and one concise set of material questions | Answer and continue |
| Designing | Source photo with unobtrusive durable progress | None required |
| Design ready | Generated design, before/after, and revision field | Keep this design |
| Revising | Current design remains visible with updating status | Continue viewing |
| Approved | Accepted design and available next deliverables | Create room plan |
| Implementation ready | Design, plan, products, and verification notes | Shop or implement |
| Failed or interrupted | Last usable visual and plain-language recovery | Retry or supply input |

Background durability, attempts, checkpoints, and recovery remain essential, but their mechanics do not dominate the interface.

## Internal Designer Autopilot contract

### Room-specific brief compiler

The long expert prompts demonstrated by the manual examples are internal artifacts, not homeowner inputs. The compiler produces a compact, versioned program with provenance for:

- room purpose and occupants;
- required functions and zones;
- fixed architecture to preserve;
- items to keep, remove, or add;
- spatial hierarchy, access, and likely clearances;
- style, palette, materials, and lighting;
- budget posture;
- safety and accessibility constraints;
- preservation and negative instructions;
- explicit unknowns, confidence, and blocking questions.

Room intelligence adapts to the actual program. A garage does not inherit residential requirements for art, plants, or sparse decoration. A child's bedroom introduces age, safety, sleep, storage, and play requirements. An open living/dining room reasons across connected zones.

### Accepted design version

Every first design and revision appends a candidate version. One current candidate may exist per source photograph, and a room has zero or one current accepted design version. **Keep this design** accepts the current candidate; a later acceptance makes the prior accepted version historical rather than deleting it. Room plans and product packages bind only to the accepted version. Existing diagnosis and mood-board tables may remain as transitional internal storage, but they are not required homeowner destinations.

### Finished-image review

Quality review receives the source image, finished image, compiled brief, typed facts, and fixed-architecture checklist. It records pass, warning, or failure with evidence and confidence.

A plan-only critic cannot certify the image. A finished result is not labeled ready when a confirmed critical preservation violation remains. Automatic repair is bounded; the application preserves failed attempts and never enters an unbounded regeneration loop.

## Quality and benchmark contract

### Required benchmark cases

The three provided manual examples become permanent private benchmarks:

| ID | Room | Generated expert prompt | Known evaluation focus |
|---|---|---:|---|
| `OPENPLAN-01` | Connected living/dining/kitchen | 820 words | Strong architecture retention; sectional and dining clearances remain unverified |
| `CHILDROOM-01` | Five-year-old child's bedroom | 2,063 words | Strong room programming; source return grille appears removed and door/dresser clearance requires review |
| `GARAGE-01` | Workshop, storage, surf, gym, and parking | 1,543 words | Strong program coverage; two-car use and equipment clearances remain unproven |

The supplied manual results are fixed comparison evidence, not flawless gold standards. Their historical model and settings may be unknown and must not be reconstructed as fact. Original minimal homeowner inputs are recorded when available; missing inputs are marked unknown and are never invented.

Raw personal photographs, generated references, and original conversations live only under the ignored `benchmarks/private/` directory or equivalent owner-approved private storage. Commit only redacted manifests, checksums, scorecards, and consumption summaries.

For each new controlled comparison, use the same source image and currently available image model/settings across:

1. the full ChatGPT-generated expert prompt;
2. the application's concise compiled brief;
3. the current application pipeline baseline.

Judge finished images blindly. Record model settings, calls, tokens, elapsed time, and estimated cost separately from design quality.

### Visual-design rubric

| Criterion | Weight |
|---|---:|
| Fixed-architecture and named-item retention | 30 |
| Required-function and program fulfillment | 20 |
| Spatial plausibility, access, and safety | 15 |
| Photographic and geometric credibility | 15 |
| Design coherence and whole-home fit | 10 |
| Owner preference | 10 |

Moving or removing a fixed opening, structural member, required access path, named keep item, vent, or visible utility is a hard failure regardless of total unless the owner explicitly authorized the change. Unknown clearances remain unverified rather than silently passing.

### Experience and efficiency measures

Track:

- time and required interactions from photo selection to first visual;
- model calls, tokens, latency, and cost per accepted design;
- percentage of intermediate work never shown or used;
- first-result acceptance and regeneration rate;
- revision success without restarting the entire design;
- owner preference against the manual and current-application baselines.

The shortest pipeline that preserves or improves outcome quality wins. No new call, critic, or artifact is justified by internal sophistication alone.

## Implementation-package contract

Every implementation statement carries provenance: owner-measured, photo-observed, model-inferred, manufacturer-specified, or unknown.

- Precise placement and fit claims require sufficient measurements.
- Unknown dimensions create a field-verification task.
- Major visible furnishings and named must-haves receive a schedule entry or an explicit custom, illustrative, or non-purchasable label.
- Products are classified as exact match, near match, or design reference.
- Retailer, canonical URL, image, price, availability time, dimensions, and budget effect are verified when claimed.
- A new accepted design version makes affected plans and products stale; it does not delete them.

The application does not purchase products, produce contractor drawings, or claim code or engineering compliance.

## Multi-room contract

Multi-room value comes from continuity, not dashboard complexity.

The application preserves:

- whole-home palette, materials, architectural character, and budget posture;
- household-wide needs and standing preferences with provenance and scope;
- room-specific briefs, constraints, photographs, and accepted designs;
- reusable or relocated items;
- decisions that should influence later rooms;
- cross-room product and budget totals when implementation begins.

A simple visual home view shows each room's current source/result, plain-language state, and next action. A sophisticated command center is deferred until several real rooms succeed and observed use justifies it.

## Reliability and state contracts

### Durable work

Long-running work persists status, safe progress, attempts, timestamps, and recovery. Refresh, navigation, browser close, duplicate taps, and retry do not lose owner input or create duplicate paid output.

```text
queued → planning → validating → generating → persisting → completed
   ├→ retryable_failed
   ├→ terminal_failed
   └→ cancelled
```

- Repeating the same durable action returns the same active logical job.
- A completed job references a persisted artifact.
- Paid output is checkpointed before persistence retry whenever possible.
- Partial perspective failure preserves successful siblings.
- Operational critic failure is not represented as a design pass or rejection.

### Append-only history

Source photographs, compiled briefs, designs, revisions, reviews, plans, products, messages, and jobs are historical records. New work appends versions. Superseded artifacts become previous or stale; they are not deleted.

### Typed facts outrank inference

User-entered dimensions, keep/remove instructions, access constraints, and explicit preferences outrank visual inference, trends, and generic style knowledge. Conflicts and uncertainty remain visible to the internal decision process and, when material, to the homeowner.

## Architecture and scope boundaries

- Next.js App Router, React, TypeScript, and Tailwind provide the application and interface.
- Supabase Postgres and Storage hold application state and images.
- Database and provider access remain server-side; service-role credentials never reach the browser.
- Exposed tables use explicit RLS and grants appropriate to server-only access, and those permissions are verified separately from schema existence.
- Do not use a `SECURITY DEFINER` permission workaround.
- Do not persist provider secrets, raw credentials, or sensitive prompt content in analytics or benchmark reports.
- Anthropic handles reasoning, OpenAI handles image editing, and Tavily supports sourcing research.
- Zod schemas under `lib/schemas/` define structured AI and domain outputs.
- Versioned runtime prompts live under `prompts/`.
- Durable job services and runners live under `lib/ai/jobs/`.
- Additive migrations under `supabase/migrations/` and `types/database.ts` own database truth.
- The product remains private, single-household, and intentionally has no authentication, billing, public marketplace, or multi-tenant behavior.
- Do not add a fourth AI provider without owner approval.

## Committed next-phase sequence

The former P1.1–P1.6 sequence is cancelled. Five concepts, a full concept editor, a visible conversational diagnosis, a six-room command center, and a standalone polish phase are not committed work.

| Phase | Outcome | Complexity | Value |
|---|---|---:|---:|
| P0.6 | Close the existing reliability foundation | Low | Required foundation |
| P1.1 | Three-room benchmark and outcome contract | Small–medium | Critical |
| P1.2 | Designer Autopilot: minimal input to one design | Large | Highest |
| P1.3 | Finished-image quality and conversational refinement | Large | Very high |
| P1.4 | Implementation-ready room package | Large | High |
| P1.5 | Whole-home continuity and multi-room persistence | Medium | High after single-room proof |
| P1.6 | Personal household release gate | Medium verification | Release confidence |

### P1.1 — Benchmark before building

Import private manifests and assets for the three benchmark rooms. Record source and reference checksums, prompt provenance, minimal original input when available, fixed architecture, required program, unknowns, settings, and baseline consumption. Freeze the blind rubric before optimizing prompts or UI.

**Gate:** all three manifests and owner-reviewed preservation/program checklists are reproducible; fixed manual reference evidence and current-application consumption are recorded rather than guessed; assets remain private; the controlled A/B model/settings and scoring procedure are frozen before optimization.

### P1.2 — Designer Autopilot

Implement minimal progressive intake, the versioned brief compiler, one durable **Design my room** operation, one recommendation, and the deliverable-forward room workspace.

P1.2 delivers the streamlined first-design path; it does not claim finished-image preservation certification until P1.3 passes.

**Gate:** a usable photo and plain-language outcome can reach exactly one persisted first design without mandatory diagnosis or concept review. The normal path uses no more than two reasoning calls before one image call and no more than three provider calls to the first visible result. Every benchmark scores at least 75/100 with zero hard failures; the owner prefers the new path to the current application in at least two of three cases; pre-result reasoning calls fall at least 60% from the recorded current baseline without score regression. The image occupies at least half of the usable first viewport and its primary action is visible without scrolling at 390, 768, and 1440 pixels. Duplicate submission, refresh/reopen, retryable failure, and terminal failure preserve input and create no duplicate paid image.

### P1.3 — Inspect and refine the finished image

Add source-versus-result review, bounded repair, and direct conversational revisions under the current visual. Preserve before/after and version history.

**Gate:** a frozen seeded corpus includes known-good edits plus moved-window, removed-post, disappeared-vent, blocked-access, and missing-required-zone failures. Review catches 100% of seeded critical cases and creates no critical failure on the known-good controls. Critical failures are not presented as ready. One automatic repair is permitted; a normal revision uses one image edit plus one review, and the bounded repair ceiling is two edits plus two reviews. Five owner revision scenarios each require one submission, create exactly one new version, preserve unrelated architecture, survive refresh, and keep the prior version available.

### P1.4 — Make the accepted design actionable

Create the provenance-aware room plan, furnishing schedule, clearance and measurement tasks, product classification, alternatives, budget, and field-verification list.

**Gate:** 100% of named must-haves and major visible furnishings are scheduled or honestly labeled custom, illustrative, or non-purchasable. Every dimensional and clearance claim has provenance; unknowns create field checks rather than fabricated precision. At least ten sampled product links all open the claimed purchasable item and show the correct exact-match, near-match, or design-reference classification. Total range, budget variance, and assumptions are visible. The owner rates one complete package at least 8/10 for usefulness and can identify what to measure, buy, and do next without reading internal artifacts.

### P1.5 — Prove continuity across rooms

Apply scoped whole-home memory and provide a simple visual room index only after at least three accepted room designs exist.

**Gate:** at least three materially different real room types inherit appropriate shared decisions without leaking room-only exceptions. Six seeded rooms in distinct lifecycle states show the correct source/result, plain-language state, and intended next action; each action is reachable in one tap. Cross-room artifact and job leakage is zero. Active or failed work survives navigation and reopen. No automated paid whole-home batch or analytics command center is introduced.

### P1.6 — Personal household release

Run the real-phone, responsive, accessibility, reliability, live-provider, cost, visual-quality, revision, and implementation matrix.

**Gate:** the owner completes three materially different real rooms on an actual phone/browser without developer instruction; median active intake after photo selection is no more than two minutes. The first design is useful enough to continue in at least two of three rooms, and all three are acceptable after at most one owner-directed revision. Every final visual scores at least 75/100 with zero hard preservation failures. Workflow clarity is at least 9/10; design usefulness, architecture confidence, and implementation-package usefulness are each at least 8/10. There are zero manual refreshes, zero duplicate paid generations, and every failure has recovery or terminal guidance. Responsive, keyboard, focus/live-region, console/network, typecheck/build, teardown, residue, cost, and persistence evidence is green. The owner independently chooses to use the application for the next room. Do not call the product household-ready before this evidence exists.

## Global non-goals through P1.6

- Five concepts, mandatory concept portfolios, or a full structured concept editor.
- A homeowner-facing prompt editor or long diagnosis report.
- Separate diagnosis, concepts, or chat workflow tabs.
- A complex multi-room command center or automated paid whole-home generation.
- Authentication, billing, multi-tenancy, public launch, purchases, or checkout.
- 3D modeling, AR, contractor drawings, inferred exact scale, or code/safety guarantees.
- Unlimited critique/regeneration loops or a fourth AI provider.
- Broad refactors, general telemetry, or premium polish that does not improve an observed homeowner outcome.

Responsive, accessible, calm, image-first quality is part of every owner-facing slice rather than a standalone phase.

## Brand contract

`brand-guidelines.html` remains the visual and verbal authority. The durable summary is:

- calm, editorial, precise, and expert-led;
- render-first rather than dashboard-first;
- Paper/Ivory/Ink/Charcoal with Brass as the only accent;
- Playfair Display plus Inter;
- square geometry, hairlines, restrained motion, no decorative SaaS chrome;
- short declarative owner copy with no exclamation points;
- no raw provider, model, pipeline, job, or internal artifact terminology in owner-facing states.

Read the full brand file only when changing owner-facing UI or copy.
