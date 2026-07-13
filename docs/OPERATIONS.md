# Operations and Verification

This document owns environment, test, migration, and deployment procedure. `package.json`, `test-isolation.config.json`, repository scripts, and GitHub workflows remain the executable authority.

## Local setup

Requirements:

- Node.js 22 or newer and npm
- Chromium for Playwright suites
- a configured `.env.local`

```powershell
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd run dev
```

The standard local application uses `.env.local`. Never print or commit credential values. The three Supabase values are required for normal application data access; provider keys are required only for live calls.

Key environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `TAVILY_API_KEY`
- `AI_MODE=mock|live`

`npm.cmd run dev:test` defaults to mock mode. `npm.cmd run dev` does not: if `AI_MODE=mock` is not explicitly present in the environment, provider paths resolve to live mode.

Use `npm.cmd run kill-servers` to stop repository development servers left on known ports.

## Test environment policy

There are two supported modes, resolved in this order.

### 1. Isolated mode

If `.env.test` exists and points to a different Supabase project from `.env.local`, it is always preferred. `npm.cmd run dev:test` starts the application against this environment with mock AI by default.

### 2. Owner-acknowledged production mode

The current owner decision is recorded in `test-isolation.config.json`: automated suites may use the production Supabase project only under all of these controls:

- every created row and storage object carries the current `test_run_id`;
- every cycle starts from a fresh seed;
- teardown runs after every cycle, including failure;
- `npm.cmd run check:residue` is a failing gate;
- mock AI is used unless a live-provider gate explicitly requires otherwise.

The committed config is the machine-readable authority. There is no silent fallback. Removing it without a valid isolated `.env.test` makes mutation-capable suites fail closed.

## Optional isolated test project

To switch to isolated mode:

1. Create a separate Supabase project.
2. Create a public `room-photos` Storage bucket.
3. Copy `.env.test.example` to `.env.test` and fill the separate project's three Supabase values.
4. Apply all migrations under `supabase/migrations/` in order.
5. Verify the `service_role` can access every application table before seeding. A fresh project may not inherit the grants assumed by older migrations; if access returns `42501`, add an explicit additive grants migration rather than changing the dashboard by hand.
6. Start the test application with `npm.cmd run dev:test`.
7. Run `npm.cmd run seed:test`, a focused suite, `npm.cmd run teardown:test`, and `npm.cmd run check:residue`.

The scripts compare non-reversible project fingerprints and verify that the running server is connected to the expected project before the first suite write.

## Verification tiers

### Inner loop — every slice

- `npm.cmd run typecheck`
- fast tests for changed pure logic
- the affected browser path when UI behavior changed
- direct persisted-state inspection when the change crosses data or storage

Do not run the full historical matrix after every edit.

### Phase gate — once after integration

- `npm.cmd run build`
- focused phase suite from a fresh seed
- one functional E2E regression journey
- teardown and residue check

Run additional integrity or failure suites only when the phase changed their boundary.

### Release gate — product milestones

- full integrity and functional journeys
- deterministic failure matrix
- responsive checks at 390, 768, and 1440 pixels
- accessibility and design review
- minimum bounded live-provider smoke
- owner-scored real-room journeys

### Visual-quality benchmark — Designer Autopilot phases

- use the same source photograph and image model/settings for every compared path;
- freeze the preservation/program checklist and scoring rubric before generating candidates;
- score finished source/result pairs blindly rather than scoring written plans or prompts;
- record calls, tokens, elapsed time, and estimated cost separately from design quality;
- treat moved fixed openings, structural members, required access, and named keep items as hard failures;
- keep raw room images, generated references, and original conversations only under ignored `benchmarks/private/` or equivalent owner-approved private storage; commit only redacted manifests, checksums, scores, and consumption summaries;
- require owner authorization before a paid multi-path comparison matrix.

## Commands

| Purpose | Command |
|---|---|
| Development server | `npm.cmd run dev` |
| Test-bound development server | `npm.cmd run dev:test` |
| Stop known local servers | `npm.cmd run kill-servers` |
| TypeScript | `npm.cmd run typecheck` |
| Production build | `npm.cmd run build` |
| Seed tagged state | `npm.cmd run seed:test` |
| Teardown tagged state | `npm.cmd run teardown:test` |
| Assert zero residue | `npm.cmd run check:residue` |
| State/invalidation regression | `npm.cmd run suite:integrity` |
| Functional browser journey | `npm.cmd run suite:e2e` |
| Failure fixtures | `npm.cmd run suite:failure-fixtures` |
| Durable jobs | `npm.cmd run suite:jobs` |
| Single render jobs | `npm.cmd run suite:render-jobs` |
| Render batches | `npm.cmd run suite:render-batches` |
| Confirmed chat actions | `npm.cmd run suite:chat-actions` |
| Assets and responsive behavior | `npm.cmd run suite:assets-responsive` |
| Legacy P0 design-review capture | `npm.cmd run suite:design-review` |
| Paid live smoke | `npm.cmd run suite:live-smoke` |
| Legacy environment/schema check | `npm.cmd run verify:live` |

`verify:p0-1` through `verify:p0-4` are historical production-mode phase runners. They start from `.env.local` and are incompatible with isolated `.env.test` mode; use them only when deliberately reopening that historical boundary. `verify:p0-6` is the supported current configurable gate: it loads the approved test environment, runs mock AI, fresh-seeds each selected suite, and always tears down and checks residue. New phases should extend or replace one configurable runner rather than copy another wrapper.

`npm.cmd run lint` is not currently a valid non-interactive gate: the repository has no completed ESLint configuration and the Next.js lint command enters setup/deprecation behavior. Use typecheck/build and focused suites until lint is repaired as a separate tooling task.

## Safe suite cycle

Start the test-bound server in one terminal:

```powershell
npm.cmd run dev:test
```

Then use a second terminal for one fresh focused cycle:

```powershell
npm.cmd run seed:test
npm.cmd run suite:<focused-suite>
npm.cmd run teardown:test
npm.cmd run check:residue
```

If the suite fails, teardown and residue checking must still be run. Do not verify a fix against dirty seeded state.

The commands above do not provide automatic `finally` behavior when run manually. Always run teardown and the residue check after a failed seed or suite as well.

## Provider modes and spend

- `AI_MODE=mock` is policy for implementation and regression work and the executable default of `npm.cmd run dev:test`; it is not the implicit default of `npm.cmd run dev`.
- Live mode is used only when output quality or provider integration is the acceptance criterion.
- Use the smallest bounded call set that supplies the missing evidence.
- Do not run the full multi-room paid release matrix without owner confirmation.
- Do not run the three-room, multi-path visual benchmark without an agreed bounded call plan and owner confirmation.

## Database schema and migrations

Schema authority is:

1. ordered files in `supabase/migrations/`;
2. application database types in `types/database.ts`;
3. runtime verification.

Do not maintain a second handwritten table inventory.

Migration rules:

- additive changes only unless the owner explicitly approves otherwise;
- generate or author a real migration file—never fabricate migration history;
- verify RLS and grants separately from table existence;
- keep code tolerant during schema-first rollout where practical;
- never expose service-role credentials.

Pull requests that change `supabase/**` run the Supabase dry-run workflow. A push to `main` that changes `supabase/**` invokes the migration deployment workflow using `SUPABASE_DB_URL`. These workflows do not run the application typecheck, build, or browser suites.

`npm.cmd run verify:live` is currently a legacy infrastructure check. It verifies configured Supabase access, an older table list, and the Storage bucket; it does not call providers and should not be treated as schema-complete for migrations 008–009. `npm.cmd run suite:live-smoke` is the bounded paid provider check.

Applying a migration directly to production, pushing, merging, or deploying requires explicit authorization in the current task.

## Evidence and reporting

Machine-readable suite results belong in `test-runs/suite-results/`. Screenshots belong in `test-runs/screenshots/`. Durable gate reports, benchmark manifests, scorecards, and consumption summaries belong once under `reports/`; private source/result images remain outside public bundles.

The active agent updates `docs/ACTIVE_BUILD.md` with a concise handoff. Do not append the same narrative to multiple plans or resurrect `SESSION_LOG.md` as startup context.
