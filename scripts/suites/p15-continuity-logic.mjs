import assert from "node:assert/strict";
import { buildWholeHomeMemory } from "../../lib/ai/context-brain/whole-home-memory.ts";
import { deriveRoomIndexState } from "../../lib/home/room-index.ts";

const home = {
  id: "home-1",
  style_notes: "Quiet, warm, and tailored",
  whole_home_palette: ["warm white", "natural oak"],
  whole_home_constraints: ["avoid cool grey flooring"]
};
const preferences = [
  { preference_type: "material", label: "aged brass in small doses" },
  { preference_type: "avoid", label: "no literal theme decor" }
];

const rooms = [
  { id: "kitchen", room_type: "Kitchen", constraints: ["keep the island plumbing"], existing_items: ["stone counters"] },
  { id: "bedroom", room_type: "Bedroom", constraints: ["blackout curtains only here"], existing_items: ["walnut bed"] },
  { id: "office", room_type: "Home office", constraints: ["preserve three door paths"], existing_items: ["standing desk"] }
];

const memories = rooms.map((room) => buildWholeHomeMemory({ home, room, preferences }));
const sharedLabels = memories.map((memory) => memory.shared_decisions.map((decision) => decision.label));
assert.deepEqual(sharedLabels[0], sharedLabels[1]);
assert.deepEqual(sharedLabels[1], sharedLabels[2]);
assert.ok(sharedLabels.every((labels) => labels.includes("natural oak") && labels.includes("aged brass in small doses")));
assert.ok(memories[0].room_only_decisions.some((decision) => decision.label === "keep the island plumbing"));
assert.ok(!memories[1].room_only_decisions.some((decision) => decision.label === "keep the island plumbing"));
assert.ok(!memories[2].room_only_decisions.some((decision) => decision.label === "blackout curtains only here"));

const lifecycleCases = [
  ["empty", { photoCount: 0, currentStage: "empty", roomStatus: "intake" }],
  ["ready", { photoCount: 1, currentStage: "photos", roomStatus: "photos" }],
  ["working", { photoCount: 1, currentStage: "photos", roomStatus: "photos", latestJobStatus: "generating" }],
  ["needs_attention", { photoCount: 1, currentStage: "photos", roomStatus: "photos", latestJobStatus: "retryable_failed" }],
  ["design_ready", { photoCount: 1, currentStage: "design_ready", roomStatus: "design_ready", renderStatus: "candidate" }],
  ["kept", { photoCount: 1, currentStage: "approved", roomStatus: "approved", renderStatus: "accepted" }],
  ["implementation_ready", { photoCount: 1, currentStage: "implementation_ready", roomStatus: "implementation_ready", renderStatus: "accepted", hasCurrentPackage: true }]
];

for (const [expected, input] of lifecycleCases) {
  const result = deriveRoomIndexState(input);
  assert.equal(result.state, expected);
  assert.ok(result.label && result.nextAction);
}

console.log("PASS - three room types inherit the same shared decisions");
console.log("PASS - room-only exceptions remain scoped to their room");
console.log("PASS - all persisted room lifecycle states resolve one next action");
