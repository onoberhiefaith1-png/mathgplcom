import { describe, it, expect } from "vitest";
import { doorShouldConsumeEvent } from "../HallwayScene";

// Regression coverage for a bug that recurred three times in this exact
// scene ("clicking a door sometimes opens the building instead of the
// door") despite three prior "permanent" fixes targeting other causes
// (room-identity resolution, entry-race conditions). None of those covered
// this specific gap: a classroom door that fails its own facing check
// neither entered a room nor stopped the click, so the same click ray could
// go on to trigger the entrance door behind it and exit the building.
describe("doorShouldConsumeEvent — a door must not leak its own failed click elsewhere", () => {
  it("a door facing the camera always consumes the event", () => {
    expect(doorShouldConsumeEvent(true, false)).toBe(true); // classroom door
    expect(doorShouldConsumeEvent(true, true)).toBe(true); // entrance door
  });

  it("REGRESSION: a classroom door NOT facing the camera still consumes the event", () => {
    // This is the exact fix: before it, a marginal-angle click on a
    // classroom door fell through to whatever the same ray hit next —
    // typically the ever-present entrance door — silently exiting the
    // building instead of simply doing nothing.
    expect(doorShouldConsumeEvent(false, false)).toBe(true);
  });

  it("the entrance door alone lets a failed check pass through, by design", () => {
    // Preserves the original, still-needed behavior: the entrance door sits
    // centimetres from the player and must not swallow a click meant for a
    // classroom door further down the hallway.
    expect(doorShouldConsumeEvent(false, true)).toBe(false);
  });
});
