import { z } from "zod";

export const existingItemSchema = z.object({
  item: z.string(),
  keep_status: z.enum(["keep", "remove", "unknown"]),
  design_relevance: z.string()
});

export const roomAnalysisSchema = z.object({
  room_summary: z.string(),
  architecture: z.object({
    doors: z.array(z.string()),
    windows: z.array(z.string()),
    ceiling: z.string(),
    flooring: z.string(),
    trim: z.string(),
    built_ins: z.array(z.string())
  }),
  lighting: z.object({
    natural_light: z.enum(["low", "medium", "high"]),
    artificial_light: z.array(z.string()),
    risk_notes: z.array(z.string())
  }),
  materials: z.array(z.string()),
  existing_items: z.array(existingItemSchema),
  constraints: z.array(z.string()),
  opportunities: z.array(z.string()),
  design_risks: z.array(z.string()),
  recommended_strategy: z.string(),
  uncertainties: z.array(z.string())
});

export const briefInterpretationSchema = z.object({
  primary_goal: z.string(),
  secondary_goal: z.string(),
  must_have_constraints: z.array(z.string()),
  avoid: z.array(z.string()),
  style_tension: z.string(),
  taste_profile: z.array(z.string()),
  budget_strategy: z.string(),
  confidence_level: z.number().min(0).max(1)
});

export const autopilotBriefSchema = z.object({
  room_summary: z.string(),
  design_direction: z.string(),
  functions_and_zones: z.array(z.string()),
  fixed_architecture: z.array(z.string()),
  keep_or_remove: z.array(z.string()),
  palette_materials_lighting: z.array(z.string()),
  preservation_constraints: z.array(z.string()),
  negative_instructions: z.array(z.string()),
  unknowns: z.array(z.string()),
  blocking_questions: z.array(z.string()),
  confidence: z.number().min(0).max(1)
});

export const wholeHomeContextSchema = z.object({
  palette_guidance: z.array(z.string()),
  repeated_material_guidance: z.array(z.string()),
  avoid_repeating: z.array(z.string()),
  compatibility_notes: z.array(z.string()),
  conflict_warnings: z.array(z.string())
});

export const moodBoardSchema = z.object({
  concept_name: z.string(),
  design_thesis: z.string(),
  style_keywords: z.array(z.string()),
  palette: z.array(z.object({ name: z.string(), hex: z.string() })),
  materials: z.array(z.string()),
  furniture_direction: z.string(),
  layout_direction: z.string(),
  lighting_direction: z.string(),
  art_direction: z.string(),
  decor_direction: z.string(),
  plant_direction: z.string(),
  budget_strategy: z.string(),
  why_it_works: z.string(),
  why_user_may_reject_it: z.string(),
  risk_profile: z.array(z.string()),
  quality_score: z.number().min(0).max(100)
});

export const productSchema = z.object({
  category: z.string(),
  name: z.string(),
  retailer: z.string(),
  url: z.string().url().optional(),
  image_url: z.string().optional(),
  price: z.number().optional(),
  dimensions: z
    .object({
      note: z.string()
    })
    .catchall(z.string()),
  material: z.string(),
  finish: z.string(),
  scores: z.object({
    style_fit: z.number().min(0).max(100),
    scale_fit: z.number().min(0).max(100),
    budget_fit: z.number().min(0).max(100),
    material_fit: z.number().min(0).max(100),
    luxury_signal: z.number().min(0).max(100)
  }),
  reason_selected: z.string(),
  risks: z.array(z.string()),
  alternatives: z.array(z.string())
});

export const renderPlanSchema = z.object({
  source_photo_id: z.string().uuid().optional(),
  mood_board_id: z.string().uuid().optional(),
  render_prompt: z.string(),
  preservation_constraints: z.array(z.string()),
  transformation_instructions: z.array(z.string()),
  negative_instructions: z.array(z.string()),
  critique: z.object({
    notes: z.array(z.string()),
    score: z.number().min(0).max(100)
  }),
  quality_score: z.number().min(0).max(100)
});

export const revisionSchema = z.object({
  user_message: z.string(),
  revision_type: z.enum([
    "general_question",
    "style_revision",
    "product_revision",
    "render_revision",
    "budget_revision",
    "layout_revision",
    "whole_home_check",
    "memory_update"
  ]),
  assistant_response: z.string(),
  state_before: z.object({ summary: z.string() }),
  state_after: z.object({ summary: z.string() })
});

export const designMemorySchema = z.object({
  scope: z.enum(["user", "home", "room"]),
  scope_id: z.string().uuid(),
  memory_type: z.string(),
  content: z.record(z.unknown())
});

export const criticDimensionsSchema = z.object({
  style_clarity: z.number().min(0).max(100),
  room_fit: z.number().min(0).max(100),
  functional_fit: z.number().min(0).max(100),
  scale_realism: z.number().min(0).max(100),
  color_material_cohesion: z.number().min(0).max(100),
  luxury_signal: z.number().min(0).max(100),
  originality: z.number().min(0).max(100),
  practicality: z.number().min(0).max(100),
  budget_alignment: z.number().min(0).max(100),
  whole_home_alignment: z.number().min(0).max(100)
});

export const designCriticSchema = criticDimensionsSchema.extend({
  summary: z.string()
});

export const conceptCritiqueSchema = z.object({
  per_concept: z.array(
    z.object({
      concept_name: z.string(),
      scores: criticDimensionsSchema,
      issues: z.array(z.string()),
      // Regionally-current governance: the specific `reject_now` items (from
      // trend_intelligence) that this concept lands on. A non-empty list is a
      // genericness FAILURE, not a taste preference — it triggers a bounded
      // regeneration in moodBoardGenerator. Empty array when no brief matches.
      reject_now_violations: z.array(z.string()),
      // Phase 3 layout-violation layer: blocking spatial-constraint breaches
      // (furniture in a diagnosed door/no-go zone, blocking an active path).
      // A non-empty list is a BLOCKING failure, not advice.
      layout_violations: z.array(z.string())
    })
  ),
  concept_differentiation_score: z.number().min(0).max(100),
  differentiation_notes: z.string(),
  // How current/regionally-right the set reads against the direction of travel.
  // Low currency (with the direction data present) reads as generic luxury.
  currency_score: z.number().min(0).max(100),
  currency_notes: z.string()
});

export const productCritiqueSchema = z.object({
  concept_fit_score: z.number().min(0).max(100),
  scale_realism_score: z.number().min(0).max(100),
  budget_discipline_score: z.number().min(0).max(100),
  coverage_score: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  issues: z.array(z.string()),
  gaps: z.array(z.string())
});

export const renderCritiqueSchema = z.object({
  preservation_score: z.number().min(0).max(100),
  constraint_adherence_score: z.number().min(0).max(100),
  density_discipline_score: z.number().min(0).max(100),
  realism_score: z.number().min(0).max(100),
  // Release-blocking breaches: an instruction that blocks a diagnosed door or
  // active path, backlights a call user against a window bank, drifts the fixed
  // architecture/camera, warps/duplicates objects, or overfills past the object
  // budget. A non-empty list gates the render (one bounded plan regeneration).
  blocking_violations: z.array(z.string()),
  issues: z.array(z.string()),
  notes: z.array(z.string())
});

export const finishedImageReviewSchema = z.object({
  verdict: z.enum(["pass", "warning", "failure"]),
  architecture_preservation_score: z.number().min(0).max(100),
  program_fulfillment_score: z.number().min(0).max(100),
  access_and_safety_score: z.number().min(0).max(100),
  realism_score: z.number().min(0).max(100),
  critical_violations: z.array(z.string()),
  warnings: z.array(z.string()),
  evidence: z.array(z.string()),
  summary: z.string(),
  confidence: z.number().min(0).max(1)
});

export const diagnosisCritiqueDimensionsSchema = z.object({
  room_specificity: z.number().min(0).max(100),
  downstream_usefulness: z.number().min(0).max(100),
  evidence_discipline: z.number().min(0).max(100),
  constraint_capture: z.number().min(0).max(100),
  execution_risk_awareness: z.number().min(0).max(100)
});

export const diagnosisCritiqueSchema = z.object({
  scores: diagnosisCritiqueDimensionsSchema,
  strengths: z.array(z.string()),
  issues: z.array(z.string()),
  missing_factors: z.array(z.string()),
  regeneration_needed: z.boolean(),
  regeneration_focus: z.array(z.string())
});

export type RoomAnalysis = z.infer<typeof roomAnalysisSchema>;
export type BriefInterpretation = z.infer<typeof briefInterpretationSchema>;
export type AutopilotBrief = z.infer<typeof autopilotBriefSchema>;
export type WholeHomeContext = z.infer<typeof wholeHomeContextSchema>;
export type MoodBoardConcept = z.infer<typeof moodBoardSchema>;
export type ProductPlanItem = z.infer<typeof productSchema>;
export type RenderPlan = z.infer<typeof renderPlanSchema>;
export type RevisionResult = z.infer<typeof revisionSchema>;
export type DesignMemory = z.infer<typeof designMemorySchema>;
export type DesignCriticScore = z.infer<typeof designCriticSchema>;
export type ConceptCritique = z.infer<typeof conceptCritiqueSchema>;
export type DiagnosisCritique = z.infer<typeof diagnosisCritiqueSchema>;
export type ProductCritique = z.infer<typeof productCritiqueSchema>;
export type RenderCritique = z.infer<typeof renderCritiqueSchema>;
export type FinishedImageReview = z.infer<typeof finishedImageReviewSchema>;
