import { describe, expect, it } from "vitest";

import { initialStance, resolveEntry } from "@/lib/building/entry";
import { classroomDimensions } from "@/lib/building/classroom";
import type { BuildingClassroom, ClassroomKind } from "@/lib/building/types";

const room = (id: string, doorId: string, kind: ClassroomKind = "classroom") =>
  ({ id, door_id: doorId, kind, name: id } as unknown as BuildingClassroom);

const call = (doorId: string, rooms: BuildingClassroom[]) =>
  resolveEntry({ doorId, rooms, doorWorld: [4, -9], front: [1, 0] });

describe("door → room entry", () => {
  it("opens the room whose door_id is that exact door", () => {
    const res = call("door-b", [room("room-a", "door-a"), room("room-b", "door-b")]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.entry.room.id).toBe("room-b");
    // The room lies opposite the way the door faces.
    expect(res.entry.into[0]).toBe(-1);
    expect(Math.abs(res.entry.into[1])).toBe(0);
    expect(res.entry.doorWorld).toEqual([4, -9]);
  });

  it("never falls back to another room", () => {
    expect(call("door-z", [room("room-a", "door-a")]).ok).toBe(false);
    expect(call("", [room("room-a", "door-a")]).ok).toBe(false);
    expect(call("door-a", []).ok).toBe(false);
  });

  it("resolves the same destination for a repeated click", () => {
    const rooms = [room("room-a", "door-a"), room("room-b", "door-b")];
    const first = call("door-a", rooms);
    const second = call("door-a", rooms);
    expect(first.ok && second.ok && first.entry.room.id === second.entry.room.id).toBe(true);
  });

  it("stands the walker inside every kind of room", () => {
    for (const kind of ["classroom", "teaching_hall", "auditorium"] as ClassroomKind[]) {
      const stance = initialStance(kind);
      expect(stance.z).toBeGreaterThan(0);
      expect(stance.z).toBeLessThan(classroomDimensions(kind).length);
      expect(stance.x).toBe(0);
      expect(stance.yaw).toBe(0);
    }
  });
});
