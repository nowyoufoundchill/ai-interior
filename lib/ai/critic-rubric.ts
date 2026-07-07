/**
 * Critic Rubric
 *
 * Concrete numeric anchors behind designCriticSchema's 0-100 dimensions, so
 * scoring is reproducible rather than an arbitrary number the model picks per
 * run (the observed failure mode: real concept output scored quality_score
 * 9.3, i.e. a 0-10 convention, against a schema defined as 0-100 with no
 * anchor text explaining what the scale means).
 */

export const SCALE_ANCHORS = {
  "50": "Meets the schema but is generic — could apply to almost any room of this type. No specific reasoning tied to this room's dimensions, light, or brief.",
  "65": "Acceptable floor: specific to this room, respects constraints and dimensions, avoids banned cliches, but does not yet have a distinctive point of view.",
  "75": "Solid and buildable: a clear point of view, defensible rationale, no execution-risk red flags.",
  "85": "Distinctive and editorial: the concept/product/render would read as intentional and high-end to someone outside the project, and the rationale would survive pushback.",
  "95": "Reserved for rare, genuinely exceptional work — should not be awarded routinely; if most outputs score here, the rubric is being applied too loosely."
} as const;

export const CRITIC_DIMENSION_GUIDANCE: Record<string, string> = {
  style_clarity: "Is the style direction identifiable and consistent across every field, or do materials/furniture/art pull in different directions?",
  room_fit: "Does the concept respond to this specific room's diagnosed architecture, light, and existing conditions rather than being style-generic?",
  functional_fit: "Does the concept actually support the room's stated purpose (e.g. all-day work and calls), not just look right in a still image?",
  scale_realism: "Are furniture and layout directions realistic against the typed dimensions and room intelligence (circulation, opening count), not just plausible-sounding?",
  color_material_cohesion: "Do the palette and materials work together as a coherent family, per the 'material honesty over material density' and layering principles in the design portfolio?",
  luxury_signal: "Does the concept use real luxury mechanics (restraint, material honesty, lighting layering, patina) rather than naming luxury adjectives without substance?",
  originality: "Would this concept be distinguishable from the other concepts in the same set, and from a generic version of the same style, without seeing the label?",
  practicality: "Is the budget strategy, product direction, and maintenance implication realistic, not aspirational fantasy?",
  budget_alignment: "Does the spend concentration make sense (invest in the few pieces that carry the design, save on the rest) rather than being evenly or randomly distributed?",
  whole_home_alignment: "Does the concept respect the whole-home palette/material/tone notes rather than treating the room as an isolated project?"
};

export function scaleAnchorSummary(): string {
  return Object.entries(SCALE_ANCHORS)
    .map(([score, meaning]) => `${score}: ${meaning}`)
    .join("\n");
}
