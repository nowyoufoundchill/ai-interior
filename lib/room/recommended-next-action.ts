export type RoomTab = "Photos & Brief" | "Concepts" | "Renders" | "Chat" | "Products";

export type RoomJobState = {
  jobType: "diagnosis" | "moodboards" | "render" | "batch_render" | "chat_action" | "products";
  status: string;
  progressCurrent?: number;
  progressTotal?: number;
  failedChildren?: number;
  activeChildren?: number;
};

export type RecommendedNextAction = {
  primary: { id: string; label: string };
  secondary: { id: string; label: string }[];
  targetTab: RoomTab;
  reason: string;
};

export type RoomActionState = {
  photoCount: number;
  hasCurrentDiagnosis: boolean;
  activeConceptCount: number;
  hasApprovedConcept: boolean;
  currentRenderCount: number;
  staleConceptCount: number;
  staleProductCount: number;
  staleRenderCount: number;
  hasProducts: boolean;
  jobs?: RoomJobState[];
};

const ACTIVE = new Set(["queued", "planning", "validating", "generating", "persisting"]);

function action(id: string, label: string, targetTab: RoomTab, reason: string, secondary: RecommendedNextAction["secondary"] = []): RecommendedNextAction {
  return { primary: { id, label }, secondary: secondary.slice(0, 2), targetTab, reason };
}

/** Pure, persisted-state decision used by room chrome and panel actions. */
export function recommendedNextAction(state: RoomActionState): RecommendedNextAction {
  const jobs = state.jobs ?? [];
  const latestByType = new Map<string, RoomJobState>();
  for (const job of jobs) if (!latestByType.has(job.jobType)) latestByType.set(job.jobType, job);
  const currentJobs = [...latestByType.values()];
  const activeJob = currentJobs.find((job) => ACTIVE.has(job.status));
  const failedJob = currentJobs.find((job) => job.status === "retryable_failed" || job.status === "terminal_failed");
  const batch = latestByType.get("batch_render");

  if (batch && (batch.failedChildren ?? 0) > 0) {
    return action("retry-failed-perspectives", "Retry failed perspectives", "Renders", "Some perspectives did not finish; your successful renders are safe.");
  }

  if (failedJob) {
    return action(
      failedJob.status === "retryable_failed" ? "retry-job" : "review-failure",
      failedJob.status === "retryable_failed" ? "Try again" : "Review what was saved",
      failedJob.jobType === "chat_action" ? "Chat" : failedJob.jobType === "diagnosis" ? "Photos & Brief" : "Renders",
      failedJob.status === "retryable_failed" ? "This step can be retried without losing your saved room work." : "This step could not be recovered; review the saved work before choosing what to do next."
    );
  }

  if (activeJob) {
    const targetTab: RoomTab = activeJob.jobType === "diagnosis" ? "Photos & Brief" : activeJob.jobType === "moodboards" ? "Concepts" : activeJob.jobType === "chat_action" ? "Chat" : "Renders";
    const label = activeJob.jobType === "batch_render" ? "View batch progress" : activeJob.jobType === "chat_action" ? "View chat progress" : "View progress";
    return action("view-progress", label, targetTab, "Work is already in progress and will continue from its saved state.");
  }

  if (!state.photoCount) return action("add-photos", "Add room photos", "Photos & Brief", "A room photo is the first step toward a useful reading.");
  if (!state.hasCurrentDiagnosis) return action("generate-diagnosis", "Generate diagnosis", "Photos & Brief", "Your photos are ready for a room reading.");
  if (state.staleConceptCount > 0) return action("refresh-concepts", "Refresh concepts", "Concepts", "The diagnosis changed, so these directions no longer describe the current room.");
  if (!state.activeConceptCount) return action("generate-concepts", "Generate concepts", "Concepts", "The diagnosis is ready to translate into design directions.");
  if (!state.hasApprovedConcept) return action("approve-concept", "Approve a direction", "Concepts", "Choose the direction you want to see on your real room.");
  if (state.staleRenderCount > 0) return action("refresh-renders", "Refresh renders", "Renders", "These visualizations are stale relative to the approved direction.");
  if (!state.currentRenderCount) return action("generate-render", "Visualize your room", "Renders", "Your approved direction is ready to apply to a room photo.");
  if (state.staleProductCount > 0) return action("refresh-products", "Refresh products", "Products", "The product plan is stale relative to the approved direction.");
  return action("review-renders", "Review your renders", "Renders", "Your room visualizations are ready to review.", [{ id: "open-chat", label: "Open design chat" }, { id: "source-products", label: "Source products" }]);
}
