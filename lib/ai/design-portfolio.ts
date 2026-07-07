/**
 * Design Portfolio (annotated reference patterns)
 *
 * This is calibration material for "what excellent looks like," distilled
 * from documented design theory, regional vernacular, and widely-covered
 * editorial design patterns (national shelter-magazine coverage, published
 * design-firm portfolio conventions). These are synthesized archetypes, not
 * verbatim descriptions of a specific named designer's specific project —
 * that would risk misattribution. Each entry states the underlying design
 * move, why it works against design theory, and the generic/failed version
 * of the same idea, so both the Concept Director and the Critic have a
 * concrete "good vs. mediocre" reference instead of an abstract adjective.
 *
 * This is a starting set focused on the registers relevant to current active
 * projects (coastal-adjacent executive/residential, quiet luxury). It should
 * be extended the same way as new registers come into active use, and
 * revisited periodically since specific material/trend references date
 * faster than the underlying principles do.
 */

export type PortfolioPattern = {
  pattern_name: string;
  register: string;
  description: string;
  why_it_works: string;
  generic_failure_version: string;
  principle_demonstrated: string;
  source_note: string;
};

export const DESIGN_PORTFOLIO: PortfolioPattern[] = [
  {
    pattern_name: "The single dark plane",
    register: "Moody Coastal / Masculine Executive / Boutique Hotel",
    description:
      "One wall (not the whole room) is taken to a deep, saturated tone — charcoal, ink, deep olive — while the rest of the room stays light. The dark wall is almost always the one with the fewest interruptions (no doors, minimal windows) and is paired with the room's largest single art piece or a lit shelving moment.",
    why_it_works:
      "It creates depth and a photographable focal point without darkening the whole room's usable daylight. It also concentrates the 'expensive' signal into one high-impact move instead of spreading a modest budget thin across four walls.",
    generic_failure_version:
      "Painting an accent wall a trendy color with no relationship to the room's openings, lighting plan, or a specific art/furniture anchor — the wall reads as decorative rather than architectural.",
    principle_demonstrated: "Contrast and focal-point composition; budget concentration over budget distribution.",
    source_note: "Consistent with widely covered 'moody accent wall done well vs. done generically' editorial coverage and standard color-contrast theory."
  },
  {
    pattern_name: "Command-position anchor furniture",
    register: "Masculine Executive / any high-traffic multi-door room",
    description:
      "The primary anchor piece (desk, bed, main seating) is positioned to face the room's main entry or line of sight, with door swings and circulation paths mapped and protected before any material or styling decision is made.",
    why_it_works:
      "It solves a functional problem (the room feels controlled, not exposed) and a psychological one (facing the entry reads as intentional and authoritative) using layout alone, at zero material cost — which is why professionally designed rooms so often get this right even on modest budgets.",
    generic_failure_version:
      "Centering furniture in the room for symmetry without checking it against door swings or circulation, producing a photogenic render that would not actually work as a floor plan.",
    principle_demonstrated: "Function-first layout; luxury as problem-solving, not just material selection.",
    source_note: "Standard professional space-planning practice; also the most common gap in AI-generated layouts per current reporting on AI interior tools ignoring circulation and real constraints."
  },
  {
    pattern_name: "Three-layer light, one room",
    register: "All registers in this library",
    description:
      "Ambient (dimmable, indirect), task (a real lamp or fixture at the point of use), and accent (directional light on one intentional focal point) are all present and distinguishable from each other, rather than one ceiling fixture doing all three jobs.",
    why_it_works:
      "A single flat light source is the single most common tell of an unstyled or budget room; three visibly distinct layers is what most directly reads as 'considered' regardless of style vocabulary chosen.",
    generic_failure_version:
      "Recessed cans as the only light source, at full brightness, with no lamps or accent fixtures — technically compliant with a 'lighting plan' but reading as unfinished.",
    principle_demonstrated: "Lighting layering (ambient/task/accent).",
    source_note: "Directly consistent with standard interior lighting design theory and professional critique conventions."
  },
  {
    pattern_name: "Material honesty over material density",
    register: "Organic Modern / Lowcountry Coastal / Quiet luxury generally",
    description:
      "A small number of real, texturally distinct materials (real wood, real linen, real stone) are used deliberately, with visible negative space between them, rather than filling every surface with a decorative object.",
    why_it_works:
      "Restraint under real functional pressure (i.e., a room that still needs storage or work surfaces but keeps them visually quiet) is harder and more expensive to achieve than visible abundance, and reads that way.",
    generic_failure_version:
      "A room styled with many inexpensive decorative objects (faux plants, generic art multiples, mismatched textures) to appear 'finished,' which instead reads as cluttered or try-hard.",
    principle_demonstrated: "Restraint and negative space as a luxury signal, not an absence.",
    source_note: "Consistent with widely documented 'quiet luxury' interior design commentary and standard composition theory (negative space)."
  },
  {
    pattern_name: "The stated exception",
    register: "All registers — this is a rationale pattern, not a material one",
    description:
      "When a design choice deliberately overrides part of the client's literal brief wording (e.g., replacing a requested cliche with a better-fitting alternative), the concept explicitly names the override and the reason, rather than silently swapping it in.",
    why_it_works:
      "It preserves trust: the client can see the system understood the request and made a judgment call, rather than wondering if the request was simply ignored or misunderstood.",
    generic_failure_version:
      "Silently ignoring part of the brief, or complying literally with a request that would visibly cheapen the room, without surfacing the tension either way.",
    principle_demonstrated: "Rationale-everywhere; the dissent policy in /lib/ai/context-brain/design-policy.ts.",
    source_note: "Direct application of PRD v2 principle #4 (Rationale everywhere) to the specific case of taste conflicts."
  }
];
