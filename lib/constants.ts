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
