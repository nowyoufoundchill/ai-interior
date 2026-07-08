import { productSchema, type ProductPlanItem } from "@/lib/schemas";

// Distinct, category-matched placeholder photos (each verified to actually
// depict its category) instead of one hotlink reused for all 6 mock
// products — found by a design-review pass: an identical stock photo across
// every product is a photographic version of the banned "three concepts
// that feel the same" pattern, and undermines using mock mode to verify the
// UI at all.
const FIXTURE_PRODUCTS = [
  ["Desk", "Warm Oak Executive Desk", "West Elm", 1299, "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd"],
  ["Desk chair", "Tailored Leather Task Chair", "Article", 549, "https://images.unsplash.com/photo-1592078615290-033ee584e267"],
  ["Rug", "Textured Wool Area Rug", "Lulu and Georgia", 998, "https://images.unsplash.com/photo-1600166898405-da9535204843"],
  ["Table lamp", "Aged Brass Library Lamp", "Rejuvenation", 399, "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15"],
  ["Artwork", "Oversized Tonal Landscape", "Chairish", 850, "https://images.unsplash.com/photo-1513519245088-0e12902e5a38"],
  ["Plant", "Sculptural Olive Tree", "Terrain", 228, "https://images.unsplash.com/photo-1512428813834-c702c7702b78"]
] as const;

export function buildProductPlanFixture(): ProductPlanItem[] {
  return FIXTURE_PRODUCTS.map(([category, name, retailer, price, imageUrl]) =>
    productSchema.parse({
      category,
      name,
      retailer,
      url: "https://example.com",
      image_url: imageUrl,
      price,
      dimensions: { note: "Confirm exact dimensions before purchase." },
      material: category === "Rug" ? "wool blend" : "mixed natural materials",
      finish: "warm neutral",
      scores: {
        style_fit: 88,
        scale_fit: 78,
        budget_fit: 74,
        material_fit: 86,
        luxury_signal: 82
      },
      reason_selected: "Chosen as a placeholder because it supports the selected concept with scale, material warmth, and a clear design rationale.",
      risks: ["Real sourcing should verify stock, dimensions, lead time, and finish variation."],
      alternatives: ["Lower-cost substitute", "Vintage option", "Investment upgrade"]
    })
  );
}
