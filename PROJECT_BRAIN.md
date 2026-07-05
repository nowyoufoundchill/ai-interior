# Project Brain: AI Interior Atelier

## Product Intent
AI Interior Atelier is a private virtual interior design studio for designing a home room by room. The product should feel like a working design studio: room intake, photo diagnosis, concept directions, product plans, render prompts/mockups, revision chat, and persistent design memory.

## Current Mode
- Private single-household mode.
- No login wall in the current build.
- Schema keeps `users` and `user_id` so Supabase Auth can be added later.
- Real AI calls are not yet wired; Phase 1 uses mock service boundaries and `ai_runs` logging.

## Repository
- GitHub origin: https://github.com/nowyoufoundchill/ai-interior
- Local path: `C:\Users\darre\Documents\AI Interior Designer`
- Local branch: `main`

## Supabase
- Project URL: `https://ztakhixowbjhfoggwtll.supabase.co`
- Public env variable expected by app: `NEXT_PUBLIC_SUPABASE_URL`
- Browser key variable expected by app: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Server secret variable expected by app: `SUPABASE_SERVICE_ROLE_KEY`
- Local secrets live only in `.env.local`, which must stay ignored by Git.

## Architecture
- Next.js App Router with TypeScript.
- Tailwind CSS for styling.
- Supabase Postgres and Storage.
- Main app flow: dashboard -> home -> room -> room workspace tabs.
- Room workspace tabs: Photos, Diagnosis, Mood Boards, Products, Renders, Chat, Memory.

## AI Service Boundaries
The AI layer lives under `lib/ai/` and should keep structured outputs validated with Zod. Replace mocks one service at a time.

Current services:
- `roomVisionAnalyst`: room/photo diagnosis.
- `designBriefInterpreter`: structured brief extraction.
- `wholeHomeContextAgent`: whole-home consistency guidance.
- `styleDirector` / `moodBoardGenerator`: concept directions.
- `productSourcingAgent`: product plan.
- `renderPromptDirector`: image mockup prompt and constraints.
- `designCritic`: output scoring rubric.
- `revisionAgent`: room-aware chat/revision handling.
- `memoryAgent`: design preference memory.

## Build Rules
- Keep `.env.local` and secrets out of Git.
- Keep AI outputs structured and Zod-validated.
- Log AI operations to `ai_runs`.
- Prefer one real AI replacement per phase so failures are isolated.
- Do not add auth until private single-household workflows are stable.
