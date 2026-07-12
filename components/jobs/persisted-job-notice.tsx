"use client";

import { useEffect, useState } from "react";
import type { Database } from "@/types/database";

type GenerationJob = Database["public"]["Tables"]["generation_jobs"]["Row"];
const ACTIVE = new Set(["queued", "planning", "validating", "generating", "persisting"]);

const COPY: Record<string, { noun: string; tab: string }> = {
  diagnosis: { noun: "room reading", tab: "Photos & Brief" },
  moodboards: { noun: "design directions", tab: "Concepts" },
  render: { noun: "visualization", tab: "Renders" },
  batch_render: { noun: "room perspectives", tab: "Renders" },
  chat_action: { noun: "requested change", tab: "Chat" },
  products: { noun: "product plan", tab: "Products" }
};

export function PersistedJobNotice(props: {
  roomId: string;
  job: GenerationJob | null;
  onOpen: (tab: string) => void;
  onRefresh: () => void;
}) {
  const [job, setJob] = useState<GenerationJob | null>(props.job);
  const [busy, setBusy] = useState(false);
  useEffect(() => setJob(props.job), [props.job]);

  useEffect(() => {
    if (!job || !ACTIVE.has(job.status)) return;
    let cancelled = false;
    const poll = async () => {
      const response = await fetch(`/api/rooms/${props.roomId}/jobs/${job.id}`, { cache: "no-store" }).catch(() => null);
      const payload = response?.ok ? await response.json().catch(() => null) : null;
      if (!cancelled && payload?.job) {
        setJob(payload.job as GenerationJob);
        if (!ACTIVE.has(payload.job.status)) props.onRefresh();
      }
    };
    poll();
    const timer = window.setInterval(poll, 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [job?.id, job?.status, props]);

  if (!job) return null;
  const copy = COPY[job.job_type] ?? { noun: "step", tab: "Photos & Brief" };
  const active = ACTIVE.has(job.status);
  const failed = job.status === "retryable_failed" || job.status === "terminal_failed";
  const retryable = job.status === "retryable_failed";

  async function retry() {
    setBusy(true);
    const response = await fetch(`/api/rooms/${props.roomId}/jobs/${job!.id}/retry`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    if (payload?.job) setJob(payload.job as GenerationJob);
    setBusy(false);
    props.onRefresh();
  }

  return (
    <section data-testid="persisted-job-notice" data-job-status={job.status} className="atelier-notice grid gap-3" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="atelier-eyebrow text-atelier-brass">{active ? "In progress" : failed ? "Needs your attention" : "Saved progress"}</p>
        <span className="atelier-label">{copy.tab}</span>
      </div>
      <p className="text-sm font-light leading-7 text-atelier-umber">
        {active ? `Your ${copy.noun} is still being prepared — ${job.stage ?? "working"}.` : job.error_message ?? `Your ${copy.noun} could not be completed.`}
      </p>
      <p className="text-xs font-light leading-6 text-atelier-fawn">
        {active ? "This work is saved and will continue if you leave and come back." : retryable ? "Your room work is saved. You can try this step again." : "Your saved room work is safe. Review the room before choosing another step."}
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="atelier-btn-quiet" onClick={() => props.onOpen(copy.tab)}>Open {copy.tab}</button>
        {retryable && <button type="button" className="atelier-btn" disabled={busy} onClick={retry}>{busy ? "Retrying" : "Try again"}</button>}
      </div>
    </section>
  );
}
