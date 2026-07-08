import { productSchema, type ProductPlanItem } from "@/lib/schemas";

const FIXTURE_PRODUCTS = [
  ["Desk", "Warm Oak Executive Desk", "West Elm", 1299],
  ["Desk chair", "Tailored Leather Task Chair", "Article", 549],
  ["Rug", "Textured Wool Area Rug", "Lulu and Georgia", 998],
  ["Table lamp", "Aged Brass Library Lamp", "Rejuvenation", 399],
  ["Artwork", "Oversized Tonal Landscape", "Chairish", 850],
  ["Plant", "Sculptural Olive Tree", "Terrain", 228]
] as const;

export function buildProductPlanFixture(): ProductPlanItem[] {
  return FIXTURE_PRODUCTS.map(([category, name, retailer, price]) =>
    productSchema.parse({
      category,
      name,
      retailer,
      url: "https://example.com",
      image_url: "https://images.unsplash.com/photo-1618220179428-22790b461013",
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
