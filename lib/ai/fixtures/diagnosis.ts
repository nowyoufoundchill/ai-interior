import { roomAnalysisSchema, type RoomAnalysis } from "@/lib/schemas";

export function buildDiagnosisFixture(input: {
  roomName: string;
  roomPurpose: string | null;
  roomType: string | null;
  photoCount: number;
  dimensions?: unknown;
  designBrief?: string | null;
}): RoomAnalysis {
  const dimensions = parseDimensions(input.dimensions);
  const dimensionLine = dimensions
    ? `${dimensions.width_ft} ft by ${dimensions.length_ft} ft`
    : "the saved room dimensions";
  const openings = trimSentenceEnd(dimensions?.notes ?? "the noted doors and windows");
  const purpose = trimSentenceEnd(input.roomPurpose ?? input.roomType ?? "room");

  return roomAnalysisSchema.parse({
    room_summary: `${input.roomName} is a ${dimensionLine} ${input.roomType ?? "room"} with ${openings}. The brief calls for a refined coastal office that feels architectural, masculine, and expensive without beach-house shorthand.`,
    architecture: {
      doors: ["Keep all three door paths and swings visually clear before placing the desk, rug, or storage."],
      windows: ["Use the three windows as the room's strongest asset: daylight should graze wood, plaster, and task surfaces without blocking operation."],
      ceiling: "Treat the ceiling as quiet architecture; rely on layered lamps and a restrained overhead gesture rather than a single showpiece.",
      flooring: "Let the oak floor remain visible at the perimeter so the office reads warm and substantial.",
      trim: "Use crisp casing and baseboards as the formal frame for art, storage, and any darker accent wall.",
      built_ins: []
    },
    lighting: {
      natural_light: "medium" as const,
      artificial_light: ["Pair a brass task lamp with low, warm ambient light so computer work and evening calls both feel composed."],
      risk_notes: ["Check monitor glare against the window wall before approving the final desk orientation."]
    },
    materials: ["warm oak", "matte plaster", "aged brass", "wool", "leather", "ceramic accent"],
    existing_items: [
      {
        item: "White shell and oak floor",
        keep_status: "unknown" as const,
        design_relevance: "Use them as the calm architectural base; avoid covering the floor with a rug that is too large or too busy."
      }
    ],
    constraints: [
      `Respect the room purpose: ${purpose}.`,
      `Plan furniture for the ${dimensionLine} footprint without blocking the three doors or three windows.`
    ],
    opportunities: [
      "Create an executive focal wall with one substantial art or storage moment rather than scattered accessories.",
      "Use fewer, heavier pieces in warm wood, leather, wool, and aged brass so the office feels private and architectural."
    ],
    design_risks: [
      "An oversized desk or chair could pinch the door clearances in an 11 ft by 14 ft room.",
      "Blue coastal cues, rope, shells, or glossy finishes would cheapen the brief."
    ],
    recommended_strategy:
      "Create three distinct directions that all protect circulation, keep daylight working, and translate coastal into material quality rather than theme.",
    uncertainties: [
      `${input.photoCount} photos are attached; final live diagnosis should confirm exact door swings, window operation, and glare from the work surface.`
    ]
  });
}

function trimSentenceEnd(value: string): string {
  return value.trim().replace(/[.!?]+$/u, "");
}

function parseDimensions(value: unknown): { width_ft: number; length_ft: number; notes?: string } | null {
  if (!value || typeof value !== "object") return null;
  const maybeDimensions = value as { width_ft?: unknown; length_ft?: unknown; notes?: unknown };
  if (typeof maybeDimensions.width_ft !== "number" || typeof maybeDimensions.length_ft !== "number") return null;
  return {
    width_ft: maybeDimensions.width_ft,
    length_ft: maybeDimensions.length_ft,
    notes: typeof maybeDimensions.notes === "string" ? maybeDimensions.notes : undefined
  };
}
