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
  /**
   * Phase 3: an explicit, typed spatial constraint set. Turns "don't block a
   * door / window / walkway" from prose into machine-checkable data the concept
   * director, render director, and critic all consume. Positions come from the
   * diagnosis's free-text door/window strings, so each constraint carries its
   * provenance and confidence rather than inventing plan-grade precision.
   */
  constraint_set: RoomConstraintSet;
};

/** A single spatial rule. `severity: "blocking"` items are release-blocking:
 *  the critic must fail any concept/render instruction set that violates one. */
export type SpatialConstraint = {
  id: string;
  kind: "door_clearance" | "window_operation" | "circulation_path" | "clearance" | "camera_backdrop" | "no_go_zone";
  label: string;
  rule: string;
  severity: "blocking" | "advisory";
  derived_from: string;
};

export type RoomConstraintSet = {
  /** Zones that must remain clear of casework/seating (human-readable, named). */
  clear_zones: string[];
  /** Named forbidden zones — placing furniture here is a blocking violation. */
  no_go_zones: string[];
  /** Explicit clearance requirements (e.g. desk chair pull-back, door swing). */
  required_clearances: { zone: string; min_clearance: string; reason: string }[];
  /** Camera/backdrop logic for call/video rooms; null when not a call room. */
  camera_backdrop: { camera_wall_goal: string; avoid: string } | null;
  /** The full typed constraint list, blocking items first. */
  constraints: SpatialConstraint[];
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

  const constraint_set = deriveRoomConstraints({
    doors,
    windows,
    floor_area_sqft,
    opening_count,
    glare_risk,
    needsCallQuality,
    constraints: input.constraints ?? [],
    purpose: input.purpose ?? null
  });

  return {
    floor_area_sqft,
    opening_count,
    glare_risk,
    circulation_note,
    backdrop_candidates,
    acoustic_flag,
    window_door_conflict_zones,
    confidence_notes,
    constraint_set
  };
}

/**
 * Derive the typed spatial constraint set from the diagnosis's door/window
 * strings + dimensions + purpose. Door/window positions in the diagnosis are
 * free text ("single door on the east wall, swings inward"), so this reads
 * orientation and swing *keywords* out of them and emits one constraint per
 * opening rather than asserting plan-grade coordinates. Every constraint names
 * where it came from so a reader can see it is a heuristic, not a survey.
 */
export function deriveRoomConstraints(input: {
  doors: string[];
  windows: string[];
  floor_area_sqft: number | null;
  opening_count: number;
  glare_risk: RoomIntelligence["glare_risk"];
  needsCallQuality: boolean;
  constraints: string[];
  purpose: string | null;
}): RoomConstraintSet {
  const constraints: SpatialConstraint[] = [];
  const clear_zones: string[] = [];
  const no_go_zones: string[] = [];
  const required_clearances: RoomConstraintSet["required_clearances"] = [];

  input.doors.forEach((door, index) => {
    const where = describeOpening(door) || `door ${index + 1}`;
    const swingsIn = /swing|inward|opens? in|into the room/i.test(door);
    clear_zones.push(`Approach + swing arc of the ${where}`);
    no_go_zones.push(`Directly in front of the ${where} (blocks entry/egress)`);
    required_clearances.push({
      zone: `${where} swing/approach`,
      min_clearance: swingsIn ? "~30 in door leaf swing + a clear approach path" : "a clear approach path (≥30 in)",
      reason: "Doors are egress; furniture here blocks entry and reads as an amateur layout error."
    });
    constraints.push({
      id: `door-${index + 1}`,
      kind: "door_clearance",
      label: `Keep the ${where} clear`,
      rule: `No casework, seating, rug edge, or large decor may sit in front of the ${where}${swingsIn ? " or inside its inward swing arc" : ""}. Circulation to it must stay open.`,
      severity: "blocking",
      derived_from: `diagnosis.architecture.doors[${index}]: "${truncate(door)}"`
    });
  });

  input.windows.forEach((window, index) => {
    const where = describeOpening(window) || `window ${index + 1}`;
    const operable = /operable|opens?|casement|double-hung|slider|egress/i.test(window);
    constraints.push({
      id: `window-${index + 1}`,
      kind: "window_operation",
      label: `Respect the ${where}`,
      rule: `Do not block the ${where} with tall furniture that kills daylight${operable ? " or prevents it from opening" : ""}. Window-height casework/headboards must sit below or beside the glass, not across it.`,
      severity: operable ? "blocking" : "advisory",
      derived_from: `diagnosis.architecture.windows[${index}]: "${truncate(window)}"`
    });
  });

  if (input.glare_risk === "high") {
    constraints.push({
      id: "glare-orientation",
      kind: "camera_backdrop",
      label: "Orient primary use away from the bright window bank",
      rule: "In a high-glare room, a screen-facing desk or a seated user's eyeline must not put a bright window bank directly behind the on-camera position or directly in the user's field of glare.",
      severity: input.needsCallQuality ? "blocking" : "advisory",
      derived_from: "room_intelligence.glare_risk = high"
    });
  }

  const camera_backdrop = input.needsCallQuality
    ? {
        camera_wall_goal:
          "Point the camera at a calm, low-opening backdrop wall (art, plaster, cabinetry) with the user's back NOT to a bright window bank.",
        avoid: "Backlighting from windows behind the seat; a cluttered or doorway backdrop; hard bare walls that echo."
      }
    : null;

  if (camera_backdrop) {
    clear_zones.push("A clean backdrop wall behind the primary seated/camera position");
    constraints.push({
      id: "camera-backdrop",
      kind: "camera_backdrop",
      label: "Protect the on-camera backdrop",
      rule: "The camera-facing wall behind the primary seat must read intentional and uncluttered; the seat's back is not to a window bank or an open doorway.",
      severity: "advisory",
      derived_from: `room purpose implies calls/video: "${truncate(input.purpose ?? "")}"`
    });
  }

  // Owner/diagnosis-stated spatial constraints become explicit no-go entries.
  input.constraints
    .filter((c) => /window|door|block|circulation|egress|walkway|path|clearance/i.test(c))
    .forEach((c, index) => {
      no_go_zones.push(c);
      constraints.push({
        id: `stated-${index + 1}`,
        kind: "no_go_zone",
        label: "Honor a stated spatial constraint",
        rule: c,
        severity: "blocking",
        derived_from: "room/owner stated constraint"
      });
    });

  if (input.floor_area_sqft && input.opening_count > 0 && input.floor_area_sqft / input.opening_count < 25) {
    constraints.push({
      id: "tight-circulation",
      kind: "circulation_path",
      label: "Protect circulation before styling",
      rule: "This room's area-per-opening is tight; a continuous clear walking path connecting every door must be established BEFORE any anchor furniture or styling is placed.",
      severity: "blocking",
      derived_from: `floor_area ${input.floor_area_sqft} sqft / ${input.opening_count} openings < 25`
    });
  }

  // Blocking constraints first so a downstream reader sees the hard rules up top.
  constraints.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "blocking" ? -1 : 1));

  const confidence_notes = [
    "Door swing direction and exact opening positions are read from diagnosis text keywords, not a floor plan — treat orientation as approximate and clearances as minimums, not surveyed values.",
    no_go_zones.length
      ? "No-go zones are the release-blocking layer: a concept or render instruction set that places furniture in one of them is a layout-violation failure, not a taste choice."
      : "No explicit no-go zones were derivable from the current diagnosis; the door/window constraints below still apply."
  ];

  return { clear_zones, no_go_zones, required_clearances, camera_backdrop, constraints, confidence_notes };
}

function describeOpening(text: string): string | null {
  const wall = text.match(/\b(north|south|east|west|left|right|rear|back|front|interior|exterior)\s+wall\b/i);
  const kind = /door/i.test(text) ? "door" : /window/i.test(text) ? "window" : "opening";
  if (wall) {
    // e.g. "east wall" + "door" -> "east wall door"
    return `${wall[0].trim().toLowerCase()} ${kind}`.replace(/\s+/g, " ");
  }
  return null;
}

function truncate(text: string, max = 90): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
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
