// CHT-001 — approved bar geometry rules.
import { describe, expect, it } from "vitest";
import { barLayout } from "@/components/lessonnotes/extensions/visuals/smartchart/barLayout";

const PAD_LEFT = 72;
const layout = (mode: "auto" | "thin" | "normal" | "wide", isHistogram = false) =>
  barLayout({ barCount: 4, slotSvg: 48, mode, isHistogram, padLeft: PAD_LEFT });

describe("bar chart geometry (CHT-001)", () => {
  it("gap between bars equals the bar width", () => {
    const l = layout("auto");
    expect(l.gap).toBe(l.barWidth);
  });

  it("Y-axis to the first bar equals the bar width", () => {
    const l = layout("auto");
    expect(l.firstBarOffset).toBe(l.barWidth);
    expect(l.xForBar(0)).toBe(PAD_LEFT + l.barWidth);
  });

  it("changing bar width moves the gaps and the first-bar offset with it", () => {
    const thin = layout("thin");
    const wide = layout("wide");
    expect(thin.barWidth).toBeLessThan(48);
    expect(thin.gap).toBe(thin.barWidth);
    expect(thin.xForBar(0)).toBe(PAD_LEFT + thin.barWidth);
    expect(thin.xForBar(1) - thin.xForBar(0)).toBe(2 * thin.barWidth);
    // wide is clamped to the slot, so it never overlaps its neighbour
    expect(wide.barWidth).toBeLessThanOrEqual(48);
    expect(wide.gap).toBe(wide.barWidth);
  });

  it("histogram bars touch (zero gap) while keeping the first-bar offset", () => {
    const h = layout("auto", true);
    expect(h.gap).toBe(0);
    expect(h.firstBarOffset).toBe(h.barWidth);
    expect(h.xForBar(1) - h.xForBar(0)).toBe(h.barWidth);
  });
});
