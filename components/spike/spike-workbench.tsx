"use client";

import { useState } from "react";

const defaultPayload = {
  home: {
    name: "New House",
    region: "South Carolina",
    home_type: "Single-family home",
    style_notes: "Collected, warm, tailored, premium but livable."
  },
  room: {
    name: "Study",
    room_type: "Office",
    purpose: "Masculine executive-style home office with practical storage and a polished background for calls.",
    budget_range: "$8k-$15k",
    design_brief:
      "Use typed dimensions as the scale anchor. Keep the room elevated and calm, not generic coastal. Prioritize a strong desk, layered lighting, and believable styling.",
    dimensions: {
      length_ft: 14,
      width_ft: 11,
      ceiling_height_ft: 9,
      window_wall_width_ft: 11
    }
  },
  photos: [
    {
      url: "https://example.com/room-photo-1.jpg",
      label: "Main angle",
      angle_type: "wide"
    }
  ],
  source_photo_url: "https://example.com/room-photo-1.jpg",
  notes: "Replace these placeholder URLs with the owner's real room-photo URLs before running the spike."
};

type SpikeResponse = {
  artifact_path: string;
  diagnosis: Record<string, unknown>;
  concepts: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  render_plan: Record<string, unknown>;
  image_edit: {
    generated: boolean;
    source_photo_url: string;
  };
  tavily?: {
    available?: boolean;
    searches?: unknown[];
    extracts?: unknown[];
    note?: string;
  };
  providers?: Record<string, unknown>;
};

export function SpikeWorkbench() {
  const [payload, setPayload] = useState(JSON.stringify(defaultPayload, null, 2));
  const [result, setResult] = useState<SpikeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const parsed = JSON.parse(payload);
      const response = await fetch("/api/spike/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(parsed)
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const issues = Array.isArray(body.issues)
          ? body.issues.map((issue: { path?: string; message?: string }) => `${issue.path || "payload"}: ${issue.message || "Invalid value"}`).join("\n")
          : null;
        throw new Error(issues ? `${body.error}\n${issues}` : body.error || "Spike run failed.");
      }

      setResult(body as SpikeResponse);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Spike run failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <p className="atelier-label">Phase 0 workbench</p>
        <h1 className="font-serif text-4xl text-atelier-ink">Intelligence spike</h1>
        <p className="max-w-3xl text-sm leading-6 text-atelier-charcoal">
          Paste a room payload with real photo URLs and typed dimensions, then run diagnosis, concepts, product sourcing,
          Tavily enrichment, render-plan composition, and OpenAI image-edit validation in one pass.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="atelier-card grid gap-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl text-atelier-ink">Spike payload</h2>
            <button
              type="button"
              onClick={run}
              disabled={loading}
              className="rounded-md bg-atelier-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-atelier-charcoal disabled:opacity-60"
            >
              {loading ? "Running spike..." : "Run spike"}
            </button>
          </div>
          <textarea
            value={payload}
            onChange={(event) => setPayload(event.target.value)}
            className="atelier-field min-h-[34rem] font-mono text-xs leading-6"
            spellCheck={false}
          />
        </article>

        <article className="atelier-card grid gap-4 p-5">
          <h2 className="font-serif text-2xl text-atelier-ink">Result summary</h2>
          {error ? (
            <pre className="overflow-auto rounded-md bg-rose-50 p-4 text-xs text-rose-900">{error}</pre>
          ) : !result ? (
            <div className="rounded-md border border-dashed border-atelier-taupe/40 bg-white/50 p-8 text-sm text-atelier-charcoal">
              The spike output will appear here after a successful run.
            </div>
          ) : (
            <div className="grid gap-4 text-sm text-atelier-charcoal">
              <p>
                Artifact file: <span className="font-semibold text-atelier-ink">{result.artifact_path}</span>
              </p>
              <p>
                Providers: <span className="font-semibold text-atelier-ink">{JSON.stringify(result.providers)}</span>
              </p>
              <p>
                Concepts: <span className="font-semibold text-atelier-ink">{result.concepts.length}</span>
              </p>
              <p>
                Products: <span className="font-semibold text-atelier-ink">{result.products.length}</span>
              </p>
              <p>
                Tavily:{" "}
                <span className="font-semibold text-atelier-ink">
                  {result.tavily?.available ? `${result.tavily.searches?.length ?? 0} searches` : result.tavily?.note ?? "Skipped"}
                </span>
              </p>
              <p>
                Image edit: <span className="font-semibold text-atelier-ink">{result.image_edit.generated ? "Generated" : "Mocked / unavailable"}</span>
              </p>

              <SummaryBlock title="Diagnosis summary" value={String(result.diagnosis.room_summary ?? "No room summary returned.")} />
              <SummaryBlock title="First concept" value={String(result.concepts[0]?.concept_name ?? "No concept returned.")} />
              <SummaryBlock title="First product" value={String(result.products[0]?.name ?? "No product returned.")} />
              <SummaryBlock title="Render prompt preview" value={String(result.render_plan.render_prompt ?? "No render prompt returned.")} />
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

function SummaryBlock(props: { title: string; value: string }) {
  return (
    <div className="rounded-md bg-atelier-linen p-4">
      <p className="atelier-label">{props.title}</p>
      <p className="mt-2 text-sm leading-6 text-atelier-charcoal">{props.value}</p>
    </div>
  );
}
