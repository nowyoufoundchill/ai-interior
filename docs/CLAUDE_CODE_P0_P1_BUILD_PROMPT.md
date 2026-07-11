# Claude Code Prompt — Execute the P0/P1 Household-Ready Build

Copy everything below the divider into Claude Code from the repository root.

---

You are the primary implementation agent responsible for taking **AI Interior Designer** from its current state to the household-ready release defined in the repository’s P0/P1 execution plan.

This is an implementation assignment, not a planning exercise and not a code-review-only assignment. Work through the phases, edit the application, add migrations and tests, run the application, drive it through a real browser, inspect persisted state, fix failures, and continue looping until every automatable gate is genuinely green.

## Repository

- Root: `C:\Users\darre\Documents\AI Interior Designer`
- Branch: use the currently checked-out branch; do not discard or overwrite unrelated user changes.
- Stack: Next.js App Router, React, TypeScript, Tailwind, Supabase, Anthropic, OpenAI image edits, Tavily.

## Read these files completely before changing anything

Read in this order:

1. `AGENTS.md`, including any nested `AGENTS.md` files that apply
2. `docs/P0_P1_EXECUTION_PLAN_2026-07-10.md`
3. `PROJECT_BRAIN.md`
4. `docs/AI_Interior_Atelier_PRD_v3.md`
5. `brand-guidelines.html`
6. `SESSION_LOG.md`
7. `reports/release-2026-07-08.md`
8. `docs/PHASE9_OWNER_CYCLE.md`
9. the current `git status` and `git diff`

The P0/P1 execution plan is the controlling implementation plan. It supersedes older execution plans wherever they conflict. The PRD remains authoritative for product invariants unless the P0/P1 plan explicitly changes them.

After reading, state in no more than ten lines:

- the product outcome;
- the current phase;
- the phase gate;
- the first vertical slice you will implement;
- any genuine external blocker.

Then begin implementation immediately. Do not stop to rewrite the plan.

## Assignment

Execute these phases in strict order:

```text
P0.0 Test isolation and observability
P0.1 Durable generation jobs
P0.2 Resilient single-photo rendering
P0.3 All-perspective render batches
P0.4 Confirmed chat-to-action execution
P0.5 Guided workflow and recovery UX
P0.6 P0 release gate
P1.1 Five differentiated concept directions
P1.2 Full structured concept editor
P1.3 Conversational diagnosis
P1.4 Trustworthy product handoff
P1.5 Six-room home command view
P1.6 Responsive, accessible, premium polish
P1.7 Household-ready release gate
```

Do not begin a later phase until the current phase’s strict success gate is green with evidence. A passing typecheck is never sufficient evidence by itself.

## Mandatory phase loop

For each phase, repeat this loop until the gate passes:

1. **Orient**
   - Read the phase and every file it touches.
   - Trace the complete browser → API/job → database/storage → response path.
   - Inspect current live production data only when useful and only read-only.

2. **Baseline**
   - Start from a fresh tagged test seed.
   - Reproduce the relevant current failure or missing behavior.
   - Record browser, server, network, database, storage, and AI-run evidence.

3. **Implement one vertical slice**
   - Make the smallest coherent end-to-end change.
   - Add tests and `data-testid` coverage as part of the slice.
   - Use additive migrations and append-only artifact semantics.

4. **Verify**
   - Run focused tests and typecheck.
   - Drive the behavior through a real browser.
   - Query persisted state directly and compare it with the UI.
   - Exercise success, failure, retry, duplicate click, refresh/reopen, and stale-state behavior.

5. **Gate**
   - Evaluate every bullet in the phase’s strict success gate.
   - Mark it `PASS` only with direct evidence.
   - If one boundary fails, fix that boundary before proceeding farther downstream.

6. **Clean and record**
   - Teardown tagged test rows and Storage objects.
   - Run the residue assertion.
   - Append the required execution entry to `SESSION_LOG.md`.
   - Update tests and documentation so the verified behavior is reproducible.

Continue automatically after a passing gate. Do not ask for permission between ordinary implementation steps.

## Attempt and recovery discipline

- Do not repeat the same failed technical approach more than three times.
- On the third failure, write a concise cause analysis, select a materially different approach, and continue.
- Never weaken a critic, assertion, timeout test, security policy, or success gate just to obtain green output.
- Never hide a failure behind a mock when the gate requires live evidence.
- Never continue past the first confirmed broken boundary in a verification flow.
- Preserve useful intermediate work, especially paid AI output, across persistence retries.

## Safety and authority boundaries

You are authorized to:

- edit application, test, prompt, script, type, and documentation files in this repository;
- add dependencies when clearly necessary, pinning versions and updating the lockfile;
- create additive Supabase migrations through the supported CLI workflow;
- run local builds, test suites, browser tests, and mock/provider fixtures;
- query production Supabase read-only for diagnosis;
- update `SESSION_LOG.md` and execution documentation.

You are not authorized to:

- run automated mutation tests against production;
- apply migrations to production without explicit owner authorization;
- deploy to Vercel or push to remote without explicit owner authorization;
- delete or rewrite owner production artifacts;
- expose service-role or provider keys;
- add authentication, a fourth AI provider, or destructive migrations;
- make purchases or trigger an unbounded quantity of paid model/image calls;
- fabricate evidence for owner-only reaction gates.

If `.env.test` is absent or resolves to the production Supabase project:

1. implement and verify the fail-closed guard without writing to production;
2. prepare the migration/configuration instructions needed for a dedicated test project;
3. continue all safe local/static/mock work that does not mutate production;
4. mark P0.0 blocked only when no further safe phase work is possible;
5. request exactly the missing external action from the owner.

Do not silently fall back to `.env.local` for mutation-capable suites.

## Architecture invariants

- The approved concept version is the sole downstream design contract.
- Existing artifacts are append-only; invalidated artifacts become stale, not deleted.
- One current render is allowed per source photo and approved concept version.
- A batch can be partially successful; successful perspectives survive sibling failure.
- Durable work must survive refresh, navigation, browser close, and client disconnect.
- Duplicate clicks and retries must be idempotent.
- No completed job may reference a missing artifact.
- No operational critic timeout may be misrepresented as a design pass or rejection.
- Chat never mutates state before explicit confirmation.
- Confirmed chat proposals create durable jobs and cannot be replayed accidentally.
- Service-role credentials stay server-only.
- RLS and grants must be verified separately for every exposed schema change.
- Do not use `SECURITY DEFINER` as a permission workaround.
- Keep the single-household/private product decision; do not introduce auth.

## Long-running job requirements

Implement the durable state contract from the P0/P1 plan:

```text
queued → planning → validating → generating → persisting → completed
   ├→ retryable_failed
   ├→ terminal_failed
   └→ cancelled
```

The execution mechanism must work in the actual deployment architecture. Do not claim durability if work merely continues in an in-memory promise after a route responds. Validate serverless/runtime behavior and document the chosen mechanism and tradeoffs before marking P0.1 complete.

Every stage must have:

- an explicit timeout;
- bounded retries;
- idempotency behavior;
- persisted progress and timestamps;
- owner-safe failure copy;
- internal correlation to provider runs;
- `test_run_id` support;
- retry behavior that avoids repeating a paid step when only persistence failed.

## Browser verification requirements

Use a real browser for all user-facing gates. Direct API calls may prepare or diagnose state, but they do not replace the browser journey.

For changed UI, verify:

- 390px mobile;
- 768px tablet;
- 1440px desktop;
- keyboard-only interaction;
- progress announcements and focus behavior;
- zero new console errors or warnings;
- zero unexpected failed network requests;
- no horizontal overflow, clipping, or ambiguous primary action.

Every interactive control and artifact card needs a stable `data-testid`. Tests must not depend on visible copy or styling classes as selectors.

## Product and brand requirements

- The render remains the flagship visual artifact.
- The experience must feel like a calm, expert-led interior design studio, not an AI pipeline or admin dashboard.
- Use the exact visual/verbal system in `brand-guidelines.html`.
- No exclamation points in owner-facing copy.
- No raw provider/model/pipeline vocabulary in owner-facing states.
- One primary action per lifecycle state, with at most two secondary actions.
- Errors must explain what happened, what was saved, and the next action.
- Do not use `alert()` as the sole presentation of a generation failure.
- The five concepts must differ in design strategy, not merely name or adjectives.
- Product pages must be verified and labeled as exact match, near-match, or design reference.

## Required tests and evidence

Maintain and expand the repository suites specified in the plan:

- integrity/state transitions;
- complete E2E journey;
- deterministic failure fixtures;
- durable refresh/reopen;
- all-photo batch and partial retry;
- confirmed chat proposal scenarios;
- five-concept differentiation;
- full concept field editing;
- product URL/image validation;
- responsive/assets;
- accessibility;
- premium design review;
- live smoke where explicitly required;
- teardown and residue.

For each phase report:

```markdown
## Phase P?.? Gate Report
- Result: PASS | FAIL | EXTERNAL BLOCKER
- Objective:
- Vertical slices completed:
- Files/migrations changed:
- Browser evidence:
- API/job evidence:
- Database/storage evidence:
- Tests and exact totals:
- Console/network result:
- Teardown/residue result:
- Known limitations:
- Next phase or next corrective loop:
```

Do not report a gate as passed with phrases such as “should work,” “appears correct,” or “typecheck passes.”

## Live-provider and owner-only gates

Mock/fixture work may proceed autonomously in the dedicated test environment. Before initiating material live-provider spend, estimate the number of Anthropic, OpenAI image, and Tavily calls for the gate and use the smallest set that supplies the required evidence.

If live credentials exist and the required calls are bounded and clearly part of the plan, run the minimum live smoke required by the phase. Do not run the full P1.7 multi-room paid matrix without explicit owner confirmation of the expected spend.

Owner-reaction gates cannot be self-scored. When all automatable criteria for P0.6 or P1.7 are green:

1. present the exact owner test script;
2. identify the rooms/artifacts to review;
3. provide the scoring questions from the plan;
4. stop and request the owner’s answers;
5. keep the phase open until those answers satisfy the gate.

## Git discipline

- Inspect `git status` before every phase.
- Preserve unrelated and pre-existing modifications.
- Keep phase changes coherent and reviewable.
- Do not amend, reset, clean, force-push, or discard user work.
- Do not commit or push unless the owner explicitly authorizes it in the Claude Code session.

## Starting instruction

Begin now with **Phase P0.0**.

First establish whether a truly separate `.env.test` Supabase project exists without printing any secrets. Inspect the current mutation suites for fallback-to-production behavior. Baseline the current test safety and observability. Then implement the smallest vertical slice that makes mutation suites fail closed when test and production point to the same project.

Remain in P0.0 until every P0.0 strict success criterion in `docs/P0_P1_EXECUTION_PLAN_2026-07-10.md` is proven green or until a genuine external test-project provisioning action is the only remaining blocker.

