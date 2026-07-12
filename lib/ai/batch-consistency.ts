import type { Json } from "@/types/database";

/**
 * P0.3 batch consistency evaluation (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md
 * §P0.3 task 10 + strict gate).
 *
 * A batch renders one approved direction across several room photos. The renders
 * should read as the SAME room in the SAME design — a shared palette, anchor
 * furniture, art direction, and material story. This evaluator scores that
 * across the completed renders and FLAGS divergence; it never erases or
 * downgrades a good render (the artifact contract keeps every successful
 * perspective usable).
 *
 * Deterministic and provider-free: it works from the persisted render plans, so
 * it is stable in mock mode (all renders derive from the one locked concept via
 * the one director → they share tokens → the rubric passes) and still surfaces a
 * genuine live divergence (one perspective drifting to a different palette or
 * anchor lowers that axis's shared ratio → flagged for owner choice).
 */

export interface RenderForConsistency {
  id: string;
  source_photo_id: string | null;
  mood_board_version: number | null;
  preservation_constraints: Json;
  transformation_instructions: Json;
  negative_instructions: Json;
  render_prompt: string | null;
}

export interface ConsistencyAxis {
  axis: string;
  passed: boolean;
  shared_ratio: number;
  detail: string;
}

export interface BatchConsistency {
  passed: boolean;
  evaluated_count: number;
  axes: ConsistencyAxis[];
  /** Owner-safe, per-photo notes about a perspective that diverges from the set. */
  flags: string[];
}

// Axis keyword dictionaries. A render "expresses" an axis token when the token
// appears anywhere in its plan text. Shared ratio = tokens present in EVERY
// render / tokens present in ANY render, per axis.
const AXIS_TOKENS: Record<string, string[]> = {
  palette: [
    "white", "ivory", "cream", "beige", "greige", "taupe", "warm", "cool", "neutral",
    "charcoal", "black", "navy", "blue", "green", "sage", "olive", "terracotta", "rust",
    "brass", "gold", "amber", "muted", "moody", "bright", "airy"
  ],
  anchor_furniture: [
    "desk", "sofa", "sectional", "chair", "armchair", "table", "bed", "shelving", "bookcase",
    "credenza", "cabinet", "console", "rug", "ottoman", "bench", "nightstand", "dresser"
  ],
  art_direction: [
    "art", "artwork", "print", "painting", "gallery", "frame", "poster", "wall",
    "sculpture", "mirror", "photograph"
  ],
  material_story: [
    "wood", "oak", "walnut", "linen", "cotton", "wool", "leather", "stone", "marble",
    "brass", "metal", "glass", "ceramic", "rattan", "velvet", "boucle", "concrete"
  ]
};

const PASS_THRESHOLD = 0.5;

function planText(render: RenderForConsistency): string {
  const parts: string[] = [];
  const push = (value: Json) => {
    if (typeof value === "string") parts.push(value);
    else if (Array.isArray(value)) value.forEach((v) => typeof v === "string" && parts.push(v));
  };
  push(render.preservation_constraints);
  push(render.transformation_instructions);
  push(render.negative_instructions);
  if (render.render_prompt) parts.push(render.render_prompt);
  return parts.join(" ").toLowerCase();
}

function axisTokens(text: string, tokens: string[]): Set<string> {
  const present = new Set<string>();
  for (const token of tokens) {
    if (new RegExp(`\\b${token}\\b`, "i").test(text)) present.add(token);
  }
  return present;
}

export function evaluateBatchConsistency(
  renders: RenderForConsistency[],
  options: { lockedVersion?: number | null } = {}
): BatchConsistency {
  const evaluatedCount = renders.length;
  const flags: string[] = [];

  // A render carrying a different concept version than the batch's approved one
  // is the clearest art-direction/material divergence — surface it explicitly.
  if (options.lockedVersion != null) {
    for (const render of renders) {
      if (render.mood_board_version != null && render.mood_board_version !== options.lockedVersion) {
        flags.push(`A perspective was rendered from an older direction (v${render.mood_board_version}).`);
      }
    }
  }

  if (evaluatedCount < 2) {
    // Nothing to compare against — a single render is trivially self-consistent.
    return {
      passed: flags.length === 0,
      evaluated_count: evaluatedCount,
      axes: Object.keys(AXIS_TOKENS).map((axis) => ({
        axis,
        passed: true,
        shared_ratio: 1,
        detail: evaluatedCount === 0 ? "No completed renders yet." : "Single perspective — nothing to compare."
      })),
      flags
    };
  }

  const texts = renders.map(planText);

  const axes: ConsistencyAxis[] = Object.entries(AXIS_TOKENS).map(([axis, tokens]) => {
    const perRender = texts.map((text) => axisTokens(text, tokens));
    const union = new Set<string>();
    perRender.forEach((set) => set.forEach((t) => union.add(t)));
    const intersection = [...union].filter((t) => perRender.every((set) => set.has(t)));
    const sharedRatio = union.size === 0 ? 1 : intersection.length / union.size;
    const passed = sharedRatio >= PASS_THRESHOLD;
    if (!passed) {
      flags.push(`Perspectives differ on ${axis.replace(/_/g, " ")} — review before sharing.`);
    }
    return {
      axis,
      passed,
      shared_ratio: Number(sharedRatio.toFixed(2)),
      detail: union.size === 0 ? "No axis cues detected." : `${intersection.length}/${union.size} cues shared across perspectives.`
    };
  });

  return {
    passed: axes.every((a) => a.passed) && flags.length === 0,
    evaluated_count: evaluatedCount,
    axes,
    flags
  };
}
