# AI Interior Designer

A private interior-design application for one household. It turns a few plain-language needs and real room photographs into one designer-quality recommendation, conversational revisions, an implementation-aware room package, and a coherent design record across rooms.

The application is currently closing **P0.6 — reliability foundation** before beginning the three-room Designer Autopilot benchmark. See [docs/ACTIVE_BUILD.md](docs/ACTIVE_BUILD.md) for the next unchecked slice and [docs/PRODUCT.md](docs/PRODUCT.md) for the replacement P1.1–P1.6 contract.

## Start the application

1. Use Node.js 22 or newer and install the locked dependencies:

   ```powershell
   npm.cmd ci
   ```

2. Copy `.env.example` to `.env.local` and provide the three required Supabase values. Provider keys are needed only for live AI calls.

3. Install Chromium once if you will run browser suites:

   ```powershell
   npx.cmd playwright install chromium
   ```

4. Start the development server:

   ```powershell
   npm.cmd run dev
   ```

The app uses private single-household mode and intentionally has no login wall.

## Core commands

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev:test
npm.cmd run seed:test
npm.cmd run suite:e2e
npm.cmd run teardown:test
npm.cmd run check:residue
```

`npm.cmd run dev:test` defaults to `AI_MODE=mock` and is the safe implementation/regression server. A normal `npm.cmd run dev` uses the mode in the environment; when `AI_MODE=mock` is absent, provider paths are live. Live calls are reserved for gates that judge provider integration or output quality.

The repository currently permits tagged automated suites against the production Supabase project under the explicit controls in `test-isolation.config.json`. Read [docs/OPERATIONS.md](docs/OPERATIONS.md) before running mutation-capable suites.

## Documentation

- [CLAUDE.md](CLAUDE.md) — Claude Code working agreement
- [docs/PRODUCT.md](docs/PRODUCT.md) — stable product and architecture contract
- [docs/ACTIVE_BUILD.md](docs/ACTIVE_BUILD.md) — current phase and next slice
- [docs/OPERATIONS.md](docs/OPERATIONS.md) — environment, tests, migrations, and deployment
- [docs/README.md](docs/README.md) — complete authority map
- [brand-guidelines.html](brand-guidelines.html) — owner-facing visual and verbal system

Superseded plans and historical session evidence live under `docs/archive/` and are not active implementation context.

## Stack

- Next.js App Router, React, TypeScript, and Tailwind CSS
- Supabase Postgres and Storage
- Anthropic for reasoning
- OpenAI for image editing
- Tavily for sourcing support
- Zod for structured AI/domain contracts
- Playwright for browser verification

Database changes are ordered additive migrations under `supabase/migrations/`. Application database types live in `types/database.ts`.
