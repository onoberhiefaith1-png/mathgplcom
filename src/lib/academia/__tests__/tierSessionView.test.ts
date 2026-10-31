import { describe, expect, it } from "vitest";
import {
  TIER_VIDEO_COLUMN,
  cycleTier,
  initialSessionTier,
  sessionTierVideoUrl,
  tierBatch,
  tierVideo,
  tierVideoPatch,
  tierVideosOf,
} from "../tiers";
import { DEFAULT_TIER_STORAGE_KEY, parseDefaultTier, readDefaultTier, writeDefaultTier } from "../tierPreference";

describe("session tier selector", () => {
  it("cycles both ways and wraps", () => {
    expect(cycleTier("beginner", 1)).toBe("intermediate");
    expect(cycleTier("expert", 1)).toBe("beginner");
    expect(cycleTier("beginner", -1)).toBe("expert");
    expect(cycleTier(null, 1)).toBe("intermediate");
  });
  it("opens on ?tier=, else the default-tier setting, else Beginner", () => {
    expect(initialSessionTier("expert", "intermediate")).toBe("expert");
    expect(initialSessionTier(null, "intermediate")).toBe("intermediate");
    expect(initialSessionTier("nonsense", undefined)).toBe("beginner");
    expect(initialSessionTier(undefined, null)).toBe("beginner");
  });
  it("shows only the selected tier's activities — no fill-in from other tiers", () => {
    const rows = [
      { id: "b1", tier: "beginner", position: 0 },
      { id: "i1", tier: "intermediate", position: 0 },
      { id: "old", tier: null, position: 1 },
    ];
    expect(tierBatch(rows, "beginner").map((r) => r.id)).toEqual(["b1", "old"]);
    expect(tierBatch(rows, "intermediate").map((r) => r.id)).toEqual(["i1"]);
    expect(tierBatch(rows, "expert")).toEqual([]);
  });
});

describe("three video slots", () => {
  it("keeps the original video_url as the Beginner slot", () => {
    expect(TIER_VIDEO_COLUMN.beginner).toBe("video_url");
    expect(tierVideosOf({ video_url: "https://youtu.be/aaaaaaaaaaa" })).toEqual({
      beginner: "https://youtu.be/aaaaaaaaaaa", intermediate: null, expert: null,
    });
  });
  it("never falls back to another tier's video", () => {
    const v = tierVideosOf({ video_url: "b.mp4", intermediate_video_url: "  ", expert_video_url: "e.mp4" });
    expect(tierVideo(v, "beginner")).toBe("b.mp4");
    expect(tierVideo(v, "intermediate")).toBeNull();
    expect(tierVideo(v, "expert")).toBe("e.mp4");
    expect(tierVideo(undefined, "beginner")).toBeNull();
  });
  it("builds a DB patch that clears blank slots and leaves unsent ones alone", () => {
    expect(tierVideoPatch({ beginner: " a ", intermediate: "" })).toEqual({ video_url: "a", intermediate_video_url: null });
  });
});

describe("default tier preference", () => {
  it("parses unknown values as Beginner", () => {
    expect(parseDefaultTier("expert")).toBe("expert");
    expect(parseDefaultTier("ADVANCED")).toBe("beginner");
    expect(parseDefaultTier(null)).toBe("beginner");
  });
  it("round-trips through device storage when available", () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(DEFAULT_TIER_STORAGE_KEY);
    expect(readDefaultTier()).toBe("beginner");
    writeDefaultTier("intermediate");
    expect(readDefaultTier()).toBe("intermediate");
    window.localStorage.removeItem(DEFAULT_TIER_STORAGE_KEY);
  });
});

describe("Mathemagine session tier video", () => {
  it("Beginner falls back to the legacy videoUrl; other tiers never borrow it", () => {
    const legacy = { videoUrl: "https://youtu.be/aaaaaaaaaaa" };
    expect(sessionTierVideoUrl(legacy, "beginner")).toBe("https://youtu.be/aaaaaaaaaaa");
    expect(sessionTierVideoUrl(legacy, "intermediate")).toBeNull();
    const partial = { videoUrl: "https://youtu.be/aaaaaaaaaaa", videos: { beginner: null, intermediate: "https://youtu.be/bbbbbbbbbbb" } };
    expect(sessionTierVideoUrl(partial, "beginner")).toBe("https://youtu.be/aaaaaaaaaaa");
    expect(sessionTierVideoUrl(partial, "intermediate")).toBe("https://youtu.be/bbbbbbbbbbb");
    expect(sessionTierVideoUrl(partial, "expert")).toBeNull();
  });
  it("splits a mixed activity list (pack activities carry tier) into one batch per tier", () => {
    const acts = [
      { id: "sd", tier: "expert" },
      { id: "quad", tier: "intermediate" },
      { id: "legacy" },
    ];
    expect(tierBatch(acts, "beginner").map((a) => a.id)).toEqual(["legacy"]);
    expect(tierBatch(acts, "intermediate").map((a) => a.id)).toEqual(["quad"]);
    expect(tierBatch(acts, "expert").map((a) => a.id)).toEqual(["sd"]);
  });
});
