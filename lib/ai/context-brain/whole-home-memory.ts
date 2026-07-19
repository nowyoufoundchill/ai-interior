type Preference = { preference_type: string; label: string };

type RoomContext = {
  id: string;
  room_type?: string | null;
  style_preferences?: unknown;
  color_preferences?: unknown;
  constraints?: unknown;
  existing_items?: unknown;
};

type HomeContext = {
  id: string;
  style_notes?: string | null;
  whole_home_palette?: unknown;
  whole_home_constraints?: unknown;
};

export type WholeHomeMemory = {
  home_id: string;
  shared_decisions: { kind: string; label: string; source: "home" | "confirmed_preference" }[];
  room_only_decisions: { kind: string; label: string; source: "room" }[];
  application_rule: string;
};

/**
 * Builds the scoped continuity context for exactly one room. Home fields and
 * confirmed preferences are shared; room facts never leave this invocation.
 * Keeping the boundary explicit prevents a bedroom exception from becoming a
 * standing rule for a kitchen (or any later room).
 */
export function buildWholeHomeMemory(input: {
  home: HomeContext;
  room: RoomContext;
  preferences?: Preference[];
}): WholeHomeMemory {
  const shared = [
    ...strings(input.home.whole_home_palette).map((label) => ({ kind: "palette", label, source: "home" as const })),
    ...strings(input.home.whole_home_constraints).map((label) => ({ kind: "constraint", label, source: "home" as const })),
    ...(input.home.style_notes?.trim()
      ? [{ kind: "style", label: input.home.style_notes.trim(), source: "home" as const }]
      : []),
    ...(input.preferences ?? [])
      .filter((preference) => preference.label?.trim())
      .map((preference) => ({
        kind: preference.preference_type,
        label: preference.label.trim(),
        source: "confirmed_preference" as const
      }))
  ];

  const roomOnly = [
    ...strings(input.room.style_preferences).map((label) => ({ kind: "style", label, source: "room" as const })),
    ...strings(input.room.color_preferences).map((label) => ({ kind: "color", label, source: "room" as const })),
    ...strings(input.room.constraints).map((label) => ({ kind: "constraint", label, source: "room" as const })),
    ...strings(input.room.existing_items).map((label) => ({ kind: "existing_item", label, source: "room" as const }))
  ];

  return {
    home_id: input.home.id,
    shared_decisions: dedupe(shared),
    room_only_decisions: dedupe(roomOnly),
    application_rule:
      "Apply shared decisions where they suit this room. Room-only decisions and typed facts outrank shared taste and must never be copied to another room."
  };
}

function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  if (typeof value === "string" && value.trim()) return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function dedupe<T extends { kind: string; label: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${item.label}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
