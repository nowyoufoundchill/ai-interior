import { after } from "next/server";
import { runJobNow } from "./runners";
import { logStructured } from "@/lib/observability";

/**
 * P0.1 execution mechanism (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.1 task 3).
 *
 * Deployment target: Next.js on Vercel serverless. The mechanism that continues
 * after the client disconnects and does NOT rely on in-process memory is
 * `after()` from `next/server` — on Vercel it is backed by `waitUntil`, so the
 * function keeps running until the scheduled work resolves even though the HTTP
 * response has already been returned and the browser tab may be closed. All
 * durable state lives in the `generation_jobs` row, so if the platform still
 * kills the invocation mid-flight, the stale-heartbeat reclaim path (read on the
 * next status poll or retry) picks the job back up, bounded by `max_attempts`.
 *
 * In local `next dev` and in tests `after()` runs the callback after the
 * response flushes, giving the same "response returns immediately, work
 * continues" behaviour without a separate worker process.
 */
export function scheduleJob(jobId: string): void {
  after(async () => {
    try {
      await runJobNow(jobId);
    } catch (error) {
      // runJobNow already records failures on the job; this only guards the
      // scheduling boundary itself.
      logStructured("job_schedule_error", {
        job_id: jobId,
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

/**
 * Synchronous compatibility path: run a job to completion inline and await it.
 * Used by the legacy synchronous routes during the P0.1 rollout so existing
 * consumers keep receiving their artifact in the response while the durable job
 * row is still created, staged, and completed exactly as the async path does.
 */
export async function runJobInline(jobId: string): Promise<void> {
  await runJobNow(jobId);
}
