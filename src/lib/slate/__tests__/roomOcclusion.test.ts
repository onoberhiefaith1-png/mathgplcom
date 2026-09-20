import { describe, expect, it } from "vitest";
import { ROOMS, NEUTRAL_ROOM, roomOcclusion } from "../rooms";
import { SLATE_Z, gameWritingWidth } from "../layout";

/** Same projection the board uses: prop silhouette measured at slate depth. */
const safeWidth = (x: number, z: number, eyeZ = 3) =>
  Math.max(1.2, (Math.abs(x) * ((eyeZ - SLATE_Z) / (eyeZ - z)) - 0.12) * 2);

describe("room-safe writing span", () => {
  it("reports side-standing props for pillared rooms", () => {
    const pillared = ROOMS.find((room) => room.props === "pillars");
    expect(pillared).toBeTruthy();
    const block = roomOcclusion(pillared!);
    expect(block).toEqual({ x: 4.3, z: -4.4 });
  });

  it("has no blockers when there is no room", () => {
    expect(roomOcclusion(null)).toBeNull();
    expect(roomOcclusion({ ...NEUTRAL_ROOM, props: "forge" })).toBeNull();
  });

  it("keeps writing inside the pillars on a wide screen", () => {
    const block = roomOcclusion(ROOMS.find((room) => room.props === "pillars")!)!;
    const safe = safeWidth(block.x, block.z);
    // a very wide viewport would otherwise let writing run behind a pillar
    const screen = gameWritingWidth(20);
    expect(Math.min(screen, safe)).toBeCloseTo(safe, 5);
    expect(safe).toBeLessThan(screen);
  });

  it("keeps the full screen band when the room is narrower than the pillars", () => {
    const block = roomOcclusion(ROOMS.find((room) => room.props === "pillars")!)!;
    const safe = safeWidth(block.x, block.z);
    const screen = gameWritingWidth(6);
    expect(Math.min(screen, safe)).toBeCloseTo(screen, 5);
  });
});
