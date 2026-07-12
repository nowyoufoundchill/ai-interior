# Phase 1 Foundation

Phase 1 builds the product foundation for a private virtual interior design studio:

- Next.js App Router with TypeScript and Tailwind CSS.
- Supabase Postgres and Storage-ready data model.
- Single-household mode without login.
- Dashboard, home creation, home detail, room creation, and room detail workspace.
- Room tabs for Photos, Diagnosis, Mood Boards, Products, Renders, Chat, and Memory.
- Photo upload, labeling, relabeling, and deletion hooks.
- Mock service boundaries for the future design intelligence pipeline.

Real AI calls are intentionally deferred. The mock services validate outputs and log to `ai_runs`, so each future OpenAI-backed service can replace one mock at a time.
