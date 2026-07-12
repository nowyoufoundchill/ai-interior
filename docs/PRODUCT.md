# AI Interior Designer — Product Contract

**Status:** Stable product and architecture authority

**Product:** Private interior-design application for one household

**Owner-facing name:** AI Interior Designer

## Outcome

Two homeowners should be able to design six real rooms without developer supervision. For each room they can provide a brief, dimensions, and photographs; understand the designer's point of view; choose and refine a direction; visualize it consistently across eligible photographs; recover from failures; and source credible products.

The flagship artifact is the transformation of the owners' real room photographs. Diagnosis, concepts, chat, and sourcing exist to make that transformation specific, coherent, and actionable.

## Intended journey

```text
Home
  → Room brief, typed dimensions, and photographs
  → Designer diagnosis
  → Distinct concept directions
  → Approve one direction
  → Render all eligible room perspectives
  → Review and refine through confirmed chat actions
  → Source products from the approved visual result
  → Continue the next room from the home view
```

The application currently generates three concept directions. Five differentiated directions remain a future P1 outcome; agents must not silently change cardinality outside that phase.

## Household-ready bar

A release is successful when both homeowners can truthfully say:

- I knew what was happening.
- I knew what to do next.
- I could recover when something failed.
- The result reflected what I asked for.
- I would independently use this for the next room.

Route success, typecheck, mocks, and persisted rows are necessary evidence, but none alone establishes household readiness.

## Product principles

### The approved direction is the contract

Products and renders always derive from a specific approved concept version. Concept changes create a new version and make affected downstream work stale only under the explicit invalidation rules.

### Preserve history

Diagnoses, concepts, renders, products, messages, proposals, and jobs are historical records. New work appends versions. Superseded artifacts remain visible as stale or previous; reruns do not delete history.

### Typed facts outrank inference

User-entered dimensions, named keep/remove items, circulation constraints, and explicit preferences outrank visual inference. Inference must not be presented as measurement.

### Reliability must be legible

Long-running actions persist status, stage, attempts, progress, timestamps, and owner-safe failures. Refresh, navigation, browser close, duplicate clicks, and retry must not lose work or create duplicate paid results.

### Chat proposes, the owner applies

A chat question remains a question. An actionable request becomes a structured proposal showing scope, normalized instructions, and consequences. Nothing mutates until explicit confirmation. Confirmation creates one durable job, and the result returns to the same conversation.

### The render is the visual hero

The edited room photograph remains the strongest element once available. Concepts align the direction; products support execution. Administrative pipeline detail must not dominate the owner experience.

### Design intelligence is structured

Runtime prompts are compact operating contracts. Room intelligence, typed constraints, taste, style knowledge, portfolio examples, and dated trend intelligence live as structured application context rather than an ever-growing prompt.

## State contracts

### Durable jobs

Durable jobs currently back diagnosis, single-photo render, render batch, and confirmed chat-action execution. Direct concept and product generation still use their existing route paths; when those operations are migrated, they must adopt this same contract rather than introduce another state system.

```text
queued → planning → validating → generating → persisting → completed
   ├→ retryable_failed
   ├→ terminal_failed
   └→ cancelled
```

- Repeating the same durable owner action returns the same active logical job.
- A completed job references a persisted artifact.
- Paid output is checkpointed before a persistence retry whenever possible.
- Operational critic failure is not represented as a design pass or rejection.
- Batch completion may contain successful and failed perspectives; successful siblings remain usable.

### Artifact currentness

- One current render exists per source photo and approved concept version.
- Replacing a current artifact marks the prior artifact stale; it does not delete it.
- A changed diagnosis may stale concepts; a changed approved concept may stale downstream renders and products.
- Stale state must explain why it occurred and provide the correct next action.

## Architecture boundaries

- Next.js App Router, React, TypeScript, and Tailwind provide the application and interface.
- Supabase Postgres and Storage hold application state and images.
- All database access and provider calls are server-side; service-role credentials never reach the browser.
- Anthropic handles reasoning, OpenAI handles image editing, and Tavily supports sourcing research.
- Zod schemas under `lib/schemas/` define structured AI and domain outputs.
- Versioned runtime prompts live under `prompts/`.
- Durable job services and runners live under `lib/ai/jobs/`.
- Additive SQL migrations under `supabase/migrations/` and `types/database.ts` own database truth.

## Security and scope decisions

- This is a private single-household product. Authentication is intentionally absent.
- Exposed database tables use explicit RLS/grants appropriate to server-only access.
- No `SECURITY DEFINER` permission workaround.
- No billing, public marketing, multi-tenant behavior, or external-user assumptions.
- Do not add a fourth AI provider without owner approval.
- Do not persist provider secrets, raw credentials, or sensitive prompt content in analytics.

## Brand contract

`brand-guidelines.html` is the complete visual and verbal authority. The durable summary is:

- calm, editorial, precise, and expert-led;
- render-first rather than dashboard-first;
- Paper/Ivory/Ink/Charcoal with Brass as the only accent;
- Playfair Display plus Inter;
- square geometry, hairlines, restrained motion, no decorative SaaS chrome;
- short declarative owner copy with no exclamation points;
- no raw provider, model, pipeline, or internal job terminology in owner-facing states.

Read the full brand file only when changing owner-facing UI or copy.

## Explicit deferrals

- Authentication and multi-tenant hardening.
- Billing and purchases.
- Automated six-room paid generation.
- Five concepts until the dedicated P1 phase.
- Full six-room command view until household workflow reliability has passed the P0 owner gate.
- Broad polish or telemetry that does not address observed homeowner friction.
