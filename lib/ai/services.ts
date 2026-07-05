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
  type WholeHomeContext
} from "@/lib/ai/schemas";
import {
  moodBoardListJsonSchema,
  productListJsonSchema,
  renderPlanJsonSchema,
  revisionJsonSchema,
  roomAnalysisJsonSchema
} from "@/lib/ai/json-schemas";
import { createStructuredResponse, isOpenAiConfigured } from "@/lib/ai/openai";
import { styleLibrary } from "@/lib/ai/style-library";

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
}): Promise<RoomAnalysis> {
  if (isOpenAiConfigured() && input.photos?.length) {
    const output = await createStructuredResponse<RoomAnalysis>({
      schemaName: "room_analysis",
      schema: roomAnalysisJsonSchema,
      instructions:
        "You are a senior interior designer analyzing a real room from photos and a room brief. Return only validated structured diagnosis data. Be specific, practical, and honest about uncertainty.",
      text: JSON.stringify({
        task: "Diagnose this room for an interior design workflow.",
        room: input.room,
        home: input.home,
        photo_labels: input.photos.map((photo) => ({
          id: photo.id,
          label: photo.label,
          angle_type: photo.angle_type,
          caption: photo.ai_caption
        })),
        success_criteria: [
          "Identify visible architecture, materials, lighting, constraints, opportunities, and risks.",
          "Use uncertainties when photo evidence is incomplete.",
          "Do not invent exact dimensions, brands, or hidden conditions."
        ]
      }),
      images: input.photos.slice(0, 10).map((photo) => ({ url: photo.file_url, detail: "high" }))
    });

    return roomAnalysisSchema.parse(output);
  }

  const roomType = input.room.room_type ?? "room";
  const output = {
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

  return roomAnalysisSchema.parse(output);
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

export async function moodBoardGenerator(input: {
  room: RoomLike;
  home?: HomeLike | null;
  analysis?: unknown;
}): Promise<MoodBoardConcept[]> {
  if (isOpenAiConfigured()) {
    const output = await createStructuredResponse<{ concepts: MoodBoardConcept[] }>({
      schemaName: "mood_board_concepts",
      schema: moodBoardListJsonSchema,
      instructions:
        "You are an interior design style director. Create exactly three distinct, buildable concept directions grounded in the room diagnosis and whole-home context. Avoid generic trend language.",
      text: JSON.stringify({
        task: "Generate three room mood board concepts.",
        room: input.room,
        home: input.home,
        analysis: input.analysis,
        success_criteria: [
          "Each concept must feel meaningfully different.",
          "Each concept must include palette hex values, materials, furniture, layout, lighting, art, decor, plants, budget strategy, risks, and rejection reason.",
          "Concepts must respect constraints and whole-home notes."
        ]
      })
    });

    return output.concepts.map((concept) => moodBoardSchema.parse(concept));
  }

  return styleDirector({ room: input.room });
}

export async function productSourcingAgent(input?: {
  room?: RoomLike;
  home?: HomeLike | null;
  analysis?: unknown;
  selectedMoodBoard?: MoodBoardLike | null;
}): Promise<ProductPlanItem[]> {
  if (isOpenAiConfigured() && input?.selectedMoodBoard) {
    const output = await createStructuredResponse<{ products: ProductPlanItem[] }>({
      schemaName: "product_plan",
      schema: productListJsonSchema,
      instructions:
        "You are an interior design product sourcing agent. Use web search when available to find plausible current retailer or search-result URLs. Produce a shoppable plan with realistic categories, target retailers, approximate pricing, scale notes, risks, and alternatives. Do not claim live stock availability unless the source explicitly supports it.",
      text: JSON.stringify({
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
      }),
      tools: [{ type: "web_search" }]
    });

    return output.products.map((product) => productSchema.parse(product));
  }

  const products = [
    ["Desk", "Warm Oak Executive Desk", "West Elm", 1299],
    ["Desk chair", "Tailored Leather Task Chair", "Article", 549],
    ["Rug", "Textured Wool Area Rug", "Lulu and Georgia", 998],
    ["Table lamp", "Aged Brass Library Lamp", "Rejuvenation", 399],
    ["Artwork", "Oversized Tonal Landscape", "Chairish", 850],
    ["Plant", "Sculptural Olive Tree", "Terrain", 228]
  ] as const;

  return products.map(([category, name, retailer, price]) =>
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
}): Promise<RenderPlan> {
  if (isOpenAiConfigured()) {
    const output = await createStructuredResponse<RenderPlan>({
      schemaName: "render_plan",
      schema: renderPlanJsonSchema,
      instructions:
        "You are a render prompt director for realistic interior design mockups. Preserve room architecture and camera geometry while applying the selected concept. Return a production-ready prompt and critique constraints.",
      text: JSON.stringify({
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
      })
    });

    return renderPlanSchema.parse({
      ...output,
      source_photo_id: output.source_photo_id || undefined,
      mood_board_id: output.mood_board_id || undefined
    });
  }

  return renderPlanSchema.parse({
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
}

export async function designCritic(): Promise<DesignCriticScore> {
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
    summary: "Mock critic score. Future calls should use the same rubric before outputs are shown as final."
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
  if (isOpenAiConfigured()) {
    const output = await createStructuredResponse<RevisionResult>({
      schemaName: "revision_result",
      schema: revisionJsonSchema,
      instructions:
        "You are a room-aware interior design assistant. Answer the user's revision request using the room brief, diagnosis, selected concept, products, renders, and memories. Save any state changes as structured before/after summaries.",
      text: JSON.stringify({
        task: "Respond to a room-aware design chat turn.",
        message: input.message,
        room: input.room,
        home: input.home,
        analysis: input.analysis,
        selected_mood_board: input.selectedMoodBoard,
        products: input.products,
        renders: input.renders,
        memories: input.memories
      })
    });

    return revisionSchema.parse(output);
  }

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

  return revisionSchema.parse({
    user_message: input.message,
    revision_type,
    assistant_response:
      "This is a saved placeholder response. The future room-aware designer chat will load the room brief, selected concept, products, renders, and memory before answering.",
    state_before: {},
    state_after: {}
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
