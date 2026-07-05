import { Database } from "lucide-react";

export function SetupNotice() {
  return (
    <div className="atelier-card p-8">
      <div className="flex items-start gap-4">
        <div className="rounded-md bg-atelier-linen p-3 text-atelier-charcoal">
          <Database className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <p className="atelier-label">Setup needed</p>
          <h1 className="mt-2 font-serif text-3xl text-atelier-ink">Connect Supabase to begin</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-atelier-charcoal">
            Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`,
            then run the SQL migration in `supabase/migrations/001_initial_schema.sql`.
            The app is intentionally in private single-household mode, so there is no login wall.
          </p>
        </div>
      </div>
    </div>
  );
}
