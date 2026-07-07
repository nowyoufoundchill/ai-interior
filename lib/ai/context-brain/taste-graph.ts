/**
 * Taste Graph
 *
 * Structured representation of the owner's taste, with confidence levels and
 * provenance, so preference data can shape generation without being treated
 * as infallible. This is bootstrapped from the room/home brief fields today
 * (style_preferences, color_preferences, style_notes) since the persistent
 * `design_preferences` table exists in the schema but has no UI yet (see
 * BUILD_PLAN Phase 5). When that table is wired up, entries sourced from it
 * should carry higher confidence than brief-derived entries, since they
 * reflect confirmed reactions to real artifacts rather than a first brief.
 */

export type TastePreference = {
  label: string;
  confidence: number; // 0-1. Explicit brief wording = high; inferred = lower.
  source: "brief" | "design_preferences" | "inferred";
};

export type TasteGraph = {
  preferred_styles: TastePreference[];
  banned_cliches: string[];
  standing_constraints: string[];
  formality_balance: string;
  ai_may_disagree_when: string[];
};

const UNIVERSAL_BANNED_CLICHES = [
  "literal theme decor (nautical props, novelty signage, obviously staged vignettes)",
  "furniture or accessories selected to fill space rather than serve the room's actual use",
  "three concepts that differ only in accent color, not in structure, formality, or material logic",
  "generic marketing language in place of a specific design rationale ('elevated', 'timeless', 'curated' used without a concrete reason)"
];

export function buildTasteGraph(input: {
  stylePreferences?: unknown;
  colorPreferences?: unknown;
  constraints?: unknown;
  homeStyleNotes?: string | null;
  wholeHomeConstraints?: unknown;
}): TasteGraph {
  const stylePrefs = toStringArray(input.stylePreferences);
  const colorPrefs = toStringArray(input.colorPreferences);
  const roomConstraints = toStringArray(input.constraints);
  const homeConstraints = toStringArray(input.wholeHomeConstraints);

  const preferred_styles: TastePreference[] = [
    ...stylePrefs.map((label) => ({ label, confidence: 0.85, source: "brief" as const })),
    ...colorPrefs.map((label) => ({ label: `color direction: ${label}`, confidence: 0.7, source: "brief" as const }))
  ];

  if (input.homeStyleNotes) {
    preferred_styles.push({ label: `whole-home tone: ${input.homeStyleNotes}`, confidence: 0.75, source: "brief" as const });
  }

  return {
    preferred_styles,
    banned_cliches: UNIVERSAL_BANNED_CLICHES,
    standing_constraints: [...roomConstraints, ...homeConstraints],
    formality_balance: inferFormalityBalance(stylePrefs),
    ai_may_disagree_when: [
      "A literal reading of the brief would produce a cliche on the banned list above.",
      "A styling choice would violate a typed dimension, block a door/window, or ignore a stated circulation constraint.",
      "The room's diagnosed light, architecture, or material reality contradicts an assumption implied by the brief wording.",
      "When disagreeing, state it explicitly (e.g. in why_it_works or a risk note) rather than silently substituting a different direction."
    ]
  };
}

function inferFormalityBalance(stylePrefs: string[]): string {
  const text = stylePrefs.join(" ").toLowerCase();
  const formalSignals = ["executive", "tailored", "formal", "boardroom", "traditional"];
  const relaxedSignals = ["casual", "relaxed", "coastal", "easy", "laid-back"];

  const formalHits = formalSignals.filter((word) => text.includes(word)).length;
  const relaxedHits = relaxedSignals.filter((word) => text.includes(word)).length;

  if (formalHits > relaxedHits) return "Lean tailored/formal, but avoid stiffness — this should still feel lived-in, not showroom.";
  if (relaxedHits > formalHits) return "Lean relaxed/casual, but avoid looking under-designed — restraint should read as intentional, not unfinished.";
  return "Balance formality and ease deliberately; do not default to the safest middle option without a stated reason.";
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (typeof value === "string" && value.trim()) return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}
