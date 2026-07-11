# Test Environment Modes — Setup Guide

**Current mode (owner decision 2026-07-10): PRODUCTION.** The owner declined
a dedicated test project; automated suites run against the production
Supabase project under the regime recorded in `test-isolation.config.json`:
mandatory `test_run_id` tagging on every row and storage object, teardown
after every cycle, and `npm run check:residue` as a failing gate. This is an
explicit, committed acknowledgment — not a silent fallback. Deleting that
config file (or provisioning `.env.test`, which always takes precedence)
restores strict fail-closed isolation.

The rest of this document describes the ISOLATED mode for whenever a
dedicated test project is wanted: every mutation-capable script and suite
then refuses to run when `.env.test` is missing or resolves to the same
Supabase project as `.env.local`.

## Owner actions (one-time, ~10 minutes)

1. **Create a second Supabase project** in the same org (dashboard → New
   project). Suggested name: `ai-interior-test`. Free tier is fine; the test
   data is torn down after every cycle.
2. **Create the storage bucket**: in the new project, create a **public**
   bucket named `room-photos` (same name and visibility as production).
3. **Copy credentials into `.env.test`**:
   ```
   cp .env.test.example .env.test
   ```
   Fill in from the new project's Settings → API:
   - `NEXT_PUBLIC_SUPABASE_URL` — the new project's URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   Leave `AI_MODE=mock`. Provider keys are only needed for Suite 3 live runs.
4. **Apply all migrations to the test project.** Two supported ways:
   - **Supabase CLI** (preferred if installed):
     ```
     npx supabase link --project-ref <test-project-ref>
     npx supabase db push
     ```
   - **SQL editor fallback:** run each file in `supabase/migrations/` in
     order (001 → 006) in the test project's SQL editor.
5. **Verify parity + isolation:**
   ```
   npm run seed:test        # must succeed and print an isolation line
   npm run teardown:test
   npm run check:residue    # still reads PRODUCTION read-only; must be clean
   ```

## How the fail-closed guard works (no action needed)

- `scripts/test-env.mjs#loadTestEnv()` throws unless `.env.test` exists and
  its Supabase project ref differs from `.env.local`'s. Identity is compared
  via SHA-256 fingerprints of the project ref — credentials are never printed.
- `npm run dev:test` starts the Next.js dev server with `.env.test` applied
  as process env (which outranks `.env.local` in Next.js), so the app under
  test writes to the test project.
- Every suite calls `requireServerIsolation()` before its first write: it
  checks `.env.test` isolation, that the seeded rows live in the test
  project, and that the **running server** reports the same test-project
  fingerprint via `GET /api/debug/env-fingerprint`. Any mismatch aborts the
  suite before it mutates anything.
- `npm run check:residue` still intentionally reads `.env.local` (production,
  read-only) — its job is proving production has zero test rows.
- Legacy cleanup only: `TEARDOWN_ALLOW_PRODUCTION=1 npm run teardown:test
  <test_run_id>` lets the owner explicitly remove old tagged residue from
  production. It is loud, opt-in, and deletes only rows carrying that id.
