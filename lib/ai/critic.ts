import {
  conceptCritiqueSchema,
  diagnosisCritiqueSchema,
  finishedImageReviewSchema,
  productCritiqueSchema,
  renderCritiqueSchema,
  type AutopilotBrief,
  type ConceptCritique,
  type DiagnosisCritique,
  type FinishedImageReview,
  type MoodBoardConcept,
  type ProductCritique,
  type ProductPlanItem,
  type RenderCritique,
  type RenderPlan,
  type RoomAnalysis
} from "@/lib/schemas";
import {
  conceptCritiqueJsonSchema,
  diagnosisCritiqueJsonSchema,
  finishedImageReviewJsonSchema,
  productCritiqueJsonSchema,
  renderCritiqueJsonSchema
} from "@/lib/schemas/json";
import { runStructuredTask, type GatewayProvider } from "@/lib/ai/gateway";
import { SCALE_ANCHORS, CRITIC_DIMENSION_GUIDANCE } from "@/lib/ai/critic-rubric";
import { activeFailureFixture, FixtureFailureError } from "@/lib/ai/failure-fixtures";
import {
  buildConceptCritiqueFixture,
  buildDiagnosisCritiqueFixture,
  buildCriticalFinishedImageReviewFixture,
  buildFinishedImageReviewFixture,
  buildSeededCriticalFinishedImageReviewFixture,
  buildProductCritiqueFixture,
  buildRejectingConceptCritiqueFixture,
  buildRejectingRenderCritiqueFixture,
  buildRenderCritiqueFixture
} from "@/lib/ai/fixtures/critic";

/**
 * Real Critic implementation. Replaces the previously hardcoded mock in
 * services.ts (`designCritic()` returned a fixed score with no model call).
 * Scores a set of concepts against the rubric in critic-rubric.ts and logs
 * the run to ai_runs via the gateway, same as any other AI call.
 */
export async function critiqueConcepts(input: {
  roomId: string;
  concepts: MoodBoardConcept[];
  contextBrain: unknown;
  provider?: GatewayProvider;
}): Promise<ConceptCritique> {
  // P0.0 critic_rejection fixture: deterministic blocking critique in mock
  // mode so the rejection path (bounded regeneration, no silent pass) is
  // testable without a paid call. Inert outside AI_MODE=mock.
  const rejecting = (await activeFailureFixture()) === "critic_rejection";
  return runStructuredTask({
    roomId: input.roomId,
    serviceName: "Design Critic",
    provider: input.provider ?? "anthropic",
    promptPath: "prompts/critic/score-artifact.v1.md",
    schemaName: "concept_critique",
    schema: conceptCritiqueJsonSchema,
    zodSchema: conceptCritiqueSchema,
    maxTokens: 8192,
    taskInput: {
      task: "Score this set of concepts as an independent, tough reviewer.",
      concepts: input.concepts,
      context_brain: input.contextBrain,
      scale_anchors: SCALE_ANCHORS,
      dimension_guidance: CRITIC_DIMENSION_GUIDANCE
    },
    mock: () =>
      rejecting ? buildRejectingConceptCritiqueFixture(input.concepts) : buildConceptCritiqueFixture(input.concepts)
  });
}

export function overallScore(scores: Record<string, number>): number {
  const values = Object.values(scores);
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function critiqueDiagnosis(input: {
  roomId: string;
  diagnosis: RoomAnalysis;
  room: unknown;
  home?: unknown;
  contextBrain: unknown;
  provider?: GatewayProvider;
}): Promise<DiagnosisCritique> {
  return runStructuredTask({
    roomId: input.roomId,
    serviceName: "Diagnosis Critic",
    provider: input.provider ?? "anthropic",
    promptPath: "prompts/critic/score-diagnosis.v1.md",
    schemaName: "diagnosis_critique",
    schema: diagnosisCritiqueJsonSchema,
    zodSchema: diagnosisCritiqueSchema,
    maxTokens: 4096,
    taskInput: {
      task: "Score this room diagnosis as an independent reviewer.",
      room: input.room,
      home: input.home,
      diagnosis: input.diagnosis,
      context_brain: input.contextBrain
    },
    mock: () => buildDiagnosisCritiqueFixture()
  });
}

/**
 * Independent product-plan critic. Mirrors the concept/diagnosis critics: runs
 * through the gateway (so it is logged to ai_runs and visible in /debug), scores
 * the product plan against the locked concept and typed room reality, and never
 * mutates state. Authoritative but non-blocking for now, matching the concept
 * critic convention (no unbounded auto-regeneration).
 */
/**
 * Render Critic (Phase 4). Reviews a render *plan* (the prompt + preservation /
 * transformation / negative instructions) against the room's typed spatial
 * constraint set and the preservation contract BEFORE the image is generated
 * and presented as "current." Blocking on door-clearance breaches, backlit call
 * users, architectural/camera drift, warped/duplicated objects, and object-
 * budget overfill. Runs through the gateway (logged to ai_runs). Gated: a
 * non-empty `blocking_violations` triggers one bounded plan regeneration.
 */
export async function critiqueRender(input: {
  roomId: string;
  plan: RenderPlan;
  contextBrain: unknown;
  objectBudget?: unknown;
  userInstructions?: string | null;
  provider?: GatewayProvider;
}): Promise<RenderCritique> {
  // P0.0 critic_rejection fixture — see critiqueConcepts.
  const fixture = await activeFailureFixture();
  const rejecting = fixture === "critic_rejection";
  // P0.2 critic_timeout fixture: the render critic itself fails to respond in
  // time. This is an OPERATIONAL failure (transport/timeout), NOT a design
  // rejection — the caller must treat it as recoverable and must never silently
  // record it as a passed critic. Mock-only (activeFailureFixture is inert live).
  if (fixture === "critic_timeout") {
    throw new FixtureFailureError("critic_timeout", "Simulated Render Critic timeout: review exceeded its time budget (fixture).");
  }
  return runStructuredTask({
    roomId: input.roomId,
    serviceName: "Render Critic",
    provider: input.provider ?? "anthropic",
    promptPath: "prompts/critic/score-render.v1.md",
    schemaName: "render_critique",
    schema: renderCritiqueJsonSchema,
    zodSchema: renderCritiqueSchema,
    maxTokens: 4096,
    taskInput: {
      task: "Review this render plan against the room's spatial constraints and the preservation contract, as an independent, tough reviewer, before the edit is presented as current.",
      render_plan: input.plan,
      context_brain: input.contextBrain,
      object_budget: input.objectBudget,
      user_instructions: input.userInstructions,
      scale_anchors: SCALE_ANCHORS
    },
    mock: () => (rejecting ? buildRejectingRenderCritiqueFixture() : buildRenderCritiqueFixture())
  });
}

export async function reviewFinishedImage(input: {
  roomId: string;
  sourceImageUrl: string;
  finishedImageUrl: string;
  brief: AutopilotBrief;
  typedFacts: unknown;
  attempt?: 1 | 2;
  provider?: GatewayProvider;
}): Promise<FinishedImageReview> {
  const fixture = await activeFailureFixture();
  const attempt = input.attempt ?? 1;
  const seededCriticalReview = fixture ? buildSeededCriticalFinishedImageReviewFixture(fixture) : null;
  return runStructuredTask({
    roomId: input.roomId,
    serviceName: "Finished Image Reviewer",
    provider: input.provider ?? "anthropic",
    promptPath: "prompts/critic/review-finished-image.v1.md",
    schemaName: "finished_image_review",
    schema: finishedImageReviewJsonSchema,
    zodSchema: finishedImageReviewSchema,
    maxTokens: 4096,
    taskInput: {
      task: "Compare the finished room image with its source and decide whether it is safe to present as the current candidate.",
      compiled_brief: input.brief,
      typed_facts: input.typedFacts,
      review_attempt: attempt,
      image_order: ["source", "finished"]
    },
    images: [
      { url: input.sourceImageUrl, detail: "high" },
      { url: input.finishedImageUrl, detail: "high" }
    ],
    mock: () =>
      seededCriticalReview ??
      (fixture === "finished_image_critical" || (fixture === "finished_image_repairable" && attempt === 1)
        ? buildCriticalFinishedImageReviewFixture()
        : buildFinishedImageReviewFixture())
  });
}

export async function critiqueProducts(input: {
  roomId: string;
  products: ProductPlanItem[];
  concept: unknown;
  diagnosis?: unknown;
  approvedRender?: unknown;
  contextBrain: unknown;
  provider?: GatewayProvider;
}): Promise<ProductCritique> {
  return runStructuredTask({
    roomId: input.roomId,
    serviceName: "Product Critic",
    provider: input.provider ?? "anthropic",
    promptPath: "prompts/critic/score-products.v1.md",
    schemaName: "product_critique",
    schema: productCritiqueJsonSchema,
    zodSchema: productCritiqueSchema,
    maxTokens: 4096,
    taskInput: {
      task: "Score this product plan against the locked concept and the real room as an independent, tough reviewer.",
      products: input.products,
      locked_concept: input.concept,
      diagnosis: input.diagnosis,
      approved_render: input.approvedRender,
      context_brain: input.contextBrain,
      scale_anchors: SCALE_ANCHORS
    },
    mock: () => buildProductCritiqueFixture()
  });
}
