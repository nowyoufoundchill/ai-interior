import type { Photo } from "@/types/database";

/**
 * P0.3 photo eligibility (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.3 task 2).
 *
 * "Render all perspectives" spends real money per photo, so the batch must not
 * silently render photos that aren't room perspectives. Room perspectives are
 * included by default; ceiling, floor, existing-item detail, inspiration, and
 * swatch photos are excluded by default unless the owner explicitly selects
 * them. The owner reviews the selection before spending.
 *
 * The signal is a photo's `angle_type`/`label` (both owner-authored at upload;
 * `angle_type` mirrors the label). We default to INCLUDE and only exclude on an
 * explicit non-perspective marker, so an unlabelled photo is treated as a
 * perspective (the safe default for a room the owner photographed to redesign).
 */

export type ExclusionReason = "ceiling" | "floor" | "detail" | "inspiration" | "existing_item" | "swatch";

export interface PhotoEligibility {
  photo_id: string;
  label: string | null;
  angle_type: string | null;
  file_url: string;
  eligible: boolean;
  reason: ExclusionReason | null;
}

/** Owner-facing explanation for why a photo is excluded by default. */
export const EXCLUSION_COPY: Record<ExclusionReason, string> = {
  ceiling: "Ceiling view — not a room perspective",
  floor: "Floor view — not a room perspective",
  detail: "Close-up detail — not a room perspective",
  inspiration: "Inspiration reference — not this room",
  existing_item: "Existing-item photo — kept, not restyled",
  swatch: "Material swatch — not a room perspective"
};

// Order matters only for which reason is reported first; a photo is excluded on
// the first matching marker. Patterns are word-boundaried to avoid matching a
// perspective label that merely mentions the floor ("floor-to-ceiling window").
const EXCLUSION_PATTERNS: { reason: ExclusionReason; pattern: RegExp }[] = [
  { reason: "inspiration", pattern: /\b(inspiration|inspo|reference|moodboard|pinterest)\b/i },
  { reason: "existing_item", pattern: /\b(existing[- ]item|keep[- ]this|current furniture)\b/i },
  { reason: "swatch", pattern: /\b(swatch|paint chip|material sample|fabric sample)\b/i },
  { reason: "detail", pattern: /\b(close[- ]?up|macro|detail shot)\b/i },
  { reason: "ceiling", pattern: /\bceiling(?![- ]to[- ])\b/i },
  { reason: "floor", pattern: /\b(floor(ing)? (view|shot|photo|only)|just the floor)\b/i }
];

export function classifyPhoto(photo: Pick<Photo, "id" | "label" | "angle_type" | "file_url">): PhotoEligibility {
  const haystack = `${photo.angle_type ?? ""} ${photo.label ?? ""}`.trim();
  const match = haystack ? EXCLUSION_PATTERNS.find(({ pattern }) => pattern.test(haystack)) : undefined;
  return {
    photo_id: photo.id,
    label: photo.label,
    angle_type: photo.angle_type,
    file_url: photo.file_url,
    eligible: !match,
    reason: match?.reason ?? null
  };
}

export function classifyPhotos(photos: Pick<Photo, "id" | "label" | "angle_type" | "file_url">[]): PhotoEligibility[] {
  return photos.map(classifyPhoto);
}

/** Photo ids included by default (all room perspectives). */
export function defaultSelection(photos: Pick<Photo, "id" | "label" | "angle_type" | "file_url">[]): string[] {
  return classifyPhotos(photos)
    .filter((p) => p.eligible)
    .map((p) => p.photo_id);
}

export interface BatchEstimate {
  photo_count: number;
  concurrency: number;
  /** Wall-clock range once bounded concurrency is applied. */
  est_seconds_min: number;
  est_seconds_max: number;
}

/**
 * Rough owner-facing time expectation. Per-perspective render is ~25–70s in live
 * mode; bounded concurrency shortens the wall clock to ceil(count / concurrency)
 * waves. Deliberately a range, not a promise.
 */
export function estimateBatch(photoCount: number, concurrency: number): BatchEstimate {
  const waves = photoCount > 0 ? Math.ceil(photoCount / Math.max(1, concurrency)) : 0;
  return {
    photo_count: photoCount,
    concurrency,
    est_seconds_min: waves * 25,
    est_seconds_max: waves * 70
  };
}
