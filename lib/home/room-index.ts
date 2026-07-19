export const ACTIVE_JOB_STATUSES = new Set(["queued", "planning", "validating", "generating", "persisting"]);
export const FAILED_JOB_STATUSES = new Set(["retryable_failed", "terminal_failed"]);

export type RoomIndexState =
  | "empty"
  | "ready"
  | "working"
  | "needs_attention"
  | "design_ready"
  | "kept"
  | "implementation_ready";

export function deriveRoomIndexState(input: {
  photoCount: number;
  currentStage: string;
  roomStatus: string;
  renderStatus?: string | null;
  latestJobStatus?: string | null;
  hasCurrentPackage?: boolean;
}): { state: RoomIndexState; label: string; nextAction: string } {
  if (input.latestJobStatus && ACTIVE_JOB_STATUSES.has(input.latestJobStatus)) {
    return { state: "working", label: "Design in progress", nextAction: "View progress" };
  }
  if (input.latestJobStatus && FAILED_JOB_STATUSES.has(input.latestJobStatus)) {
    return { state: "needs_attention", label: "Needs attention", nextAction: "Review and continue" };
  }
  if (input.hasCurrentPackage || input.currentStage === "implementation_ready") {
    return { state: "implementation_ready", label: "Room plan ready", nextAction: "Open room plan" };
  }
  if (input.renderStatus === "accepted" || input.currentStage === "approved" || input.roomStatus === "approved") {
    return { state: "kept", label: "Design kept", nextAction: "Continue this room" };
  }
  if (input.renderStatus === "candidate" || input.currentStage === "design_ready") {
    return { state: "design_ready", label: "Recommendation ready", nextAction: "Review the design" };
  }
  if (input.photoCount > 0) {
    return { state: "ready", label: "Photo ready", nextAction: "Design this room" };
  }
  return { state: "empty", label: "Ready to begin", nextAction: "Add a room photo" };
}
