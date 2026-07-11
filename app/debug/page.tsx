export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DebugPage() {
  const supabase = createServerSupabaseClient();
  const { data: runs, error } = await supabase
    .from("ai_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <AppShell>
      <div className="grid gap-6">
        <section>
          <p className="atelier-label">Owner debug panel</p>
          <h1 className="mt-2 font-serif text-4xl text-atelier-ink">AI run log</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-atelier-charcoal">
            Prompt versions, statuses, models, and validation traces for the latest room-level AI operations.
          </p>
        </section>

        {error ? (
          <div className="border border-hairline bg-atelier-ivory p-8 text-sm text-atelier-charcoal">
            {error.message}
          </div>
        ) : (
          <div className="grid gap-4">
            {(runs ?? []).map((run) => (
              <article key={run.id} className="atelier-card grid gap-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="atelier-label">{run.provider ?? "provider unknown"}</p>
                    <h2 className="mt-1 font-serif text-2xl text-atelier-ink">{run.service_name}</h2>
                  </div>
                  <span className="bg-atelier-ivory px-3 py-1 text-xs font-semibold text-atelier-charcoal">
                    {run.status}
                  </span>
                </div>
                <div className="grid gap-2 text-sm text-atelier-charcoal md:grid-cols-3">
                  <p>Prompt: {run.prompt_version}</p>
                  <p>Model: {run.model_name ?? "n/a"}</p>
                  <p>Quality: {run.quality_score ?? "n/a"}</p>
                  <p>Error code: {run.error_code ?? "none"}</p>
                  <p>Attempt: {run.attempt ?? "n/a"}</p>
                  <p>Correlation: {run.correlation_id ?? "n/a"}</p>
                </div>
                <pre className="overflow-auto bg-atelier-ivory p-3 text-xs">
                  {JSON.stringify(
                    {
                      room_id: run.room_id,
                      correlation_id: run.correlation_id,
                      error_code: run.error_code,
                      attempt: run.attempt,
                      validation_errors: run.validation_errors,
                      token_estimate: run.token_estimate,
                      cost_estimate: run.cost_estimate,
                      latency_ms: run.latency_ms,
                      created_at: run.created_at
                    },
                    null,
                    2
                  )}
                </pre>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
