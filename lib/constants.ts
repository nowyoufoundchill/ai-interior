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

export const ROOM_TABS = [
  "Photos & Brief",
  "Diagnosis",
  "Concepts",
  "Products",
  "Renders",
  "Chat"
] as const;

export const ROOM_STATUSES = {
  empty: "Ready for intake",
  photos: "Photos and dimensions added",
  diagnosed: "Diagnosis ready",
  concepts: "Concepts generated",
  concept_locked: "Concept locked",
  executing: "Execution in progress",
  intake: "Intake",
  analyzed: "Diagnosis ready",
  selected: "Concept selected",
  products: "Products planned",
  renders: "Mockups ready"
} as const;
