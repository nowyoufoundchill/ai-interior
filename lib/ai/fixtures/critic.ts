import type { ConceptCritique, DiagnosisCritique, MoodBoardConcept, ProductCritique, RenderCritique } from "@/lib/schemas";

export function buildConceptCritiqueFixture(concepts: MoodBoardConcept[]): ConceptCritique {
  return {
    // A small deterministic per-index offset keeps mock quality_score from
    // collapsing to one identical value across all 3 concepts (found by a
    // design-review pass: identical-looking concepts undermine the point of
    // using mock mode to verify differentiation), without pretending this is
    // a real per-concept judgment.
    per_concept: concepts.map((concept, index) => ({
      concept_name: concept.concept_name,
      scores: {
        style_clarity: 74 - index,
        room_fit: 72 + index,
        functional_fit: 70,
        scale_realism: 70 + index,
        color_material_cohesion: 74 - index,
        luxury_signal: 70,
        originality: 68 + index * 2,
        practicality: 72,
        budget_alignment: 70,
        whole_home_alignment: 72 - index
      },
      issues: ["Mock critique only — no model call made. Provide a room + real concepts to score for real."],
      // Mock concepts are authored to avoid the reject_now list, so no
      // violations here — real detection needs a live critic call.
      reject_now_violations: [],
      // Mock concepts do not place furniture in a no-go zone; real layout-
      // violation detection needs a live critic call.
      layout_violations: []
    })),
    // Kept >= the governance regeneration threshold (70, see
    // buildConceptRegenerationFeedback) — this used to sit at 65 and silently
    // forced every mock-mode generation through a second full round every
    // time, which the old bulk-insert-at-the-end code happened to discard
    // invisibly. Checkpointed persistence surfaced it as a real extra "stale"
    // batch, which is what exposed this as a fixture bug rather than
    // intended mock behavior.
    concept_differentiation_score: 74,
    differentiation_notes: "Mock differentiation score — real scoring requires a live critic call.",
    currency_score: 72,
    currency_notes: "Mock currency score — real regional-currency scoring requires a live critic call."
  };
}

export function buildDiagnosisCritiqueFixture(): DiagnosisCritique {
  return {
    scores: {
      room_specificity: 72,
      downstream_usefulness: 74,
      evidence_discipline: 78,
      constraint_capture: 70,
      execution_risk_awareness: 73
    },
    strengths: ["Diagnosis names practical next-step design concerns."],
    issues: ["Mock critique only - no model call made."],
    missing_factors: [],
    regeneration_needed: false,
    regeneration_focus: []
  };
}

export function buildRenderCritiqueFixture(): RenderCritique {
  return {
    preservation_score: 82,
    constraint_adherence_score: 80,
    density_discipline_score: 78,
    realism_score: 80,
    // Mock render plans are authored to preserve architecture and respect the
    // constraint set, so no blocking violations — real detection needs a live
    // critic call against the actual plan.
    blocking_violations: [],
    issues: ["Mock render critique only — no model call made."],
    notes: ["Preservation and constraint adherence assumed from the mock plan."]
  };
}

export function buildProductCritiqueFixture(): ProductCritique {
  return {
    concept_fit_score: 74,
    scale_realism_score: 72,
    budget_discipline_score: 73,
    coverage_score: 75,
    strengths: ["Plan covers the core categories for the concept."],
    issues: ["Mock critique only — no model call made."],
    gaps: []
  };
}
