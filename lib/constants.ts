export const SINGLE_HOUSEHOLD_USER_ID = "00000000-0000-0000-0000-000000000001";

export const PHOTO_LABELS = [
  "Main angle",
  "Wall A",
  "Wall B",
  "Wall C",
  "Wall D",
  "Corner",
  "Ceiling",
  "Floor",
  "Existing item",
  "Inspiration"
] as const;

// P0.3 batch eligibility: room-perspective photos render by default; these
// non-perspective labels are excluded from "Render all perspectives" unless the
// owner explicitly selects them. Shared by the batch runner and the workspace UI
// so the previewed count and the server's selection always agree.
export const RENDER_EXCLUDED_PHOTO_LABELS = ["Ceiling", "Floor", "Existing item", "Inspiration"] as const;

export function isEligiblePerspectiveLabel(label: string | null | undefined): boolean {
  const value = (label ?? "").trim();
  if (!value) return true;
  return !(RENDER_EXCLUDED_PHOTO_LABELS as readonly string[]).includes(value);
}

// Order reflects the homeowner's mental model, not the pipeline: pick a
// direction, see it on your real room, refine it — then source products.
// Diagnosis now lives inside the first room page instead of as a separate tab.
export const ROOM_TABS = [
  "Photos & Brief",
  "Concepts",
  "Renders",
  "Chat",
  "Products"
] as const;

export const ROOM_STATUSES = {
  empty: "Ready for intake",
  photos: "Photos and dimensions added",
  diagnosed: "Diagnosis ready",
  concepts: "Concepts generated",
  concept_locked: "Direction approved",
  executing: "In progress",
  intake: "Intake",
  analyzed: "Diagnosis ready",
  selected: "Direction approved",
  products: "Products sourced",
  renders: "Render ready"
} as const;
