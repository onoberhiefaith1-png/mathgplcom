import { expect, it } from "vitest";
import { CASTLE_URL, GAME_FONT_URLS, backdropFor, gameLookUrls, missingFrom } from "../offlineLook";

it("lists the castle, every Game font and the surface frames a Game uses", () => {
  const urls = gameLookUrls({ surfaceId: "wood", slots: [{ surfaceId: "stone-wall" }, { surfaceId: "nope-not-a-surface" }, {}] });
  expect(urls).toContain(CASTLE_URL);
  for (const font of GAME_FONT_URLS) expect(urls).toContain(font);
  expect(urls).toContain("/offline-game/surfaces/wood.webp");
  expect(urls).toContain("/offline-game/surfaces/stone-wall.webp");
  expect(urls.some((u) => u.includes("nope-not-a-surface"))).toBe(false);
  expect(new Set(urls).size).toBe(urls.length);
});

it("still lists the castle, fonts and the default frame with no Game", () => {
  for (const game of [null, undefined, {}, { slots: "x" }]) {
    const urls = gameLookUrls(game as never);
    expect(urls).toContain(CASTLE_URL);
    expect(urls).toContain("/offline-game/surfaces/scroll.webp");
  }
});

it("only asks for what the device is missing, once each", () => {
  expect(missingFrom(["a", "b", "b", "c"], new Set(["a"]))).toEqual(["b", "c"]);
  expect(missingFrom(["a"], new Set(["a"]))).toEqual([]);
});

it("shows the video only once it has a frame and has not failed", () => {
  expect(backdropFor({ frame: true, failed: false, started: true, online: false })).toEqual({ showVideo: true, notice: null });
  expect(backdropFor({ frame: false, failed: false, started: false, online: false }).notice).toBeNull();
});

it("explains a missing video offline and online, and never goes dark", () => {
  const offline = backdropFor({ frame: false, failed: true, started: true, online: false });
  expect(offline.showVideo).toBe(false);
  expect(offline.notice).toMatch(/not saved on this device/);
  const loading = backdropFor({ frame: false, failed: false, started: true, online: true });
  expect(loading.notice).toMatch(/still loading/);
  expect(backdropFor({ frame: true, failed: true, started: true, online: true }).showVideo).toBe(false);
});
