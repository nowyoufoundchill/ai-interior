import type { MoodBoardConcept } from "@/lib/schemas";

/**
 * Concept Coherence (Phase 6)
 *
 * The approved direction is the sole downstream contract, so it must never be
 * internally incoherent. This is the systemic guard for the class of bug that
 * shipped once: a locked concept whose thesis read "…not as a **ocean esque**
 * focal plane but as a soft **oceanwash**-plastered backdrop" — a garbled
 * word-substitution of "dark"/"limewash" that contradicted the concept's own
 * materials list.
 *
 * These checks are DETERMINISTIC on purpose: they need no model call, so they
 * run in mock mode and in a route hot path, and they cannot themselves
 * hallucinate a contradiction. They catch broken/garbled finish tokens,
 * self-contradiction against the materials list, and degenerate/duplicated
 * fields — the concrete failure modes — rather than making a taste judgment
 * (that is the Critic's job).
 */

// Recognized finish/wash tokens. A "*wash" or "*-plaster(ed)" token in the
// narrative that is NOT here and NOT present in the concept's own materials
// list is treated as a probable garbled token (the oceanwash class).
const KNOWN_FINISHES = [
  "limewash",
  "whitewash",
  "colorwash",
  "greywash",
  "graywash",
  "plaster",
  "plastered",
  "venetian plaster",
  "lime plaster",
  "microcement",
  "tadelakt",
  "stucco"
];

const NARRATIVE_FIELDS: (keyof MoodBoardConcept)[] = [
  "design_thesis",
  "furniture_direction",
  "layout_direction",
  "lighting_direction",
  "art_direction",
  "decor_direction",
  "plant_direction",
  "budget_strategy",
  "why_it_works",
  "why_user_may_reject_it"
];

export type CoherenceViolation = {
  code: "garbled_finish_token" | "empty_field" | "degenerate_palette" | "duplicated_narrative" | "empty_materials";
  message: string;
  field?: string;
  token?: string;
  suggestion?: string;
};

export type CoherenceResult = {
  coherent: boolean;
  violations: CoherenceViolation[];
};

function materialsList(concept: MoodBoardConcept): string[] {
  return (concept.materials ?? []).filter((m): m is string => typeof m === "string").map((m) => m.toLowerCase());
}

/** Extract "*wash" / "*plaster(ed)" finish tokens from a piece of narrative. */
function finishTokens(text: string): string[] {
  const matches = text.toLowerCase().match(/\b[a-z]+(?:wash|plastered|plaster)\b/g) ?? [];
  return Array.from(new Set(matches));
}

function isKnownFinish(token: string, materials: string[]): boolean {
  if (KNOWN_FINISHES.some((f) => token === f || token.includes(f) || f.includes(token))) return true;
  // Present in the concept's own materials list (as a token or substring) → consistent.
  return materials.some((m) => m.includes(token) || token.includes(m.replace(/\s+/g, "")));
}

/** Closest real finish to substitute for a garbled token: prefer one the
 *  concept already lists in materials, else the nearest known finish. */
function suggestFinish(materials: string[]): string | null {
  const listed = materials.find((m) => KNOWN_FINISHES.some((f) => m.includes(f)));
  if (listed) {
    const hit = KNOWN_FINISHES.find((f) => listed.includes(f));
    return hit ?? listed;
  }
  return null;
}

export function assessConceptCoherence(concept: MoodBoardConcept): CoherenceResult {
  const violations: CoherenceViolation[] = [];
  const materials = materialsList(concept);

  if (!materials.length) {
    violations.push({ code: "empty_materials", message: "Concept has no materials listed — nothing downstream can execute it." });
  }

  // Garbled / self-contradictory finish tokens (the oceanwash class).
  for (const field of NARRATIVE_FIELDS) {
    const value = concept[field];
    if (typeof value !== "string") continue;
    for (const token of finishTokens(value)) {
      if (!isKnownFinish(token, materials)) {
        const suggestion = suggestFinish(materials);
        violations.push({
          code: "garbled_finish_token",
          field,
          token,
          suggestion: suggestion ?? undefined,
          message: `"${field}" references "${token}", which is not a recognized finish and is not in this concept's materials list${
            suggestion ? ` — likely a garbled token for "${suggestion}"` : ""
          }. The approved direction would contradict its own materials.`
        });
      }
    }
  }

  // Degenerate / empty required narrative.
  for (const field of ["concept_name", "design_thesis", "why_it_works"] as (keyof MoodBoardConcept)[]) {
    const value = concept[field];
    if (typeof value === "string" && !value.trim()) {
      violations.push({ code: "empty_field", field: String(field), message: `"${String(field)}" is empty.` });
    }
  }

  // Degenerate palette (all identical hexes or fewer than two colors).
  const hexes = (concept.palette ?? []).map((p) => (typeof p?.hex === "string" ? p.hex.toLowerCase() : "")).filter(Boolean);
  if (hexes.length >= 2 && new Set(hexes).size === 1) {
    violations.push({ code: "degenerate_palette", message: "Every palette swatch has the same hex value — the palette is not a real color story." });
  }

  // Verbatim-duplicated narrative (thesis === why_it_works is a slop signal).
  if (
    typeof concept.design_thesis === "string" &&
    typeof concept.why_it_works === "string" &&
    concept.design_thesis.trim().length > 0 &&
    concept.design_thesis.trim() === concept.why_it_works.trim()
  ) {
    violations.push({ code: "duplicated_narrative", message: "design_thesis and why_it_works are identical text — the concept is not fully authored." });
  }

  return { coherent: violations.length === 0, violations };
}

/**
 * Bounded, deterministic repair pass (single pass, no loop). Only repairs what
 * it can do safely: substitutes a garbled finish token with the concept's own
 * listed finish. Anything it cannot safely repair is left for the assessor to
 * still flag (so approval stays blocked rather than silently "fixed" wrong).
 */
export function repairConceptCoherence(concept: MoodBoardConcept): { concept: MoodBoardConcept; repaired: string[] } {
  const materials = materialsList(concept);
  const suggestion = suggestFinish(materials);
  const repaired: string[] = [];
  if (!suggestion) return { concept, repaired };

  const next: MoodBoardConcept = { ...concept };
  for (const field of NARRATIVE_FIELDS) {
    const value = next[field];
    if (typeof value !== "string") continue;
    let updated = value;
    for (const token of finishTokens(value)) {
      if (!isKnownFinish(token, materials)) {
        const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
        updated = updated.replace(re, suggestion);
        repaired.push(`${String(field)}: "${token}" → "${suggestion}"`);
      }
    }
    if (updated !== value) {
      (next[field] as string) = updated;
    }
  }
  return { concept: next, repaired };
}

/** Owner-facing message for a blocked approval. */
export function coherenceBlockMessage(result: CoherenceResult): string {
  const lead = "This concept can't be approved yet — it isn't internally coherent:";
  const items = result.violations.map((v) => `• ${v.message}`).join("\n");
  return `${lead}\n${items}\nRe-harmonize the concept (or edit it) to resolve this, then approve.`;
}
