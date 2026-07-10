import { productSchema, type ProductPlanItem } from "@/lib/schemas";

// Distinct, category-matched placeholder photos (each verified to actually
// depict its category) instead of one hotlink reused for all 6 mock
// products — found by a design-review pass: an identical stock photo across
// every product is a photographic version of the banned "three concepts
// that feel the same" pattern, and undermines using mock mode to verify the
// UI at all.
const FIXTURE_PRODUCTS = [
  [
    "Desk",
    "Warm Oak Executive Desk",
    "Wayfair",
    1299,
    "https://assets.wfcdn.com/im/72800167/resize-h800-w800%5Ecompr-r85/3859/385931665/63%27%27%2BModern%2BOffice%2BExecutive%2BDesk%2C%2BWood%2BComputer%2BDesk%2BWriting%2BTable%2C%2BWeathered%2BOak.jpg",
    "https://www.wayfair.com/furniture/pdp/ophelia-co-63-modern-office-executive-desk-wood-computer-desk-writing-table-weathered-oak-w116235268.html"
  ],
  [
    "Desk chair",
    "Tailored Leather Task Chair",
    "Omidi",
    549,
    "https://cdn.shopify.com/s/files/1/0903/2410/7578/files/8006-brown-1.webp?v=1764746513",
    "https://www.omidifurniture.com/blogs/news/10-reasons-to-embrace-an-executive-leather-office-chair-for-a-superior-workspace"
  ],
  ["Rug", "Textured Wool Area Rug", "Target", 998, "https://images.unsplash.com/photo-1600166898405-da9535204843", "https://www.target.com/s?searchTerm=wool%20rug"],
  [
    "Table lamp",
    "Aged Brass Library Lamp",
    "WT Lighting",
    399,
    "https://wtlighting.co.uk/_cache/_products_main/167x167/bridport-warm-brass-usb-rechargeable-table-lamp-3-stage-touch-dimmer-3000k-warm-white-11966-thumb.jpg",
    "https://wtlighting.co.uk/rechargeable-table-lamps/bridport-warm-brass-usb-rechargeable-table-lamp-3-stage-touch-dimmer-3000k-warm-white/"
  ],
  [
    "Artwork",
    "Oversized Tonal Landscape",
    "Wayfair",
    850,
    "https://assets.wfcdn.com/im/52457942/resize-h800-w800%5Ecompr-r85/4064/406486676/Soft%2BSepia%2BMisty%2BNeutral%2BLandscape%2BWall%2BArt%2BSet%2BFramed%2BMaster%2BBedroom%2BWall%2BArt%2BWork%2B2%2BPieces%2BPrint-219147296-219147301.jpg",
    "https://www.wayfair.com/decor-pillows/pdp/latitude-run-soft-sepia-misty-neutral-landscape-wall-art-set-framed-master-bedroom-wall-art-work-2-pieces-print-w117649682.html"
  ],
  [
    "Plant",
    "Sculptural Olive Tree",
    "The Sill",
    228,
    "https://www.thesill.com/cdn/shop/files/Olivetree-Isabella_Top-Half-Mustard_Variant.png?v=1774369803&width=1445",
    "https://www.thesill.com/products/olive-tree"
  ]
] as const;

const DIMENSION_NOTES: Record<string, string> = {
  Desk: "Keep the desk near 63 in. wide so it sits comfortably inside the 11 ft by 14 ft office without clipping the three door paths.",
  "Desk chair": "Choose a compact executive chair with full swivel clearance at the desk and enough pullback room for all-day calls.",
  Rug: "Use an 8 ft by 10 ft or smaller rug to define the work zone while leaving oak floor visible at door swings and window paths.",
  "Table lamp": "Scale for a desktop or credenza layer; warm brass adds task light without competing with window daylight.",
  Artwork: "Oversized but shallow wall art gives the office a focal plane without stealing circulation depth.",
  Plant: "Place the olive tree in a corner or window-adjacent pocket so it softens the room without blocking operation."
};

const PRODUCT_REASONS: Record<string, string> = {
  Desk: "The fluted oak desk gives the office its executive weight while staying narrow enough for the 11 ft by 14 ft footprint and three-door circulation.",
  "Desk chair": "The warm leather chair brings the masculine note the brief asks for, with a compact swivel shape that can pull back without crowding the window wall.",
  Rug: "A restrained wool rug softens calls and anchors the desk zone, but its recommended size leaves oak visible at the door swings and keeps the room architectural.",
  "Table lamp": "The brass lamp adds the single warm accent the brand allows and gives the work surface a low evening layer without turning the office glossy.",
  Artwork: "The sepia landscape creates one calm focal plane for the white shell, giving coastal atmosphere through tone and scale rather than literal beach imagery.",
  Plant: "The olive tree adds one living sculptural line near the natural light, softening the office while staying clear of doors, windows, and the work path."
};

export function buildProductPlanFixture(): ProductPlanItem[] {
  return FIXTURE_PRODUCTS.map(([category, name, retailer, price, imageUrl, url]) =>
    productSchema.parse({
      category,
      name,
      retailer,
      url,
      image_url: imageUrl,
      price,
      dimensions: { note: DIMENSION_NOTES[category] ?? "Verify final measurements against the 11 ft by 14 ft office before purchase." },
      material: category === "Rug" ? "wool blend" : "mixed natural materials",
      finish: "warm neutral",
      scores: {
        style_fit: 88,
        scale_fit: 78,
        budget_fit: 74,
        material_fit: 86,
        luxury_signal: 82
      },
      reason_selected: PRODUCT_REASONS[category] ?? `Selected for a clear role in the 11 ft by 14 ft office and the approved direction.`,
      risks: ["Real sourcing should verify stock, dimensions, lead time, and finish variation."],
      alternatives: ["Lower-cost substitute", "Vintage option", "Investment upgrade"]
    })
  );
}
