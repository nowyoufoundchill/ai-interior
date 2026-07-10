# P0/P1 Household-Ready Execution Plan

**Date:** 2026-07-10  
**Status:** Ready for agent execution  
**Authority:** This plan converts the July 10 live-room UX audit into gated implementation work. It supplements `docs/AI_Interior_Atelier_PRD_v3.md` and supersedes older plans wherever they conflict with the P0/P1 outcomes below.

## 1. Mission and release bar

Make the application trustworthy enough for two homeowners to design six real rooms without developer supervision.

The release is not successful because routes return `200`, mocks pass, or a single render exists. It is successful only when a homeowner can:

1. create a home and room;
2. provide dimensions, a brief, and multiple photographs;
3. understand what the designer sees and recommends;
4. compare five genuinely different directions;
5. approve and refine one direction;
6. render that direction consistently across every eligible room photo;
7. request a concrete change conversationally and explicitly apply it;
8. recover from provider failures without losing work or guessing whether the app is stuck;
9. open trustworthy product pages for the approved result; and
10. see the state and next action for all six rooms from the home/dashboard.

### Non-negotiable release outcomes

- The newest real-room failure class—Render Critic timing out after approximately 90 seconds and leaving no render—has a deterministic recovery path.
- No generation depends on an open browser request for its durable state.
- No successful click requires manual refresh to reveal the result.
- Every long-running action has durable status, stage, elapsed time, and a useful failure action.
- “Apply to all photos” is a first-class batch operation with per-photo progress and retry.
- Chat never silently mutates design state, but a confirmed chat proposal can execute the relevant concept/render/product action without retyping.
- Automated tests never write to production. A dedicated test Supabase project/branch is a hard prerequisite for mutation-heavy loops.
- Existing append-only artifact history, concept coherence, render preservation, and stale-state semantics remain intact.

## 2. Priority definitions

### P0 — household-blocking

P0 is the minimum trustworthy loop:

- durable generation jobs;
- resilient single-photo rendering;
- all-photo batch rendering;
- explicit chat-to-action confirmation;
- unambiguous next actions;
- inline, recoverable failure UX;
- production-safe test isolation;
- a real live-room release cycle.

No P1 phase starts until the P0 program gate is green.

### P1 — experience-completing

P1 delivers the intended premium designer journey:

- five differentiated concept directions;
- full structured concept editing;
- conversational diagnosis and designer pushback;
- richer progress expectations and notifications;
- trustworthy product handoff;
- six-room home overview;
- responsive and accessibility polish;
- owner-scored “wow” acceptance.

## 3. Agent-loop operating contract

Every phase is executed as a bounded loop. An agent must not begin the next phase merely because code was written.

### Loop protocol

1. **Orient**
   - Read this entire plan, `PROJECT_BRAIN.md`, the relevant PRD sections, `git status`, and the files named by the phase.
   - Inspect current production state read-only when the phase concerns a known live failure.
   - Read every applicable skill before acting.
   - State the phase objective in one sentence.

2. **Baseline**
   - Start from a fresh tagged test seed in the dedicated test project.
   - Run the phase’s pre-change tests and record failures.
   - Capture browser, API, database, and provider-log evidence where applicable.

3. **Implement one vertical slice**
   - Change the smallest coherent browser → API → data → response slice.
   - Use additive migrations only.
   - Preserve unrelated user changes in a dirty worktree.
   - Add or update `data-testid` attributes with every interactive state.

4. **Verify locally**
   - Run typecheck plus focused tests.
   - Drive the affected behavior through a real browser.
   - Query persisted state directly and compare it with the UI.
   - Test success, provider failure, retry, refresh/reopen, and stale-artifact behavior.

5. **Evaluate the gate**
   - Produce a gate checklist with direct evidence.
   - If any required item fails, remain in the phase.
   - Fix the first broken boundary before testing downstream behavior.

6. **Close the loop**
   - Teardown tagged test data and storage.
   - Run the residue check.
   - Update `SESSION_LOG.md`, this plan’s execution ledger, tests, and relevant documentation.
   - Commit only if the user’s current instruction authorizes commits.

### Attempt limits

- Maximum three attempts using the same technical approach.
- After the third failure, stop retrying, write a short cause analysis, choose a materially different approach, and restart the phase loop.
- Provider calls must always be bounded by explicit timeout, retry count, and idempotency behavior.
- A phase may not lower a critic threshold or weaken an assertion merely to turn the gate green.

### Evidence required at every gate

- exact test commands and totals;
- browser screenshots for changed states at 390, 768, and 1440 pixels when UI is affected;
- zero new console errors or warnings;
- zero unexpected failed network requests;
- database rows proving durable state transitions;
- teardown and residue result;
- known limitations and deferred items;
- owner judgment where explicitly required.

## 4. Cross-cutting state contracts

### Generation job state machine

All long-running diagnosis, concept, render, batch-render, chat-action, and product operations use a shared durable contract:

```text
queued → planning → validating → generating → persisting → completed
   └──────────────→ retryable_failed
   └──────────────→ terminal_failed
   └──────────────→ cancelled
```

Required job fields:

- `id`, `room_id`, `job_type`, `status`, `stage`;
- `requested_by`, `request_payload`, `result_refs`;
- `idempotency_key`, `attempt_count`, `max_attempts`;
- `progress_current`, `progress_total`;
- `started_at`, `heartbeat_at`, `completed_at`;
- `error_code`, owner-safe `error_message`, internal `error_detail`;
- `test_run_id`, `created_at`, `updated_at`.

Security requirements:

- service-role credentials remain server-only;
- any exposed table has RLS enabled and explicit grants/policies appropriate to the private single-household model;
- no `SECURITY DEFINER` workaround;
- requests may only reference artifacts belonging to the target room;
- request payloads and logs must not persist provider secrets.

### Idempotency contract

- Repeated submission of the same owner action returns the same active job instead of creating duplicates.
- Retrying a failed photo creates a new attempt tied to the same logical batch item.
- A completed job cannot be accidentally rerun by browser refresh.
- Persisted artifact creation and job completion are coordinated so the UI cannot show “complete” without a valid artifact reference.

### Artifact contract

- Old artifacts remain append-only and become stale only under existing invalidation rules.
- One current render is allowed per source photo and approved concept version.
- A render batch may be partially successful; completed perspectives remain usable while failed perspectives are retryable.
- Batch completion means every eligible photo is either completed, intentionally skipped, or explicitly terminal-failed.

## 5. Phase sequence

```text
P0.0 Test isolation and observability
  → P0.1 Durable generation jobs
  → P0.2 Resilient single-photo render
  → P0.3 All-perspective render batches
  → P0.4 Confirmed chat actions
  → P0.5 Guided workflow and recovery UX
  → P0.6 P0 release gate
  → P1.1 Five concept directions
  → P1.2 Full concept editor
  → P1.3 Conversational diagnosis
  → P1.4 Product handoff trust
  → P1.5 Six-room command view
  → P1.6 Responsive, accessible, premium polish
  → P1.7 Household-ready release gate
```

---

## Phase P0.0 — Test Isolation, Failure Fixtures, and Observability

### Objective

Make repeated agent execution safe and make every generation failure explainable before changing production behavior.

### Work

1. Provision or connect a dedicated test Supabase project/branch and create `.env.test` locally.
2. Fail closed: mutation-capable suites must refuse to run when test and production project references match.
3. Apply all migrations to the test project and verify schema parity.
4. Add deterministic fixtures for:
   - provider timeout;
   - provider 429/5xx;
   - critic rejection;
   - image response with no image;
   - storage upload failure;
   - database persistence failure after provider success;
   - client disconnect and page reload mid-generation.
5. Standardize structured logs across UI request, job, provider run, and persisted artifact using correlation IDs.
6. Surface provider error codes and attempt counts in `/debug` without exposing secrets.
7. Extend residue checks to every new table and storage prefix introduced by this plan.

### Likely files

- `scripts/test-env.mjs`
- `scripts/seed-test.mjs`
- `scripts/teardown-test.mjs`
- `scripts/check-test-residue.mjs`
- `lib/ai/gateway.ts`
- `lib/ai/logging.ts`
- `app/debug/page.tsx`
- additive Supabase migration(s)

### Strict success gate P0.0

- Mutation suites abort before their first write when `.env.test` is absent or points to production.
- Test and production project references are proven different without printing credentials.
- Every named failure fixture is triggerable without paid provider calls.
- One correlation ID traces browser action → route/job → `ai_runs` → artifact or failure.
- Teardown removes 100% of seeded rows and storage objects; production residue is zero.
- Typecheck, integrity suite, and focused fixture tests pass from a fresh seed.

### Stop condition

Do not begin durable-job work until this gate is green. Running loops against production is a blocker, not an accepted risk.

---

## Phase P0.1 — Durable Generation Jobs

### Objective

Remove long-running AI work from the lifecycle of a single browser request and make status survive refresh, navigation, and client disconnect.

### Work

1. Add the `generation_jobs` schema and typed database definitions.
2. Build a server-only job service with:
   - create-or-return-active idempotency;
   - claimed execution;
   - atomic stage transitions;
   - heartbeat/stale detection;
   - bounded retry scheduling;
   - safe completion/failure persistence.
3. Choose and document the execution mechanism supported by the deployment environment. It must continue after client disconnect and must not rely on in-process memory.
4. Convert one low-risk operation first—diagnosis or mock render—to prove the contract.
5. Add room-scoped job status and retry/cancel endpoints.
6. Add a reusable client job observer. Prefer event-driven updates where reliable; retain bounded polling fallback.
7. Keep legacy synchronous endpoints behind a temporary internal compatibility layer until each consumer migrates.

### Required tests

- duplicate POSTs with the same idempotency key;
- simultaneous claim attempts;
- page refresh during every stage;
- stale heartbeat recovery;
- worker retry and terminal failure;
- completed artifact reference integrity;
- unauthorized/wrong-room artifact references;
- production/serverless restart simulation where feasible.

### Strict success gate P0.1

- A queued mock job completes after the initiating browser page is closed.
- Refreshing/reopening the room shows the exact current stage without duplicate output.
- Two rapid clicks produce one logical job.
- A crashed execution is reclaimed once and never loops indefinitely.
- Job completion always references a persisted artifact; failed jobs never masquerade as complete.
- Existing room artifacts and invalidation behavior remain green.
- Browser, API, database, and residue evidence are attached to the phase report.

---

## Phase P0.2 — Resilient Single-Photo Rendering

### Objective

Guarantee that one approved direction can produce or recoverably fail one room-photo edit without losing the owner’s instructions.

### Work

1. Decompose rendering into independently recorded stages:
   - validate locked concept and source photo;
   - compose render plan;
   - run deterministic preservation/coherence checks;
   - run model critic;
   - generate image edit;
   - upload image;
   - persist render;
   - mark current/stale atomically.
2. Put separate time budgets and retry policies around critic, image generation, upload, and persistence.
3. Define critic failure behavior:
   - blocking design violations remain blocking;
   - timeout/transport failure is operational, not a design rejection;
   - operational failure may retry or fall back to deterministic guards, but is never silently treated as a passed critic.
4. Preserve the owner’s request, source photo, approved concept version, and successful intermediate plan across retries.
5. Add inline render job cards showing stage, elapsed time, attempt, saved work, and owner-safe errors.
6. Replace alert-based render errors with `Retry`, `Edit instructions`, and `Return to direction` actions.
7. Add a render-cost/latency record per stage for debugging and later UX estimates.

### Required failure matrix

| Failure | Expected result |
|---|---|
| Render Critic timeout | bounded retry, then clear recoverable failure; plan retained |
| Critic finds door/path violation | no image generation; actionable design failure |
| OpenAI timeout/429/5xx | bounded retry with same idempotency key |
| OpenAI returns no image | recoverable failure; no current render row |
| Storage upload fails | image stage not repeated unnecessarily if recoverable payload is available |
| DB insert fails | retry persistence without generating a second paid image |
| Browser closes | job continues and result appears on return |

### Strict success gate P0.2

- The exact July 10 Render Critic timeout class is reproduced with a fixture and produces a recoverable inline state.
- Ten consecutive mock renders complete with no duplicate artifacts.
- At least three live renders complete across two source photos, including one retry scenario.
- No paid image call is repeated solely because persistence failed.
- Every completed render preserves room/photo/concept version linkage and one-current-per-photo semantics.
- A nontechnical owner can tell: what is happening, how long it has run, whether work was saved, and what to do after failure.

---

## Phase P0.3 — All-Perspective Render Batches

### Objective

Deliver the approved direction across all eligible room photographs as one understandable operation.

### Work

1. Add parent batch and per-photo item semantics using `generation_jobs` or an additive companion table.
2. Define photo eligibility:
   - room perspectives included by default;
   - ceiling, floor, existing-item detail, and inspiration photos excluded by default unless explicitly selected;
   - owner can review selection before spending.
3. Add `Render all perspectives` as the dominant post-approval action.
4. Display estimated count, cost/credit implication if available, and expected time range before confirmation.
5. Run items with bounded concurrency to respect provider rate limits.
6. Keep a shared batch-level concept/preservation brief while composing camera-specific instructions per photo.
7. Show progress such as `2 of 4 complete`, thumbnails as they arrive, and failures beside the affected source photo.
8. Support retry failed, retry selected, cancel remaining, and regenerate one perspective with instructions.
9. Preserve successful items if another perspective fails.
10. Add a consistency evaluation across the batch for palette, anchor furniture, art direction, and material story; flag but do not erase good renders.

### Strict success gate P0.3

- A four-photo room produces four linked current render results from one confirmed batch action.
- Progress persists through refresh and browser close.
- A forced failure on photo 3 leaves photos 1, 2, and 4 intact and makes only photo 3 retryable.
- Retrying photo 3 does not regenerate or stale successful siblings.
- No batch exceeds configured concurrency or creates duplicate paid calls under rapid clicks.
- The batch view makes source/after pairing unmistakable at mobile, tablet, and desktop widths.
- Batch consistency rubric passes for a live four-photo room, or discrepancies are visibly flagged for owner choice.

---

## Phase P0.4 — Confirmed Chat-to-Action Execution

### Objective

Let the homeowner say “replace the ocean artwork with a sky painting,” review the designer’s interpretation, and apply it without retyping or silent mutation.

### Work

1. Replace free-text-only intent handling with a versioned structured `ActionProposal` schema:
   - intent type;
   - target artifact(s);
   - proposed change summary;
   - normalized instructions;
   - scope: one perspective, selected perspectives, or all perspectives;
   - expected invalidations;
   - confidence/clarifying need;
   - status: proposed, confirmed, executing, applied, rejected, failed.
2. Persist proposals and reference them from chat messages.
3. Render proposal cards in the thread with `Apply`, `Adjust`, and `Dismiss`.
4. On confirmation, create the relevant durable job; never run mutation directly inside the chat response request.
5. Support at minimum:
   - render revision;
   - concept revision/re-harmonization;
   - product-plan revision;
   - preference update.
6. Preview stale/invalidation consequences before confirmation.
7. Return job progress and final artifacts into the same conversation thread.
8. Prevent replay of an already confirmed proposal.

### Required scenarios

- replace ocean art with sky art across all renders;
- warm wall color on one perspective only;
- retain an existing chair everywhere;
- ask “why” with no mutation proposal;
- ambiguous request that requires clarification;
- dismiss and later restate a proposal;
- confirmation followed by provider failure and retry.

### Strict success gate P0.4

- No chat message mutates an artifact before explicit confirmation.
- Confirming a proposal starts exactly one durable job with the normalized instructions shown to the owner.
- The completed artifact is linked back into the thread.
- Questions remain questions and do not produce misleading action controls.
- Invalidation previews match the executable integrity table.
- All seven required scenarios pass in the browser and persisted state matches the thread.

---

## Phase P0.5 — Guided Workflow, Next Actions, and Recovery UX

### Objective

Make the next step obvious at every point and eliminate dead ends, alert-only errors, and refresh uncertainty.

### Work

1. Introduce a single room-level `recommendedNextAction` resolver based on persisted state, not duplicated UI conditions.
2. Give each stage one primary action and at most two secondary actions.
3. On concept approval, move focus to a render kickoff panel with `Render all perspectives` primary.
4. On partial batch completion, prioritize `Retry failed perspective`.
5. On completed render batch, prioritize `Review and refine`; make sourcing the secondary next step.
6. Replace remaining generation alerts with inline notices that preserve user input.
7. Add durable job indicators to dashboard/home/room so navigation does not hide ongoing work.
8. Add success arrival treatment for the first completed render and completed batch without blocking access or becoming theatrical.
9. Ensure stale artifacts explain why they are stale and offer the correct one-click rerun.
10. Add analytics/telemetry events for action started, result seen, retry, abandonment, and next-step selection without storing sensitive prompt content.

### Strict success gate P0.5

- At every seeded lifecycle state, five first-time-user testers or a formal heuristic reviewer identify the intended next action without instruction; target ≥4/5 correct.
- No generation failure is presented only through `alert()`.
- No successful action requires manual refresh.
- Refreshing at every in-progress stage restores a meaningful UI state.
- Keyboard and screen-reader users receive progress and completion announcements without focus loss.
- Browser suite has zero console errors, zero unexpected network failures, and no dead-end state.

---

## Phase P0.6 — P0 Program Release Gate

### Objective

Prove that the minimum six-room workflow is reliable before expanding features.

### Automated gate

From fresh seeds:

- all integrity assertions green;
- full E2E journey green;
- all failure fixtures green;
- four-photo batch with partial failure/retry green;
- chat proposal/confirmation matrix green;
- assets/responsive suite green at 390, 768, 1440;
- typecheck and production build green;
- zero test residue;
- zero writes to production from automated suites.

### Live gate

Run two different real rooms end to end in live mode:

- room A: four or more perspectives, full batch completion;
- room B: at least three perspectives and one intentional revision through chat;
- one controlled operational failure and successful recovery;
- every completed image viewable after a fresh browser session;
- provider latency and cost recorded;
- owner sees no raw provider/pipeline language.

### P0 owner gate

Both homeowners independently answer yes to:

- “I always knew what was happening.”
- “I knew what to do next.”
- “I could recover when something failed.”
- “The changed result reflected what I asked for.”

Any “no” keeps P0 open. P1 work does not begin.

---

## Phase P1.1 — Five Deliberately Differentiated Directions

### Objective

Present five useful design choices with meaningful strategic differences, not five renamed variations.

### Work

1. Update schemas, prompts, critics, fixtures, UI, and tests from exactly three to exactly five active directions.
2. Define a five-slot portfolio strategy informed by the room:
   - safest/high-confidence fit;
   - lighter/brighter interpretation;
   - richer/deeper interpretation;
   - spatially or materially adventurous interpretation;
   - designer’s recommendation that may challenge the brief.
3. Do not force irrelevant styles; each slot is a design strategy, not a generic taxonomy label.
4. Strengthen portfolio-level differentiation across layout, palette temperature, material anchor, formality, budget concentration, and risk.
5. Surface `Designer’s recommendation`, strongest tradeoff, and likely rejection reason.
6. Make the five-card review usable on mobile without a wall of text.

### Strict success gate P1.1

- Exactly five current concepts persist per successful generation.
- Pairwise differentiation passes thresholds across at least four defined axes.
- No direction violates hard room constraints or the trend `reject_now` list.
- In blinded review, reviewers correctly describe each direction’s distinct strategy without seeing its name.
- Generation failure cannot leave an unlabeled partial set as if it were complete; partial concepts are checkpointed and visibly resumable.

---

## Phase P1.2 — Full Structured Concept Editor

### Objective

Allow the homeowner to make the “tiny edit here or color change there” promised by the journey while maintaining coherence and version history.

### Work

1. Add edit controls for every PRD concept field:
   - name and thesis;
   - style keywords;
   - palette names/hex/temperature;
   - materials;
   - furniture and layout;
   - lighting, art, decor, plants;
   - budget strategy;
   - rationale, risks, and rejection reason.
2. Track edited fields as locked constraints for re-harmonization.
3. Provide simple owner controls first—swatch replacement, material replacement, keep/remove item—and advanced text editing behind disclosure.
4. Preview which downstream artifacts will become stale.
5. Save edits as new append-only versions; never mutate approved history in place.
6. Run deterministic coherence plus model critic before approval.
7. Offer compare-current-to-edited before approval.

### Strict success gate P1.2

- Every structured field is editable and round-trips without data loss.
- Edited fields remain fixed through re-harmonization.
- Contradictory material/thesis or invalid palette edits cannot be approved.
- Version history clearly shows origin and parent.
- Existing downstream artifacts become stale only after the new version is approved, according to the documented integrity contract.
- Ten targeted tiny-edit scenarios pass, including art subject and single-color replacement.

---

## Phase P1.3 — Conversational Diagnosis and Designer Point of View

### Objective

Turn the strong diagnosis data into the intended “Here’s what I see, what I think, and where I’d push back” experience.

### Work

1. Present diagnosis in four owner-facing sections:
   - what I see in your photos;
   - what is working;
   - what I would solve first;
   - what I think about your stated preferences.
2. Distinguish observation, inference, recommendation, and uncertainty visually and semantically.
3. Cite photo labels and typed dimensions where claims come from them.
4. Add `That’s wrong`, `Tell me more`, and `Make this a standing preference` feedback actions.
5. Let corrections update explicit room facts/preferences through confirmation, then regenerate affected work under normal versioning rules.
6. Show the designer’s recommended concept after the five-direction review and explain why.

### Strict success gate P1.3

- Every factual spatial claim has photo/dimension provenance or is labeled uncertain.
- The UI never presents inference as measured fact.
- Owner corrections persist and influence a subsequent generation.
- Diagnosis remains readable in under three minutes while full detail is available.
- Owner review rates specificity, honesty, and usefulness ≥8/10.

---

## Phase P1.4 — Trustworthy Product Handoff

### Objective

Make “Where do I find this stuff?” end in useful, current retailer pages rather than plausible-looking data.

### Work

1. Require a completed current render and approved concept version.
2. Reverify every candidate’s product URL, canonical URL, image, retailer, price, availability signal, and extraction timestamp before persistence.
3. Cache product imagery and store verification status/time.
4. Reject category/search/editorial pages when a specific purchasable item is claimed.
5. Distinguish exact visual match, close substitute, and design-direction reference.
6. Show dimensions, scale fit, budget impact, risks, and alternatives.
7. Add `Open retailer page` and record link-health failures without intercepting commerce.
8. Add scheduled or manual recheck workflow and replacement suggestions for dead links.
9. Provide room budget rollup against the owner’s stated range.

### Strict success gate P1.4

- Every persisted current product has a validated reachable canonical URL and cached image.
- A human can identify whether it is exact, near-match, or reference before clicking.
- Ten sampled retailer links open the claimed product; target 10/10 at release time.
- Product dimensions do not violate known room constraints without a visible warning.
- Total recommended spend and budget variance are visible.
- Dead-link recheck produces a badge and replacement path without deleting history.

---

## Phase P1.5 — Six-Room Home Command View

### Objective

Let the household understand and operate six rooms without opening each one to discover its state.

### Work

1. Add room cards with current source photo/render, approved direction, stage, active job, failure, stale state, and recommended next action.
2. Add home-level progress: intake, direction needed, rendering, review needed, sourcing, complete.
3. Surface cross-room palette/style consistency and standing home preferences without forcing sameness.
4. Allow safe room ordering and labels.
5. Add “Continue where we left off” and active/failing job visibility.
6. Keep generation actions room-scoped; avoid a dangerous one-click paid six-room batch until costs and controls justify it.

### Strict success gate P1.5

- Six seeded rooms in six different lifecycle states are correctly summarized from persisted data.
- The owner reaches the intended next action for any room in one click.
- Active and failed jobs are visible without entering the room.
- No room displays another room’s artifact or job.
- Mobile view remains scannable with no horizontal overflow or clipped primary actions.

---

## Phase P1.6 — Responsive, Accessible, Premium Interaction Polish

### Objective

Make every new workflow feel calm, deliberate, and excellent on the phone as well as desktop.

### Work

1. Run the complete journey at 390, 768, and 1440 pixels.
2. Verify minimum tap targets, keyboard order, focus restoration, dialogs, progress announcements, error association, and color contrast.
3. Optimize image loading and use framework image handling where compatible with dynamic storage/product sources.
4. Validate first-render and batch-completion moments with motion-reduction support.
5. Remove pipeline vocabulary and align all new copy with `brand-guidelines.html`.
6. Conduct fresh-context screenshot review for every empty, generating, partial, failed, completed, stale, proposal, confirmation, and recovery state.

### Strict success gate P1.6

- Full journey passes at all three widths.
- Zero critical/high accessibility findings and zero keyboard traps.
- Every changed screen scores ≥8/10 on the established premium/editorial rubric.
- No new exclamation points, disallowed iconography, rounded SaaS UI, or raw model terminology.
- Render hero remains the strongest visual element once available.

---

## Phase P1.7 — Household-Ready Release Gate

### Objective

Prove the complete product with realistic diversity, live providers, and homeowner judgment.

### Ten-scenario release matrix

Run ten distinct journeys, not ten prompt variants of one office:

1. Bright home office with four perspectives, glare, doors, and dual monitors.
2. Living room with keep-items and circulation constraints.
3. Bedroom with low budget and one-photo limitation.
4. Dining room with a bold user preference the designer should challenge.
5. Child/family room with durability and safety requirements.
6. Awkward small room with uncertain dimensions and clarification needs.
7. Room requiring an art-subject revision across all perspectives.
8. Room with one failed render perspective and successful targeted retry.
9. Room with stale concept/render/product history after a new approval.
10. Six-room returning-home session using the command view.

Each scenario must cover browser → API/job → database/storage → rendered response. At least three use live model/image providers; the rest may use deterministic fixtures where cost would add no evidence.

### Quantitative release criteria

- 10/10 journeys complete their intended outcome.
- 0 manual refreshes required.
- 0 duplicate paid generations from repeat clicks or refresh.
- 100% of failures show recovery or explicit terminal guidance.
- 100% of completed render batches retain correct source-photo linkage.
- 100% of current product samples pass release-time link/image validation.
- 0 unexpected console errors or failed network requests.
- 0 test residue and 0 automated production writes.
- All suite, typecheck, build, responsive, and accessibility gates green.

### Owner “wow” gate

For at least two real rooms and both homeowners:

- first-render reaction recorded verbatim;
- render resemblance/preservation ≥8/10;
- concept fit ≥8/10;
- workflow clarity ≥9/10;
- confidence in applying a revision ≥9/10;
- product usefulness ≥8/10;
- both say they would independently use it on the next room.

If a render is aesthetically weak but the workflow is correct, one owner-directed regeneration is permitted. If the second attempt still fails to produce a result either owner would use, the release gate remains closed and the failure is classified as prompt/context, provider capability, or preservation fidelity before another loop.

## 6. Regression suite expansion

The existing suites remain, with these additions:

- **Integrity:** job idempotency, job/artifact atomicity, batch partial success, proposal invalidations, one-current-render-per-photo.
- **E2E:** durable refresh/reopen, all-photo batch, failed-photo retry, chat proposal confirmation, five concepts, full editor, product open.
- **Failure suite:** every P0.0 fixture at every affected stage.
- **Assets/responsive:** job cards, proposal cards, batch grid, five-concept review, six-room dashboard.
- **Design review:** diagnosis conversation, differentiation, first-render arrival, failure/recovery tone, product trust cues.
- **Live smoke:** at least one diagnosis, five-concept generation, two-photo batch, chat-confirmed revision, and validated product.
- **Residue:** all new rows and storage objects keyed by `test_run_id`.

## 7. Migration and rollout policy

1. Additive migrations only.
2. Generate migration files with the Supabase CLI’s current supported workflow; never invent migration history entries.
3. Run database advisors before finalizing schema work.
4. Verify RLS/grants separately from table existence.
5. Deploy schema before code that requires it; keep code backward-tolerant during rollout where practical.
6. Feature-flag durable jobs, batch render, chat actions, and five concepts independently.
7. Roll out to the owner household first; no external-user assumptions are introduced.
8. A rollback disables the new entry point but never deletes jobs or artifacts.

## 8. Execution ledger template

Append one entry per loop to `SESSION_LOG.md`:

```markdown
### YYYY-MM-DD — Phase P?.? — Attempt N
- Objective:
- Baseline evidence:
- Change:
- Browser evidence:
- API/job evidence:
- Database/storage evidence:
- Tests:
- Residue:
- Gate result: PASS | FAIL
- Failure classification:
- Next loop:
```

## 9. Definition of household-ready

The application is household-ready only when Phase P1.7 is green. Until then, completed phases may be described as implemented and verified, but the product must not be described as flawless, six-room-ready, or released.

