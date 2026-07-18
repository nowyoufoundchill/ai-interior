import { runStructuredTask } from "@/lib/ai/gateway";
import { buildImplementationPackageFixture } from "@/lib/ai/fixtures/implementation-package";
import { implementationPackageJsonSchema } from "@/lib/schemas/json";
import { implementationPackageSchema, type ImplementationClaim, type ImplementationPackagePlan } from "@/lib/schemas";

export async function compileImplementationPackage(input: {
  roomId: string;
  room: Record<string, unknown>;
  home: Record<string, unknown> | null;
  acceptedRender: Record<string, unknown>;
  sourcePhoto: Record<string, unknown> | null;
  brief: Record<string, unknown>;
  existingProducts: Record<string, unknown>[];
}) {
  return runStructuredTask({
    roomId: input.roomId,
    serviceName: "Implementation Package Compiler",
    provider: "anthropic",
    promptPath: "prompts/implementation/compile-room-package.v1.md",
    schemaName: "implementation_package",
    schema: implementationPackageJsonSchema,
    zodSchema: implementationPackageSchema,
    maxTokens: 12000,
    taskInput: {
      task: "Create one honest implementation package bound to the accepted render.",
      room: input.room,
      home: input.home,
      accepted_render: input.acceptedRender,
      source_photo: input.sourcePhoto,
      compiled_brief: input.brief,
      existing_verified_products: input.existingProducts
    },
    images: [
      ...(typeof input.sourcePhoto?.file_url === "string" ? [{ url: input.sourcePhoto.file_url, detail: "high" as const }] : []),
      ...(typeof input.acceptedRender.file_url === "string" ? [{ url: input.acceptedRender.file_url, detail: "high" as const }] : [])
    ],
    mock: () => buildImplementationPackageFixture({ room: input.room, brief: input.brief })
  });
}

export function auditImplementationPackage(plan: ImplementationPackagePlan, requiredCoverageLabels: string[] = []): string[] {
  const issues: string[] = [];
  const itemIds = new Set(plan.furnishing_schedule.map((item) => item.id));
  const taskIds = new Set(plan.field_verification_tasks.map((task) => task.id));
  const allClaims: ImplementationClaim[] = [
    ...plan.placement_guidance,
    ...plan.measurement_and_clearance_claims,
    ...plan.furnishing_schedule.flatMap((item) => [item.placement, ...item.dimensions])
  ];
  for (const claim of allClaims) {
    if (claim.provenance === "unknown" && (!claim.field_task_id || !taskIds.has(claim.field_task_id))) {
      issues.push(`Unknown claim ${claim.id} has no valid field-verification task.`);
    }
  }
  for (const coverage of plan.coverage) {
    if (!itemIds.has(coverage.schedule_item_id)) issues.push(`Coverage item ${coverage.label} is not linked to the schedule.`);
  }
  const coveredLabels = new Set(plan.coverage.map((coverage) => normalizeLabel(coverage.label)));
  for (const label of requiredCoverageLabels) {
    if (!coveredLabels.has(normalizeLabel(label))) issues.push(`Named must-have ${label} is missing from package coverage.`);
  }
  for (const item of plan.furnishing_schedule) {
    const sourcingClass = ["exact_match", "near_match", "design_reference"].includes(item.classification);
    if (sourcingClass && !item.product) issues.push(`${item.category} has sourcing classification ${item.classification} but no product link.`);
    if (!sourcingClass && item.product) issues.push(`${item.category} is ${item.classification} but claims a purchasable product.`);
    if (item.budget_high < item.budget_low) issues.push(`${item.category} has an inverted budget range.`);
  }
  const calculatedLow = plan.furnishing_schedule.reduce((sum, item) => sum + item.budget_low * item.quantity, 0);
  const calculatedHigh = plan.furnishing_schedule.reduce((sum, item) => sum + item.budget_high * item.quantity, 0);
  if (plan.budget.total_low !== calculatedLow || plan.budget.total_high !== calculatedHigh) {
    issues.push("Package budget totals do not equal the furnishing schedule.");
  }
  if (plan.budget.total_high < plan.budget.total_low) issues.push("Package budget range is inverted.");
  return [...new Set(issues)];
}

function normalizeLabel(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}
