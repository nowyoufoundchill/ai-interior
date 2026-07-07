import type { RoomAnalysis } from "@/lib/schemas";

/**
 * Room Intelligence
 *
 * Derives structural, non-taste facts about a specific room from its
 * diagnosis + typed dimensions, so the Concept Director prompt does not have
 * to re-infer circulation, glare, and backdrop logic from raw photo captions
 * on every call. This is deterministic derivation from already-verified data
 * (typed dimensions + the diagnosis service's photo reading), not a second
 * guess at the room.
 *
 * Confidence is surfaced explicitly: anything this module cannot derive with
 * reasonable certainty is marked as such rather than asserted.
 */

export type RoomDimensionsLike = {
  width_ft?: number | string | null;
  length_ft?: number | string | null;
  ceiling_height?: number | string | null;
  notes?: string | null;
} | null | undefined;

export type RoomIntelligence = {
  floor_area_sqft: number | null;
  opening_count: number;
  glare_risk: "low" | "medium" | "high" | "unknown";
  circulation_note: string;
  backdrop_candidates: string[];
  acoustic_flag: string | null;
  window_door_conflict_zones: string[];
  confidence_notes: string[];
};

export function deriveRoomIntelligence(input: {
  dimensions?: RoomDimensionsLike;
  purpose?: string | null;
  constraints?: string[];
  analysis?: Partial<RoomAnalysis> | null;
}): RoomIntelligence {
  const width = toNumber(input.dimensions?.width_ft);
  const length = toNumber(input.dimensions?.length_ft);
  const floor_area_sqft = width && length ? Math.round(width * length) : null;

  const doors = input.analysis?.architecture?.doors ?? [];
  const windows = input.analysis?.architecture?.windows ?? [];
  const opening_count = doors.length + windows.length;

  const naturalLight = input.analysis?.lighting?.natural_light;
  const glare_risk: RoomIntelligence["glare_risk"] =
    naturalLight === "high" ? "high" : naturalLight === "medium" ? "medium" : naturalLight === "low" ? "low" : "unknown";

  const circulation_note = buildCirculationNote({ floor_area_sqft, opening_count, doors: doors.length });

  const backdrop_candidates = buildBackdropCandidates({ doors: doors.length, windows: windows.length });

  const purposeText = (input.purpose ?? "").toLowerCase();
  const needsCallQuality =
    purposeText.includes("call") || purposeText.includes("zoom") || purposeText.includes("video") || purposeText.includes("meeting");
  const acoustic_flag = needsCallQuality
    ? "Room purpose includes calls/video; prioritize a clean backdrop wall, glare control facing the camera position, and soft materials (rug, upholstery, drapery) to reduce echo, since hard flooring plus bare walls will read poorly on camera and in person."
    : null;

  const window_door_conflict_zones = (input.constraints ?? []).filter(
    (constraint) => /window|door|block|circulation|egress/i.test(constraint)
  );

  const confidence_notes = [
    floor_area_sqft
      ? `Floor area is a simple width x length estimate (${floor_area_sqft} sq ft); it ignores alcoves, closets, or irregular footprints not described in the brief.`
      : "Floor area could not be computed; width_ft and length_ft were not both provided as numbers.",
    "Exact wall lengths, door swing direction, and precise window placement are not confirmed — this module reasons from counts and diagnosis text, not a floor plan.",
    opening_count >= 5
      ? "This room has an unusually high number of openings for its likely size; furniture layout should be treated as the primary design risk, not an afterthought."
      : "Opening count is within a normal range for this room type."
  ];

  return {
    floor_area_sqft,
    opening_count,
    glare_risk,
    circulation_note,
    backdrop_candidates,
    acoustic_flag,
    window_door_conflict_zones,
    confidence_notes
  };
}

function buildCirculationNote(input: { floor_area_sqft: number | null; opening_count: number; doors: number }): string {
  if (!input.floor_area_sqft) {
    return "Circulation cannot be scored precisely without confirmed floor area; treat every furniture placement as circulation-risk until dimensions are verified against the plan.";
  }

  const perOpeningArea = input.opening_count > 0 ? input.floor_area_sqft / input.opening_count : input.floor_area_sqft;

  if (perOpeningArea < 25) {
    return `With ${input.floor_area_sqft} sq ft and ${input.opening_count} openings (doors + windows), this room has tight circulation math. Anchor furniture must be placed to protect clear paths to every door before any styling decision is made.`;
  }

  if (input.doors >= 3) {
    return `Multiple doors (${input.doors}) mean this room likely functions as a pass-through space. Furniture placement should treat circulation as a layout constraint equal in weight to the design thesis, not a secondary concern.`;
  }

  return "Circulation appears workable at this room's approximate size and opening count, but the layout direction should still state explicit clearances rather than assuming they exist.";
}

function buildBackdropCandidates(input: { doors: number; windows: number }): string[] {
  const candidates: string[] = [];

  if (input.doors + input.windows <= 3) {
    candidates.push("At least one wall likely has few or no openings and is a strong candidate for a styled backdrop or focal treatment — the diagnosis's wall-by-wall photo labels should confirm which.");
  } else {
    candidates.push("This room has many openings relative to its wall count; a backdrop wall may need to be built rather than found — consider a freestanding or applied focal treatment (cabinetry, art, wall finish) rather than assuming a clean wall exists.");
  }

  return candidates;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  return null;
}
