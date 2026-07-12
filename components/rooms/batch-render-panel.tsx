"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * P0.3 "Render all perspectives" panel (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md
 * §P0.3). The dominant post-approval action: deliver the approved direction
 * across every eligible room photo as one durable, partially-recoverable batch.
 *
 * Source of truth is GET /render-batch (per-photo state comes from the durable
 * child jobs, not this component's memory), so the grid is correct after a
 * refresh, a reopen, or a closed tab. While a batch is in flight it polls; a
 * failed perspective is retryable on its own without disturbing its siblings.
 */

interface PhotoEligibility {
  photo_id: string;
  label: string | null;
  file_url: string;
  eligible: boolean;
  reason: string | null;
}

interface BatchPhoto {
  photo_id: string;
  label: string | null;
  file_url: string;
  child_job_id: string | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
  render: { id: string; file_url: string | null } | null;
}

interface ConsistencyAxis {
  axis: string;
  passed: boolean;
  shared_ratio: number;
  detail: string;
}

interface BatchView {
  job: { id: string; status: string; stage: string | null; progress_current: number; progress_total: number };
  photos: BatchPhoto[];
  completed: number;
  failed: number;
  total: number;
  consistency: { passed: boolean; evaluated_count: number; axes: ConsistencyAxis[]; flags: string[] } | null;
}

interface BatchResponse {
  eligibility: { photos: PhotoEligibility[]; eligible_count: number };
  estimate: { photo_count: number; concurrency: number; est_seconds_min: number; est_seconds_max: number };
  concurrency: number;
  batch: BatchView | null;
}

const EXCLUSION_REASON_COPY: Record<string, string> = {
  ceiling: "Ceiling view — not a room perspective",
  floor: "Floor view — not a room perspective",
  detail: "Close-up detail — not a room perspective",
  inspiration: "Inspiration reference — not this room",
  existing_item: "Existing-item photo — kept, not restyled",
  swatch: "Material swatch — not a room perspective"
};

const PHOTO_STATUS_COPY: Record<string, string> = {
  pending: "Queued",
  queued: "Queued",
  running: "Visualizing",
  completed: "Done",
  retryable_failed: "Didn't finish",
  terminal_failed: "Couldn't complete",
  cancelled: "Cancelled"
};

const ACTIVE_BATCH_STATUSES = new Set(["queued", "planning", "validating", "generating", "persisting"]);

function batchIsActive(view: BatchView | null): boolean {
  if (!view) return false;
  if (ACTIVE_BATCH_STATUSES.has(view.job.status)) return true;
  return view.photos.some((p) => p.status === "running" || p.status === "queued" || p.status === "pending");
}

function estimateCopy(min: number, max: number): string {
  const fmt = (s: number) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s}s`);
  if (min === max) return fmt(min);
  return `${fmt(min)}–${fmt(max)}`;
}

export function BatchRenderPanel(props: { roomId: string; hasLockedConcept: boolean; onSettled: () => void }) {
  const [data, setData] = useState<BatchResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wasActiveRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${props.roomId}/render-batch`, { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as BatchResponse;
      setData(body);
      // When a batch that WAS active settles, refresh the parent so the render
      // gallery below picks up the new current renders.
      const active = batchIsActive(body.batch);
      if (wasActiveRef.current && !active) props.onSettled();
      wasActiveRef.current = active;
    } catch {
      /* transient; the next poll retries */
    }
  }, [props]);

  useEffect(() => {
    if (!props.hasLockedConcept) return;
    load();
  }, [props.hasLockedConcept, load]);

  // Poll while a batch is in flight.
  useEffect(() => {
    if (!data || !batchIsActive(data.batch)) return;
    const timer = window.setInterval(load, 1500);
    return () => window.clearInterval(timer);
  }, [data, load]);

  const start = useCallback(async () => {
    setBusy("start");
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${props.roomId}/render-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error ?? "The batch couldn't start.");
        return;
      }
      wasActiveRef.current = true;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The batch couldn't start.");
    } finally {
      setBusy(null);
    }
  }, [props.roomId, load]);

  const retryFailed = useCallback(async () => {
    setBusy("retry");
    setError(null);
    try {
      await fetch(`/api/rooms/${props.roomId}/render-batch/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      wasActiveRef.current = true;
      await load();
    } finally {
      setBusy(null);
    }
  }, [props.roomId, load]);

  const retryPhoto = useCallback(
    async (photoId: string) => {
      setBusy(`retry-${photoId}`);
      setError(null);
      try {
        await fetch(`/api/rooms/${props.roomId}/render-batch/retry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo_ids: [photoId] })
        });
        wasActiveRef.current = true;
        await load();
      } finally {
        setBusy(null);
      }
    },
    [props.roomId, load]
  );

  const cancel = useCallback(async () => {
    setBusy("cancel");
    setError(null);
    try {
      await fetch(`/api/rooms/${props.roomId}/render-batch/cancel`, { method: "POST" });
      await load();
    } finally {
      setBusy(null);
    }
  }, [props.roomId, load]);

  if (!props.hasLockedConcept || !data) return null;

  const { eligibility, estimate, batch } = data;
  const excluded = eligibility.photos.filter((p) => !p.eligible);
  const active = batchIsActive(batch);

  return (
    <section data-testid="batch-render-panel" className="atelier-card grid gap-6 border border-atelier-brass/40 bg-atelier-paper p-7">
      <div className="grid gap-2">
        <p className="atelier-eyebrow text-atelier-brass">Every perspective</p>
        <h3 className="font-serif text-2xl text-atelier-umber">
          Render <em className="italic">the whole room</em>
        </h3>
        <p className="text-sm font-light leading-7 text-atelier-fawn">
          Apply the approved direction to all {eligibility.eligible_count} room perspectives in one pass. Each photo is
          saved on its own, so a perspective that needs another try never disturbs the others.
        </p>
      </div>

      {/* --- No batch yet: the confirm + estimate step ------------------------ */}
      {!batch && (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-y border-hairline py-4">
            <Stat label="Perspectives" value={String(eligibility.eligible_count)} testId="batch-estimate-count" />
            <Stat label="Estimated time" value={estimateCopy(estimate.est_seconds_min, estimate.est_seconds_max)} testId="batch-estimate-time" />
            <Stat label="At a time" value={String(estimate.concurrency)} />
          </div>

          {excluded.length > 0 && (
            <details className="text-sm text-atelier-umber" data-testid="batch-excluded">
              <summary className="atelier-label cursor-pointer">{excluded.length} photo(s) left out by default</summary>
              <ul className="mt-3 grid gap-1.5">
                {excluded.map((p) => (
                  <li key={p.photo_id} className="text-xs font-light leading-6 text-atelier-fawn">
                    <span className="text-atelier-umber">{p.label ?? "Photo"}</span> — {p.reason ? EXCLUSION_REASON_COPY[p.reason] ?? p.reason : "not a room perspective"}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <button
            type="button"
            data-testid="batch-render-button"
            onClick={start}
            disabled={busy === "start" || eligibility.eligible_count === 0}
            className="atelier-btn justify-self-start"
          >
            {busy === "start" ? "Starting the set" : "Render all perspectives"}
          </button>
        </div>
      )}

      {/* --- Batch exists: progress grid + per-photo state -------------------- */}
      {batch && (
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-hairline py-4">
            <p className="atelier-eyebrow" data-testid="batch-progress" data-completed={batch.completed} data-total={batch.total}>
              {batch.completed} of {batch.total} complete
              {batch.failed > 0 ? ` · ${batch.failed} to retry` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {batch.failed > 0 && !active && (
                <button
                  type="button"
                  data-testid="batch-retry-failed"
                  onClick={retryFailed}
                  disabled={busy === "retry"}
                  className="atelier-btn-quiet"
                >
                  {busy === "retry" ? "Retrying" : `Retry failed (${batch.failed})`}
                </button>
              )}
              {active && (
                <button
                  type="button"
                  data-testid="batch-cancel"
                  onClick={cancel}
                  disabled={busy === "cancel"}
                  className="atelier-btn-quiet"
                >
                  {busy === "cancel" ? "Cancelling" : "Cancel remaining"}
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {batch.photos.map((photo) => (
              <BatchPhotoCard
                key={photo.photo_id}
                photo={photo}
                busyRetry={busy === `retry-${photo.photo_id}`}
                onRetry={() => retryPhoto(photo.photo_id)}
              />
            ))}
          </div>

          {batch.consistency && batch.completed >= 2 && (
            <ConsistencyNotice consistency={batch.consistency} />
          )}
        </div>
      )}

      {error && (
        <p data-testid="batch-error" className="text-sm font-light leading-7 text-atelier-brass" role="status">
          {error}
        </p>
      )}
    </section>
  );
}

function Stat(props: { label: string; value: string; testId?: string }) {
  return (
    <div className="grid gap-1">
      <span className="atelier-label">{props.label}</span>
      <span data-testid={props.testId} className="font-serif text-xl text-atelier-umber">
        {props.value}
      </span>
    </div>
  );
}

function BatchPhotoCard(props: { photo: BatchPhoto; busyRetry: boolean; onRetry: () => void }) {
  const { photo } = props;
  const done = photo.status === "completed";
  const failed = photo.status === "retryable_failed" || photo.status === "terminal_failed";
  const canRetry = photo.status === "retryable_failed";
  const showAfter = done && photo.render?.file_url;

  return (
    <article
      data-testid={`batch-photo-${photo.photo_id}`}
      data-status={photo.status}
      className="atelier-card grid gap-3 overflow-hidden border border-hairline"
    >
      <div className="relative">
        {showAfter ? (
          <img src={photo.render!.file_url!} alt={`Visualized ${photo.label ?? "room"}`} className="aspect-[16/10] w-full object-cover" />
        ) : photo.file_url ? (
          <img src={photo.file_url} alt={`Source ${photo.label ?? "room"}`} className="aspect-[16/10] w-full object-cover opacity-70" />
        ) : (
          <div className="aspect-[16/10] w-full bg-atelier-ivory" />
        )}
        <span
          className={`absolute left-3 top-3 border px-2.5 py-1 text-[10px] font-medium uppercase tracking-eyebrow ${
            done
              ? "border-atelier-brass/50 bg-atelier-paper/90 text-atelier-brass"
              : failed
                ? "border-atelier-brass/40 bg-atelier-paper/90 text-atelier-umber"
                : "border-hairline bg-atelier-paper/90 text-atelier-fawn"
          }`}
        >
          {showAfter ? "After" : PHOTO_STATUS_COPY[photo.status] ?? photo.status}
        </span>
      </div>
      <div className="grid gap-2 px-4 pb-4">
        <p className="text-sm font-light leading-6 text-atelier-umber">{photo.label ?? "Room perspective"}</p>
        {failed && (
          <p className="text-xs font-light leading-6 text-atelier-fawn">
            {photo.error_message ?? "This perspective didn't finish. Your direction is saved."}
          </p>
        )}
        {canRetry && (
          <button
            type="button"
            data-testid={`batch-photo-retry-${photo.photo_id}`}
            onClick={props.onRetry}
            disabled={props.busyRetry}
            className="atelier-btn-quiet justify-self-start text-xs"
          >
            {props.busyRetry ? "Retrying" : "Retry this perspective"}
          </button>
        )}
      </div>
    </article>
  );
}

function ConsistencyNotice(props: { consistency: NonNullable<BatchView["consistency"]> }) {
  const { consistency } = props;
  return (
    <div
      data-testid="batch-consistency"
      data-passed={consistency.passed}
      className="grid gap-2 border-t border-hairline pt-4"
    >
      <p className="atelier-eyebrow">
        {consistency.passed ? "The set holds together" : "Worth a second look"}
      </p>
      {consistency.passed ? (
        <p className="text-xs font-light leading-6 text-atelier-fawn">
          Palette, anchor furniture, art direction, and material story read consistently across the perspectives.
        </p>
      ) : (
        <ul className="grid gap-1">
          {consistency.flags.map((flag, i) => (
            <li key={i} className="text-xs font-light leading-6 text-atelier-fawn">
              {flag}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
