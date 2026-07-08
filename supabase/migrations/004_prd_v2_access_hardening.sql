-- PRD v2 access hardening.
--
-- Migration 002 revoked all table/routine/sequence privileges from the browser-
-- facing roles (anon, authenticated) to enforce the private, server-only data
-- access model. However, 002 ran BEFORE migration 003 created the PRD-v2 tables
-- `design_preferences` and `chat_messages`, so those tables can still carry the
-- default grants Supabase applies to newly created public tables. This migration
-- re-applies the revoke (now that all tables exist) and, critically, changes the
-- schema default privileges so any future table is server-only by default and
-- this class of gap cannot recur.
--
-- The application never uses the anon key to read or write tables (the browser
-- Supabase client is unused; all data access goes through server routes using the
-- service role, which bypasses grants). This migration is additive and idempotent.

-- 1. Re-revoke on every current table/routine/sequence, including the PRD-v2 tables.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all routines in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- 2. Stop future objects in this schema from being auto-granted to browser roles.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- 3. Keep schema usage so the storage read policy for room-photos still resolves.
grant usage on schema public to anon, authenticated;
