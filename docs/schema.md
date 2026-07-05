# Database Schema

AI Interior Atelier starts in private single-household mode. The schema still keeps a `users` table and `user_id` on homes so Supabase Auth can be added later without changing the product model.

Run `supabase/migrations/001_initial_schema.sql` in Supabase SQL Editor or through the Supabase CLI.

Tables:

- `users`: private household owner profile.
- `homes`: whole-home project context, palette, and constraints.
- `rooms`: room brief, state, selected concept, and workflow status.
- `photos`: uploaded room and inspiration images with labels.
- `room_analyses`: structured designer diagnosis outputs.
- `mood_boards`: concept directions and selected state.
- `products`: shoppable product plan with scoring and rationale.
- `renders`: mockup metadata, source photo, prompt, critique, and output URL.
- `revisions`: persistent room-aware design chat and revision history.
- `design_memories`: user, home, and room preferences or decisions.
- `ai_runs`: prompt/debug log for mocked and future AI services.

Storage:

- `room-photos`: public Supabase Storage bucket used for room photos and future render uploads.
