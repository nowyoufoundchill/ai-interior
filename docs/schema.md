# Database Schema

AI Interior Atelier is migrating from an early v1-style schema to the append-only PRD v2 model.

Apply migrations in order:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_private_server_access_hardening.sql`
- `supabase/migrations/003_prd_v2_foundation_alignment.sql`

Core tables currently in play:

- `users`: single-household owner placeholder profile.
- `homes`: whole-home project context.
- `rooms`: room brief plus both legacy `status` and PRD-v2-aligned `current_stage`.
- `photos`: uploaded room/source images.
- `room_analyses`: diagnosis records with version and stale/current status metadata.
- `mood_boards`: concept records with version, origin, and status metadata including `locked` and `stale`.
- `products`: append-only product plan records tied to mood board version where available.
- `renders`: append-only render records tied to mood board version and source photo.
- `revisions`: legacy chat/revision history still used by the current UI.
- `design_memories`: legacy preference memory records still used by the current UI.
- `design_preferences`: PRD v2 home-level taste record table introduced by migration 003.
- `chat_messages`: PRD v2-aligned chat transcript table introduced by migration 003.
- `ai_runs`: debug/prompt log, expanded in migration 003 for provider/raw input-output metadata.

Storage:

- `room-photos`: currently stores both uploaded room photos and generated render images.
