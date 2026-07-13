# AI Interior Designer — Claude Code Instructions

## Start here

1. Read `docs/ACTIVE_BUILD.md`.
2. Inspect `git status`, the current branch, and the relevant diff.
3. Read only the source, tests, and reference sections named by the active slice.

`docs/PRODUCT.md` owns stable product and architecture invariants. `docs/OPERATIONS.md` owns commands, test policy, migrations, and deployment procedure. Do not read `docs/archive/` or historical reports unless the active task explicitly requires history.

## Execution rule

Implement only the next unchecked slice in `docs/ACTIVE_BUILD.md`. P0.0 through P0.5 are accepted as complete. Do not reopen a completed phase unless a focused regression in the code you changed fails.

This is an implementation repository. Do not rewrite the roadmap, reproduce old audits, or create a second plan before beginning ordinary scoped work.

## Product bar

The application must let a homeowner move from a few plain-language facts and real room photographs to one useful designer recommendation, refine it naturally, implement it honestly, and continue coherently across rooms without understanding the AI pipeline.

For every owner-facing change, optimize for:

- one obvious next action;
- the source photograph or latest design in the first usable viewport;
- durable progress that survives refresh and navigation;
- specific, room-aware design judgment;
- clear recovery when work fails;
- the minimum owner input and provider work that preserve outcome quality;
- calm, editorial presentation consistent with `brand-guidelines.html`.

## Invariants

- Every first design or revision appends a candidate version. One current candidate may exist per source photo; a room has zero or one current accepted design version. Room plans and products bind only to that accepted version. Transitional diagnosis or mood-board rows may support it internally but are not required owner destinations.
- Artifacts are append-only. Superseded work becomes stale; it is not deleted.
- Successful batch perspectives survive sibling failure and remain independently retryable.
- Long-running work is persisted, bounded, idempotent, and recoverable after refresh or browser close.
- A completed job must reference a persisted artifact.
- Sending an unambiguous, reversible one-room visual revision is explicit authorization for one append-only revision job; do not add a second confirmation ceremony. Ambiguous, standing-preference, cross-room, or implementation-invalidating changes must explain scope before execution. No confirmed action can be replayed accidentally.
- Typed dimensions and explicit owner constraints outrank inferred room facts, preferences, and trend intelligence.
- One recommendation is the default. Do not introduce a required concept count, prompt editor, or visible diagnosis workflow.
- Finished-image quality is judged from the actual source/result pair. A plan-only critic cannot certify architectural retention.
- Visual inference is not measurement; exact placement, fit, product, construction, or safety claims require provenance and visible caveats.
- Service-role credentials and provider secrets remain server-only.
- The product remains private, single-household, and without authentication unless the owner changes that decision.
- Provider roles remain Anthropic for reasoning, OpenAI for image editing, and Tavily for sourcing support. Do not add another provider without approval.
- Database changes are additive migrations. Do not use destructive schema changes or `SECURITY DEFINER` permission workarounds.

## Working loop

For each slice:

1. Trace only the affected browser → API/job → data → response path.
2. Implement the smallest coherent owner-visible outcome.
3. Run typecheck plus focused, fast tests.
4. Drive the affected path in a real browser when UI behavior changes.
5. Inspect persisted state when the slice crosses a database or storage boundary.
6. Fix the first broken boundary before testing farther downstream.
7. Run the integrated phase gate once after all slices are complete.

Do not run every historical suite after every small edit. Use the verification tiers in `docs/OPERATIONS.md`.

## Handoff

Update only `docs/ACTIVE_BUILD.md` with:

- completed slice and outcome;
- focused verification result;
- current blocker, if any;
- next unchecked slice.

Do not append to a narrative session log, duplicate the same evidence in multiple documents, or update archived plans.

## Authority and stop conditions

Proceed without asking between ordinary repository edits, mock-mode tests, browser checks, and the owner-approved tagged test regime described by `test-isolation.config.json`.

Stop and request the specific missing decision before:

- applying a production migration directly;
- committing, pushing, merging, deploying, or deleting production data;
- making a destructive migration or adding authentication/a provider;
- running an unbounded or material paid-provider matrix;
- claiming an owner-reaction gate has passed without the owners' answers.

Preserve unrelated work. Never reset, clean, amend, force-push, or discard user changes.
