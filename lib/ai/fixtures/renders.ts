import { renderPlanSchema, type RenderPlan } from "@/lib/schemas";

export function buildRenderPlanFixture(input: {
  sourcePhotoId?: string;
  moodBoardId?: string;
  userInstructions?: string | null;
}): RenderPlan {
  return renderPlanSchema.parse({
    source_photo_id: input.sourcePhotoId,
    mood_board_id: input.moodBoardId,
    render_prompt:
      "Edit this real room photo in place: keep the existing architecture, camera angle, windows, doors, floor plane, and ceiling exactly, and restyle only the paint, furniture, lighting, art, rug, and styling to match the locked concept." +
      (input.userInstructions ? ` Owner edit request: ${input.userInstructions}` : ""),
    preservation_constraints: ["Preserve architecture", "Preserve camera angle", "Preserve window and door locations"],
    transformation_instructions: ["Layer lighting", "Add right-scaled furniture", "Use palette and materials from the selected mood board"],
    negative_instructions: ["No distorted room geometry", "No blocked doors", "No unrealistic furniture scale", "No generic beach decor"],
    critique: {
      notes: ["Mock render prompt only. Image generation will be connected in a later phase."],
      score: 82
    },
    quality_score: 82
  });
}
