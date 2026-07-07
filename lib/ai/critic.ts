import { conceptCritiqueSchema, diagnosisCritiqueSchema, type ConceptCritique, type DiagnosisCritique, type MoodBoardConcept, type RoomAnalysis } from "@/lib/schemas";
import { conceptCritiqueJsonSchema, diagnosisCritiqueJsonSchema } from "@/lib/schemas/json";
import { runStructuredTask, type GatewayProvider } from "@/lib/ai/gateway";
import { SCALE_ANCHORS, CRITIC_DIMENSION_GUIDANCE } from "@/lib/ai/critic-rubric";

/**
 * Real Critic implementation. Replaces the previously hardcoded mock in
 * services.ts (`designCritic()` returned a fixed score with no model call).
 * Scores a set of concepts against the rubric in critic-rubric.ts and logs
 * the run to ai_runs via the gateway, same as any other AI call.
 */
export async function critiqueConcepts(input: {
  roomId: string;
  concepts: MoodBoardConcept[];
  contextBrain: unknown;
  provider?: GatewayProvider;
}): Promise<ConceptCritique> {
  return runStructuredTask({
    roomId: input.roomId,
    serviceName: "Design Critic",
    provider: input.provider ?? "anthropic",
    promptPath: "prompts/critic/score-artifact.v1.md",
    schemaName: "concept_critique",
    schema: conceptCritiqueJsonSchema,
    zodSchema: conceptCritiqueSchema,
    maxTokens: 8192,
    taskInput: {
      task: "Score this set of concepts as an independent, tough reviewer.",
      concepts: input.concepts,
      context_brain: input.contextBrain,
      scale_anchors: SCALE_ANCHORS,
      dimension_guidance: CRITIC_DIMENSION_GUIDANCE
    },
    mock: () => mockCritique(input.concepts)
  });
}

export function overallScore(scores: Record<string, number>): number {
  const values = Object.values(scores);
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function critiqueDiagnosis(input: {
  roomId: string;
  diagnosis: RoomAnalysis;
  room: unknown;
  home?: unknown;
  contextBrain: unknown;
  provider?: GatewayProvider;
}): Promise<DiagnosisCritique> {
  return runStructuredTask({
    roomId: input.roomId,
    serviceName: "Diagnosis Critic",
    provider: input.provider ?? "anthropic",
    promptPath: "prompts/critic/score-diagnosis.v1.md",
    schemaName: "diagnosis_critique",
    schema: diagnosisCritiqueJsonSchema,
    zodSchema: diagnosisCritiqueSchema,
    maxTokens: 4096,
    taskInput: {
      task: "Score this room diagnosis as an independent reviewer.",
      room: input.room,
      home: input.home,
      diagnosis: input.diagnosis,
      context_brain: input.contextBrain
    },
    mock: () => ({
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
    })
  });
}

function mockCritique(concepts: MoodBoardConcept[]): ConceptCritique {
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
