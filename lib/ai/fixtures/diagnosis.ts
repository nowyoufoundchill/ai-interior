import { roomAnalysisSchema, type RoomAnalysis } from "@/lib/schemas";

export function buildDiagnosisFixture(input: {
  roomName: string;
  roomPurpose: string | null;
  roomType: string | null;
  photoCount: number;
}): RoomAnalysis {
  return roomAnalysisSchema.parse({
    room_summary: `${input.roomName} is ready for a designer diagnosis once the uploaded angles are reviewed. This mock summary preserves the future structure for photo-aware analysis.`,
    architecture: {
      doors: ["Door locations will be identified from straight-on wall photos."],
      windows: ["Window count, scale, and treatment opportunities will be inferred from uploaded photos."],
      ceiling: "Ceiling height and fixture placement are currently based on the room brief.",
      flooring: "Flooring material will be read from floor and wide-angle photos.",
      trim: "Trim, casing, and baseboard profile will be captured in the real vision pass.",
      built_ins: []
    },
    lighting: {
      natural_light: "medium" as const,
      artificial_light: ["Layer task, ambient, and accent lighting before finalizing products."],
      risk_notes: ["Mock analysis cannot yet confirm glare, shadowing, or actual fixture output."]
    },
    materials: ["warm wood", "textured textile", "aged metal", "ceramic accent"],
    existing_items: [
      {
        item: "Existing pieces from the room brief",
        keep_status: "unknown" as const,
        design_relevance: "Future analysis will separate keep, remove, and style-anchor items."
      }
    ],
    constraints: [`Respect the room purpose: ${input.roomPurpose ?? input.roomType ?? "room"}.`],
    opportunities: [
      "Create a clear focal wall and a more intentional lighting hierarchy.",
      "Use scale, material contrast, and fewer stronger pieces to avoid a generic AI-room feel."
    ],
    design_risks: [
      "Furniture scale should be checked before sourcing.",
      "Mood boards should not rely on trend language without room-specific rationale."
    ],
    recommended_strategy:
      "Use the uploaded room geometry, the whole-home notes, and the brief to create three distinct but executable design directions.",
    uncertainties: [
      `${input.photoCount} photos are attached; final diagnosis should confirm doors, windows, flooring, and existing items from image understanding.`
    ]
  });
}
