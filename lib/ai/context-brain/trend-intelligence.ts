/**
 * Trend Intelligence
 *
 * This is the layer that lets the design brain execute like a designer who
 * *reads*, not just a model with good general taste. The property dossier
 * (property-dossier.ts) captures what is *durably* true about a region
 * (climate, vernacular). This module captures what is *currently* true about
 * taste — the dated, sourced trend picture that separates "on-brief for 2026"
 * from "generic luxury."
 *
 * Design decisions this file encodes on purpose:
 *
 * 1. Taste is DATA, not prose in a prompt. A real research pass (e.g. a deep
 *    trend report on South Carolina luxury interiors) is distilled into a
 *    structured `RegionalTrendBrief` — directional theses, a materially
 *    specific palette/material vocabulary, a sub-regional split, a price-tier
 *    register, and an explicit "reads wrong now" rejection list.
 *
 * 2. Every trend carries its MECHANISM, not just its name. "Warm woods over
 *    stark white" is useless to a model as a slogan; "wood overtook white as
 *    the most popular cabinet finish because the market moved from flat
 *    minimalism to tactile warmth" is a rule it can reason with.
 *
 * 3. Taste has PROVENANCE and an EXPIRY. Each brief is stamped with its
 *    sources, the date it was authored, and a `valid_through` year, so it can
 *    be trusted, audited, and deliberately refreshed rather than silently
 *    rotting. When `valid_through` passes, the resolver still returns the
 *    brief but flags it stale so the pipeline can down-weight it.
 *
 * 4. Trend is SEPARATE from vernacular and from the owner's taste graph, and
 *    it is LOWER priority than both room reality and the owner's confirmed
 *    preferences (see design-policy.ts). Trend informs the point of view; it
 *    never overrides a measurement, a diagnosed constraint, or a stated
 *    owner preference.
 *
 * Refresh workflow: to update taste for a new year, add a new brief with a new
 * `authored` date and `valid_through`, keep the old one for provenance, and
 * point the resolver at the newest matching entry. Do not silently rewrite the
 * meaning of an existing brief.
 */

export type PriceTierRegister = {
  tier: string;
  interior_character: string;
  spends_on: string[];
  trying_to_avoid: string;
};

export type RegionalTrendBrief = {
  brief_id: string;
  region_match: string;
  authored: string; // ISO date the brief was distilled from research
  valid_through: number; // last year this brief should be treated as current
  confidence: "high" | "medium" | "low";
  sources: string[];

  /** The one-line direction of travel for the year. */
  headline: string;

  /**
   * Directional theses with their mechanism. `move` is the shift, `because`
   * is why it reads expensive / current, `instead_of` is the dated version it
   * replaces. This is the core of what makes a concept feel authored.
   */
  directional_theses: { move: string; because: string; instead_of: string }[];

  /** Materially specific, not adjectives. */
  material_vocabulary: string[];
  palette_direction: string[];

  /**
   * Sub-regional split. The same state is not one taste market; the brain
   * should know which vocabulary applies to this address.
   */
  sub_regions: { name: string; region_match: string; reads_as: string; palette_bias: string[] }[];

  /** The price-tier ladder: what each tier expects and, crucially, avoids. */
  price_tier_register: PriceTierRegister[];

  /**
   * Regionally-current rejection list. Not timeless cliche (that lives in the
   * taste graph's banned_cliches) — this is "what reads dated or wrong *now*."
   */
  reject_now: string[];

  /** Provenance the market can actually be sourced from — makers, not vibes. */
  regional_makers: string[];
};

const TREND_BRIEFS: RegionalTrendBrief[] = [
  {
    brief_id: "sc-luxury-2026",
    region_match:
      "south carolina|charleston|lowcountry|isle of palms|sullivan's island|kiawah|seabrook|bluffton|palmetto bluff|greenville|lake keowee|okatie|johns island",
    authored: "2026-07-08",
    valid_through: 2027,
    confidence: "high",
    sources: [
      "Houzz 2026 Kitchen Trends Study (1,780 homeowners) + 2026 Houzz & Home",
      "AIA Home Design Trends Survey (300+ residential firms)",
      "Sherwin-Williams 2026 (Universal Khaki) + Benjamin Moore 2026 (Silhouette AF-655)",
      "SC luxury listing + local portfolio review (Charleston, Bluffton, Lake Keowee)",
      "FEMA flood-resistant material guidance; EPA indoor RH 30-50%"
    ],
    headline:
      "2026 SC luxury is not theatrical maximalism — it is warm, regional, resilient, and integrated. The winning houses are the most coherent, not the most decorated.",
    directional_theses: [
      {
        move: "Warm woods and stained oak/walnut over stark all-white schemes.",
        because:
          "In the 2026 Houzz kitchen study wood overtook white as the most popular cabinet finish; the market has moved from flat minimalism to tactile warmth. Warm wood reads current; all-white reads 2018.",
        instead_of: "Cool grey-and-white minimalism and stark painted millwork."
      },
      {
        move: "Textured natural finishes over flat drywall — lime/Venetian plaster, limewash, handmade tile, grasscloth, bouclé.",
        because:
          "The year's defining move is 'quiet richness': luxury read through craft and tactility, not shine. A single hand-troweled plaster plane reads more expensive than any glossy feature wall.",
        instead_of: "Flat painted drywall feature walls and high-gloss lacquer."
      },
      {
        move: "Warm, grounded neutrals — khaki, warm taupe, oyster, sand, marsh green, olive, honey, soft brown, charcoal-brown.",
        because:
          "Sherwin-Williams (Universal Khaki) and Benjamin Moore (Silhouette, a refined charcoal-undertone brown) both anchor 2026 in warm classic neutrals. These mediate SC's intense daylight and marsh/oyster surroundings; icy whites and grey fight the light.",
        instead_of: "The 2020-2023 grey era and hyper-saturated statement color."
      },
      {
        move: "Concealed storage, sculleries, and integrated millwork over visual clutter.",
        because:
          "'Hidden, seamless, integrated' is the 2026 zeitgeist and built-ins are a growing AIA feature; bespoke millwork is now the core differentiator in the upper tiers, not a nice extra.",
        instead_of: "Open shelving as decoration and freestanding statement furniture as the main gesture."
      },
      {
        move: "Wellness, resilience, and smart systems integrated into the architecture, not added as gadgets.",
        because:
          "Resilience is now a design trend in its own right (hurricane-resistant design, backup power, humidity control, one interoperable control layer). At this level a stack of unrelated apps reads unfinished.",
        instead_of: "Bolt-on tech, exposed equipment, and wellness as an afterthought amenity."
      },
      {
        move: "A layered stone strategy, not marble everywhere.",
        because:
          "Engineered quartz still leads heavy-use zones but buyers are more selective; quartzite or a dramatic natural stone earns a secondary focal point, with timber/butcher-block contrast at islands. Veined patterns still preferred.",
        instead_of: "Generic white quartz on every surface."
      }
    ],
    material_vocabulary: [
      "white oak (wide plank)",
      "medium-stained oak",
      "walnut accents",
      "pecky cypress moments",
      "tongue-and-groove ceilings",
      "lime / Venetian plaster",
      "limewash walls",
      "travertine (honed)",
      "quartzite / veined natural stone",
      "handmade / zellige-adjacent tile",
      "grasscloth",
      "bouclé",
      "linen",
      "aged / unlacquered brass",
      "hand-finished bronze"
    ],
    palette_direction: [
      "khaki",
      "warm taupe",
      "oyster",
      "sand",
      "marsh green",
      "olive",
      "honey",
      "ochre",
      "soft brown",
      "charcoal-brown",
      "plaster white"
    ],
    sub_regions: [
      {
        name: "Coastal Lowcountry & islands",
        region_match:
          "charleston|isle of palms|sullivan's island|kiawah|seabrook|folly|johns island|bluffton|palmetto bluff|lowcountry",
        reads_as:
          "Resilience with elegance. Updated Lowcountry / coastal-contemporary: deep porches, elevated living, marsh/ocean orientation, pecky cypress or T&G detail, lime/Venetian plaster, travertine in wet zones, wide oak, resilient assemblies. Stay luminous but textured.",
        palette_bias: ["sand", "oyster", "khaki", "driftwood", "marsh green", "rusted brass", "plaster white"]
      },
      {
        name: "Inland / Upstate & lake",
        region_match: "greenville|lake keowee|upstate|midlands|okatie",
        reads_as:
          "Experience-rich retreat living. Lake-modern / urban-transitional: more stone, heavier timber, large glass, gallery-scale walls for art, generous entertaining and recreation. Tolerates deeper contrast and richer wood.",
        palette_bias: ["warm brown", "forest green", "stone grey", "charcoal", "gallery white", "richer woods"]
      }
    ],
    price_tier_register: [
      {
        tier: "$1m-$3m",
        interior_character:
          "Edited luxury: cleaner transitional/coastal, one or two signature finishes rather than whole-house authorship.",
        spends_on: [
          "better cabinetry and warm wood tones",
          "one bespoke moment (plaster wall, millwork niche)",
          "smart thermostat + an upgraded outdoor room",
          "designer lighting in key rooms"
        ],
        trying_to_avoid: "looking 'mass luxury' / builder-grade."
      },
      {
        tier: "$3m-$6m",
        interior_character:
          "Authored, full-service design becomes common; stronger local identity; custom joinery and outdoor entertaining expected.",
        spends_on: [
          "scullery / secondary prep",
          "custom millwork and higher-grade stone/tile",
          "tuned lighting program",
          "screened porches, pool house, EV readiness, resilience package"
        ],
        trying_to_avoid: "looking generic or superficially regional."
      },
      {
        tier: "$6m-$10m",
        interior_character:
          "Fully authored: architecture, interiors, lighting, art, and landscape conceived as one system with a climate-engineering layer.",
        spends_on: [
          "artisan plaster, pecky cypress/oak, collection-grade stone",
          "elevators, backup power, advanced automation",
          "wellness rooms, expansive glazing, choreographed landscape"
        ],
        trying_to_avoid:
          "anything unconsidered — mismatched light temperatures, visible equipment, weak trim hierarchy, awkward indoor-outdoor transitions."
      }
    ],
    reject_now: [
      "all-white / grey-and-white minimalism (reads dated in 2026)",
      "flat drywall feature walls where a plaster/limewash plane is expected",
      "literal nautical or tiki 'beach house' theming on the coast",
      "generic white quartz on every surface with no stone hierarchy",
      "cold high-gloss ultra-modern finishes that ignore regional material vocabulary",
      "bolt-on smart gadgets and visible equipment presented as a feature",
      "oversized statement furniture used to fill a room instead of proportion and restraint"
    ],
    regional_makers: [
      "Master of Plaster (Landrum) — slaked-lime plaster systems",
      "Urban Electric (North Charleston) — bench-made, customizable lighting",
      "Mulberry Millworks / Charleston Custom Cabinetry / Elliott Brothers — Lowcountry millwork & sculleries",
      "Village Millworks (Greenville) — Upstate custom cabinetry",
      "FLOW Gallery + Workshop, Artists of the Bluff, Art & Design Atelier — commissioned/curated local art"
    ]
  }
];

export type ResolvedTrendBrief = RegionalTrendBrief & {
  is_stale: boolean;
  matched_sub_region: RegionalTrendBrief["sub_regions"][number] | null;
};

/**
 * Resolve the trend brief for a region and year. Returns null when no brief
 * matches (the pipeline then runs on vernacular + style library alone, rather
 * than inventing a trend picture). Picks the most specific sub-region and
 * flags staleness against `valid_through`.
 */
export function resolveRegionalTrendBrief(
  region?: string | null,
  year: number = new Date().getFullYear()
): ResolvedTrendBrief | null {
  const haystack = (region ?? "").toLowerCase();
  if (!haystack) return null;

  // Refresh ritual: multiple briefs may match a region across years. Always
  // resolve to the NEWEST matching brief by `authored` date, so appending a new
  // annual brief (never overwriting the old one) automatically supersedes it
  // while the prior brief is retained for audit/provenance. See docs/runbooks/TREND_REFRESH.md.
  const brief = TREND_BRIEFS.filter((entry) =>
    entry.region_match.split("|").some((pattern) => haystack.includes(pattern))
  ).sort((a, b) => b.authored.localeCompare(a.authored))[0];
  if (!brief) return null;

  const matched_sub_region =
    brief.sub_regions.find((sub) => sub.region_match.split("|").some((p) => haystack.includes(p))) ?? null;

  return { ...brief, is_stale: year > brief.valid_through, matched_sub_region };
}

/**
 * Map an owner-facing home price band to the tier register key. Kept separate
 * from the room furnishing budget: this is about the *property* tier, which
 * sets the level of authorship expected. Falls back to the middle register
 * when the band is unknown, since that is the safest register for SC luxury.
 */
export function resolveTierRegister(
  brief: RegionalTrendBrief,
  homeValueBand?: string | null
): PriceTierRegister {
  const tiers = brief.price_tier_register;
  const bottom = tiers[0];
  const middle = tiers[1] ?? bottom;
  const top = tiers[tiers.length - 1];

  // Parse the dollar figures out of the band (e.g. "$3m-$6m", "$9.5m") and use
  // the lower bound, which places both single values and ranges correctly.
  const figures = (String(homeValueBand ?? "").match(/(\d+(?:\.\d+)?)\s*m/gi) ?? []).map((s) => parseFloat(s));
  if (!figures.length) return middle; // unknown band -> safest SC register

  const low = Math.min(...figures);
  if (low >= 6) return top;
  if (low >= 3) return middle;
  return bottom;
}

/**
 * Compact the brief for injection into a generation task. Keeps the model's
 * working set tight: the direction of travel, the mechanism-bearing theses,
 * the applicable sub-region, and the current rejection list — the parts that
 * change *judgment*, not the full provenance dump.
 */
/**
 * Compact the brief for the *diagnosis* pass. Diagnosis should read the room in
 * current-market terms — e.g. flag that an all-white shell "reads dated in
 * 2026" — so it needs the direction of travel and the rejection list, but not
 * the palette/material vocabulary or maker provenance (those are generation
 * concerns). Deliberately smaller than the generation slice.
 */
export function compactTrendBriefForDiagnosis(resolved: ResolvedTrendBrief) {
  return {
    as_of: `${resolved.brief_id} (authored ${resolved.authored}${resolved.is_stale ? ", STALE — refresh" : ""})`,
    headline: resolved.headline,
    direction_of_travel: resolved.directional_theses.map((t) => ({ move: t.move, instead_of: t.instead_of })),
    reads_dated_now: resolved.reject_now,
    applies_here: resolved.matched_sub_region
      ? { sub_region: resolved.matched_sub_region.name, reads_as: resolved.matched_sub_region.reads_as }
      : null,
    // Diagnosis names what currently reads wrong; it does not prescribe the
    // fix — that is the concept director's job, downstream of the decision
    // hierarchy. Trend never overrides a measurement or a diagnosed constraint.
    usage_note:
      "Use this only to frame existing conditions in current-market terms (e.g. note when a finish reads dated). Do not prescribe a redesign or override a measured constraint."
  };
}

export function compactTrendBriefForGeneration(resolved: ResolvedTrendBrief, homeValueBand?: string | null) {
  const tier = resolveTierRegister(resolved, homeValueBand);
  return {
    as_of: `${resolved.brief_id} (authored ${resolved.authored}${resolved.is_stale ? ", STALE — refresh" : ""})`,
    headline: resolved.headline,
    directional_theses: resolved.directional_theses.slice(0, 6),
    applies_here: resolved.matched_sub_region
      ? { sub_region: resolved.matched_sub_region.name, reads_as: resolved.matched_sub_region.reads_as, palette_bias: resolved.matched_sub_region.palette_bias }
      : null,
    tier_register: { tier: tier.tier, interior_character: tier.interior_character, trying_to_avoid: tier.trying_to_avoid, spends_on: tier.spends_on.slice(0, 3) },
    material_vocabulary: resolved.material_vocabulary.slice(0, 10),
    palette_direction: resolved.palette_direction.slice(0, 8),
    reject_now: resolved.reject_now,
    regional_makers: resolved.regional_makers.slice(0, 3)
  };
}
