import { revisionSchema, type RevisionResult } from "@/lib/schemas";

export function buildRevisionFixture(input: { message: string; revisionType: string }): RevisionResult {
  const lower = input.message.toLowerCase();
  const response = lower.includes("moodier") || lower.includes("darker")
    ? "Yes. I would make the next pass moodier by deepening the wall tone, warming the wood, and reducing small decorative contrast so the room feels richer without becoming heavy. Nothing has changed yet; confirm this in the Concepts tab with a re-harmonized direction or in the Renders tab with a new visualization."
    : lower.includes("palette")
      ? "The palette is doing two jobs: keeping the office calm on camera while giving the approved direction enough warmth to avoid a flat white shell. I would keep the quieter base and let wood, art, and lighting carry the richer notes. Nothing has changed; this is design rationale only."
      : "I would treat this as an advisory design revision, not an automatic change. Working from the approved direction and latest render, I would adjust the next confirmed step around your request, then have you approve it in the relevant tab before anything is regenerated.";

  return revisionSchema.parse({
    user_message: input.message,
    revision_type: input.revisionType,
    assistant_response: response,
    state_before: { summary: "No design state changed before this advisory reply." },
    state_after: { summary: "No design state changed after this advisory reply; owner confirmation is still required." }
  });
}
