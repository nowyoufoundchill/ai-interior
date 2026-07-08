import { revisionSchema, type RevisionResult } from "@/lib/schemas";

export function buildRevisionFixture(input: { message: string; revisionType: string }): RevisionResult {
  return revisionSchema.parse({
    user_message: input.message,
    revision_type: input.revisionType,
    assistant_response:
      "This is a saved placeholder response. The future room-aware designer chat will load the room brief, selected concept, products, renders, and memory before answering.",
    state_before: {},
    state_after: {}
  });
}
