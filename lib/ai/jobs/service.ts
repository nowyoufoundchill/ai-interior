import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logStructured } from "@/lib/observability";
import type { GenerationJob, Json } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * P0.1 durable generation-job service (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §4).
 *
 * Server-only. The durable state of a long-running AI operation lives in the
 * `generation_jobs` row, never in an open request or in-process memory, so
 * status survives refresh, navigation, and client disconnect. This module owns
 * the state machine; runners (./runners) own the actual AI work.
 */

type Supabase = SupabaseClient<Database>;

export type JobType = "diagnosis" | "moodboards" | "render" | "batch_render" | "chat_action" | "products";

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

/** Statuses that hold the active-idempotency slot for a logical action. */
export const ACTIVE_STATUSES: JobStatus[] = ["queued", "planning", "validating", "generating", "persisting"];
/** Statuses a running job passes through (used for stale detection). */
export const RUNNING_STATUSES: JobStatus[] = ["planning", "validating", "generating", "persisting"];
export const TERMINAL_STATUSES: JobStatus[] = ["completed", "terminal_failed", "cancelled"];

/**
 * A running job whose heartbeat is older than this is presumed crashed
 * (serverless kill, deploy, disconnect) and is reclaimable. Bounded by
 * `max_attempts` so a genuinely broken job can never loop indefinitely.
 */
export const STALE_HEARTBEAT_MS = 90_000;

/** Missing-table signal so durable routes fail closed with a clear message. */
export class JobsTableMissingError extends Error {
  constructor() {
    super("generation_jobs table is not present. Apply migration 008_generation_jobs.sql.");
    this.name = "JobsTableMissingError";
  }
}

function isMissingTable(message: string | undefined): boolean {
  return Boolean(message && /generation_jobs/.test(message) && /(does not exist|schema cache|relation)/i.test(message));
}

export function deriveIdempotencyKey(jobType: JobType, roomId: string, payload?: Record<string, unknown>): string {
  const parts: string[] = [jobType, roomId];
  if (jobType === "render" && payload) {
    if (payload.source_photo_id) parts.push(`photo:${String(payload.source_photo_id)}`);
    if (payload.mood_board_id) parts.push(`board:${String(payload.mood_board_id)}`);
    if (payload.instructions) parts.push(`instr:${hashString(String(payload.instructions))}`);
  }
  return parts.join("|");
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export interface CreateJobInput {
  roomId: string;
  jobType: JobType;
  requestPayload?: Record<string, unknown>;
  requestedBy?: string;
  correlationId?: string | null;
  testRunId?: string | null;
  maxAttempts?: number;
  progressTotal?: number;
  /** Override the derived idempotency key (e.g. batch children keyed per batch). */
  idempotencyKey?: string;
  /** Parent batch job id for a per-photo child render. */
  parentJobId?: string | null;
}

export interface CreateJobResult {
  job: GenerationJob;
  created: boolean;
}

/**
 * Idempotency contract (§4): two rapid submissions of the same owner action
 * resolve to ONE logical job. We insert; the partial unique index on
 * `idempotency_key` (active statuses only) makes a concurrent duplicate fail
 * with 23505, at which point we return the already-active job.
 */
export async function createOrGetActiveJob(input: CreateJobInput, client?: Supabase): Promise<CreateJobResult> {
  const supabase = client ?? createServerSupabaseClient();
  const idempotencyKey = input.idempotencyKey ?? deriveIdempotencyKey(input.jobType, input.roomId, input.requestPayload);

  const insertRow: Database["public"]["Tables"]["generation_jobs"]["Insert"] = {
    room_id: input.roomId,
    job_type: input.jobType,
    status: "queued",
    stage: "queued",
    requested_by: input.requestedBy ?? null,
    request_payload: (input.requestPayload ?? {}) as Json,
    idempotency_key: idempotencyKey,
    parent_job_id: input.parentJobId ?? null,
    max_attempts: input.maxAttempts ?? 3,
    progress_total: input.progressTotal ?? 1,
    correlation_id: input.correlationId ?? null,
    test_run_id: input.testRunId ?? null
  };

  const { data, error } = await supabase.from("generation_jobs").insert(insertRow).select("*").single();

  if (!error && data) {
    logJob("job_created", data as GenerationJob);
    return { job: data as GenerationJob, created: true };
  }

  if (error && isMissingTable(error.message)) throw new JobsTableMissingError();

  // 23505 = unique_violation: an active job with this key already exists.
  if (error && (error.code === "23505" || /duplicate key|unique/i.test(error.message))) {
    const existing = await findActiveJob(input.roomId, input.jobType, idempotencyKey, supabase);
    if (existing) {
      logJob("job_deduped", existing);
      return { job: existing, created: false };
    }
  }

  throw new Error(error?.message ?? "Failed to create generation job.");
}

async function findActiveJob(
  roomId: string,
  jobType: JobType,
  idempotencyKey: string,
  supabase: Supabase
): Promise<GenerationJob | null> {
  const { data } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("room_id", roomId)
    .eq("job_type", jobType)
    .eq("idempotency_key", idempotencyKey)
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as GenerationJob | null) ?? null;
}

export async function getJob(jobId: string, roomId?: string, client?: Supabase): Promise<GenerationJob | null> {
  const supabase = client ?? createServerSupabaseClient();
  let query = supabase.from("generation_jobs").select("*").eq("id", jobId);
  // Room scoping (§4 security): a job can only be read in the context of its room.
  if (roomId) query = query.eq("room_id", roomId);
  const { data, error } = await query.maybeSingle();
  if (error && isMissingTable(error.message)) throw new JobsTableMissingError();
  return (data as GenerationJob | null) ?? null;
}

/**
 * Atomically claim a queued (or reclaimed-to-queued) job for execution.
 * The `.eq("status", "queued")` guard means only one caller wins the row;
 * a loser gets `null` and must not execute. Increments `attempt_count`.
 */
export async function claimJob(jobId: string, client?: Supabase): Promise<GenerationJob | null> {
  const supabase = client ?? createServerSupabaseClient();
  const current = await getJob(jobId, undefined, supabase);
  if (!current) return null;
  if (current.status !== "queued") return null;

  const { data, error } = await supabase
    .from("generation_jobs")
    .update({
      status: "planning",
      stage: "planning",
      started_at: current.started_at ?? new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      attempt_count: current.attempt_count + 1
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .single();

  if (error) {
    // Lost the race (another executor claimed it) or table gone.
    if (isMissingTable(error.message)) throw new JobsTableMissingError();
    return null;
  }
  logJob("job_claimed", data as GenerationJob);
  return data as GenerationJob;
}

export async function advanceStage(
  jobId: string,
  status: JobStatus,
  stage: string,
  progress?: { current?: number; total?: number },
  client?: Supabase
): Promise<void> {
  const supabase = client ?? createServerSupabaseClient();
  const patch: Database["public"]["Tables"]["generation_jobs"]["Update"] = {
    status,
    stage,
    heartbeat_at: new Date().toISOString()
  };
  if (progress?.current !== undefined) patch.progress_current = progress.current;
  if (progress?.total !== undefined) patch.progress_total = progress.total;
  await supabase.from("generation_jobs").update(patch).eq("id", jobId);
}

export async function heartbeat(jobId: string, client?: Supabase): Promise<void> {
  const supabase = client ?? createServerSupabaseClient();
  await supabase.from("generation_jobs").update({ heartbeat_at: new Date().toISOString() }).eq("id", jobId);
}

/**
 * Complete a job. Persisted-artifact reference is REQUIRED (§4): a job cannot
 * report "completed" without a valid artifact ref, so the UI can never show
 * complete without real output.
 */
export async function completeJob(jobId: string, resultRefs: Record<string, unknown>, client?: Supabase): Promise<GenerationJob> {
  const supabase = client ?? createServerSupabaseClient();
  const hasRef = Object.values(resultRefs).some((value) => value !== null && value !== undefined && value !== "");
  if (!hasRef) {
    throw new Error("completeJob requires at least one persisted artifact reference.");
  }
  const { data, error } = await supabase
    .from("generation_jobs")
    .update({
      status: "completed",
      stage: "completed",
      result_refs: resultRefs as Json,
      progress_current: 1,
      progress_total: 1,
      completed_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
      error_detail: null
    })
    .eq("id", jobId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  logJob("job_completed", data as GenerationJob);
  return data as GenerationJob;
}

export interface FailJobInput {
  errorCode: string;
  ownerMessage: string;
  detail?: string;
  retryable?: boolean;
}

/**
 * Fail a job. A retryable failure with attempts remaining becomes
 * `retryable_failed`; once attempts are exhausted (or the caller marks it
 * non-retryable) it becomes `terminal_failed`. A failed job NEVER masquerades
 * as complete and never carries a result ref.
 */
export async function failJob(jobId: string, input: FailJobInput, client?: Supabase): Promise<GenerationJob> {
  const supabase = client ?? createServerSupabaseClient();
  const current = await getJob(jobId, undefined, supabase);
  const attempts = current?.attempt_count ?? 1;
  const maxAttempts = current?.max_attempts ?? 3;
  const canRetry = (input.retryable ?? true) && attempts < maxAttempts;
  const status: JobStatus = canRetry ? "retryable_failed" : "terminal_failed";

  const { data, error } = await supabase
    .from("generation_jobs")
    .update({
      status,
      error_code: input.errorCode,
      error_message: input.ownerMessage,
      error_detail: input.detail ?? null,
      heartbeat_at: new Date().toISOString()
    })
    .eq("id", jobId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  logJob("job_failed", data as GenerationJob, { retryable: canRetry });
  return data as GenerationJob;
}

/**
 * Requeue a retryable_failed job (or a stale-reclaimed one) for another
 * execution, if attempts remain. Resets status to `queued` so `claimJob`
 * can pick it up exactly once. Returns the job if requeued, else null.
 */
export async function requeueJob(jobId: string, client?: Supabase): Promise<GenerationJob | null> {
  const supabase = client ?? createServerSupabaseClient();
  const current = await getJob(jobId, undefined, supabase);
  if (!current) return null;
  if (current.attempt_count >= current.max_attempts) {
    // No attempts left: settle as terminal rather than looping.
    if (current.status !== "terminal_failed") {
      await supabase
        .from("generation_jobs")
        .update({
          status: "terminal_failed",
          error_code: current.error_code ?? "attempts_exhausted",
          error_message: current.error_message ?? "This step could not be completed after several attempts.",
          heartbeat_at: new Date().toISOString()
        })
        .eq("id", jobId);
    }
    return null;
  }
  const { data, error } = await supabase
    .from("generation_jobs")
    .update({ status: "queued", stage: "queued", heartbeat_at: new Date().toISOString() })
    .eq("id", jobId)
    .in("status", ["retryable_failed", "queued"])
    .select("*")
    .single();
  if (error) return null;
  logJob("job_requeued", data as GenerationJob);
  return data as GenerationJob;
}

export async function cancelJob(jobId: string, roomId: string, client?: Supabase): Promise<GenerationJob | null> {
  const supabase = client ?? createServerSupabaseClient();
  const { data, error } = await supabase
    .from("generation_jobs")
    .update({
      status: "cancelled",
      stage: "cancelled",
      heartbeat_at: new Date().toISOString(),
      error_code: "cancelled",
      error_message: "Cancelled."
    })
    .eq("id", jobId)
    .eq("room_id", roomId)
    .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`)
    .select("*")
    .maybeSingle();
  if (error) return null;
  return (data as GenerationJob | null) ?? null;
}

export function isStale(job: GenerationJob, now = Date.now()): boolean {
  if (!RUNNING_STATUSES.includes(job.status as JobStatus)) return false;
  const beat = job.heartbeat_at ? new Date(job.heartbeat_at).getTime() : (job.started_at ? new Date(job.started_at).getTime() : 0);
  return now - beat > STALE_HEARTBEAT_MS;
}

/**
 * Reclaim a crashed (stale-heartbeat) running job. If attempts remain it is
 * reset to `queued` for one more execution; otherwise it is settled as
 * terminal so it can never loop. Returns the reclaimed queued job or null.
 */
export async function reclaimIfStale(job: GenerationJob, client?: Supabase): Promise<GenerationJob | null> {
  if (!isStale(job)) return null;
  const supabase = client ?? createServerSupabaseClient();

  if (job.attempt_count >= job.max_attempts) {
    const { data } = await supabase
      .from("generation_jobs")
      .update({
        status: "terminal_failed",
        error_code: "stale_timeout",
        error_message: "This step stopped responding and could not be recovered.",
        error_detail: `Reclaimed stale job after ${job.max_attempts} attempts.`,
        heartbeat_at: new Date().toISOString()
      })
      .eq("id", job.id)
      .in("status", RUNNING_STATUSES)
      .select("*")
      .maybeSingle();
    if (data) logJob("job_stale_terminal", data as GenerationJob);
    return null;
  }

  // Reclaim exactly once: the `.in(status, RUNNING_STATUSES)` guard means only
  // one reader wins the transition; a concurrent poll sees it already queued.
  const { data } = await supabase
    .from("generation_jobs")
    .update({ status: "queued", stage: "queued", heartbeat_at: new Date().toISOString() })
    .eq("id", job.id)
    .in("status", RUNNING_STATUSES)
    .select("*")
    .maybeSingle();
  if (data) logJob("job_reclaimed", data as GenerationJob);
  return (data as GenerationJob | null) ?? null;
}

export async function findLatestActiveJobForRoom(
  roomId: string,
  jobType: JobType,
  client?: Supabase
): Promise<GenerationJob | null> {
  const supabase = client ?? createServerSupabaseClient();
  const { data, error } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("room_id", roomId)
    .eq("job_type", jobType)
    .in("status", [...ACTIVE_STATUSES, "retryable_failed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && isMissingTable(error.message)) throw new JobsTableMissingError();
  return (data as GenerationJob | null) ?? null;
}

/**
 * Owner-safe projection of a job for the browser: strips the internal
 * `error_detail` (which may carry provider/stack text) while keeping the
 * owner-facing `error_message`, stage, progress, and status.
 */
export function toOwnerSafeJob(job: GenerationJob): Omit<GenerationJob, "error_detail"> {
  const { error_detail: _internal, ...rest } = job;
  return rest;
}

export async function listChildJobs(parentJobId: string, client?: Supabase): Promise<GenerationJob[]> {
  const supabase = client ?? createServerSupabaseClient();
  const { data } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("parent_job_id", parentJobId)
    .order("created_at", { ascending: true });
  return (data as GenerationJob[]) ?? [];
}

function logJob(event: string, job: GenerationJob, extra?: Record<string, unknown>): void {
  logStructured(event, {
    correlation_id: job.correlation_id,
    job_id: job.id,
    room_id: job.room_id,
    job_type: job.job_type,
    status: job.status,
    stage: job.stage,
    attempt: job.attempt_count,
    ...extra
  });
}
