# Documentation Map

This directory has four active sources of truth. Each kind of information has one owner.

| Document | Authority |
|---|---|
| `../CLAUDE.md` | Always-on implementation rules and authority boundaries for Claude Code |
| `PRODUCT.md` | Stable product/experience contract, quality bar, and committed P1.1–P1.6 sequence |
| `ACTIVE_BUILD.md` | Current phase only: next unchecked slice, non-goals, gate, and handoff |
| `OPERATIONS.md` | Environment, testing, migrations, deployment, and verification commands |

Additional references are loaded only when relevant:

- `../brand-guidelines.html` — complete visual and verbal brand system for owner-facing UI work.
- `runbooks/TREND_REFRESH.md` — periodic trend-intelligence refresh procedure.
- `../prompts/` — versioned runtime prompts used by the application.
- `../supabase/migrations/` and `../types/database.ts` — database schema authority.
- `../reports/` — immutable gate and benchmark evidence; never startup context.
- `archive/` — superseded planning and historical evidence; never startup context.

## Agent reading order

For ordinary implementation work:

1. `../CLAUDE.md` loads automatically in Claude Code.
2. Read `ACTIVE_BUILD.md`.
3. Inspect current source, tests, status, and diff.
4. Consult only the relevant section of `PRODUCT.md` or `OPERATIONS.md`.

Do not read every document before changing code. Do not use archived files to override an active source of truth.

There is no separate active PRD, project brain, execution prompt, or session log. Historical filenames retained at the docs root are compatibility redirects only.

## Maintenance rule

- Stable product decisions change in `PRODUCT.md`.
- Current progress changes in `ACTIVE_BUILD.md`.
- Commands and operational policy change in `OPERATIONS.md`.
- Gate and benchmark evidence is written once under `reports/`.
- Superseded plans move to `archive/`; they are not edited further.
