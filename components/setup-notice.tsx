export function SetupNotice() {
  return (
    <div className="atelier-card p-10 md:p-14">
      <p className="atelier-eyebrow">Setup needed</p>
      <h1 className="mt-3 font-serif text-4xl text-atelier-ink">
        Connect the studio to <em className="italic">begin</em>
      </h1>
      <p className="mt-5 max-w-2xl text-sm font-light leading-7 text-atelier-umber">
        Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`, then run
        the SQL migration in `supabase/migrations/001_initial_schema.sql`. The studio is
        intentionally in private single-household mode, so there is no login wall.
      </p>
    </div>
  );
}
