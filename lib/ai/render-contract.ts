import { z } from "zod";

export const renderModeSchema = z.enum(["designer", "concept"]);
export type RenderMode = z.infer<typeof renderModeSchema>;

export const ARCHITECTURE_LOCK = `ARCHITECTURAL SOURCE OF TRUTH — ARCHITECTURE LOCK
Treat the original room photograph and confirmed room geometry as immutable.
Preserve wall positions; window and door count, size and position; ceiling height and geometry; flooring boundaries; and built-in architecture.
Preserve camera position and perspective unless the owner explicitly requests a different view.
Do not invent windows, doors, openings, fireplaces, columns or architectural features.
Confirmed dimensions and explicit constraints outrank visual inference. Unknown dimensions remain unknown.
Redesign the interior rather than redesigning the building.`;

export const designRenderSpecSchema = z.object({
  room_architecture: z.object({
    confirmed_dimensions: z.array(z.string()),
    doors: z.array(z.string()),
    windows: z.array(z.string()),
    ceiling: z.string(),
    fixed_features: z.array(z.string()),
    camera: z.string()
  }),
  preserve: z.array(z.string()),
  design_changes: z.array(z.string()),
  design_intent: z.array(z.string()),
  render_instructions: z.object({
    camera: z.string(),
    lighting: z.string(),
    composition: z.string(),
    materials: z.array(z.string()),
    architectural_preservation_rules: z.array(z.string())
  }),
  unknowns: z.array(z.string())
});
export type DesignRenderSpec = z.infer<typeof designRenderSpecSchema>;

const strings = { type: "array", items: { type: "string" } } as const;
export const designRenderSpecJsonSchema = {
  type: "object", additionalProperties: false,
  properties: {
    room_architecture: {
      type: "object", additionalProperties: false,
      properties: {
        confirmed_dimensions: strings, doors: strings, windows: strings,
        ceiling: { type: "string" }, fixed_features: strings, camera: { type: "string" }
      },
      required: ["confirmed_dimensions", "doors", "windows", "ceiling", "fixed_features", "camera"]
    },
    preserve: strings, design_changes: strings, design_intent: strings,
    render_instructions: {
      type: "object", additionalProperties: false,
      properties: {
        camera: { type: "string" }, lighting: { type: "string" }, composition: { type: "string" },
        materials: strings, architectural_preservation_rules: strings
      },
      required: ["camera", "lighting", "composition", "materials", "architectural_preservation_rules"]
    },
    unknowns: strings
  },
  required: ["room_architecture", "preserve", "design_changes", "design_intent", "render_instructions", "unknowns"]
} as const;

export function renderSpecPrompt(spec: DesignRenderSpec) {
  return `STRUCTURED DESIGN RENDER SPEC\n${JSON.stringify(spec, null, 2)}`;
}
