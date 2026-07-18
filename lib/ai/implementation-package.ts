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
  repair?: {
    previousPlan: ImplementationPackagePlan;
    issues: string[];
  };
}) {
  return runStructuredTask({
    roomId: input.roomId,
    serviceName: "Implementation Package Compiler",
    provider: "openai",
    promptPath: "prompts/implementation/compile-room-package.v1.md",
    schemaName: "implementation_package",
    schema: implementationPackageJsonSchema,
    zodSchema: implementationPackageSchema,
    maxTokens: 12000,
    taskInput: {
      task: input.repair
        ? "Return a complete corrected implementation package that resolves every required correction."
        : "Create one honest implementation package bound to the accepted render.",
      room: input.room,
      home: input.home,
      accepted_render: input.acceptedRender,
      source_photo: input.sourcePhoto,
      compiled_brief: input.brief,
      existing_verified_products: input.existingProducts,
      previous_package: input.repair?.previousPlan ?? null,
      required_corrections: input.repair?.issues ?? []
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
  const tasksById = new Map(plan.field_verification_tasks.map((task) => [task.id, task]));
  const allClaims: ImplementationClaim[] = [
    ...plan.placement_guidance,
    ...plan.measurement_and_clearance_claims,
    ...plan.furnishing_schedule.flatMap((item) => [item.placement, ...item.dimensions])
  ];
  for (const claim of allClaims) {
    if (claim.provenance !== "unknown") continue;
    const task = claim.field_task_id ? tasksById.get(claim.field_task_id) : null;
    if (!task) {
      issues.push(`Unknown claim ${claim.id} has no valid field-verification task.`);
    } else if (!task.resolves_claim_ids.includes(claim.id)) {
      issues.push(`Field-verification task ${task.id} does not explicitly resolve unknown claim ${claim.id}.`);
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

export function normalizeImplementationPackage(plan: ImplementationPackagePlan): ImplementationPackagePlan {
  const normalized = structuredClone(plan);
  const sourcingClassifications = new Set(["exact_match", "near_match", "design_reference"]);

  for (const item of normalized.furnishing_schedule) {
    if (sourcingClassifications.has(item.classification) && !item.product) {
      item.classification = "illustrative";
    } else if (!sourcingClassifications.has(item.classification) && item.product) {
      item.product = null;
    }
  }

  const itemsById = new Map(normalized.furnishing_schedule.map((item) => [item.id, item]));
  for (const coverage of normalized.coverage) {
    const item = itemsById.get(coverage.schedule_item_id);
    if (!item) continue;
    coverage.disposition = item.classification === "custom"
      ? "custom"
      : item.classification === "illustrative"
        ? "illustrative"
        : item.classification === "non_purchasable"
          ? "non_purchasable"
          : "scheduled";
  }

  const tasksById = new Map(normalized.field_verification_tasks.map((task) => [task.id, task]));
  const claims = [
    ...normalized.placement_guidance,
    ...normalized.measurement_and_clearance_claims,
    ...normalized.furnishing_schedule.flatMap((item) => [item.placement, ...item.dimensions])
  ];
  for (const claim of claims) {
    if (claim.provenance !== "unknown") continue;
    let task = claim.field_task_id ? tasksById.get(claim.field_task_id) : undefined;
    if (!task) {
      let taskId = `field-${claim.id}`;
      let suffix = 2;
      while (tasksById.has(taskId)) {
        taskId = `field-${claim.id}-${suffix}`;
        suffix += 1;
      }
      task = {
        id: taskId,
        task: `Verify on site before purchase: ${claim.statement}`,
        reason: "The accepted rendering and stored room facts do not establish this claim.",
        priority: "before_purchase",
        resolves_claim_ids: [claim.id],
        status: "open"
      };
      normalized.field_verification_tasks.push(task);
      tasksById.set(task.id, task);
      claim.field_task_id = task.id;
    } else if (!task.resolves_claim_ids.includes(claim.id)) {
      task.resolves_claim_ids.push(claim.id);
    }
  }

  normalized.budget.total_low = normalized.furnishing_schedule.reduce(
    (sum, item) => sum + item.budget_low * item.quantity,
    0
  );
  normalized.budget.total_high = normalized.furnishing_schedule.reduce(
    (sum, item) => sum + item.budget_high * item.quantity,
    0
  );

  return normalized;
}

function normalizeLabel(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}
