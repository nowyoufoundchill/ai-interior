import { z } from "zod";
import {
  briefInterpretationSchema,
  designCriticSchema,
  designMemorySchema,
  moodBoardSchema,
  productSchema,
  renderPlanSchema,
  revisionSchema,
  roomAnalysisSchema,
  wholeHomeContextSchema,
  type BriefInterpretation,
  type DesignCriticScore,
  type DesignMemory,
  type MoodBoardConcept,
  type ProductPlanItem,
  type RenderPlan,
  type RevisionResult,
  type RoomAnalysis,
  type DiagnosisCritique,
  type WholeHomeContext
} from "@/lib/schemas";
import {
  diagnosisCritiqueJsonSchema,
  moodBoardJsonSchema,
  moodBoardListJsonSchema,
  productListJsonSchema,
  renderPlanJsonSchema,
  revisionJsonSchema,
  roomAnalysisJsonSchema
} from "@/lib/schemas/json";
import { runStructuredTask, type GatewayProvider } from "@/lib/ai/gateway";
import { styleLibrary, type StyleProfile } from "@/lib/ai/style-library";
import { resolvePropertyDossier } from "@/lib/ai/context-brain/property-dossier";
import { deriveRoomIntelligence } from "@/lib/ai/context-brain/room-intelligence";
import { buildTasteGraph } from "@/lib/ai/context-brain/taste-graph";
import { DESIGN_DISSENT_POLICY } from "@/lib/ai/context-brain/design-policy";
import { DESIGN_PORTFOLIO } from "@/lib/ai/design-portfolio";
import { critiqueConcepts, critiqueDiagnosis, overallScore } from "@/lib/ai/critic";

type RoomLike = {
  id: string;
  name: string;
  room_type: string | null;
  purpose: string | null;
  budget_range: string | null;
  style_preferences: unknown;
  color_preferences: unknown;
  constraints: unknown;
  existing_items: unknown;
  design_brief: string | null;
  dimensions?: unknown;
};

type HomeLike = {
  id?: string;
  name: string;
  region: string | null;
  home_type: string | null;
  style_notes: string | null;
  whole_home_palette?: unknown;
  whole_home_constraints?: unknown;
};

type PhotoLike = {
  id: string;
  file_url: string;
  label: string | null;
  angle_type: string | null;
  ai_caption?: string | null;
};

type MoodBoardLike = {
  id: string;
  concept_name: string;
  concept_data: unknown;
  quality_score: number | null;
};

export async function roomVisionAnalyst(input: {
  room: RoomLike;
  photoCount: number;
  photos?: PhotoLike[];
  home?: HomeLike | null;
  provider?: GatewayProvider;
}): Promise<RoomAnalysis> {
  const provider = input.provider ?? "anthropic";
  const roomType = input.room.room_type ?? "room";
  const mockOutput = {
    room_summary: `${input.room.name} is ready for a designer diagnosis once the uploaded angles are reviewed. This mock summary preserves the future structure for photo-aware analysis.`,
    architecture: {
      doors: ["Door locations will be identified from straight-on wall photos."],
      windows: ["Window count, scale, and treatment opportunities will be inferred from uploaded photos."],
      ceiling: "Ceiling height and fixture placement are currently based on the room brief.",
      flooring: "Flooring material will be read from floor and wide-angle photos.",
      trim: "Trim, casing, and baseboard profile will be captured in the real vision pass.",
      built_ins: []
    },
    lighting: {
      natural_light: "medium" as const,
      artificial_light: ["Layer task, ambient, and accent lighting before finalizing products."],
      risk_notes: ["Mock analysis cannot yet confirm glare, shadowing, or actual fixture output."]
    },
    materials: ["warm wood", "textured textile", "aged metal", "ceramic accent"],
    existing_items: [
      {
        item: "Existing pieces from the room brief",
        keep_status: "unknown" as const,
        design_relevance: "Future analysis will separate keep, remove, and style-anchor items."
      }
    ],
    constraints: [`Respect the room purpose: ${input.room.purpose ?? roomType}.`],
    opportunities: [
      "Create a clear focal wall and a more intentional lighting hierarchy.",
      "Use scale, material contrast, and fewer stronger pieces to avoid a generic AI-room feel."
    ],
    design_risks: [
      "Furniture scale should be checked before sourcing.",
      "Mood boards should not rely on trend language without room-specific rationale."
    ],
    recommended_strategy:
      "Use the uploaded room geometry, the whole-home notes, and the brief to create three distinct but executable design directions.",
    uncertainties: [
      `${input.photoCount} photos are attached; final diagnosis should confirm doors, windows, flooring, and existing items from image understanding.`
    ]
  };

  if (!input.photos?.length) {
    return roomAnalysisSchema.parse(mockOutput);
  }

  const photos = input.photos;
  const contextBrain = buildContextBrain({ room: input.room, home: input.home });
  const diagnosisContextBrain = compactContextBrainForDiagnosis(contextBrain);
  const photoLabels = photos.map((photo) => ({
    id: photo.id,
    label: photo.label,
    angle_type: photo.angle_type,
    caption: photo.ai_caption
  }));

  const generateDiagnosis = (regenerationFocus?: string[]) =>
    runStructuredTask({
      roomId: input.room.id,
      serviceName: regenerationFocus?.length ? "Room Vision Analyst Regeneration" : "Room Vision Analyst",
      provider,
      promptPath: "prompts/diagnosis/room-diagnosis.v2.md",
      schemaName: "room_analysis",
      schema: roomAnalysisJsonSchema,
      zodSchema: roomAnalysisSchema,
      maxTokens: 4096,
      taskInput: {
        task: "Diagnose this room for an interior design workflow.",
        room: input.room,
        home: input.home,
        photo_labels: photoLabels,
        context_brain: diagnosisContextBrain,
        regeneration_focus: regenerationFocus ?? [],
        success_criteria: [
          "Identify visible architecture, layout cues, materials, lighting conditions, existing items, constraints, opportunities, and execution risks.",
          "Treat typed dimensions and the room brief as ground truth, and use photos only for visual evidence and spatial reading.",
          "Call out what should influence downstream concept direction, furniture scale, circulation, lighting strategy, and render realism.",
          "Use uncertainties when photo evidence is incomplete or ambiguous instead of guessing.",
          "Do not invent exact dimensions, brands, hidden conditions, or unseen architectural features.",
          "Avoid generic decorating advice and keep the diagnosis specific to this room and its intended use."
        ]
      },
      images: photos.slice(0, 10).map((photo) => ({ url: photo.file_url, detail: "high" })),
      mock: () => roomAnalysisSchema.parse(mockOutput)
    });

  let diagnosis = await generateDiagnosis();
  let critique = await critiqueDiagnosis({
    roomId: input.room.id,
    diagnosis,
    room: input.room,
    home: input.home,
    contextBrain: diagnosisContextBrain,
    provider
  });

  if (shouldRegenerateDiagnosis(critique)) {
    diagnosis = await generateDiagnosis(critique.regeneration_focus);
  }

  return diagnosis;
}

export async function designBriefInterpreter(input: {
  room: RoomLike;
}): Promise<BriefInterpretation> {
  return briefInterpretationSchema.parse({
    primary_goal: input.room.purpose ?? "Create a room that feels elevated, personal, and functional.",
    secondary_goal: "Balance whole-home cohesion with a distinct room identity.",
    must_have_constraints: toArray(input.room.constraints),
    avoid: ["generic decor advice", "under-scaled furniture", "unexplained product picks"],
    style_tension: "Use preferences as direction, not as a rigid style filter.",
    taste_profile: toArray(input.room.style_preferences).slice(0, 6),
    budget_strategy: input.room.budget_range ?? "Define investment pieces and smart substitutions.",
    confidence_level: 0.74
  });
}

export async function wholeHomeContextAgent(input: {
  home: HomeLike;
}): Promise<WholeHomeContext> {
  return wholeHomeContextSchema.parse({
    palette_guidance: ["Repeat warm neutrals and natural materials across rooms.", input.home.region ?? "Use regional context once provided."],
    repeated_material_guidance: ["wood tone", "aged metal", "linen or wool texture"],
    avoid_repeating: ["literal theme decor", "one-note palettes", "room concepts that ignore the rest of the home"],
    compatibility_notes: [input.home.style_notes ?? "Add whole-home style notes to sharpen future concepts."],
    conflict_warnings: []
  });
}

export async function styleDirector(input: {
  room: RoomLike;
}): Promise<MoodBoardConcept[]> {
  const styles = styleLibrary.slice(0, 3);
  return styles.map((style, index) =>
    moodBoardSchema.parse({
      concept_name: index === 0 ? "Tailored Coastal Study" : index === 1 ? "Quiet Organic Atelier" : "Collected Transitional Room",
      design_thesis:
        index === 0
          ? "A composed, slightly moody direction that uses coastal restraint without beach references."
          : index === 1
            ? "A tactile, warm modern direction focused on calm materials, softened edges, and practical storage."
            : "A layered direction that blends classic structure with fresher art, lighting, and relaxed upholstery.",
      style_keywords: [style.style_name, ...style.pairs_well_with.slice(0, 2)],
      palette: [
        { name: "Warm white", hex: "#f5efe4" },
        { name: "Oak", hex: "#b9895a" },
        { name: "Moss", hex: "#687461" },
        { name: "Charcoal", hex: "#3b3933" },
        { name: "Aged brass", hex: "#b08a4c" }
      ],
      materials: style.materials.slice(0, 6),
      furniture_direction: style.furniture_silhouettes.join(", "),
      layout_direction: "Anchor the main function first, then add storage, lighting, and one strong secondary seating or styling moment.",
      lighting_direction: style.lighting_types.join(", "),
      art_direction: style.art_direction.join(", "),
      decor_direction: "Use fewer, better objects with visible texture and a reason to be in the room.",
      plant_direction: style.plants.join(", "),
      budget_strategy: "Invest in the main workhorse piece, lighting, and rug scale; save on accessories and secondary tables.",
      why_it_works: `This direction gives ${input.room.name} a clear point of view while preserving whole-home flexibility.`,
      why_user_may_reject_it: "It may feel too restrained if the desired outcome is highly colorful or maximal.",
      risk_profile: style.common_mistakes.slice(0, 3),
      quality_score: 86 - index
    })
  );
}

/**
 * Selects a small, relevant slice of the style library instead of dumping all
 * 14 entries into every call. Matches against the room's stated style
 * preferences and whole-home style notes first; falls back to the styles
 * with the deepest authored detail (proportion/lighting/luxury mechanics) so
 * the generator always has at least a few fully-authored anchors to work
 * from.
 */
function selectRelevantStyles(input: { room: RoomLike; home?: HomeLike | null }): StyleProfile[] {
  const text = [
    ...toArray(input.room.style_preferences),
    ...toArray(input.room.color_preferences),
    input.home?.style_notes ?? ""
  ]
    .join(" ")
    .toLowerCase();

  const scored = styleLibrary.map((style) => {
    const nameHit = text.includes(style.style_name.toLowerCase());
    const keywordHits = [...style.pairs_well_with, style.style_name].filter((keyword) =>
      text.includes(keyword.toLowerCase())
    ).length;
    const depthBonus = style.proportion_rules ? 1 : 0;
    return { style, score: (nameHit ? 5 : 0) + keywordHits + depthBonus };
  });

  const ranked = scored.sort((a, b) => b.score - a.score).map((entry) => entry.style);
  const withDepthFirst = [...ranked.filter((style) => style.proportion_rules), ...ranked.filter((style) => !style.proportion_rules)];

  return withDepthFirst.slice(0, 5);
}

function buildContextBrain(input: { room: RoomLike; home?: HomeLike | null; analysis?: unknown }) {
  const analysis = (input.analysis ?? null) as Partial<RoomAnalysis> | null;

  const dimensions = (input.room.dimensions ?? null) as {
    width_ft?: number | string | null;
    length_ft?: number | string | null;
    ceiling_height?: number | string | null;
    notes?: string | null;
  } | null;

  return {
    property_dossier: resolvePropertyDossier(input.home?.region ?? null),
    room_intelligence: deriveRoomIntelligence({
      dimensions,
      purpose: input.room.purpose,
      constraints: toArray(input.room.constraints),
      analysis
    }),
    taste_graph: buildTasteGraph({
      stylePreferences: input.room.style_preferences,
      colorPreferences: input.room.color_preferences,
      constraints: input.room.constraints,
      homeStyleNotes: input.home?.style_notes ?? null,
      wholeHomeConstraints: input.home?.whole_home_constraints
    }),
    design_policy: DESIGN_DISSENT_POLICY,
    style_library: selectRelevantStyles({ room: input.room, home: input.home }),
    design_portfolio: DESIGN_PORTFOLIO
  };
}

function compactContextBrainForGeneration(contextBrain: ReturnType<typeof buildContextBrain>) {
  return {
    property_dossier: {
      local_luxury_register: contextBrain.property_dossier.local_luxury_register,
      what_reads_as_wrong_here: contextBrain.property_dossier.what_reads_as_wrong_here.slice(0, 4),
      geography_informed_moves: contextBrain.property_dossier.geography_informed_moves.slice(0, 3)
    },
    room_intelligence: contextBrain.room_intelligence,
    taste_graph: {
      preferred_styles: contextBrain.taste_graph.preferred_styles.slice(0, 6),
      banned_cliches: contextBrain.taste_graph.banned_cliches.slice(0, 4),
      standing_constraints: contextBrain.taste_graph.standing_constraints.slice(0, 8),
      formality_balance: contextBrain.taste_graph.formality_balance,
      ai_may_disagree_when: contextBrain.taste_graph.ai_may_disagree_when.slice(0, 3)
    },
    design_policy: {
      priority_order: contextBrain.design_policy.priority_order,
      rule: contextBrain.design_policy.rule
    },
    style_library: contextBrain.style_library.slice(0, 3).map((style) => ({
      style_name: style.style_name,
      summary: style.summary,
      color_palette: style.color_palette.slice(0, 5),
      materials: style.materials.slice(0, 5),
      furniture_silhouettes: style.furniture_silhouettes.slice(0, 4),
      lighting_types: style.lighting_types.slice(0, 4),
      luxury_signals: style.luxury_signals.slice(0, 4),
      common_mistakes: style.common_mistakes.slice(0, 3),
      proportion_rules: style.proportion_rules?.slice(0, 2) ?? [],
      lighting_layers: style.lighting_layers ?? null,
      luxury_mechanics: style.luxury_mechanics?.slice(0, 2) ?? []
    })),
    design_portfolio: contextBrain.design_portfolio.slice(0, 3).map((pattern) => ({
      pattern_name: pattern.pattern_name,
      register: pattern.register,
      why_it_works: pattern.why_it_works,
      generic_failure_version: pattern.generic_failure_version,
      principle_demonstrated: pattern.principle_demonstrated
    }))
  };
}

function compactContextBrainForCritic(contextBrain: ReturnType<typeof buildContextBrain>) {
  return {
    property_dossier: {
      local_luxury_register: contextBrain.property_dossier.local_luxury_register,
      what_reads_as_wrong_here: contextBrain.property_dossier.what_reads_as_wrong_here.slice(0, 4)
    },
    room_intelligence: contextBrain.room_intelligence,
    taste_graph: {
      preferred_styles: contextBrain.taste_graph.preferred_styles.slice(0, 6),
      standing_constraints: contextBrain.taste_graph.standing_constraints.slice(0, 8),
      formality_balance: contextBrain.taste_graph.formality_balance
    },
    design_portfolio: contextBrain.design_portfolio.slice(0, 2).map((pattern) => ({
      pattern_name: pattern.pattern_name,
      principle_demonstrated: pattern.principle_demonstrated,
      generic_failure_version: pattern.generic_failure_version
    }))
  };
}

function compactContextBrainForDiagnosis(contextBrain: ReturnType<typeof buildContextBrain>) {
  return {
    property_dossier: {
      climate_notes: contextBrain.property_dossier.climate_notes,
      architectural_vernacular: contextBrain.property_dossier.architectural_vernacular,
      local_luxury_register: contextBrain.property_dossier.local_luxury_register,
      what_reads_as_wrong_here: contextBrain.property_dossier.what_reads_as_wrong_here.slice(0, 4)
    },
    room_intelligence: contextBrain.room_intelligence,
    taste_graph: {
      preferred_styles: contextBrain.taste_graph.preferred_styles.slice(0, 6),
      standing_constraints: contextBrain.taste_graph.standing_constraints.slice(0, 8),
      banned_cliches: contextBrain.taste_graph.banned_cliches.slice(0, 4),
      formality_balance: contextBrain.taste_graph.formality_balance
    },
    design_policy: {
      priority_order: contextBrain.design_policy.priority_order,
      rule: contextBrain.design_policy.rule
    }
  };
}

function shouldRegenerateDiagnosis(critique: DiagnosisCritique) {
  if (critique.regeneration_needed) {
    return true;
  }

  return overallScore(critique.scores) < 72;
}

export async function moodBoardGenerator(input: {
  room: RoomLike;
  home?: HomeLike | null;
  analysis?: unknown;
  provider?: GatewayProvider;
  skipCritic?: boolean;
}): Promise<MoodBoardConcept[]> {
  const mockConcepts = await styleDirector({ room: input.room });
  const contextBrain = buildContextBrain(input);
  const generationContextBrain = compactContextBrainForGeneration(contextBrain);
  const criticContextBrain = compactContextBrainForCritic(contextBrain);
  const provider = input.provider ?? "anthropic";
  const styleAnchors = generationContextBrain.style_library.map((style) => style.style_name);

  const generateOne = (slotIndex: number, previousConcepts: MoodBoardConcept[], regenerationFeedback?: string) =>
    runStructuredTask({
      roomId: input.room.id,
      serviceName: `Mood Board Generator ${slotIndex}`,
      provider,
      promptPath: "prompts/concepts/generate-room-concept.v1.md",
      schemaName: `mood_board_concept_${slotIndex}`,
      schema: moodBoardJsonSchema,
      zodSchema: moodBoardSchema,
      maxTokens: 4096,
      taskInput: {
        task: "Generate one room mood board concept.",
        room: input.room,
        home: input.home,
        diagnosis: input.analysis,
        context_brain: generationContextBrain,
        concept_slot: slotIndex,
        required_style_anchor: styleAnchors[slotIndex - 1] ?? null,
        slot_goal:
          slotIndex === 1
            ? "Create the clearest best-fit concept for this room and brief."
            : slotIndex === 2
              ? "Create a distinctly more contrasty, darker, or more formal alternative than the first concept."
              : "Create a distinctly lighter, cleaner, or more relaxed/architectural alternative than the earlier concepts.",
        previous_concepts_summary: previousConcepts.map((concept) => ({
          concept_name: concept.concept_name,
          design_thesis: concept.design_thesis,
          style_keywords: concept.style_keywords,
          palette: concept.palette.map((item) => item.name),
          risk_profile: concept.risk_profile
        })),
        regeneration_feedback: regenerationFeedback ?? null
      },
      mock: () => mockConcepts[slotIndex - 1] ?? mockConcepts[0]
    });

  const generateSet = async (regenerationFeedback?: string) => {
    const concepts: MoodBoardConcept[] = [];
    for (let slotIndex = 1; slotIndex <= 3; slotIndex += 1) {
      const concept = await generateOne(slotIndex, concepts, regenerationFeedback);
      concepts.push(concept);
    }
    return concepts;
  };

  let concepts = await generateSet();

  if (input.skipCritic) {
    return concepts;
  }

  let critique = await critiqueConcepts({ roomId: input.room.id, concepts, contextBrain: criticContextBrain, provider });

  // The critic remains authoritative, but automatic regeneration is disabled
  // for now so the real office workflow can complete within practical batch
  // and route time limits during Phase 0 validation.

  // Replace the model's self-reported quality_score (observed to drift onto a
  // 0-10 convention against a 0-100 schema) with the critic's calibrated
  // score, so quality_score is always independently derived, not self-graded.
  return concepts.map((concept) => {
    const match = critique.per_concept.find((entry) => entry.concept_name === concept.concept_name);
    return {
      ...concept,
      quality_score: match ? overallScore(match.scores) : concept.quality_score
    };
  });
}

export async function productSourcingAgent(input?: {
  room?: RoomLike;
  home?: HomeLike | null;
  analysis?: unknown;
  selectedMoodBoard?: MoodBoardLike | null;
  provider?: GatewayProvider;
  tools?: unknown[];
}): Promise<ProductPlanItem[]> {
  const provider = input?.provider ?? "anthropic";
  const products = [
    ["Desk", "Warm Oak Executive Desk", "West Elm", 1299],
    ["Desk chair", "Tailored Leather Task Chair", "Article", 549],
    ["Rug", "Textured Wool Area Rug", "Lulu and Georgia", 998],
    ["Table lamp", "Aged Brass Library Lamp", "Rejuvenation", 399],
    ["Artwork", "Oversized Tonal Landscape", "Chairish", 850],
    ["Plant", "Sculptural Olive Tree", "Terrain", 228]
  ] as const;

  const mockProducts = products.map(([category, name, retailer, price]) =>
    productSchema.parse({
      category,
      name,
      retailer,
      url: "https://example.com",
      image_url: "https://images.unsplash.com/photo-1618220179428-22790b461013",
      price,
      dimensions: { note: "Confirm exact dimensions before purchase." },
      material: category === "Rug" ? "wool blend" : "mixed natural materials",
      finish: "warm neutral",
      scores: {
        style_fit: 88,
        scale_fit: 78,
        budget_fit: 74,
        material_fit: 86,
        luxury_signal: 82
      },
      reason_selected: "Chosen as a placeholder because it supports the selected concept with scale, material warmth, and a clear design rationale.",
      risks: ["Real sourcing should verify stock, dimensions, lead time, and finish variation."],
      alternatives: ["Lower-cost substitute", "Vintage option", "Investment upgrade"]
    })
  );

  if (!input?.selectedMoodBoard || !input.room) {
    return mockProducts;
  }

  const output = await runStructuredTask({
    roomId: input.room.id,
    serviceName: "Product Sourcing Agent",
    provider,
    promptPath: "prompts/products/source-product-plan.v1.md",
    schemaName: "product_plan",
    schema: productListJsonSchema,
    zodSchema: briefProductListSchema,
    maxTokens: 12288,
    taskInput: {
      task: "Generate a product sourcing plan for the selected concept.",
      room: input.room,
      home: input.home,
      analysis: input.analysis,
      selected_mood_board: input.selectedMoodBoard,
      success_criteria: [
        "Include at least six products covering anchor furniture, rug/textile, lighting, art/decor, storage or utility, and plant/accessory.",
        "Use dimensions as target guidance when exact dimensions are unknown.",
        "Use URLs as retailer home or search URLs when exact product URLs are not verified.",
        "Include purchase risks such as scale, finish variation, lead time, and stock verification."
      ]
    },
    tools: input.tools,
    mock: () => ({ products: mockProducts })
  });

  return output.products.map((product) => productSchema.parse(product));
}

export async function scaleAndFitEvaluator(input: {
  product: ProductPlanItem;
}): Promise<ProductPlanItem["scores"]> {
  return input.product.scores;
}

export async function renderPromptDirector(input: {
  roomId: string;
  sourcePhotoId?: string;
  moodBoardId?: string;
  room?: RoomLike;
  analysis?: unknown;
  selectedMoodBoard?: MoodBoardLike | null;
  sourcePhoto?: PhotoLike | null;
  provider?: GatewayProvider;
}): Promise<RenderPlan> {
  const provider = input.provider ?? "anthropic";
  const mockPlan = renderPlanSchema.parse({
    source_photo_id: input.sourcePhotoId,
    mood_board_id: input.moodBoardId,
    render_prompt:
      "Create a realistic interior design mockup that preserves the room architecture, camera angle, windows, doors, floor plane, and ceiling while applying the selected concept through paint, furniture, lighting, art, rug, and styling.",
    preservation_constraints: ["Preserve architecture", "Preserve camera angle", "Preserve window and door locations"],
    transformation_instructions: ["Layer lighting", "Add right-scaled furniture", "Use palette and materials from the selected mood board"],
    negative_instructions: ["No distorted room geometry", "No blocked doors", "No unrealistic furniture scale", "No generic beach decor"],
    critique: {
      notes: ["Mock render prompt only. Image generation will be connected in a later phase."],
      score: 82
    },
    quality_score: 82
  });

  return runStructuredTask({
    roomId: input.roomId,
    serviceName: "Render Prompt Director",
    provider,
    promptPath: "prompts/renders/compose-render-plan.v1.md",
    schemaName: "render_plan",
    schema: renderPlanJsonSchema,
    zodSchema: renderPlanSchema,
    taskInput: {
      task: "Create a render prompt plan for this room and source photo.",
      room_id: input.roomId,
      room: input.room,
      analysis: input.analysis,
      selected_mood_board: input.selectedMoodBoard,
      source_photo: input.sourcePhoto,
      source_photo_id: input.sourcePhotoId ?? "",
      mood_board_id: input.moodBoardId ?? "",
      success_criteria: [
        "Preserve walls, doors, windows, floor plane, ceiling, fixed architecture, and camera angle.",
        "Apply only reversible design changes unless explicitly requested.",
        "List negative instructions that reduce distorted geometry and unrealistic scale."
      ]
    },
    mock: () => mockPlan
  }).then((output) =>
    renderPlanSchema.parse({
      ...output,
      source_photo_id: output.source_photo_id || undefined,
      mood_board_id: output.mood_board_id || undefined
    })
  );
}

/**
 * Aggregate single-score critic, kept for backward compatibility with any
 * caller expecting one DesignCriticScore. When given a room and concepts,
 * this now delegates to the real critic (critiqueConcepts in critic.ts) and
 * averages across concepts instead of returning a hardcoded mock score.
 */
export async function designCritic(input?: {
  room?: RoomLike;
  home?: HomeLike | null;
  analysis?: unknown;
  concepts?: MoodBoardConcept[];
  provider?: GatewayProvider;
}): Promise<DesignCriticScore> {
  if (!input?.room || !input.concepts?.length) {
    return designCriticSchema.parse({
      style_clarity: 86,
      room_fit: 82,
      functional_fit: 80,
      scale_realism: 78,
      color_material_cohesion: 88,
      luxury_signal: 84,
      originality: 76,
      practicality: 83,
      budget_alignment: 75,
      whole_home_alignment: 81,
      summary: "Mock critic score — no room/concepts provided. Real scoring requires critiqueConcepts() with a live room."
    });
  }

  const contextBrain = buildContextBrain({ room: input.room, home: input.home, analysis: input.analysis });
  const critique = await critiqueConcepts({
    roomId: input.room.id,
    concepts: input.concepts,
    contextBrain,
    provider: input.provider
  });

  const dimensionKeys = Object.keys(critique.per_concept[0]?.scores ?? {}) as Array<
    keyof (typeof critique.per_concept)[number]["scores"]
  >;

  const averaged = Object.fromEntries(
    dimensionKeys.map((key) => [
      key,
      Math.round(
        critique.per_concept.reduce((sum, entry) => sum + entry.scores[key], 0) / critique.per_concept.length
      )
    ])
  );

  return designCriticSchema.parse({
    ...averaged,
    summary: `Averaged across ${critique.per_concept.length} concepts. Concept differentiation scored ${critique.concept_differentiation_score}/100: ${critique.differentiation_notes}`
  });
}

export async function revisionAgent(input: {
  message: string;
  room?: RoomLike;
  home?: HomeLike | null;
  analysis?: unknown;
  selectedMoodBoard?: unknown;
  products?: unknown;
  renders?: unknown;
  memories?: unknown;
}): Promise<RevisionResult> {
  const lower = input.message.toLowerCase();
  const revision_type = lower.includes("remember") || lower.includes("i prefer") || lower.includes("we prefer") || lower.includes("always") || lower.includes("never")
    ? "memory_update"
    : lower.includes("budget") || lower.includes("cheaper")
    ? "budget_revision"
    : lower.includes("render") || lower.includes("mockup")
      ? "render_revision"
      : lower.includes("product") || lower.includes("rug") || lower.includes("chair")
        ? "product_revision"
        : lower.includes("moodier") || lower.includes("coastal") || lower.includes("style")
          ? "style_revision"
          : lower.includes("living room") || lower.includes("clash")
            ? "whole_home_check"
            : "general_question";

  const mockRevision = revisionSchema.parse({
    user_message: input.message,
    revision_type,
    assistant_response:
      "This is a saved placeholder response. The future room-aware designer chat will load the room brief, selected concept, products, renders, and memory before answering.",
    state_before: {},
    state_after: {}
  });

  if (!input.room) {
    return mockRevision;
  }

  return runStructuredTask({
    roomId: input.room.id,
    serviceName: "Revision Agent",
    promptPath: "prompts/chat/design-chat.v1.md",
    schemaName: "revision_result",
    schema: revisionJsonSchema,
    zodSchema: revisionSchema,
    taskInput: {
      task: "Respond to a room-aware design chat turn.",
      message: input.message,
      room: input.room,
      home: input.home,
      analysis: input.analysis,
      selected_mood_board: input.selectedMoodBoard,
      products: input.products,
      renders: input.renders,
      memories: input.memories
    },
    mock: () => mockRevision
  });
}

export async function memoryAgent(input: {
  scope: "user" | "home" | "room";
  scopeId: string;
  note: string;
}): Promise<DesignMemory> {
  return designMemorySchema.parse({
    scope: input.scope,
    scope_id: input.scopeId,
    memory_type: "preference",
    content: { note: input.note }
  });
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}
const briefProductListSchema = z.object({
  products: z.array(productSchema)
});
