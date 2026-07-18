/**
 * P0.4 ActionProposal builder (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.4).
 *
 * Turns one design-chat turn into a structured, versioned proposal the owner can
 * review and explicitly confirm — never a silent mutation. This is deterministic
 * (no model/image spend): the classification, scope, normalized instruction, and
 * invalidation preview are computed from the message + persisted room context, so
 * every proposal is reproducible and testable, and a chat turn costs nothing to
 * turn into a card. The heavy, paid work happens only after the owner confirms,
 * inside a durable `chat_action` job (lib/ai/jobs/runners.ts).
 *
 * Invariants this enforces:
 *  - a question stays a question (no action controls);
 *  - a change request that lacks a concrete target becomes a clarification, not a
 *    guess;
 *  - the invalidation preview it emits is exactly what the runner will do, so the
 *    preview "matches the executable integrity table" (§P0.4 gate).
 */

export const PROPOSAL_VERSION = 1;

export type ProposalIntent =
  | "render_revision"
  | "concept_revision"
  | "product_revision"
  | "preference_update"
  | "clarification"
  | "question";

export type ProposalScope =
  | "one_perspective"
  | "selected_perspectives"
  | "all_perspectives"
  | "concept"
  | "products"
  | "preferences"
  | "none";

export interface ProposalContext {
  /** Source photo of the current render — the natural "this perspective" target. */
  currentRenderPhotoId?: string | null;
  hasLockedConcept?: boolean;
  hasRenders?: boolean;
  hasProducts?: boolean;
}

export interface ProposalDraft {
  intent_type: ProposalIntent;
  scope: ProposalScope;
  scope_photo_ids: string[];
  summary: string;
  normalized_instructions: string | null;
  expected_invalidations: string[];
  confidence: "high" | "medium" | "low";
  clarifying_question: string | null;
  /** True when this draft should be persisted as a proposal row (mutation intents
   *  + clarification). A pure question is not persisted as a proposal. */
  persist: boolean;
  /** True when the owner can Apply it (a concrete, confirmable mutation). */
  actionable: boolean;
}

// A concrete visual thing the owner can point at in a render. Presence of one of
// these turns a change verb into a confident render revision rather than a vague
// "make it better".
const VISUAL_ANCHOR =
  /\b(art|artwork|painting|picture|print|photo frame|ocean|sky|wall|walls|colou?r|paint|rug|chair|sofa|couch|curtain|drape|drapes|blind|light|lamp|lighting|floor|flooring|window|plant|pillow|throw|cushion|headboard|table|shelf|shelving|mirror|ceiling|trim|accent)\b/;

const CHANGE_VERB =
  /\b(replace|swap|change|recolou?r|repaint|paint|warm|warmer|cool|cooler|darker|lighter|brighten|dim|remove|take out|add|introduce|keep|retain|leave|make|turn|soften|richen|deepen)\b/;

const PREFERENCE_CUE = /\b(remember|i prefer|we prefer|i like|we like|always|never|standing preference|from now on|going forward)\b/;

const SHOPPING_CUE = /\b(buy|shop|purchase|source|retailer|where can i (find|buy)|find me|link to|add to cart|budget|cheaper|price)\b/;

const CONCEPT_CUE = /\b(concept|direction|re-?harmonize|reharmonise|whole home|other rooms|overall style|different style|start over|new direction)\b/;

const QUESTION_LEAD = /^(why|what|how|should|could|would|when|where|which|is it|are you|do you|does|can you explain|tell me|explain)\b/;

const ONE_PERSPECTIVE_CUE =
  /\b(this (photo|perspective|render|angle|view|shot|image|one)|only (this|here|one)|just this|one (photo|perspective|angle|view|render)|on this (one|photo|angle|view)|single perspective)\b/;

const ALL_PERSPECTIVE_CUE = /\b(all|every|everywhere|each|across (all|every)|throughout|whole room|entire room)\b/;

// A change desire with no concrete anchor — needs the designer to ask what to change.
const VAGUE_CHANGE = /\b(make it (better|nicer|different)|do something|something else|improve it|fix it|change it|redo it|not quite right|meh)\b/;

function normalize(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, " ");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export type DirectVisualRevisionDecision =
  | { actionable: true; instructions: string }
  | { actionable: false; error: string; code: "needs_detail" | "needs_scope" | "not_visual" };

/**
 * The autopilot revision field is already scoped to the one design visible
 * above it. Concrete, reversible visual changes can therefore run immediately;
 * requests that imply standing memory, another room, shopping, or an unclear
 * target stop before a job is created.
 */
export function classifyDirectVisualRevision(message: string): DirectVisualRevisionDecision {
  const cleaned = normalize(message);
  const text = cleaned.toLowerCase();
  if (!text || text.length < 5 || QUESTION_LEAD.test(text) || VAGUE_CHANGE.test(text)) {
    return {
      actionable: false,
      code: "needs_detail",
      error: "Name the visible change you want, such as making the palette warmer, adding closed storage, or using less furniture."
    };
  }
  if (PREFERENCE_CUE.test(text) || CONCEPT_CUE.test(text)) {
    return {
      actionable: false,
      code: "needs_scope",
      error: "That request may affect your standing preferences or other rooms. Restate one change for only this displayed design."
    };
  }
  if (SHOPPING_CUE.test(text)) {
    return {
      actionable: false,
      code: "not_visual",
      error: "This field changes the room image. Save shopping and product requests for the implementation package."
    };
  }

  const directVisualCue =
    CHANGE_VERB.test(text) ||
    VISUAL_ANCHOR.test(text) ||
    /\b(warmth|storage|furniture|texture|cozier|cosier|brighter|darker|minimal|less|more|open|airy|soft|bold)\b/.test(text);
  if (!directVisualCue) {
    return {
      actionable: false,
      code: "needs_detail",
      error: "Describe one visible adjustment to this design so I can revise it without guessing."
    };
  }
  return { actionable: true, instructions: cleaned };
}

/**
 * Classify a chat turn and produce a proposal draft. `revisionType` is the chat
 * agent's own coarse label (from lib/schemas revisionSchema); we refine it here
 * with message + room context so, e.g., "replace the ocean artwork" reliably
 * becomes a render revision even though the agent labelled it a general question.
 */
export function buildProposalDraft(
  message: string,
  revisionType: string,
  context: ProposalContext = {}
): ProposalDraft {
  const text = message.toLowerCase();
  const cleaned = normalize(message);
  const hasAnchor = VISUAL_ANCHOR.test(text);
  const hasChangeVerb = CHANGE_VERB.test(text);

  // 1) Standing preference ("always keep a reading nook").
  if (PREFERENCE_CUE.test(text) || revisionType === "memory_update") {
    return {
      intent_type: "preference_update",
      scope: "preferences",
      scope_photo_ids: [],
      summary: `Save a standing preference: ${cleaned}`,
      normalized_instructions: cleaned,
      expected_invalidations: [
        "Saved as a standing home preference that guides future concepts, renders, and products. Nothing already created changes until you regenerate it."
      ],
      confidence: "high",
      clarifying_question: null,
      persist: true,
      actionable: true
    };
  }

  // 2) A concrete visual change to the rendered room → render revision.
  //    (Checked before shopping/concept so "change the wall color" isn't misread
  //    as a shopping or concept request.)
  if (hasChangeVerb && hasAnchor) {
    const one = ONE_PERSPECTIVE_CUE.test(text);
    const all = ALL_PERSPECTIVE_CUE.test(text);
    const scope: ProposalScope = one && !all ? "one_perspective" : "all_perspectives";
    const scopePhotoIds =
      scope === "one_perspective" && context.currentRenderPhotoId ? [context.currentRenderPhotoId] : [];
    return {
      intent_type: "render_revision",
      scope,
      scope_photo_ids: scopePhotoIds,
      summary:
        scope === "one_perspective"
          ? `Revise this one perspective: ${cleaned}`
          : `Revise every room perspective: ${cleaned}`,
      normalized_instructions: cleaned,
      expected_invalidations: [
        scope === "one_perspective"
          ? "The current render for the selected perspective becomes stale and is replaced with the new visualization. Other perspectives are untouched."
          : "The current render for each eligible perspective becomes stale and is replaced with the new visualization. Your approved direction is unchanged."
      ],
      // Explicit scope word or a named anchor → high; a defaulted "all" → medium.
      confidence: one || all ? "high" : "medium",
      clarifying_question: null,
      persist: true,
      actionable: true
    };
  }

  // 3) Explicit shopping / product-plan intent.
  if (SHOPPING_CUE.test(text) || revisionType === "product_revision" || revisionType === "budget_revision") {
    return {
      intent_type: "product_revision",
      scope: "products",
      scope_photo_ids: [],
      summary: `Re-source the product plan: ${cleaned}`,
      normalized_instructions: cleaned,
      expected_invalidations: [
        "A new product plan is sourced for your approved direction; the previous product suggestions become stale (kept in history, not deleted)."
      ],
      confidence: "high",
      clarifying_question: null,
      persist: true,
      actionable: true
    };
  }

  // 4) Concept / direction re-harmonization.
  if (CONCEPT_CUE.test(text) || revisionType === "style_revision" || revisionType === "whole_home_check") {
    return {
      intent_type: "concept_revision",
      scope: "concept",
      scope_photo_ids: [],
      summary: `Explore a re-harmonized direction: ${cleaned}`,
      normalized_instructions: cleaned,
      expected_invalidations: [
        "New concept directions are generated as new versions. Your current locked direction and its renders and products stay intact until you approve a new one."
      ],
      confidence: "medium",
      clarifying_question: null,
      persist: true,
      actionable: true
    };
  }

  // 5) A change desire with no concrete target → clarification (never a guess).
  if (VAGUE_CHANGE.test(text) || (hasChangeVerb && !hasAnchor && !QUESTION_LEAD.test(text))) {
    return {
      intent_type: "clarification",
      scope: "none",
      scope_photo_ids: [],
      summary: "The designer needs one detail before proposing a change.",
      normalized_instructions: null,
      expected_invalidations: [],
      confidence: "low",
      clarifying_question:
        "Happy to refine this. Which part should I change — the wall colour, the artwork, a specific piece of furniture, or the overall palette — and should it apply to one perspective or all of them?",
      persist: true,
      actionable: false
    };
  }

  // 6) Everything else is a question: answered in the thread, no action controls.
  return {
    intent_type: "question",
    scope: "none",
    scope_photo_ids: [],
    summary: "Question answered — no change proposed.",
    normalized_instructions: null,
    expected_invalidations: [],
    confidence: "high",
    clarifying_question: null,
    persist: false,
    actionable: false
  };
}
