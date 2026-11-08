// The Smartboard tray (when enabled) runs this loop over the whole screen.
// Count real canvas work per animation frame with a manual frame clock.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { setupDom } = await import("@/test/domRender");
const { FlowTrail } = await import("@/components/flow/FlowTrail");

describe("FlowTrail frame work", () => {
  let dom: ReturnType<typeof setupDom>;
  let frames: Array<(t: number) => void> = [];
  let now = 0;
  const ops = { clear: 0, stroke: 0, rect: 0 };
  beforeEach(() => {
    dom = setupDom();
    frames = []; now = 0; ops.clear = 0; ops.stroke = 0; ops.rect = 0;
    vi.stubGlobal("requestAnimationFrame", (f: (t: number) => void) => { frames.push(f); return frames.length; });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const ctx: any = new Proxy({}, { get: (_t, k) => {
      if (k === "clearRect") return () => { ops.clear += 1; };
      if (k === "stroke") return () => { ops.stroke += 1; };
      if (k === "createRadialGradient") return () => ({ addColorStop() {} });
      return () => undefined;
    }, set: () => true });
    (window as any).HTMLCanvasElement.prototype.getContext = () => ctx;
    (window as any).HTMLCanvasElement.prototype.getBoundingClientRect = function () {
      ops.rect += 1; return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0 };
    };
  });
  afterEach(async () => { vi.restoreAllMocks(); await dom.cleanup(); });

  const run = (n: number) => { for (let i = 0; i < n; i++) { now += 16; const f = frames.shift(); f?.(now); } };
  const settings = { color: "#f59e0b", length: 0.5, thickness: 0.4, glow: 0.6, speed: 0.55, vibration: 0, fadeSec: 0.2 } as any;

  it("stops repainting once the trail has settled under a still pointer", async () => {
    const point = { x: 100, y: 100 };
    await dom.render(<FlowTrail active settings={settings} getPoint={() => point} />);
    run(2000);
    const settledClear = ops.clear;
    const settledRect = ops.rect;
    run(600);
    expect(ops.clear - settledClear).toBe(0);
    expect(ops.rect - settledRect).toBe(0);
  });

  it("still draws every frame while the pointer moves", async () => {
    const point = { x: 100, y: 100 };
    await dom.render(<FlowTrail active settings={settings} getPoint={() => point} />);
    run(5);
    const before = ops.clear;
    for (let i = 0; i < 30; i++) { point.x += 5; run(1); }
    expect(ops.clear - before).toBe(30);
    expect(ops.stroke).toBeGreaterThan(0);
  });
});
