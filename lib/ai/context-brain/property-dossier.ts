/**
 * Property Dossier
 *
 * Durable, region-level design intelligence that should NOT be re-derived by a
 * model on every call. This is the "what would feel wrong here" layer: climate,
 * material behavior, architectural vernacular, and the local luxury register.
 *
 * This is looked up by region string and merged with live home/room data at
 * call time. It is intentionally static, versioned data (edit via new entries
 * or fields, not silent rewrites of meaning) rather than something fetched
 * live per-request.
 */

export type PropertyDossier = {
  region_match: string;
  climate_notes: string[];
  material_behavior: string[];
  architectural_vernacular: string[];
  local_luxury_register: string;
  what_reads_as_wrong_here: string[];
  geography_informed_moves: string[];
};

const DOSSIERS: PropertyDossier[] = [
  {
    region_match: "isle of palms|charleston|lowcountry|sea island|folly beach|kiawah|sullivan's island",
    climate_notes: [
      "High humidity and salt air year-round; UV exposure is strong for most of the year.",
      "Storm/hurricane season (roughly June-November) means window and door treatments should assume real weather exposure, not just decorative light control.",
      "Daylight is typically strong and warm-toned; glare and heat gain through unshaded glass are real, not theoretical, concerns."
    ],
    material_behavior: [
      "Unsealed brass and unlacquered metals will patina quickly in salt air — treat patina as a feature to plan for, not a defect to avoid.",
      "Solid wood and veneers should be specified with humidity movement in mind; avoid material choices that assume a dry, stable climate.",
      "Natural fiber rugs (jute, sisal) perform differently in humidity than in dry climates and can feel damp underfoot if not paired with proper ventilation."
    ],
    architectural_vernacular: [
      "Charleston single-house and Lowcountry vernacular: raised foundations, deep porches/piazzas, large operable windows, symmetrical facades, restrained ornament.",
      "Historic Charleston material palette leans toward tabby, stucco, painted brick, heart pine, and wrought iron rather than glossy resort finishes.",
      "Regional interiors historically favor architectural proportion and craft over decorative abundance — the 'good bones first' bias is real and should inform furniture scale decisions."
    ],
    local_luxury_register: "Quiet and architectural, not resort-glossy. In this market, luxury reads through material honesty, restraint, and proportion — not through high-shine finishes, literal nautical motifs, or maximal styling. A room can look expensive in this region while looking almost austere by Miami or Vegas standards.",
    what_reads_as_wrong_here: [
      "Literal nautical decor: rope, anchors, ship wheels, shells-as-styling, stripe-heavy 'beach house' cliches.",
      "High-gloss, cold, ultra-modern finishes that ignore the historic material vocabulary of the region.",
      "Tropical/resort styling (rattan-as-theme, tiki references) that belongs to a different coastal geography.",
      "Overly formal, heavy European traditional detailing that fights the region's lighter, breezier architectural instinct."
    ],
    geography_informed_moves: [
      "Favor natural light control (tailored shades, deep-toned interiors) over heavy drapery loads.",
      "Let material honesty (real wood, real linen, real stone) carry the luxury signal rather than ornament density.",
      "Where a client brief asks for something generically 'beachy,' interpret it through Lowcountry restraint rather than tourist-coastal literalism unless explicitly told otherwise."
    ]
  },
  {
    region_match: "default",
    climate_notes: ["No region-specific climate data available; treat material and light guidance as general-purpose."],
    material_behavior: ["Default to standard interior material assumptions; verify local climate factors before finalizing exterior-adjacent material choices."],
    architectural_vernacular: ["No confirmed regional vernacular; rely on the room diagnosis and brief for architectural cues."],
    local_luxury_register: "Calm, editorial, and restrained by default: prioritize proportion, material honesty, and coherate rather than any specific regional trope.",
    what_reads_as_wrong_here: ["Generic decorating language not grounded in the room's actual architecture or the owner's stated brief."],
    geography_informed_moves: ["Ground every recommendation in the room's real dimensions, light, and constraints since no regional dossier is confirmed."]
  }
];

export function resolvePropertyDossier(region?: string | null): PropertyDossier {
  const haystack = (region ?? "").toLowerCase();

  for (const dossier of DOSSIERS) {
    if (dossier.region_match === "default") continue;
    const patterns = dossier.region_match.split("|");
    if (patterns.some((pattern) => haystack.includes(pattern))) {
      return dossier;
    }
  }

  return DOSSIERS[DOSSIERS.length - 1];
}
