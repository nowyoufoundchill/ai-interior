const stringArray = {
  type: "array",
  items: { type: "string" }
} as const;

const score = {
  type: "number",
  minimum: 0,
  maximum: 100
} as const;

export const roomAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    room_summary: { type: "string" },
    architecture: {
      type: "object",
      additionalProperties: false,
      properties: {
        doors: stringArray,
        windows: stringArray,
        ceiling: { type: "string" },
        flooring: { type: "string" },
        trim: { type: "string" },
        built_ins: stringArray
      },
      required: ["doors", "windows", "ceiling", "flooring", "trim", "built_ins"]
    },
    lighting: {
      type: "object",
      additionalProperties: false,
      properties: {
        natural_light: { type: "string", enum: ["low", "medium", "high"] },
        artificial_light: stringArray,
        risk_notes: stringArray
      },
      required: ["natural_light", "artificial_light", "risk_notes"]
    },
    materials: stringArray,
    existing_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          item: { type: "string" },
          keep_status: { type: "string", enum: ["keep", "remove", "unknown"] },
          design_relevance: { type: "string" }
        },
        required: ["item", "keep_status", "design_relevance"]
      }
    },
    constraints: stringArray,
    opportunities: stringArray,
    design_risks: stringArray,
    recommended_strategy: { type: "string" },
    uncertainties: stringArray
  },
  required: [
    "room_summary",
    "architecture",
    "lighting",
    "materials",
    "existing_items",
    "constraints",
    "opportunities",
    "design_risks",
    "recommended_strategy",
    "uncertainties"
  ]
} as const;

export const moodBoardJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    concept_name: { type: "string" },
    design_thesis: { type: "string" },
    style_keywords: stringArray,
    palette: {
      type: "array",
      minItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          hex: { type: "string" }
        },
        required: ["name", "hex"]
      }
    },
    materials: stringArray,
    furniture_direction: { type: "string" },
    layout_direction: { type: "string" },
    lighting_direction: { type: "string" },
    art_direction: { type: "string" },
    decor_direction: { type: "string" },
    plant_direction: { type: "string" },
    budget_strategy: { type: "string" },
    why_it_works: { type: "string" },
    why_user_may_reject_it: { type: "string" },
    risk_profile: stringArray,
    quality_score: score
  },
  required: [
    "concept_name",
    "design_thesis",
    "style_keywords",
    "palette",
    "materials",
    "furniture_direction",
    "layout_direction",
    "lighting_direction",
    "art_direction",
    "decor_direction",
    "plant_direction",
    "budget_strategy",
    "why_it_works",
    "why_user_may_reject_it",
    "risk_profile",
    "quality_score"
  ]
} as const;

export const moodBoardListJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    concepts: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: moodBoardJsonSchema
    }
  },
  required: ["concepts"]
} as const;

export const productListJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    products: {
      type: "array",
      minItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string" },
          name: { type: "string" },
          retailer: { type: "string" },
          url: { type: "string" },
          image_url: { type: "string" },
          price: { type: "number" },
          dimensions: {
            type: "object",
            additionalProperties: { type: "string" },
            properties: {
              note: { type: "string" }
            },
            required: ["note"]
          },
          material: { type: "string" },
          finish: { type: "string" },
          scores: {
            type: "object",
            additionalProperties: false,
            properties: {
              style_fit: score,
              scale_fit: score,
              budget_fit: score,
              material_fit: score,
              luxury_signal: score
            },
            required: ["style_fit", "scale_fit", "budget_fit", "material_fit", "luxury_signal"]
          },
          reason_selected: { type: "string" },
          risks: stringArray,
          alternatives: stringArray
        },
        required: [
          "category",
          "name",
          "retailer",
          "url",
          "image_url",
          "price",
          "dimensions",
          "material",
          "finish",
          "scores",
          "reason_selected",
          "risks",
          "alternatives"
        ]
      }
    }
  },
  required: ["products"]
} as const;

export const renderPlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    source_photo_id: { type: "string" },
    mood_board_id: { type: "string" },
    render_prompt: { type: "string" },
    preservation_constraints: stringArray,
    transformation_instructions: stringArray,
    negative_instructions: stringArray,
    critique: {
      type: "object",
      additionalProperties: false,
      properties: {
        notes: stringArray,
        score
      },
      required: ["notes", "score"]
    },
    quality_score: score
  },
  required: [
    "source_photo_id",
    "mood_board_id",
    "render_prompt",
    "preservation_constraints",
    "transformation_instructions",
    "negative_instructions",
    "critique",
    "quality_score"
  ]
} as const;

const criticDimensionsJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    style_clarity: score,
    room_fit: score,
    functional_fit: score,
    scale_realism: score,
    color_material_cohesion: score,
    luxury_signal: score,
    originality: score,
    practicality: score,
    budget_alignment: score,
    whole_home_alignment: score
  },
  required: [
    "style_clarity",
    "room_fit",
    "functional_fit",
    "scale_realism",
    "color_material_cohesion",
    "luxury_signal",
    "originality",
    "practicality",
    "budget_alignment",
    "whole_home_alignment"
  ]
} as const;

const diagnosisCritiqueDimensionsJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    room_specificity: score,
    downstream_usefulness: score,
    evidence_discipline: score,
    constraint_capture: score,
    execution_risk_awareness: score
  },
  required: [
    "room_specificity",
    "downstream_usefulness",
    "evidence_discipline",
    "constraint_capture",
    "execution_risk_awareness"
  ]
} as const;

export const conceptCritiqueJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    per_concept: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          concept_name: { type: "string" },
          scores: criticDimensionsJsonSchema,
          issues: stringArray
        },
        required: ["concept_name", "scores", "issues"]
      }
    },
    concept_differentiation_score: score,
    differentiation_notes: { type: "string" }
  },
  required: ["per_concept", "concept_differentiation_score", "differentiation_notes"]
} as const;

export const diagnosisCritiqueJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    scores: diagnosisCritiqueDimensionsJsonSchema,
    strengths: stringArray,
    issues: stringArray,
    missing_factors: stringArray,
    regeneration_needed: { type: "boolean" },
    regeneration_focus: stringArray
  },
  required: ["scores", "strengths", "issues", "missing_factors", "regeneration_needed", "regeneration_focus"]
} as const;

export const productCritiqueJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    concept_fit_score: score,
    scale_realism_score: score,
    budget_discipline_score: score,
    coverage_score: score,
    strengths: stringArray,
    issues: stringArray,
    gaps: stringArray
  },
  required: ["concept_fit_score", "scale_realism_score", "budget_discipline_score", "coverage_score", "strengths", "issues", "gaps"]
} as const;

export const revisionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    user_message: { type: "string" },
    revision_type: {
      type: "string",
      enum: [
        "general_question",
        "style_revision",
        "product_revision",
        "render_revision",
        "budget_revision",
        "layout_revision",
        "whole_home_check",
        "memory_update"
      ]
    },
    assistant_response: { type: "string" },
    state_before: {
      type: "object",
      additionalProperties: true
    },
    state_after: {
      type: "object",
      additionalProperties: true
    }
  },
  required: ["user_message", "revision_type", "assistant_response", "state_before", "state_after"]
} as const;
