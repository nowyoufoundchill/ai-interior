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
  "Photos",
  "Diagnosis",
  "Mood Boards",
  "Products",
  "Renders",
  "Chat",
  "Memory"
] as const;

export const ROOM_STATUSES = {
  intake: "Intake",
  photos: "Photos added",
  analyzed: "Diagnosis ready",
  concepts: "Concepts ready",
  selected: "Concept selected",
  products: "Products planned",
  renders: "Mockups ready"
} as const;
