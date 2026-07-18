import { implementationPackageSchema, type ImplementationPackagePlan } from "@/lib/schemas";

const PRODUCT_REFERENCES = [
  ["Desk", "LAGKAPTEN / ALEX desk design reference", "IKEA", "https://www.ikea.com/us/en/p/lagkapten-alex-desk-white-s99431982/", 280, 900],
  ["Desk chair", "Ergonomic upholstered task chair — source after sit test", "Custom", null, 450, 1200],
  ["Closed bookcase", "KALLAX storage unit design reference; add doors only where verified compatible", "IKEA", "https://www.ikea.com/us/en/p/kallax-shelf-unit-white-80275887/", 200, 700],
  ["Area rug", "LOHALS flatwoven rug design reference", "IKEA", "https://www.ikea.com/us/en/p/lohals-rug-flatwoven-natural-00277395/", 300, 900],
  ["Task lamp", "RANARP task-light design reference", "IKEA", "https://www.ikea.com/us/en/p/ranarp-work-lamp-off-white-20231325/", 80, 400],
  ["Wall focal point", "HOVET mirror used only as a scale and finish reference", "IKEA", "https://www.ikea.com/us/en/p/hovet-mirror-aluminum-40507196/", 200, 900],
  ["Plant", "Sculptural olive tree", "The Sill", "https://www.thesill.com/products/olive-tree", 150, 350],
  ["Window treatment", "MERETE curtain design reference; final treatment must fit the measured opening", "IKEA", "https://www.ikea.com/us/en/p/ritva-curtains-with-tie-backs-1-pair-white-40111987/", 200, 1600],
  ["Wall finish", "Warm mineral paint finish", "Illustrative", null, 250, 800],
  ["Cable management", "Concealed floor and desk cable route", "Custom", null, 75, 300]
] as const;

const ALTERNATIVE_URLS: Record<string, string> = {
  Desk: "https://www.ikea.com/us/en/p/micke-desk-white-30213076/",
  "Closed bookcase": "https://www.ikea.com/us/en/p/alex-drawer-unit-white-00473546/",
  "Task lamp": "https://wtlighting.co.uk/rechargeable-table-lamps/bridport-warm-brass-usb-rechargeable-table-lamp-3-stage-touch-dimmer-3000k-warm-white/"
};

export function buildImplementationPackageFixture(input: {
  room: Record<string, unknown>;
  brief: Record<string, unknown>;
}): ImplementationPackagePlan {
  const fieldTasks = PRODUCT_REFERENCES.map((item, index) => ({
    id: `field-${index + 1}`,
    task: `Measure the available width, depth, and circulation around the ${item[0].toLowerCase()} location.`,
    reason: "A photograph and typed room envelope do not prove exact product fit or installation clearance.",
    priority: "before_purchase" as const,
    resolves_claim_ids: [`dimension-${index + 1}`],
    status: "open" as const
  }));
  const schedule = PRODUCT_REFERENCES.map(([category, description, retailer, url, low, high], index) => {
    const classification = url ? "design_reference" : retailer === "Custom" ? "custom" : "illustrative";
    return {
      id: `item-${index + 1}`,
      category,
      description,
      quantity: 1,
      coverage_labels: [category],
      classification: classification as "design_reference" | "custom" | "illustrative",
      placement: {
        id: `placement-${index + 1}`,
        statement: `Place the ${category.toLowerCase()} in the zone shown by the accepted design while keeping visible openings and access unobstructed.`,
        provenance: "model_inferred" as const,
        source_detail: "Accepted design plus original source photograph; verify final position on site.",
        field_task_id: null
      },
      dimensions: [{
        id: `dimension-${index + 1}`,
        statement: `Exact ${category.toLowerCase()} size and clearance are unknown until the intended location is measured.`,
        provenance: "unknown" as const,
        source_detail: "No manufacturer-selected item and no location-specific owner measurement are available.",
        field_task_id: `field-${index + 1}`
      }],
      product: url ? {
        retailer,
        canonical_url: url,
        image_url: null,
        price: null,
        availability: "Reference link supplied; price and stock require recheck before purchase.",
        verified_at: "not_verified",
        verification_status: "unverified" as const
      } : null,
      alternatives: ALTERNATIVE_URLS[category] ? [{
        label: `Alternative ${category.toLowerCase()} design reference`,
        classification: "design_reference" as const,
        canonical_url: ALTERNATIVE_URLS[category]
      }] : [],
      budget_low: low,
      budget_high: high,
      notes: [url ? "Design reference only; do not purchase until fit, finish, price, and availability are rechecked." : "Requires custom specification or a later verified source."]
    };
  });
  const named = [...new Set([
    ...arrayOfStrings(input.room.existing_items),
    ...arrayOfStrings(input.brief.keep_or_remove)
  ])];
  const coverage: ImplementationPackagePlan["coverage"] = schedule.map((item) => ({
    label: item.category,
    kind: "major_visible_furnishing" as const,
    schedule_item_id: item.id,
    disposition: item.classification === "custom" ? "custom" as const : item.classification === "illustrative" ? "illustrative" as const : "scheduled" as const
  }));
  for (const [index, label] of named.entries()) {
    coverage.push({
      label,
      kind: "named_must_have",
      schedule_item_id: schedule[Math.min(index, schedule.length - 1)].id,
      disposition: "scheduled"
    });
  }
  const totalLow = schedule.reduce((sum, item) => sum + item.budget_low * item.quantity, 0);
  const totalHigh = schedule.reduce((sum, item) => sum + item.budget_high * item.quantity, 0);
  const roomDimensions = asRecord(input.room.dimensions);
  const typedDimensionText = Object.entries(roomDimensions).map(([key, value]) => `${key}: ${String(value)}`).join(", ") || "No complete room dimensions supplied";

  return implementationPackageSchema.parse({
    summary: "A field-check-first implementation plan tied to the accepted room design, with buying references separated from claims of exact fit.",
    placement_guidance: [{
      id: "room-envelope",
      statement: `Use the owner-entered room envelope as the planning baseline (${typedDimensionText}); verify each product location before purchase.`,
      provenance: Object.keys(roomDimensions).length ? "owner_measured" : "unknown",
      source_detail: Object.keys(roomDimensions).length ? "Typed room dimensions supplied by the owner." : "No owner measurement is stored.",
      field_task_id: Object.keys(roomDimensions).length ? null : fieldTasks[0].id
    }],
    measurement_and_clearance_claims: schedule.flatMap((item) => item.dimensions),
    furnishing_schedule: schedule,
    coverage,
    field_verification_tasks: fieldTasks,
    budget: {
      currency: "USD",
      total_low: totalLow,
      total_high: totalHigh,
      target_low: null,
      target_high: null,
      variance_summary: "The range includes design-reference and custom allowances; verified product selections may move the total materially.",
      assumptions: ["Taxes, shipping, labor, electrical work, and construction are excluded unless explicitly listed."]
    },
    installation_sequence: [
      { order: 1, step: "Complete every before-purchase field measurement.", caveats: ["Do not infer construction or code compliance from the image."] },
      { order: 2, step: "Confirm paint, electrical, and window-treatment scope before ordering furniture.", caveats: ["Use qualified trades where required."] },
      { order: 3, step: "Order verified long-lead and custom items, then movable furnishings.", caveats: ["Recheck return policies and delivery access."] },
      { order: 4, step: "Place furniture, test circulation, then install art, lighting, and styling.", caveats: ["Keep all required access paths clear."] }
    ],
    assumptions: ["The accepted rendering is design intent, not a measured drawing.", "Exact color and material appearance varies by screen, sample, and room light."]
  });
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
