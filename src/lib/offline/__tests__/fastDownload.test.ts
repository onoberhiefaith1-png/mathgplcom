import { describe, expect, it } from "vitest";
import { ESSENTIAL_TIMEOUT_MS, PARALLEL, runPool, splitMedia } from "../prepareOffline";

describe("fast offline download", () => {
  it("keeps videos out of the essentials that decide Ready", () => {
    const { essential, videos } = splitMedia(["/a.webp?_aof=1", "/v.mp4?_aof=1", "/s.mp3", "/b.MOV"]);
    expect(essential).toEqual(["/a.webp?_aof=1", "/s.mp3"]);
    expect(videos).toEqual(["/v.mp4?_aof=1", "/b.MOV"]);
  });

  it("downloads 6 files at once and each essential waits at most 15 seconds", async () => {
    expect(PARALLEL).toBe(6);
    expect(ESSENTIAL_TIMEOUT_MS).toBe(15_000);
    let running = 0;
    let peak = 0;
    await runPool(Array.from({ length: 20 }, (_, i) => i), PARALLEL, async () => {
      running++; peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
    });
    expect(peak).toBe(6);
  });
});
