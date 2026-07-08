import type { ConceptCritique, DiagnosisCritique, MoodBoardConcept, ProductCritique } from "@/lib/schemas";

export function buildConceptCritiqueFixture(concepts: MoodBoardConcept[]): ConceptCritique {
  return {
    per_concept: concepts.map((concept) => ({
      concept_name: concept.concept_name,
      scores: {
        style_clarity: 74,
        room_fit: 72,
        functional_fit: 70,
        scale_realism: 70,
        color_material_cohesion: 74,
        luxury_signal: 70,
        originality: 68,
        practicality: 72,
        budget_alignment: 70,
        whole_home_alignment: 72
      },
      issues: ["Mock critique only — no model call made. Provide a room + real concepts to score for real."]
    })),
    concept_differentiation_score: 65,
    differentiation_notes: "Mock differentiation score — real scoring requires a live critic call."
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
