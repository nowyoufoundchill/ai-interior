/**
 * P0.1 reusable client job observer (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md
 * §P0.1 task 6).
 *
 * The app is server-only (browser Supabase access is revoked, migrations
 * 002/004), so realtime subscriptions aren't available to the client. This is
 * the bounded-polling fallback: it polls the room-scoped job status endpoint
 * until the job reaches a terminal state, invoking `onUpdate` on every tick so
 * a caller can reflect stage/progress. Reading status also drives server-side
 * stale reclaim, so this poller is itself part of the recovery path.
 */

export type JobStatus =
  | "queued"
  | "planning"
  | "validating"
  | "generating"
  | "persisting"
  | "completed"
  | "retryable_failed"
  | "terminal_failed"
  | "cancelled";

export interface ObservedJob {
  id: string;
  job_type: string;
  status: JobStatus;
  stage: string | null;
  progress_current: number;
  progress_total: number;
  attempt_count?: number;
  max_attempts?: number;
  error_code: string | null;
  error_message: string | null;
  result_refs: Record<string, unknown>;
}

const TERMINAL: JobStatus[] = ["completed", "terminal_failed", "cancelled"];

export interface ObserveOptions {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onUpdate?: (job: ObservedJob) => void;
}

export async function fetchJobStatus(roomId: string, jobId: string, signal?: AbortSignal): Promise<ObservedJob | null> {
  const response = await fetch(`/api/rooms/${roomId}/jobs/${jobId}`, { signal, cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  return (payload?.job as ObservedJob) ?? null;
}

/**
 * Poll a job until it settles (or times out / is aborted). Resolves with the
 * final observed job, or null if it could not be read. `retryable_failed` is
 * treated as settled for the observer — the caller decides whether to retry.
 */
export async function observeJob(roomId: string, jobId: string, options: ObserveOptions = {}): Promise<ObservedJob | null> {
  const intervalMs = options.intervalMs ?? 1500;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const deadline = Date.now() + timeoutMs;

  let last: ObservedJob | null = null;
  while (Date.now() < deadline) {
    if (options.signal?.aborted) return last;
    const job = await fetchJobStatus(roomId, jobId, options.signal);
    if (job) {
      last = job;
      options.onUpdate?.(job);
      if (TERMINAL.includes(job.status) || job.status === "retryable_failed") return job;
    }
    await delay(intervalMs, options.signal);
  }
  return last;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}
