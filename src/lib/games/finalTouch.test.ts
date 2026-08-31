import { describe, expect, it } from "vitest";
import { tuneFromLoop } from "./finalTouch";
import type { RawFrame } from "./bgAnalysis";

const W = 40;
const H = 40;

/** A flat-backdrop frame with a solid subject block in the middle. */
const frame = (opts: {
  bg?: [number, number, number];
  subject?: [number, number, number];
  shift?: number;
  hole?: boolean;
}): RawFrame => {
  const bg = opts.bg ?? [255, 255, 255];
  const subject = opts.subject ?? [30, 40, 60];
  const shift = opts.shift ?? 0;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const inside = x >= 12 + shift && x < 28 + shift && y >= 10 && y < 32;
      // A white detail inside the subject must survive the cut.
      const isHole = opts.hole && inside && x >= 18 && x < 22 && y >= 16 && y < 20;
      const c = isHole ? [255, 255, 255] : inside ? subject : bg;
      data[i] = c[0]!;
      data[i + 1] = c[1]!;
      data[i + 2] = c[2]!;
      data[i + 3] = 255;
    }
  }
  return { data, w: W, h: H };
};

describe("tuneFromLoop", () => {
  it("reports nothing to work with when there are no frames", () => {
    const res = tuneFromLoop([]);
    expect(res.ok).toBe(false);
    expect(res.patch).toBeNull();
  });

  it("clears a stable white backdrop across the whole loop", () => {
    const res = tuneFromLoop([frame({}), frame({}), frame({})]);
    expect(res.ok).toBe(true);
    expect(res.patch).not.toBeNull();
    expect(res.patch!.keyTolerance).toBeGreaterThan(0);
    expect(res.patch!.keyFeather).toBeGreaterThanOrEqual(1);
    expect(res.issues.find((i) => i.id === "backdrop")!.verdict).toBe("fixed");
  });

  it("keeps white detail inside the subject out of the key decision", () => {
    const res = tuneFromLoop([frame({ hole: true }), frame({ hole: true })]);
    expect(res.ok).toBe(true);
    // The interior white patch must not push the tolerance wide open.
    expect(res.patch!.keyTolerance).toBeLessThan(0.6);
  });

  it("adds a loop fade when the first and last frame disagree", () => {
    const res = tuneFromLoop([frame({ shift: 0 }), frame({ shift: 4 }), frame({ shift: 8 })]);
    expect(res.patch!.loopFade).toBeGreaterThan(0);
    expect(res.issues.find((i) => i.id === "seam")!.verdict).toBe("fixed");
  });

  it("does not claim flicker or seam fixes for a single frame", () => {
    const res = tuneFromLoop([frame({})]);
    expect(res.issues.find((i) => i.id === "flicker")!.verdict).toBe("not-applicable");
    expect(res.issues.find((i) => i.id === "seam")!.verdict).toBe("not-applicable");
  });

  it("refuses a busy photographic backdrop instead of guessing", () => {
    const noisy: RawFrame[] = Array.from({ length: 3 }, (_, k) => {
      const data = new Uint8ClampedArray(W * H * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = (i * 7 + k * 13) % 256;
        data[i + 1] = (i * 3 + k * 29) % 256;
        data[i + 2] = (i * 11 + k * 5) % 256;
        data[i + 3] = 255;
      }
      return { data, w: W, h: H };
    });
    const res = tuneFromLoop(noisy);
    expect(res.ok).toBe(false);
    expect(res.patch).toBeNull();
  });
});
