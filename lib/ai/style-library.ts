/**
 * Style Library
 *
 * Six styles, authored deeply rather than many authored thinly (PRD v3 §7).
 * This library is vocabulary and guardrails for the Concept Director, not a
 * set of templates to reproduce verbatim — concepts should be interpretations
 * of a specific room/brief/constraints that may blend more than one entry
 * below. Every entry carries the full field set the PRD requires (summary,
 * colors, materials, furniture silhouettes, lighting types, art direction,
 * plant direction, luxury signals, common mistakes, budget substitutions,
 * pairs well with, clashes with) plus the design-theory depth fields
 * (proportion_rules, lighting_layers, luxury_mechanics) added in a prior
 * session — now authored for all six, not a subset.
 */
export type StyleProfile = {
  style_name: string;
  summary: string;
  color_palette: string[];
  materials: string[];
  furniture_silhouettes: string[];
  lighting_types: string[];
  art_direction: string[];
  plants: string[];
  luxury_signals: string[];
  common_mistakes: string[];
  budget_substitutions: string[];
  pairs_well_with: string[];
  avoid_pairing_with: string[];
  /**
   * Design-theory depth, authored for every style in this library: the
   * proportion rules that keep the style from reading generic, the layered
   * lighting plan that carries it after dark, and the specific mechanics
   * behind its luxury signals (why they read expensive, not just that they
   * do).
   */
  proportion_rules: string[];
  lighting_layers: {
    ambient: string;
    task: string;
    accent: string;
    decorative?: string;
  };
  luxury_mechanics: string[];
};

export const styleLibrary: StyleProfile[] = [
  {
    style_name: "Lowcountry Coastal",
    summary:
      "Southern coastal design rooted in architecture, not props: airy color, woven texture, warm wood, and screened-porch light, edited so it reads elevated rather than themed. Think Charleston single house, not beach-rental cliche.",
    color_palette: [
      "soft white",
      "haint blue",
      "sand",
      "natural oak",
      "sea grass green",
      "oyster gray",
      "aged brass"
    ],
    materials: ["rattan", "linen", "natural oak", "grasscloth", "unlacquered brass", "ceramic", "sisal", "painted wood"],
    furniture_silhouettes: [
      "deep slipcovered sofa with a loose, tailored fit",
      "woven or caned dining/accent chair",
      "simple painted writing desk",
      "campaign-style chest with brass hardware",
      "skirted round table"
    ],
    lighting_types: ["lantern-style pendant", "ceramic table lamp", "woven or rattan shade sconce", "picture light over art"],
    art_direction: ["marsh or lowcountry landscape in a natural frame", "loose botanical study", "soft abstract in water-adjacent tones"],
    plants: ["potted palmetto", "olive tree", "Boston fern", "trailing pothos on a high shelf"],
    luxury_signals: ["dense grasscloth or woven wall texture", "tailored (not billowy) slipcovers", "oversized art scaled to the wall", "unlacquered brass allowed to patina"],
    common_mistakes: [
      "literal shells, anchors, or nautical rope styling",
      "every blue in the room being the same saturation, flattening the palette",
      "thin, builder-grade rugs under substantial furniture",
      "grasscloth applied to only one small accent wall instead of a full, intentional plane"
    ],
    budget_substitutions: [
      "woven bamboo blinds instead of custom Roman shades",
      "painted vintage chest instead of a campaign antique",
      "linen-blend drapery panels instead of Belgian linen",
      "ceramic lamp with a linen shade instead of a stone-base lamp"
    ],
    pairs_well_with: ["Moody Coastal", "Organic Modern", "Boutique Hotel"],
    avoid_pairing_with: ["industrial loft hardware and exposed conduit", "neon or saturated tropical color", "glossy, ultra-modern lacquer casework"],
    proportion_rules: [
      "Slipcovered and woven seating should be sized generously — deep seats, wide arms — because this style reads thin and under-scaled the instant furniture is picked to the tightest size that fits the floor plan.",
      "Grasscloth, cane, or woven wall texture should run a full wall (or a fully bounded architectural plane like a stair hall) and never stop mid-wall; partial application is the single fastest way this style looks like an afterthought rather than a material decision.",
      "Keep window treatments full-length and full-width at the header — puddled or skimpy panels undercut the airy, tall-ceiling feeling this style depends on even in a modest room."
    ],
    lighting_layers: {
      ambient: "Warm ambient light from visible fixtures (lantern pendants, flush mounts with a woven or glass diffuser) rather than fully recessed, invisible lighting — the fixture itself should look like a considered object.",
      task: "Ceramic table lamps at seating and work zones, 2700K; avoid utilitarian task lighting (clip lamps, plain metal gooseneck), which reads office-grade rather than home-grade.",
      accent: "Woven- or linen-shade sconces flanking a mantel, headboard, or console to soften architecture that may otherwise feel plain in a builder-grade room.",
      decorative: "One lantern or statement fixture at the entry or over the primary table is appropriate; a second competing statement fixture in the same sightline undercuts the calm this style depends on."
    },
    luxury_mechanics: [
      "Texture density (grasscloth, rattan weave, linen slub, sisal underfoot) is the primary luxury signal in this style — it substitutes for color or ornament, so a room with flat, smooth surfaces throughout will feel unfinished no matter how correct the palette is.",
      "Tailored, fitted slipcovers are what separates 'elevated coastal' from 'beach rental' at effectively the same furniture cost — the tailoring is the spend, not the fabric.",
      "Unlacquered brass that is allowed to spot and darken over time reads as old-house authenticity; lacquered or plated brass in the same silhouette reads as a hotel supply catalog."
    ]
  },
  {
    style_name: "Moody Coastal",
    summary:
      "Refined coastal warmth pulled toward dusk: darker accents, tactile materials, and restrained references to place instead of literal beach signifiers. Coastal by material logic and light quality, not by decor theme.",
    color_palette: ["warm white", "blue-gray", "mushroom", "natural oak", "blackened bronze", "muted olive", "deep indigo"],
    materials: ["linen", "wool", "natural oak", "aged or blackened brass", "ceramic", "leather", "hand-thrown pottery"],
    furniture_silhouettes: ["clean-lined desk or console", "low credenza", "slipcovered lounge chair", "chunky hand-knotted wool rug", "substantial coffee or side table"],
    lighting_types: ["large fabric-shaded table lamp", "picture light", "aged brass sconce", "low profile floor lamp"],
    art_direction: ["oversized abstract landscape", "framed charcoal or ink sketch", "textural paper or fiber work"],
    plants: ["olive tree", "ficus", "sculptural bare-branch arrangement", "single potted fern in a stone vessel"],
    luxury_signals: ["three-plus layers of light at different heights", "oversized art relative to the wall", "natural fibers throughout", "intentional, uncluttered negative space"],
    common_mistakes: [
      "nautical or literal beach decor (rope, shells, anchors)",
      "cold blue-gray walls with no warm material to offset them",
      "relying on a single ceiling fixture as the only light source",
      "under-scaled art that reads as an afterthought on a large wall"
    ],
    budget_substitutions: ["ceramic lamp instead of a carved stone base", "a well-chosen vintage art print instead of commissioned work", "jute-wool blend rug instead of a hand-knotted wool rug"],
    pairs_well_with: ["Organic Modern", "Lowcountry Coastal", "Masculine Executive"],
    avoid_pairing_with: ["high-gloss glam finishes", "literal beach theme decor", "bright, high-chroma tropical color"],
    proportion_rules: [
      "One dominant anchor piece per zone (desk, sofa, bed) sized to roughly a third of the wall it sits against — undersizing the anchor is the most common way this style reads cheap.",
      "Keep a minimum 36 in. clearance on primary circulation paths; this style's calm feeling depends on negative space being real and walkable, not accidental leftover space."
    ],
    lighting_layers: {
      ambient: "Dimmable recessed or a single quiet fixture at 2700-3000K; never the sole light source once the sun goes down.",
      task: "One substantial lamp (table or floor) per functional zone with a shade that reads as fabric or ceramic, not builder-grade plastic.",
      accent: "Picture light or a directional sconce on the room's one intentional focal moment (art or architecture), not spread evenly across every wall.",
      decorative: "A single warm low-glow element (candle, small accent lamp) so the room doesn't go flat and cold after dark."
    },
    luxury_mechanics: [
      "Layering three distinct light sources at different heights is what separates this from a builder-grade room lit by one ceiling fixture — the layering itself is the luxury signal, not any single fixture's price.",
      "Aged or oxidizing metals (unlacquered brass, blackened bronze) read as intentional and expensive specifically because they show they were chosen to change over time, unlike plated finishes meant to stay static."
    ]
  },
  {
    style_name: "Organic Modern",
    summary:
      "Soft modern rooms built around warm woods, stone, plaster, natural textiles, and quiet forms. Modern in structure, organic in every material and edge — nothing glossy, nothing sharp-cornered without reason.",
    color_palette: ["bone", "sand", "greige", "walnut", "charcoal", "sage", "warm plaster white"],
    materials: ["white oak", "travertine", "boucle", "linen", "limewash plaster", "matte black metal", "hand-thrown ceramic"],
    furniture_silhouettes: ["rounded lounge chair", "monolithic stone or wood table", "low, deep sofa", "simple console with no applied ornament"],
    lighting_types: ["paper or linen-drum lantern", "ceramic table lamp", "linear plaster or metal sconce"],
    art_direction: ["earth-toned abstract", "minimal woven or fiber textile art", "black and white photography with a soft, non-graphic subject"],
    plants: ["olive tree", "rubber tree", "large fern", "single sculptural branch arrangement"],
    luxury_signals: ["calm, deliberate proportion", "true stone or plaster accents", "soft, deep upholstery", "hidden storage that keeps surfaces clear"],
    common_mistakes: [
      "an all-beige room with no material or tonal contrast",
      "under-scaled furniture floating in the middle of the room",
      "faux-finish plaster or stone instead of the real (or convincingly close) material",
      "too many small matching accessories instead of a few confident, larger gestures"
    ],
    budget_substitutions: ["stone-look ceramic tray instead of solid travertine", "limewash-effect paint instead of true plaster", "oak-veneer case goods instead of solid wood"],
    pairs_well_with: ["Moody Coastal", "Lowcountry Coastal", "Boutique Hotel"],
    avoid_pairing_with: ["ornate traditional carving and gilt", "bright, high-chroma coastal color", "high-gloss lacquer surfaces"],
    proportion_rules: [
      "Favor fewer, larger-scaled pieces over many small ones; this style fails when executed as a collection of small matching accessories instead of a handful of confident gestures.",
      "Low-slung furniture (lower seat and back heights) reads as calm and expensive here; standard-height case goods can make the room feel like a generic rental unless deliberately mixed with lower forms."
    ],
    lighting_layers: {
      ambient: "Soft, diffused ambient light (paper, linen, or frosted shades) rather than exposed bulbs or bright white recessed cans.",
      task: "A sculptural floor or table lamp treated as a design object in its own right, not just a light source.",
      accent: "Low, warm accent light grazing a textured surface (plaster, stone, wood grain) so material texture reads at night, not just in daylight photos.",
      decorative: "Minimal — one quiet accent is enough; this style is undermined by decorative over-lighting."
    },
    luxury_mechanics: [
      "The 'calm proportion' luxury signal comes from restraint under real storage and functional pressure — hidden storage that keeps surfaces clear is doing more design work than any single decorative object.",
      "Stone, plaster, and true wood grain read as expensive because they are materially honest — faux finishes that mimic them undercut the whole appeal, since the style's premise depends on the material being real or convincingly close."
    ]
  },
  {
    style_name: "Modern Traditional",
    summary:
      "Traditional bones made sharper: cleaner silhouettes, deeper tonal contrast, and edited styling replace ornate carving and clutter. Rich materials and classical proportion stay; fussiness and over-symmetry go.",
    color_palette: ["cream", "ink black", "oxblood", "walnut", "aged brass", "warm stone gray", "bottle green"],
    materials: ["mahogany or walnut", "velvet", "wool", "unlacquered brass", "leather", "honed marble"],
    furniture_silhouettes: ["roll-arm sofa in a tailored (not overstuffed) profile", "campaign-style desk", "open library bookcase, floor to ceiling", "a single wing or barrel chair as counterpoint, not a matched pair"],
    lighting_types: ["library or bankers lamp", "streamlined brass chandelier or lantern", "picture light over art or bookcase"],
    art_direction: ["portrait-style or figurative art in a simple frame", "a single large vintage landscape rather than a cluttered gallery wall", "a tight, curated gallery wall with one consistent frame color"],
    plants: ["clipped topiary", "magnolia branches in a simple vessel", "olive tree"],
    luxury_signals: ["library-style layered lighting", "one well-scaled framed art grouping rather than many small frames", "rich, real wood grain", "custom or custom-look drapery to the floor"],
    common_mistakes: [
      "an overly formal, perfectly symmetrical layout that reads stiff rather than lived-in",
      "too many antiques competing for attention with no clear hierarchy",
      "heavy, dated window treatments (swags, tassels) instead of clean tailored panels",
      "matching wood tones throughout instead of one dominant tone with intentional contrast pieces"
    ],
    budget_substitutions: ["a well-chosen vintage chair instead of a new upholstered piece", "ready-made drapery in a substantial fabric instead of custom", "antiqued brass hardware swaps on existing case goods"],
    pairs_well_with: ["Masculine Executive", "Boutique Hotel", "Lowcountry Coastal"],
    avoid_pairing_with: ["stark Scandinavian minimalism", "boho maximalism with no material hierarchy", "glossy contemporary furniture with exposed hardware"],
    proportion_rules: [
      "Keep one dominant wood tone in the room (walnut or mahogany, not both at equal weight) and let brass or leather carry the contrast — mixed wood tones at equal visual weight is what makes 'traditional' read dated rather than intentional.",
      "Break perfect symmetry deliberately in at least one zone (an off-center art grouping, a single accent chair instead of a pair) — total symmetry is the fastest way this style tips into stiff and formal rather than composed."
    ],
    lighting_layers: {
      ambient: "Warm dimmable ambient light (2700K) from a single well-scaled fixture (lantern or streamlined chandelier) rather than multiple small ceiling fixtures, which fragments the room's sense of formality.",
      task: "A library or bankers-style lamp with real material presence at any desk or reading chair — task lighting here is also a styling object, not just illumination.",
      accent: "Picture lights on art and on a full bookcase wall to give the room depth and a sense of collection after dark, not just in daylight.",
      decorative: "One quiet decorative lamp (a small ceramic or brass base) at a console or bar cart is enough — more than one starts to read as over-accessorized."
    },
    luxury_mechanics: [
      "Deep tonal contrast (ink, oxblood, or bottle green against cream and warm wood) is what reads as 'edited traditional' rather than 'inherited traditional' — a uniformly light or uniformly mid-tone room loses the effect even with the same furniture.",
      "A library-style lit bookcase or art wall does the same status-signaling work here that statement lighting does in Boutique Hotel — it says the room was curated over time, not furnished in one trip.",
      "One deliberate asymmetry (a single chair, an off-center grouping) reads as confident editing; achieving it with cheaper furniture still outperforms a perfectly matched, symmetrical set of expensive pieces."
    ]
  },
  {
    style_name: "Masculine Executive",
    summary:
      "A polished office language built on dark contrast, leather, wood, tailored storage, and artful lighting — substantial without being cold, and personal enough to survive a video call background.",
    color_palette: ["charcoal", "camel", "walnut", "cream", "olive", "aged brass", "deep navy"],
    materials: ["leather", "walnut", "wool", "unlacquered brass", "smoked glass", "linen"],
    furniture_silhouettes: ["substantial desk sized to the room, not the budget", "leather lounge chair", "low credenza with cord routing built in", "a full bookcase wall used for storage and display"],
    lighting_types: ["bankers lamp", "picture light", "architectural floor lamp", "articulating task lamp"],
    art_direction: ["one large abstract as the room's anchor", "black and white photography", "a framed textile or map with a personal or regional connection"],
    plants: ["olive tree", "rubber tree", "snake plant for low-light corners"],
    luxury_signals: ["desk and seating scaled to the room", "invisible cord and cable management", "layered library-style lighting", "leather allowed to show patina"],
    common_mistakes: [
      "a dark, moody room with no lamps to break up the gloom by evening",
      "an executive desk that is oversized for the actual room, blocking circulation",
      "cool white or cold-toned metal finishes that read corporate rather than personal",
      "visible cords and cables undermining an otherwise considered room"
    ],
    budget_substitutions: ["a leather-look accent chair instead of full-grain leather", "a vintage brass lamp sourced secondhand instead of new", "a walnut-veneer credenza instead of solid wood"],
    pairs_well_with: ["Moody Coastal", "Modern Traditional", "Boutique Hotel"],
    avoid_pairing_with: ["cutesy or novelty coastal decor", "fragile, purely decorative minimalism with no storage function"],
    proportion_rules: [
      "Desk and seating scale should feel substantial relative to the room — an undersized desk is the single fastest way to undercut an 'executive' brief regardless of material or color choices.",
      "Keep a minimum 30-36 in. clearance behind any desk chair and along every door swing; this style is often deployed in multi-purpose rooms where circulation math matters as much as furniture choice."
    ],
    lighting_layers: {
      ambient: "Warm dimmable base layer (2700-3000K); avoid cool white light, which reads corporate rather than executive.",
      task: "A directional desk lamp with real presence (bankers lamp, articulating library lamp) — task lighting is also a status object in this style.",
      accent: "Picture light on art or a lit bookcase/credenza to create depth on a video-call backdrop, not just in person.",
      decorative: "Optional single sculptural lamp or sconce; more than one decorative fixture starts to read cluttered rather than collected."
    },
    luxury_mechanics: [
      "Leather patina and real wood grain do the same job here that aged brass does in coastal styles — they signal the room was built to last and improve with use, not just to look good on delivery day.",
      "Cord and cable management is a genuine luxury signal in an executive office context: visible cords instantly read as unfinished regardless of how good the furniture is."
    ]
  },
  {
    style_name: "Boutique Hotel",
    summary:
      "Hospitality-inspired polish: dramatic lighting, rich texture, strong art, and memorable focal moments over safe, evenly-distributed decorating. The room should feel like it was designed to be photographed at dusk.",
    color_palette: ["cream", "charcoal", "cognac", "moss", "black", "aged brass", "deep burgundy"],
    materials: ["velvet", "leather", "marble", "walnut", "unlacquered brass", "wool bouclé"],
    furniture_silhouettes: ["curved lounge chair", "substantial desk or console as a focal object", "low, deep lounge seating", "a fluted or channel-front cabinet"],
    lighting_types: ["oversized floor lamp", "wall-mounted sconce used generously", "picture light", "dimmable statement pendant"],
    art_direction: ["one large, dramatic abstract as the room's single loudest gesture", "black and white photography at gallery scale", "a sculptural object used as art, not just decor"],
    plants: ["bird of paradise", "olive tree", "large indoor palm"],
    luxury_signals: ["a genuine statement lighting moment", "layered, lounge-height seating", "deliberately moody, uneven color and shadow", "art scaled beyond the 'safe' size for the wall"],
    common_mistakes: [
      "going so theatrical the room stops being livable day to day",
      "poor task lighting that leaves the mood lighting doing all the work and nothing to actually read or work by",
      "prioritizing drama over comfort in seating depth and cushioning",
      "matching every metal finish instead of letting one dominate"
    ],
    budget_substitutions: ["a dramatic accent-wall paint color instead of wallpaper or paneling", "one genuine statement lamp with simpler supporting fixtures elsewhere", "a large framed print instead of commissioned art"],
    pairs_well_with: ["Masculine Executive", "Modern Traditional", "Moody Coastal"],
    avoid_pairing_with: ["farmhouse literalism (shiplap-and-signage styling)", "tiny, under-scaled furniture", "uniformly bright, shadowless lighting"],
    proportion_rules: [
      "Oversized single gestures (one large lamp, one large artwork) outperform several medium ones — this style's 'memorable moment' depends on scale contrast, not accumulation.",
      "Seating should be lower and deeper than standard residential scale to read lounge-like rather than domestic-standard."
    ],
    lighting_layers: {
      ambient: "Deliberately moodier ambient base (dimmed, warm) than a typical residential room — this style should never be lit flat and bright.",
      task: "Directional floor lamps or wall-mounted reading lights rather than table lamps alone, to support the layered-shadow look hospitality interiors use.",
      accent: "Wall sconces or picture lights used generously to create depth and shadow across multiple surfaces, not just one focal wall.",
      decorative: "Candlelight-style low accent sources are appropriate here more than in most other styles in this library — the mood depends on visible warm light sources, not just their effect."
    },
    luxury_mechanics: [
      "Deliberate shadow and contrast (not even, shadowless lighting) is the core luxury mechanic — a hospitality-inspired room lit like a showroom loses the entire effect.",
      "Statement lighting is allowed to be the most expensive single item in the room here, unlike most other styles in this library where the anchor furniture usually carries that role."
    ]
  }
];
