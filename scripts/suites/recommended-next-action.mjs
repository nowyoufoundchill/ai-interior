import assert from "node:assert/strict";
import { recommendedNextAction } from "../../lib/room/recommended-next-action.ts";

const base = { photoCount: 0, hasCurrentDiagnosis: false, activeConceptCount: 0, hasApprovedConcept: false, currentRenderCount: 0, staleConceptCount: 0, staleProductCount: 0, staleRenderCount: 0, hasProducts: false };
const cases = [
  ["no photos", {}, "add-photos", "Photos & Brief"],
  ["ready for diagnosis", { photoCount: 2 }, "generate-diagnosis", "Photos & Brief"],
  ["ready for concepts", { photoCount: 2, hasCurrentDiagnosis: true }, "generate-concepts", "Concepts"],
  ["concepts need approval", { ...base, photoCount: 2, hasCurrentDiagnosis: true, activeConceptCount: 3 }, "approve-concept", "Concepts"],
  ["ready to render", { ...base, photoCount: 2, hasCurrentDiagnosis: true, activeConceptCount: 3, hasApprovedConcept: true }, "generate-render", "Renders"],
  ["batch active", { ...base, photoCount: 2, hasCurrentDiagnosis: true, activeConceptCount: 3, hasApprovedConcept: true, jobs: [{ jobType: "batch_render", status: "generating" }] }, "view-progress", "Renders"],
  ["partial batch failure", { ...base, photoCount: 2, hasCurrentDiagnosis: true, activeConceptCount: 3, hasApprovedConcept: true, jobs: [{ jobType: "batch_render", status: "retryable_failed", failedChildren: 1 }] }, "retry-failed-perspectives", "Renders"],
  ["partial batch with failed child", { ...base, photoCount: 2, hasCurrentDiagnosis: true, activeConceptCount: 3, hasApprovedConcept: true, jobs: [{ jobType: "batch_render", status: "completed", failedChildren: 1 }, { jobType: "render", status: "terminal_failed" }] }, "retry-failed-perspectives", "Renders"],
  ["renders ready for review", { ...base, photoCount: 2, hasCurrentDiagnosis: true, activeConceptCount: 3, hasApprovedConcept: true, currentRenderCount: 2 }, "review-renders", "Renders"],
  ["stale downstream work", { ...base, photoCount: 2, hasCurrentDiagnosis: true, activeConceptCount: 3, hasApprovedConcept: true, currentRenderCount: 2, staleRenderCount: 2 }, "refresh-renders", "Renders"],
  ["terminal failure", { ...base, photoCount: 2, jobs: [{ jobType: "render", status: "terminal_failed" }] }, "review-failure", "Renders"]
];

for (const [name, overrides, id, tab] of cases) {
  const result = recommendedNextAction({ ...base, ...overrides });
  assert.equal(result.primary.id, id, name);
  assert.equal(result.targetTab, tab, name);
  assert.ok(result.reason.length > 0, name);
  assert.ok(result.secondary.length <= 2, name);
}
console.log(`recommended-next-action: ${cases.length} cases passed`);
