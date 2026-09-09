/**
 * The smart screen must obey the teacher's own size and place when they have
 * set one, and fall back to the room's automatic sizing when they have not.
 */
import { describe, expect, it } from "vitest";
import { screenMount, type RoomScreen } from "@/lib/building/screen";

const row = (over: Partial<RoomScreen>): RoomScreen =>
  ({
    id: "s",
    building_id: "b",
    classroom_id: "c",
    video_path: null,
    video_mime: null,
    video_name: null,
    camera_active: false,
    camera_host_id: null,
    wall: "endWall",
    width: null,
    height_ratio: 9 / 16,
    offset_along: null,
    offset_y: null,
    rotation: 0,
    locked: false,
    updated_at: "",
    ...over,
  }) as RoomScreen;

describe("screenMount", () => {
  it("uses the room's own proportions when nothing is set", () => {
    const auto = screenMount("classroom");
    expect(auto.width).toBeGreaterThan(1);
    expect(auto.height).toBeCloseTo(auto.width * (9 / 16), 5);
    expect(auto.position[0]).toBeCloseTo(0, 5);
  });

  it("takes the teacher's width and shape", () => {
    const m = screenMount("classroom", row({ width: 3, height_ratio: 1 }));
    expect(m.width).toBeCloseTo(3, 5);
    expect(m.height).toBeCloseTo(3, 5);
  });

  it("moves across the wall and up the wall", () => {
    const left = screenMount("classroom", row({ width: 2, offset_along: 0 }));
    const right = screenMount("classroom", row({ width: 2, offset_along: 1 }));
    expect(left.position[0]).toBeLessThan(0);
    expect(right.position[0]).toBeGreaterThan(0);
    const high = screenMount("classroom", row({ width: 2, offset_y: 2.4 }));
    expect(high.centreY).toBeCloseTo(2.4, 5);
  });

  it("never lets a screen grow wider than its room", () => {
    const m = screenMount("classroom", row({ width: 99 }));
    expect(m.width).toBeLessThan(20);
  });
});
