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
};

export const styleLibrary: StyleProfile[] = [
  {
    style_name: "Moody Coastal",
    summary: "Refined coastal warmth with darker accents, tactile materials, and restrained references to place.",
    color_palette: ["warm white", "blue-gray", "mushroom", "oak", "blackened bronze", "muted olive"],
    materials: ["linen", "wool", "natural oak", "aged brass", "ceramic", "leather"],
    furniture_silhouettes: ["clean-lined desk", "low credenza", "slipcovered chair", "woven rug"],
    lighting_types: ["large shaded table lamp", "picture light", "aged brass sconce"],
    art_direction: ["oversized abstract landscape", "framed charcoal sketch", "textural paper work"],
    plants: ["olive tree", "ficus", "sculptural branch arrangement"],
    luxury_signals: ["layered lighting", "oversized art", "natural fibers", "intentional negative space"],
    common_mistakes: ["nautical decor", "cold gray walls", "too few light sources"],
    budget_substitutions: ["ceramic lamp instead of stone", "vintage art print", "jute-wool blend rug"],
    pairs_well_with: ["Organic Modern", "Lowcountry Coastal", "Masculine Executive"],
    avoid_pairing_with: ["high-gloss glam", "literal beach theme"]
  },
  {
    style_name: "Organic Modern",
    summary: "Soft modern rooms built around warm woods, stone, plaster, natural textiles, and quiet forms.",
    color_palette: ["bone", "sand", "greige", "walnut", "charcoal", "sage"],
    materials: ["oak", "travertine", "boucle", "linen", "plaster", "matte black metal"],
    furniture_silhouettes: ["rounded lounge chair", "monolithic table", "low sofa", "simple console"],
    lighting_types: ["paper lantern", "ceramic lamp", "linear sconce"],
    art_direction: ["earth-toned abstract", "minimal textile art", "black and white photography"],
    plants: ["olive tree", "rubber tree", "large fern"],
    luxury_signals: ["calm proportion", "stone accents", "soft upholstery", "hidden storage"],
    common_mistakes: ["all beige room", "under-scaled furniture", "no contrast"],
    budget_substitutions: ["stone tray", "limewash-look paint", "oak veneer case goods"],
    pairs_well_with: ["Japandi", "Warm Minimal", "California Casual"],
    avoid_pairing_with: ["ornate traditional", "bright coastal"]
  },
  {
    style_name: "Transitional",
    summary: "Balanced traditional structure with fresh fabrics, clean lines, and comfortable polish.",
    color_palette: ["warm white", "taupe", "navy", "camel", "soft black", "brass"],
    materials: ["wool", "linen", "walnut", "brass", "marble", "leather"],
    furniture_silhouettes: ["track-arm sofa", "turned-leg desk", "tailored chair", "framed cabinet"],
    lighting_types: ["drum pendant", "pharmacy lamp", "tailored shade sconce"],
    art_direction: ["framed botanicals", "abstract landscape", "collected prints"],
    plants: ["fiddle leaf fig", "topiary", "orchid"],
    luxury_signals: ["symmetry", "tailored upholstery", "substantial rug", "art in proper scale"],
    common_mistakes: ["too many matching sets", "flat builder beige", "tiny art"],
    budget_substitutions: ["vintage side table", "custom-looking drapery panels", "framed print sets"],
    pairs_well_with: ["Modern Traditional", "Classic Southern", "Boutique Hotel"],
    avoid_pairing_with: ["extreme minimalism", "novelty decor"]
  },
  {
    style_name: "Modern Traditional",
    summary: "Traditional bones made sharper with cleaner silhouettes, deeper contrast, and edited styling.",
    color_palette: ["cream", "ink", "oxblood", "walnut", "brass", "stone"],
    materials: ["mahogany", "velvet", "wool", "brass", "leather", "marble"],
    furniture_silhouettes: ["roll-arm chair", "campaign desk", "library bookcase", "tailored sofa"],
    lighting_types: ["library lamp", "brass chandelier", "picture light"],
    art_direction: ["portrait-style art", "vintage landscape", "gallery wall"],
    plants: ["topiary", "magnolia branches", "olive tree"],
    luxury_signals: ["library lighting", "framed art groupings", "rich wood", "custom drapery"],
    common_mistakes: ["overly formal layout", "too many antiques", "heavy window treatments"],
    budget_substitutions: ["vintage chair", "ready-made drapery", "antique brass hardware"],
    pairs_well_with: ["Transitional", "Masculine Executive", "Classic Southern"],
    avoid_pairing_with: ["stark Scandinavian", "boho overload"]
  },
  {
    style_name: "European Country",
    summary: "Layered, relaxed, old-world warmth with patina, mixed woods, plaster tones, and collected pieces.",
    color_palette: ["cream", "stone", "sage", "umber", "antique gold", "dusty blue"],
    materials: ["linen", "oak", "terracotta", "iron", "antique brass", "wool"],
    furniture_silhouettes: ["farm table", "skirted chair", "arched cabinet", "rush seat"],
    lighting_types: ["iron chandelier", "pleated shade lamp", "wall lantern"],
    art_direction: ["vintage oils", "botanical studies", "landscape sketches"],
    plants: ["olive tree", "lavender", "herbs"],
    luxury_signals: ["patina", "natural stone", "antique textiles", "quiet irregularity"],
    common_mistakes: ["fake distressed finishes", "too much rustic decor", "yellow lighting"],
    budget_substitutions: ["vintage market art", "linen-look panels", "terracotta accessories"],
    pairs_well_with: ["Modern Rustic", "Classic Southern", "Collected Eclectic"],
    avoid_pairing_with: ["ultra glam", "cold gray modern"]
  },
  {
    style_name: "Lowcountry Coastal",
    summary: "Southern coastal design with airy color, woven texture, warm wood, and architectural restraint.",
    color_palette: ["soft white", "haint blue", "sand", "natural oak", "sea grass", "charcoal"],
    materials: ["rattan", "linen", "oak", "grasscloth", "brass", "ceramic"],
    furniture_silhouettes: ["slipcovered sofa", "woven chair", "simple writing desk", "painted cabinet"],
    lighting_types: ["lantern pendant", "ceramic table lamp", "woven shade"],
    art_direction: ["marsh landscape", "soft abstract", "botanical work"],
    plants: ["palmetto", "olive tree", "fern"],
    luxury_signals: ["grasscloth", "woven texture", "large art", "tailored slipcovers"],
    common_mistakes: ["literal shells", "too much blue", "thin rugs"],
    budget_substitutions: ["woven tray", "painted vintage case good", "linen blend drapes"],
    pairs_well_with: ["Moody Coastal", "Classic Southern", "California Casual"],
    avoid_pairing_with: ["industrial loft", "neon palettes"]
  },
  {
    style_name: "Masculine Executive",
    summary: "A polished office language using dark contrast, leather, wood, tailored storage, and artful lighting.",
    color_palette: ["charcoal", "camel", "walnut", "cream", "olive", "aged brass"],
    materials: ["leather", "walnut", "wool", "brass", "smoked glass", "linen"],
    furniture_silhouettes: ["substantial desk", "leather lounge chair", "low credenza", "bookcase wall"],
    lighting_types: ["bankers lamp", "picture light", "architectural floor lamp"],
    art_direction: ["large abstract", "black and white photography", "framed textile"],
    plants: ["olive tree", "rubber tree", "snake plant"],
    luxury_signals: ["desk scale", "cord management", "library layers", "leather patina"],
    common_mistakes: ["too dark without lamps", "oversized executive furniture", "cold metal finishes"],
    budget_substitutions: ["leather-look accent chair", "vintage brass lamp", "walnut veneer credenza"],
    pairs_well_with: ["Moody Coastal", "Modern Traditional", "Boutique Hotel"],
    avoid_pairing_with: ["cutesy coastal", "fragile minimalism"]
  },
  {
    style_name: "California Casual",
    summary: "Easy, sunlit living with natural textiles, unfussy comfort, white oak, and relaxed layering.",
    color_palette: ["white", "sand", "oak", "clay", "denim", "olive"],
    materials: ["linen", "white oak", "jute", "ceramic", "cotton", "rattan"],
    furniture_silhouettes: ["deep lounge sofa", "simple desk", "woven accent chair", "open shelf"],
    lighting_types: ["ceramic lamp", "woven pendant", "simple floor lamp"],
    art_direction: ["soft abstracts", "coastal photography", "simple line drawings"],
    plants: ["bird of paradise", "olive tree", "pothos"],
    luxury_signals: ["casual scale", "sun-washed palette", "textural mix", "comfortable seating"],
    common_mistakes: ["too washed out", "generic boho", "no storage"],
    budget_substitutions: ["jute rug", "ceramic-look lamp", "ready-made linen curtains"],
    pairs_well_with: ["Organic Modern", "Lowcountry Coastal", "Warm Minimal"],
    avoid_pairing_with: ["heavy Victorian", "cold industrial"]
  },
  {
    style_name: "Japandi",
    summary: "Japanese and Scandinavian restraint with natural materials, low contrast, craft, and functional calm.",
    color_palette: ["warm white", "ash", "black", "natural oak", "stone", "tea green"],
    materials: ["oak", "paper", "linen", "stoneware", "wool", "bamboo"],
    furniture_silhouettes: ["low lounge chair", "simple platform bench", "clean desk", "slatted cabinet"],
    lighting_types: ["paper lantern", "linear lamp", "soft wall sconce"],
    art_direction: ["ink wash", "minimal landscape", "ceramic wall piece"],
    plants: ["bonsai-inspired olive", "fern", "single branch"],
    luxury_signals: ["negative space", "quiet craft", "material honesty", "hidden clutter"],
    common_mistakes: ["too empty", "cheap faux bamboo", "no softness"],
    budget_substitutions: ["paper shade", "simple oak shelf", "stoneware accessories"],
    pairs_well_with: ["Warm Minimal", "Organic Modern", "Modern Rustic"],
    avoid_pairing_with: ["busy eclectic", "glam metallic overload"]
  },
  {
    style_name: "Warm Minimal",
    summary: "Minimal rooms softened with warmth, material texture, and carefully chosen functional pieces.",
    color_palette: ["ivory", "greige", "oak", "putty", "black", "clay"],
    materials: ["oak", "linen", "wool", "ceramic", "plaster", "matte metal"],
    furniture_silhouettes: ["simple desk", "arched cabinet", "low chair", "clean-lined sofa"],
    lighting_types: ["soft globe lamp", "plaster sconce", "quiet pendant"],
    art_direction: ["large abstract", "single framed textile", "tonal photography"],
    plants: ["olive tree", "rubber tree", "single sculptural branch"],
    luxury_signals: ["restraint", "proportion", "texture", "concealed storage"],
    common_mistakes: ["sterile room", "not enough seating", "all furniture same tone"],
    budget_substitutions: ["matte ceramic lamp", "wool-look rug", "simple oak side table"],
    pairs_well_with: ["Organic Modern", "Japandi", "California Casual"],
    avoid_pairing_with: ["maximal pattern", "ornate traditional"]
  },
  {
    style_name: "Classic Southern",
    summary: "Gracious, collected rooms with traditional forms, fresh color, antiques, botanicals, and tailored textiles.",
    color_palette: ["cream", "soft green", "sky blue", "walnut", "brass", "coral"],
    materials: ["linen", "mahogany", "rattan", "brass", "chintz", "wool"],
    furniture_silhouettes: ["skirted table", "wing chair", "writing desk", "china cabinet"],
    lighting_types: ["brass lamp", "lantern", "pleated shade sconce"],
    art_direction: ["botanicals", "landscape paintings", "family pieces"],
    plants: ["topiary", "fern", "orchid"],
    luxury_signals: ["custom pillows", "antiques", "layered pattern", "symmetry"],
    common_mistakes: ["too formal", "dated florals", "overmatching"],
    budget_substitutions: ["vintage side chair", "botanical prints", "pleated lamp shade"],
    pairs_well_with: ["Transitional", "Lowcountry Coastal", "Modern Traditional"],
    avoid_pairing_with: ["stark industrial", "ultra minimal"]
  },
  {
    style_name: "Collected Eclectic",
    summary: "Personal, layered rooms with meaningful contrast, vintage finds, art variety, and controlled color.",
    color_palette: ["cream", "oxblood", "olive", "indigo", "walnut", "brass"],
    materials: ["velvet", "wood", "wool", "ceramic", "brass", "rattan"],
    furniture_silhouettes: ["vintage desk", "curved chair", "bookshelf", "patterned ottoman"],
    lighting_types: ["vintage lamp", "sculptural floor lamp", "picture light"],
    art_direction: ["mixed media wall", "vintage portraits", "abstract prints"],
    plants: ["ficus", "fern", "large trailing plant"],
    luxury_signals: ["collected art", "unexpected textile mix", "vintage patina", "balanced asymmetry"],
    common_mistakes: ["clutter", "too many colors", "no anchoring neutral"],
    budget_substitutions: ["estate sale lamps", "framed found textiles", "secondhand side tables"],
    pairs_well_with: ["European Country", "Classic Southern", "Boutique Hotel"],
    avoid_pairing_with: ["strict minimalism", "theme rooms"]
  },
  {
    style_name: "Boutique Hotel",
    summary: "Hospitality-inspired polish with dramatic lighting, rich texture, strong art, and memorable focal moments.",
    color_palette: ["cream", "charcoal", "cognac", "moss", "black", "brass"],
    materials: ["velvet", "leather", "marble", "walnut", "brass", "wool"],
    furniture_silhouettes: ["curved chair", "substantial desk", "low lounge seating", "fluted cabinet"],
    lighting_types: ["oversized floor lamp", "wall sconce", "picture light"],
    art_direction: ["large dramatic abstract", "black and white photography", "sculptural object"],
    plants: ["bird of paradise", "olive tree", "large palm"],
    luxury_signals: ["statement lighting", "layered seating", "moody color", "art scale"],
    common_mistakes: ["too theatrical", "poor task lighting", "ignoring comfort"],
    budget_substitutions: ["dramatic paint", "single statement lamp", "large framed print"],
    pairs_well_with: ["Masculine Executive", "Transitional", "Collected Eclectic"],
    avoid_pairing_with: ["farmhouse literalism", "tiny furniture"]
  },
  {
    style_name: "Modern Rustic",
    summary: "Rustic material character refined through modern lines, warm contrast, and less clutter.",
    color_palette: ["cream", "charcoal", "reclaimed wood", "stone", "olive", "iron"],
    materials: ["oak", "iron", "stone", "linen", "leather", "wool"],
    furniture_silhouettes: ["trestle desk", "leather chair", "simple bench", "open shelving"],
    lighting_types: ["iron pendant", "ceramic lamp", "adjustable floor lamp"],
    art_direction: ["landscape photography", "textural abstract", "vintage map"],
    plants: ["olive tree", "snake plant", "branch arrangement"],
    luxury_signals: ["authentic wood grain", "iron detail", "substantial textiles", "pared-back styling"],
    common_mistakes: ["fake farmhouse signs", "too much reclaimed wood", "orange stain"],
    budget_substitutions: ["vintage wood desk", "iron-look lamp", "wool blend rug"],
    pairs_well_with: ["European Country", "Japandi", "Organic Modern"],
    avoid_pairing_with: ["high-gloss glam", "pastel coastal"]
  }
];
