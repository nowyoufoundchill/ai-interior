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
  type ConceptCritique,
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
import { resolveAiMode, runStructuredTask, type GatewayProvider } from "@/lib/ai/gateway";
import { logAiRun } from "@/lib/ai/logging";
import { styleLibrary, type StyleProfile } from "@/lib/ai/style-library";
import { resolvePropertyDossier } from "@/lib/ai/context-brain/property-dossier";
import {
  resolveRegionalTrendBrief,
  compactTrendBriefForGeneration,
  compactTrendBriefForDiagnosis
} from "@/lib/ai/context-brain/trend-intelligence";
import { deriveRoomIntelligence } from "@/lib/ai/context-brain/room-intelligence";
import { buildTasteGraph } from "@/lib/ai/context-brain/taste-graph";
import { DESIGN_DISSENT_POLICY } from "@/lib/ai/context-brain/design-policy";
import { DESIGN_PORTFOLIO } from "@/lib/ai/design-portfolio";
import { critiqueConcepts, critiqueDiagnosis, critiqueProducts, critiqueRender, overallScore } from "@/lib/ai/critic";
import { buildDiagnosisFixture } from "@/lib/ai/fixtures/diagnosis";
import { buildProductPlanFixture } from "@/lib/ai/fixtures/products";
import { buildRenderPlanFixture } from "@/lib/ai/fixtures/renders";
import { buildRevisionFixture } from "@/lib/ai/fixtures/chat";
import { extractTavily, isTavilyConfigured, searchTavily } from "@/lib/ai/tavily";
import type { Json } from "@/types/database";

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
  value_band?: string | null;
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
  const mockOutput = buildDiagnosisFixture({
    roomName: input.room.name,
    roomPurpose: input.room.purpose,
    roomType,
    photoCount: input.photoCount,
    dimensions: input.room.dimensions,
    designBrief: input.room.design_brief
  });

  if (!input.photos?.length) {
    return mockOutput;
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
      maxTokens: 8192,
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
      mock: () => mockOutput
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

// Per-style mock fixture data (concept name, thesis, palette, rejection
// note) so the 3 mock concepts a room sees under AI_MODE=mock are visibly
// distinct — matching styleLibrary.slice(0, 3) by index. Concepts that all
// share one hardcoded palette and one templated why_it_works sentence fail
// the PRD v3 §5.2/§11 differentiation requirement even in mock mode, which
// defeats the point of using mock mode to verify the UI (Suite 5 design
// review would never be able to pass against identical-looking concepts).
const MOCK_CONCEPT_PROFILES: Array<{
  conceptName: string;
  thesis: string;
  palette: { name: string; hex: string }[];
  whyMayReject: string;
  layoutDirection: string;
  decorDirection: string;
  budgetStrategy: string;
  whyItWorks: string;
}> = [
  {
    conceptName: "Tidewater Study",
    thesis: "An airy, architectural coastal direction that leans on light and material honesty instead of beach props.",
    palette: [
      { name: "Warm white", hex: "#f7f2ea" },
      { name: "Oyster plaster", hex: "#d8cfc1" },
      { name: "Sand", hex: "#d9c7a8" },
      { name: "Natural oak", hex: "#b9895a" },
      { name: "Weathered taupe", hex: "#8A8073" }
    ],
    whyMayReject: "It may feel too light and airy if the desired outcome is darker or more enclosed.",
    layoutDirection: "Float the main desk toward the window wall to work with natural light; keep circulation to the interior side clear.",
    decorDirection: "One or two woven or ceramic pieces with visible handwork; nothing glossy or overly polished.",
    budgetStrategy: "Invest in the desk and task lighting; keep rug and accessories mid-range.",
    whyItWorks:
      "This is the lightest reading: oyster plaster, sand, natural oak, and weathered taupe keep the 11 ft by 14 ft office bright for daytime work while rejecting beach props. The desk sits with the window light, woven texture stays secondary, and the three doors remain visually clear."
  },
  {
    conceptName: "Dusk Harbor Room",
    thesis: "A moodier coastal direction pulled toward dusk: darker accents and tactile materials over literal beach signifiers.",
    palette: [
      { name: "Warm white", hex: "#f2ede2" },
      { name: "Smoke taupe", hex: "#6d6258" },
      { name: "Mushroom", hex: "#a9998a" },
      { name: "Natural oak", hex: "#a67b4d" },
      { name: "Blackened bronze", hex: "#3b342c" }
    ],
    whyMayReject: "It may feel too dark or reserved if the desired outcome is bright and high-energy.",
    layoutDirection: "Anchor the room with a substantial desk or console against the darkest wall, balanced by a layered lighting plan.",
    decorDirection: "Fewer, larger objects — one oversized art piece and one sculptural accent rather than many small ones.",
    budgetStrategy: "Invest in lighting layers and one statement material moment; save on secondary seating.",
    whyItWorks:
      "This is the executive dusk option: smoke taupe, mushroom, oak, leather, and blackened bronze make the white shell feel quieter on camera. It solves the brief through depth, task light, and one substantial desk wall rather than coastal decoration."
  },
  {
    conceptName: "Quiet Organic Atelier",
    thesis: "A tactile, warm modern direction built on soft forms, natural texture, and quiet, uncluttered negative space.",
    palette: [
      { name: "Bone", hex: "#f0e9dd" },
      { name: "Greige", hex: "#b8ab97" },
      { name: "Walnut", hex: "#6b4a35" },
      { name: "Charcoal", hex: "#3a3a38" },
      { name: "Stone taupe", hex: "#B8A99A" }
    ],
    whyMayReject: "It may feel too restrained if the desired outcome is highly colorful or maximal.",
    layoutDirection: "Keep the center of the room open; push storage and secondary pieces to the perimeter for a calm, uncluttered feel.",
    decorDirection: "A single large plant and one soft textile layer (throw or woven basket); resist adding more than that.",
    budgetStrategy: "Invest in the anchor seating piece and rug texture; keep storage and lighting simple and functional.",
    whyItWorks:
      "This is the most tactile and restrained option: bone, greige, walnut, charcoal, plaster, and travertine turn the office into a quiet workroom. It keeps the center open, uses the oak floor as warmth, and lets one sculptural chair or table carry the luxury signal."
  }
];

export async function styleDirector(input: {
  room: RoomLike;
}): Promise<MoodBoardConcept[]> {
  const styles = styleLibrary.slice(0, 3);
  return styles.map((style, index) => {
    const profile = MOCK_CONCEPT_PROFILES[index] ?? MOCK_CONCEPT_PROFILES[0];
    return moodBoardSchema.parse({
      concept_name: profile.conceptName,
      design_thesis: profile.thesis,
      style_keywords: [style.style_name, ...style.pairs_well_with.slice(0, 2)],
      palette: profile.palette,
      materials: style.materials.slice(0, 6),
      furniture_direction: style.furniture_silhouettes.join(", "),
      layout_direction: profile.layoutDirection,
      lighting_direction: style.lighting_types.join(", "),
      art_direction: style.art_direction.join(", "),
      decor_direction: profile.decorDirection,
      plant_direction: style.plants.join(", "),
      budget_strategy: profile.budgetStrategy,
      why_it_works: profile.whyItWorks,
      why_user_may_reject_it: profile.whyMayReject,
      risk_profile: style.common_mistakes.slice(0, 3),
      quality_score: 86 - index
    });
  });
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
  const ownerText = [
    ...toArray(input.room.style_preferences),
    ...toArray(input.room.color_preferences),
    input.home?.style_notes ?? ""
  ]
    .join(" ")
    .toLowerCase();

  // Trend sub-region bias (Phase 2 task 4): the same state is not one taste
  // market. Fold the resolved sub-region's reads_as + palette bias into the
  // scoring text so a coastal Lowcountry address favors the coastal styles and
  // an inland/lake address favors heavier wood/stone/gallery styles — without
  // overriding an explicit owner preference (owner text is weighted higher).
  const resolvedTrend = resolveRegionalTrendBrief(input.home?.region ?? null);
  const subRegionText = resolvedTrend?.matched_sub_region
    ? [resolvedTrend.matched_sub_region.reads_as, ...resolvedTrend.matched_sub_region.palette_bias].join(" ").toLowerCase()
    : "";

  const scored = styleLibrary.map((style) => {
    const nameHit = ownerText.includes(style.style_name.toLowerCase());
    const keywordHits = [...style.pairs_well_with, style.style_name].filter((keyword) =>
      ownerText.includes(keyword.toLowerCase())
    ).length;
    // Sub-region only nudges (weight 2 for a name hit, 1 per keyword) so an
    // explicit owner style preference (weight 5) always wins.
    const subRegionNameHit = subRegionText.includes(style.style_name.toLowerCase());
    const subRegionKeywordHits = [...style.pairs_well_with, style.style_name].filter((keyword) =>
      subRegionText.includes(keyword.toLowerCase())
    ).length;
    const depthBonus = style.proportion_rules ? 1 : 0;
    return {
      style,
      score: (nameHit ? 5 : 0) + keywordHits + (subRegionNameHit ? 2 : 0) + subRegionKeywordHits + depthBonus
    };
  });

  const ranked = scored.sort((a, b) => b.score - a.score).map((entry) => entry.style);
  const withDepthFirst = [...ranked.filter((style) => style.proportion_rules), ...ranked.filter((style) => !style.proportion_rules)];

  return withDepthFirst.slice(0, 5);
}

function buildContextBrain(input: {
  room: RoomLike;
  home?: HomeLike | null;
  analysis?: unknown;
  designPreferences?: { preference_type: string; label: string }[];
}) {
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
      wholeHomeConstraints: input.home?.whole_home_constraints,
      designPreferences: input.designPreferences
    }),
    design_policy: DESIGN_DISSENT_POLICY,
    style_library: selectRelevantStyles({ room: input.room, home: input.home }),
    design_portfolio: DESIGN_PORTFOLIO,
    // Dated, sourced trend picture for this region (null when no brief matches,
    // so we never invent a trend story). Lower priority than room reality and
    // the owner's taste graph — it informs the point of view, not the rules.
    trend_intelligence: resolveRegionalTrendBrief(input.home?.region ?? null),
    // Owner-facing property value band; sets which price-tier register the
    // trend brain targets (edited luxury vs fully authored). Null falls back to
    // the safe middle register inside resolveTierRegister.
    home_value_band: input.home?.value_band ?? null
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
    })),
    // Current, sourced trend picture — the difference between "on-brief for
    // 2026" and "generic luxury." Concepts must reflect the direction of
    // travel and avoid everything in `reject_now`.
    trend_intelligence: contextBrain.trend_intelligence
      ? compactTrendBriefForGeneration(contextBrain.trend_intelligence, contextBrain.home_value_band)
      : null
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
    })),
    // The critic scores currency/regional-rightness against this: a concept
    // that ignores the direction of travel or lands on a `reject_now` item is
    // generic, not just a taste preference.
    trend_intelligence: contextBrain.trend_intelligence
      ? {
          headline: contextBrain.trend_intelligence.headline,
          direction_of_travel: contextBrain.trend_intelligence.directional_theses.map((t) => t.move),
          reject_now: contextBrain.trend_intelligence.reject_now
        }
      : null
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
    },
    // A compact, current-market slice so the diagnosis can frame existing
    // conditions in 2026 terms (e.g. "all-white shell reads dated") without
    // prescribing the redesign. Null when no regional brief matches.
    trend_intelligence: contextBrain.trend_intelligence
      ? compactTrendBriefForDiagnosis(contextBrain.trend_intelligence)
      : null
  };
}

function compactContextBrainForRender(contextBrain: ReturnType<typeof buildContextBrain>) {
  return {
    property_dossier: {
      local_luxury_register: contextBrain.property_dossier.local_luxury_register,
      what_reads_as_wrong_here: contextBrain.property_dossier.what_reads_as_wrong_here.slice(0, 4)
    },
    // Full room intelligence including the typed constraint_set — the render
    // director needs the no-go zones, door clearances, and camera-backdrop
    // logic verbatim, not a summary.
    room_intelligence: contextBrain.room_intelligence,
    taste_graph: {
      preferred_styles: contextBrain.taste_graph.preferred_styles.slice(0, 6),
      standing_constraints: contextBrain.taste_graph.standing_constraints.slice(0, 8),
      formality_balance: contextBrain.taste_graph.formality_balance
    },
    // Lighting + luxury mechanics are exactly what a render needs to make a
    // material read expensive under the room's real light.
    style_library: contextBrain.style_library.slice(0, 3).map((style) => ({
      style_name: style.style_name,
      color_palette: style.color_palette.slice(0, 5),
      materials: style.materials.slice(0, 5),
      lighting_types: style.lighting_types.slice(0, 4),
      lighting_layers: style.lighting_layers ?? null,
      luxury_mechanics: style.luxury_mechanics?.slice(0, 3) ?? []
    })),
    trend_intelligence: contextBrain.trend_intelligence
      ? compactTrendBriefForGeneration(contextBrain.trend_intelligence, contextBrain.home_value_band)
      : null
  };
}

function shouldRegenerateDiagnosis(critique: DiagnosisCritique) {
  if (critique.regeneration_needed) {
    return true;
  }

  return overallScore(critique.scores) < 72;
}

/**
 * Decide whether a concept set must be regenerated once, and with what focus.
 * Returns null when the set passes governance (no regeneration). Blocking
 * conditions, in priority order:
 *  - any concept lands on a `reject_now` item (regionally-current genericness);
 *  - the set reads generic against the direction of travel (low currency);
 *  - the set fails the differentiation bar.
 */
function buildConceptRegenerationFeedback(critique: ConceptCritique): string | null {
  const layoutViolations = critique.per_concept
    .filter((entry) => (entry.layout_violations?.length ?? 0) > 0)
    .map((entry) => `- "${entry.concept_name}" breaks a blocking spatial constraint: ${entry.layout_violations.join("; ")}`);

  const violations = critique.per_concept
    .filter((entry) => (entry.reject_now_violations?.length ?? 0) > 0)
    .map((entry) => `- "${entry.concept_name}" lands on reject_now: ${entry.reject_now_violations.join("; ")}`);

  const lowCurrency = critique.currency_score < 70;
  const lowDifferentiation = critique.concept_differentiation_score < 70;

  if (!layoutViolations.length && !violations.length && !lowCurrency && !lowDifferentiation) {
    return null;
  }

  const parts: string[] = ["The previous concept set failed governance and must be regenerated. Fix, specifically:"];
  if (layoutViolations.length) {
    parts.push(
      `LAYOUT VIOLATIONS (blocking — fix first): these place furniture in a diagnosed door/no-go zone or block an active path. Re-plan the layout to keep every no-go zone and circulation path clear:\n${layoutViolations.join("\n")}`
    );
  }
  if (violations.length) {
    parts.push(
      `These concepts landed on the regional reject_now list (treat as genericness failures, not options — remove them entirely):\n${violations.join("\n")}`
    );
  }
  if (lowCurrency) {
    parts.push(
      `Currency scored ${critique.currency_score}/100: ${critique.currency_notes || "the set reads generic luxury, not authored for this region this year."} Pull each concept toward at least one current direction-of-travel move and cite its mechanism.`
    );
  }
  if (lowDifferentiation) {
    parts.push(
      `Differentiation scored ${critique.concept_differentiation_score}/100: ${critique.differentiation_notes} Make the concepts differ in style anchor, palette temperature, formality, and risk profile — not just name.`
    );
  }
  return parts.join("\n\n");
}

export async function moodBoardGenerator(input: {
  room: RoomLike;
  home?: HomeLike | null;
  analysis?: unknown;
  provider?: GatewayProvider;
  skipCritic?: boolean;
  designPreferences?: { preference_type: string; label: string }[];
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
      maxTokens: 8192,
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

  // Governance enforcement (Phase 2): a concept landing on a `reject_now` item,
  // a set that reads generic against the direction of travel, or a set that
  // fails the differentiation bar is a genericness FAILURE, not a taste
  // preference. Do ONE bounded regeneration with targeted feedback, then
  // re-score — mirroring the existing single-retry convention (never an
  // unbounded loop).
  const regenerationFeedback = buildConceptRegenerationFeedback(critique);
  if (regenerationFeedback) {
    concepts = await generateSet(regenerationFeedback);
    critique = await critiqueConcepts({ roomId: input.room.id, concepts, contextBrain: criticContextBrain, provider });
  }

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

/**
 * Re-harmonizes a single existing concept: regenerates one improved version of
 * a concept while keeping its core identity (style anchor, palette temperature,
 * formality). Used by the concept re-harmonize flow so owners can refine a
 * direction without discarding it or regenerating the whole set. Append-only at
 * the route layer — this only produces the refined concept object.
 */
export async function refineConcept(input: {
  room: RoomLike;
  home?: HomeLike | null;
  analysis?: unknown;
  baseConcept: MoodBoardConcept;
  instructions?: string;
  provider?: GatewayProvider;
}): Promise<MoodBoardConcept> {
  const contextBrain = buildContextBrain(input);
  const generationContextBrain = compactContextBrainForGeneration(contextBrain);
  const provider = input.provider ?? "anthropic";

  return runStructuredTask({
    roomId: input.room.id,
    serviceName: "Concept Re-harmonizer",
    provider,
    promptPath: "prompts/concepts/generate-room-concept.v1.md",
    schemaName: "mood_board_concept_reharmonized",
    schema: moodBoardJsonSchema,
    zodSchema: moodBoardSchema,
    maxTokens: 4096,
    taskInput: {
      task: "Refine and re-harmonize one existing room concept while preserving its core identity.",
      room: input.room,
      home: input.home,
      diagnosis: input.analysis,
      context_brain: generationContextBrain,
      base_concept: input.baseConcept,
      refinement_instructions:
        input.instructions?.trim() ||
        "Tighten and elevate this concept. Keep its style anchor, palette temperature, and formality, and resolve any generic, under-scaled, or under-specified moments.",
      slot_goal:
        "Return a single improved version of the base concept that stays recognizably the same design direction but is more specific, better scaled, and more cohesive.",
      required_style_anchor: input.baseConcept.style_keywords[0] ?? null
    },
    mock: () => ({ ...input.baseConcept })
  });
}

export async function productSourcingAgent(input?: {
  room?: RoomLike;
  home?: HomeLike | null;
  analysis?: unknown;
  selectedMoodBoard?: MoodBoardLike | null;
  approvedRender?: unknown;
  provider?: GatewayProvider;
  tools?: unknown[];
  skipCritic?: boolean;
  designPreferences?: { preference_type: string; label: string }[];
}): Promise<ProductPlanItem[]> {
  const provider = input?.provider ?? "anthropic";
  const mockProducts = buildProductPlanFixture();

  if (!input?.selectedMoodBoard || !input.room) {
    return mockProducts;
  }

  const room = input.room;
  const contextBrain = buildContextBrain({ room, home: input.home, analysis: input.analysis, designPreferences: input.designPreferences });
  const lockedConcept = input.selectedMoodBoard.concept_data;

  if (resolveAiMode() !== "mock" && isTavilyConfigured()) {
    const tavilyProducts = await sourceProductsWithTavily({
      room,
      home: input.home,
      diagnosis: input.analysis,
      lockedConcept
    });

    if (!input.skipCritic) {
      // Tavily is now the sourcing authority for this stage, so skip the
      // Anthropic critic pass by default to avoid turning product sourcing back
      // into an Anthropic-dependent workflow.
    }

    return tavilyProducts;
  }

  const productContextBrain = compactContextBrainForGeneration(contextBrain);

  const output = await runStructuredTask({
    roomId: room.id,
    serviceName: "Product Sourcing Agent",
    provider,
    promptPath: "prompts/products/source-product-plan.v1.md",
    schemaName: "product_plan",
    schema: productListJsonSchema,
    zodSchema: briefProductListSchema,
    maxTokens: 12288,
    taskInput: {
      task: "Generate a product sourcing plan that executes the locked concept for this specific room.",
      room,
      home: input.home,
      diagnosis: input.analysis,
      locked_concept: lockedConcept,
      context_brain: productContextBrain,
      typed_dimensions: room.dimensions ?? null,
      success_criteria: [
        "Every product must execute the locked concept's palette temperature, materials, formality, and risk profile — lead with that rationale in reason_selected, not generic decorating language.",
        "Treat the room's typed dimensions as ground truth for scale: size anchor pieces (desk, seating, rug) to the real room and note the target dimension in dimensions.",
        "Include at least six products covering anchor furniture, rug/textile, lighting, art/decor, storage or utility, and plant/accessory, with no duplicate roles.",
        "Respect the concept's budget strategy: invest where it matters, save elsewhere, and explain any premium pick.",
        "Use retailer home or search URLs when exact product URLs are not verified; never claim live stock.",
        "Include purchase risks such as scale, finish variation, lead time, and stock verification."
      ]
    },
    tools: input.tools,
    mock: () => ({ products: mockProducts })
  });

  const sourcedProducts = output.products.map((product) => productSchema.parse(product));

  if (!input.skipCritic) {
    // Authoritative, non-blocking critic pass. Logged to ai_runs via the gateway
    // (visible in /debug) but does not mutate or filter the plan, matching the
    // concept critic convention.
    try {
      await critiqueProducts({
        roomId: room.id,
        products: sourcedProducts,
        concept: lockedConcept,
        diagnosis: input.analysis,
        approvedRender: input.approvedRender,
        contextBrain: compactContextBrainForCritic(contextBrain),
        provider
      });
    } catch {
      // A critic failure must never block a completed product plan.
    }
  }

  return sourcedProducts;
}

async function sourceProductsWithTavily(input: {
  room: RoomLike;
  home?: HomeLike | null;
  diagnosis?: unknown;
  lockedConcept: unknown;
}): Promise<ProductPlanItem[]> {
  const startedAt = Date.now();
  const concept = asRecord(input.lockedConcept);
  const conceptName = String(concept.concept_name ?? "Locked concept");
  const styleKeywords = toStringArray(concept.style_keywords).slice(0, 3);
  const conceptMaterials = toStringArray(concept.materials).slice(0, 5);
  const budget = input.room.budget_range ?? "budget not specified";
  const dimensions = asRecord(input.room.dimensions);
  const diagnosis = asRecord(input.diagnosis);
  const strategy = String(diagnosis.recommended_strategy ?? "");
  const roomSummary = String(diagnosis.room_summary ?? "");
  const opportunities = toStringArray(diagnosis.opportunities).slice(0, 2);
  const risks = toStringArray(diagnosis.design_risks).slice(0, 2);
  const categoryPlans = buildTavilyCategoryPlans({
    roomName: input.room.name,
    roomPurpose: input.room.purpose ?? input.room.name,
    conceptName,
    styleKeywords,
    conceptMaterials,
    budget,
    dimensions,
    strategy
  });

  const results = await Promise.all(
    categoryPlans.map(async (plan) => {
      const search = await searchTavily({
        query: plan.query,
        maxResults: 5,
        includeRawContent: false,
        includeImages: true
      }).catch(() =>
        searchTavily({
          query: `${plan.category} home office ${plan.material} buy online`,
          maxResults: 5,
          includeRawContent: false,
          includeImages: true
        }).catch(() => null)
      );

      if (!search) return null;

      const viableResults = (search.results ?? []).filter((result) => isCategoryResult(plan.category, result));
      const primary = viableResults[0] ?? null;
      if (!primary) return null;
      const fallbackImage =
        primary?.images?.map(normalizeTavilyImageUrl).find(Boolean) ??
        search.images?.map(normalizeTavilyImageUrl).find(Boolean) ??
        undefined;
      const extract = primary?.url
        ? await extractTavily({
            urls: [primary.url],
            query: `Find price, dimensions, materials, finish, and practical buying notes for a ${plan.category.toLowerCase()} in an interior design sourcing workflow.`
          }).catch(() => null)
        : null;

      return buildTavilyProduct({
        plan,
        primary,
        alternatives: viableResults.slice(1, 3),
        fallbackImage,
        extract,
        roomSummary,
        opportunities,
        risks
      });
    })
  );

  const products = results.filter((result): result is ProductPlanItem => Boolean(result)).map((result) => productSchema.parse(result));

  if (!products.length) {
    throw new Error("Tavily did not return any usable product candidates.");
  }

  await logAiRun({
    roomId: input.room.id,
    serviceName: "Product Sourcing Agent",
    promptVersion: "product_sourcing_tavily_v1",
    provider: "tavily",
    modelName: "tavily-search-extract",
    status: "completed",
    inputPayload: {
      room_name: input.room.name,
      budget,
      concept_name: conceptName,
      category_queries: categoryPlans.map((plan) => ({ category: plan.category, query: plan.query }))
    },
    outputPayload: { products } as Json,
    latencyMs: Date.now() - startedAt
  });

  return products;
}

function buildTavilyCategoryPlans(input: {
  roomName: string;
  roomPurpose: string;
  conceptName: string;
  styleKeywords: string[];
  conceptMaterials: string[];
  budget: string;
  dimensions: Record<string, unknown>;
  strategy: string;
}) {
  const style = input.styleKeywords.join(" ");
  const materials = input.conceptMaterials.join(", ");
  const dimensionHint = Object.entries(input.dimensions)
    .map(([key, value]) => `${key} ${String(value)}`)
    .join(", ");
  const context = [style, materials].filter(Boolean).join(" ");

  return [
    {
      category: "Desk",
      query: `executive desk home office ${context} buy online site:target.com OR site:ikea.com OR site:wayfair.com OR site:westelm.com ${input.budget} ${dimensionHint}`.trim(),
      targetNote: "Choose a desk sized for dual monitors while preserving chair pull-back clearance.",
      material: pickMaterial(input.conceptMaterials, ["oak", "walnut", "wood", "white oak"]) ?? "wood veneer or solid wood",
      finish: pickFinish(input.conceptMaterials, ["oak", "walnut", "blackened", "plaster"]) ?? "warm natural finish"
    },
    {
      category: "Desk chair",
      query: `ergonomic desk chair designer home office ${context} buy online site:target.com OR site:ikea.com OR site:wayfair.com OR site:westelm.com ${input.budget}`.trim(),
      targetNote: "Prioritize ergonomic support and a silhouette refined enough for on-camera use.",
      material: pickMaterial(input.conceptMaterials, ["boucle", "linen", "leather", "rattan"]) ?? "upholstery with supportive frame",
      finish: "textured neutral upholstery"
    },
    {
      category: "Rug",
      query: `wool area rug home office refined neutral ${context} buy online site:target.com OR site:ikea.com OR site:wayfair.com OR site:westelm.com ${input.budget} ${dimensionHint}`.trim(),
      targetNote: "Size the rug to ground the desk zone rather than floating as a small accent.",
      material: pickMaterial(input.conceptMaterials, ["wool", "linen", "jute", "boucle"]) ?? "wool or wool blend",
      finish: "soft tonal pattern or low-contrast texture"
    },
    {
      category: "Table lamp",
      query: `table lamp task lighting desk aged brass ceramic ${context} buy online site:target.com OR site:ikea.com OR site:wayfair.com OR site:westelm.com ${input.budget}`.trim(),
      targetNote: "Add glare-controlled task lighting that also reads well on camera.",
      material: pickMaterial(input.conceptMaterials, ["travertine", "brass", "bronze", "ceramic"]) ?? "mixed stone or metal",
      finish: pickFinish(input.conceptMaterials, ["brass", "bronze", "blackened"]) ?? "aged metal finish"
    },
    {
      category: "Artwork",
      query: `oversized wall art neutral tonal study office ${context} buy online site:target.com OR site:art.com OR site:chairish.com OR site:minted.com ${input.budget}`.trim(),
      targetNote: "Choose art large enough to support the desk wall rather than many small pieces.",
      material: "framed print, canvas, or mixed media",
      finish: "muted tonal palette"
    },
    {
      category: "Plant",
      query: `sculptural indoor plant planter refined home office ${context} buy online site:target.com OR site:ikea.com OR site:thesill.com OR site:terrain.com ${input.budget}`.trim(),
      targetNote: "Use one architectural plant moment instead of filling the room with small decor.",
      material: "living greenery with ceramic or stone planter",
      finish: "organic green with matte vessel"
    }
  ];
}

function buildTavilyProduct(input: {
  plan: {
    category: string;
    query: string;
    targetNote: string;
    material: string;
    finish: string;
  };
  primary: {
    title?: string;
    url?: string;
    content?: string;
    images?: Array<{ url?: string; description?: string }>;
  } | null;
  alternatives: Array<{
    title?: string;
    url?: string;
  }>;
  fallbackImage?: string;
  extract: {
    results?: Array<{
      raw_content?: string;
      images?: Array<{ url?: string; description?: string }>;
    }>;
  } | null;
  roomSummary: string;
  opportunities: string[];
  risks: string[];
}): ProductPlanItem {
  const sourceText = [input.primary?.title, input.primary?.content, input.extract?.results?.[0]?.raw_content]
    .filter(Boolean)
    .join(" ");
  const name = cleanProductTitle(input.primary?.title, input.plan.category);
  const url = input.primary?.url;
  if (!url) {
    throw new Error(`No verified source URL for ${input.plan.category}.`);
  }
  const imageUrl =
    input.extract?.results?.[0]?.images?.map(normalizeTavilyImageUrl).find(Boolean) ??
    input.primary?.images?.map(normalizeTavilyImageUrl).find(Boolean) ??
    input.fallbackImage;
  const retailer = getRetailerName(url ?? "");
  const price = extractPrice(sourceText);

  return {
    category: input.plan.category,
    name,
    retailer,
    url,
    image_url: imageUrl,
    price,
    dimensions: buildProductDimensions(input.plan.category, input.plan.targetNote, sourceText),
    material: input.plan.material,
    finish: input.plan.finish,
    scores: buildTavilyScores(input.plan.category),
    reason_selected: buildProductReason({
      category: input.plan.category,
      roomSummary: input.roomSummary,
      opportunity: input.opportunities[0],
      targetNote: input.plan.targetNote
    }),
    risks: buildProductRisks(input.risks, sourceText),
    alternatives: input.alternatives.map((alternative) => cleanProductTitle(alternative.title, "Alternative")).slice(0, 2)
  };
}

function buildProductDimensions(category: string, targetNote: string, sourceText: string) {
  const dimensions = extractDimensionFragments(sourceText);
  const note = dimensions.length
    ? `${targetNote} Verify listed source dimensions before purchase.`
    : `${targetNote} Exact source dimensions were not confidently extracted; verify before purchase.`;

  return {
    note,
    ...(dimensions[0] ? { source_size: dimensions[0] } : {})
  };
}

function buildTavilyScores(category: string) {
  const scaleBias = category === "Desk" || category === "Rug" ? 82 : 78;
  return {
    style_fit: 84,
    scale_fit: scaleBias,
    budget_fit: 74,
    material_fit: 82,
    luxury_signal: 79
  };
}

function buildProductReason(input: {
  category: string;
  roomSummary: string;
  opportunity?: string;
  targetNote: string;
}) {
  const roomContext = input.opportunity || input.roomSummary || "the diagnosed room conditions";
  return `Selected as the ${input.category.toLowerCase()} candidate because it supports ${roomContext.toLowerCase()} and follows the concept's material and proportion direction. ${input.targetNote}`;
}

function buildProductRisks(roomRisks: string[], sourceText: string) {
  const risks = [
    roomRisks[0] || "Verify fit against real room clearances before ordering.",
    extractLeadTimeCue(sourceText) || "Stock and lead time should be verified directly with the retailer.",
    "Finish and color can read differently online than in the room's daylight."
  ];
  return risks.slice(0, 3);
}

function cleanProductTitle(title: string | undefined, fallback: string) {
  if (!title?.trim()) return fallback;
  return title.replace(/\s*\|\s*.+$/, "").trim();
}

function getRetailerName(url: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const root = hostname.split(".")[0] ?? "Retailer";
    return root
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return "Retailer";
  }
}

function normalizeTavilyImageUrl(image: unknown) {
  if (typeof image === "string" && /^https?:\/\//i.test(image)) return image;
  const record = asRecord(image);
  const url = typeof record.url === "string" ? record.url : "";
  return /^https?:\/\//i.test(url) ? url : undefined;
}

function isCategoryResult(category: string, result: { title?: string; url?: string; content?: string }) {
  if (!result.url || !result.title) return false;
  if (!isRetailerUrl(result.url)) return false;
  const text = `${result.title} ${result.url}`.toLowerCase();
  const terms = categoryTerms(category);
  return terms.some((term) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, "i").test(text));
}

function isRetailerUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return [
      "target.com",
      "ikea.com",
      "wayfair.com",
      "westelm.com",
      "article.com",
      "rejuvenation.com",
      "luluandgeorgia.com",
      "chairish.com",
      "art.com",
      "minted.com",
      "thesill.com",
      "terrain.com",
      "potterybarn.com",
      "crateandbarrel.com"
    ].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function categoryTerms(category: string) {
  switch (category.toLowerCase()) {
    case "desk":
      return ["desk", "writing table", "work table"];
    case "desk chair":
      return ["desk chair", "office chair", "task chair", "ergonomic chair"];
    case "rug":
      return ["rug", "area rug", "carpet"];
    case "table lamp":
      return ["table lamp", "desk lamp", "task lamp"];
    case "artwork":
      return ["art", "artwork", "print", "wall decor"];
    case "plant":
      return ["plant", "planter", "tree"];
    default:
      return [category.toLowerCase()];
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractPrice(text: string) {
  const match = text.match(/\$ ?(\d{2,5}(?:\.\d{2})?)/);
  return match ? Number(match[1]) : undefined;
}

function extractDimensionFragments(text: string) {
  return Array.from(text.matchAll(/\b\d{1,3}(?:\.\d+)?\s?(?:inches|inch|in|\"|ft|feet|cm)\b/gi))
    .map((match) => match[0])
    .slice(0, 3);
}

function extractLeadTimeCue(text: string) {
  const match = text.match(/\b(?:lead time|ships in|delivery|made to order)[^.]{0,80}/i);
  return match?.[0]?.trim() || null;
}

function pickMaterial(materials: string[], preferredTerms: string[]) {
  const lowerMaterials = materials.map((material) => material.toLowerCase());
  const match = preferredTerms.find((term) => lowerMaterials.some((material) => material.includes(term)));
  return match ? materials.find((material) => material.toLowerCase().includes(match)) ?? null : null;
}

function pickFinish(materials: string[], preferredTerms: string[]) {
  const lowerMaterials = materials.map((material) => material.toLowerCase());
  const match = preferredTerms.find((term) => lowerMaterials.some((material) => material.includes(term)));
  if (!match) return null;
  if (match.includes("blackened")) return "blackened metal";
  if (match.includes("brass")) return "aged brass";
  if (match.includes("bronze")) return "blackened bronze";
  if (match.includes("plaster")) return "limewash or plaster-toned finish";
  return `${match} finish`;
}

export async function scaleAndFitEvaluator(input: {
  product: ProductPlanItem;
}): Promise<ProductPlanItem["scores"]> {
  return input.product.scores;
}

/**
 * Compute a hard object budget for a render: how many discrete furniture + decor
 * pieces this room and concept should carry. Driven by room size (floor area) ×
 * concept restraint × property tier register. Directly fixes the "too full"
 * render — a restraint concept in a small room gets a small budget, not
 * desk+lounge+credenza+plant+lamp+art.
 */
function computeObjectBudget(input: {
  floorAreaSqft: number | null;
  concept: unknown;
  tierInteriorCharacter?: string | null;
}) {
  const concept = asRecord(input.concept);
  const restraintText = [
    concept.design_thesis,
    concept.decor_direction,
    concept.layout_direction,
    ...(Array.isArray(concept.style_keywords) ? concept.style_keywords : []),
    ...(Array.isArray(concept.risk_profile) ? concept.risk_profile : [])
  ]
    .filter((v): v is string => typeof v === "string")
    .join(" ")
    .toLowerCase();

  const isRestraint = /restraint|quiet|uncluttered|minimal|negative space|pared|sparse|calm|edited|less is more|breathing room/.test(
    restraintText
  );
  const isLayered = /layered|maximal|collected|rich|abundant|gallery wall|eclectic|more is more|saturated/.test(restraintText);

  // Base cap by floor area (discrete furniture + decor objects visible in frame).
  const area = input.floorAreaSqft;
  let base = area == null ? 6 : area < 120 ? 4 : area < 200 ? 6 : area < 350 ? 8 : 10;

  let posture: "restraint" | "balanced" | "layered" = "balanced";
  if (isRestraint && !isLayered) {
    posture = "restraint";
    base = Math.max(3, base - 2);
  } else if (isLayered && !isRestraint) {
    posture = "layered";
    base = base + 1;
  }

  return {
    max_objects: base,
    posture,
    basis: `${area == null ? "unknown area" : `${area} sq ft`} × ${posture} concept${
      input.tierInteriorCharacter ? ` × tier: ${input.tierInteriorCharacter}` : ""
    }`,
    guidance:
      posture === "restraint"
        ? "Restraint concept: prefer proportion and negative space over object count. Do not add a piece just because it would be nice."
        : posture === "layered"
          ? "Layered concept: more objects are acceptable, but every added piece must earn its place and stay in scale."
          : "Balanced concept: a considered, non-crowded object count sized to the room."
  };
}

export async function renderPromptDirector(input: {
  roomId: string;
  sourcePhotoId?: string;
  moodBoardId?: string;
  room?: RoomLike;
  home?: HomeLike | null;
  analysis?: unknown;
  selectedMoodBoard?: MoodBoardLike | null;
  sourcePhoto?: PhotoLike | null;
  userInstructions?: string;
  skipCritic?: boolean;
  designPreferences?: { preference_type: string; label: string }[];
  provider?: GatewayProvider;
}): Promise<RenderPlan> {
  const provider = input.provider ?? "anthropic";
  const userInstructions = input.userInstructions?.trim() || null;
  const mockPlan = buildRenderPlanFixture({
    sourcePhotoId: input.sourcePhotoId,
    moodBoardId: input.moodBoardId,
    userInstructions
  });

  // Full context brain (Phase 4): property dossier, room intelligence + the
  // Phase 3 constraint set, taste graph, Phase 2 trend intelligence, and the
  // style library's lighting/luxury mechanics all reach the render director.
  const contextBrain = input.room
    ? buildContextBrain({ room: input.room, home: input.home, analysis: input.analysis, designPreferences: input.designPreferences })
    : null;
  const renderContextBrain = contextBrain ? compactContextBrainForRender(contextBrain) : null;
  const objectBudget = computeObjectBudget({
    floorAreaSqft: contextBrain?.room_intelligence.floor_area_sqft ?? null,
    concept: input.selectedMoodBoard?.concept_data,
    tierInteriorCharacter: renderContextBrain?.trend_intelligence?.tier_register?.interior_character ?? null
  });

  const generatePlan = (criticFeedback?: string) =>
    runStructuredTask({
      roomId: input.roomId,
      serviceName: criticFeedback ? "Render Prompt Director Regeneration" : "Render Prompt Director",
      provider,
      promptPath: "prompts/renders/compose-render-plan.v2.md",
      schemaName: "render_plan",
      schema: renderPlanJsonSchema,
      zodSchema: renderPlanSchema,
      maxTokens: 6144,
      taskInput: {
        task: "Create a render prompt plan for this room and source photo.",
        room_id: input.roomId,
        room: input.room,
        analysis: input.analysis,
        selected_mood_board: input.selectedMoodBoard,
        source_photo: input.sourcePhoto,
        source_photo_id: input.sourcePhotoId ?? "",
        mood_board_id: input.moodBoardId ?? "",
        context_brain: renderContextBrain,
        object_budget: objectBudget,
        user_regeneration_instructions: userInstructions,
        critic_feedback: criticFeedback ?? null,
        success_criteria: [
          "This is a photo edit of a real room, not a text-to-image generation: preserve walls, doors, windows, floor plane, ceiling, fixed architecture, and camera angle.",
          "Keep every no_go_zone and door clearance in room_intelligence.constraint_set clear; orient a call-room seat away from the window bank.",
          "Stay within object_budget; a restraint concept in a small room stays sparse.",
          "Name the exact surfaces being changed and what the light does to the materials.",
          "Honor the owner's regeneration instructions when provided, without violating the preservation constraints or the constraint set."
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

  let plan = await generatePlan();

  // Gated Render Critic (Phase 4): review the plan against the constraint set +
  // preservation contract + object budget BEFORE the image is generated. One
  // bounded regeneration on blocking violations, mirroring the concept critic.
  if (!input.skipCritic && contextBrain) {
    try {
      let critique = await critiqueRender({
        roomId: input.roomId,
        plan,
        contextBrain: renderContextBrain,
        objectBudget,
        userInstructions,
        provider
      });

      if (critique.blocking_violations.length) {
        const feedback = `The previous render plan had BLOCKING violations that must be fixed:\n${critique.blocking_violations
          .map((v) => `- ${v}`)
          .join("\n")}\nRe-plan so none remain, without violating the preservation contract or the object budget.`;
        plan = await generatePlan(feedback);
        critique = await critiqueRender({
          roomId: input.roomId,
          plan,
          contextBrain: renderContextBrain,
          objectBudget,
          userInstructions,
          provider
        });
      }

      // Fold the critic's verdict into the plan's own critique so it is
      // persisted and visible, and floor the quality score when blocking
      // violations survived the one bounded retry (so a door-blocking or
      // backlit plan cannot present as a high-quality "current" render).
      const residual = critique.blocking_violations;
      plan = renderPlanSchema.parse({
        ...plan,
        critique: {
          notes: [
            ...plan.critique.notes,
            ...critique.notes,
            ...(residual.length ? residual.map((v) => `BLOCKING (unresolved): ${v}`) : ["Render Critic: no blocking spatial violations."])
          ],
          score: residual.length ? Math.min(plan.critique.score, 45) : plan.critique.score
        },
        quality_score: residual.length ? Math.min(plan.quality_score, 45) : plan.quality_score
      });
    } catch {
      // A critic failure must never block a completed render plan.
    }
  }

  return plan;
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
  currentRender?: unknown;
  chatThread?: unknown;
  lastRequestedChange?: string | null;
  memories?: unknown;
  provider?: GatewayProvider;
}): Promise<RevisionResult> {
  const provider = input.provider ?? "anthropic";
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

  const mockRevision = buildRevisionFixture({ message: input.message, revisionType: revision_type });

  if (!input.room) {
    return mockRevision;
  }

  return runStructuredTask({
    roomId: input.room.id,
    serviceName: "Revision Agent",
    provider,
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
      current_render: input.currentRender,
      chat_thread: input.chatThread,
      last_requested_change: input.lastRequestedChange,
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

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

const briefProductListSchema = z.object({
  products: z.array(productSchema)
});
// end of services
