import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupDom } from "@/test/domRender";

const seen: Array<{ x: number; y: number } | null> = [];
const trails: unknown[] = [];
vi.mock("@/components/flow/FlowTrail", () => ({
  default: (p: { getPoint: () => { x: number; y: number } | null; settings: unknown }) => {
    trails.push(p.settings);
    (globalThis as any).__getPoint = p.getPoint;
    return <canvas data-testid="flow-trail" />;
  },
}));

import { BoardTray, TrayPreview, usePointerFollower } from "../BoardTray";
import { DEFAULT_TRAY, normalizeTraySettings, trayToTrail } from "@/lib/smartboard/traySettings";

let dom: ReturnType<typeof setupDom>;
beforeEach(() => { dom = setupDom(); seen.length = 0; trails.length = 0; });
afterEach(async () => { await dom.cleanup(); });

const on = { ...DEFAULT_TRAY, enabled: true, mode: "always" as const };

describe("Smartboard trail reuses the Flow ribbon and follows mouse and finger", () => {
  it("follows a touch (finger) with passive listeners", async () => {
    await dom.render(<BoardTray settings={on} inSolution={false} />);
    const touch = new window.Event("touchmove") as any;
    touch.touches = [{ clientX: 40, clientY: 70 }];
    await act(async () => { window.dispatchEvent(touch); });
    expect((globalThis as any).__getPoint()).toEqual({ x: 40, y: 70 });
  });
  it("follows the mouse", async () => {
    await dom.render(<BoardTray settings={on} inSolution={false} />);
    const move = new window.Event("pointermove") as any;
    move.clientX = 12; move.clientY = 34;
    await act(async () => { window.dispatchEvent(move); });
    expect((globalThis as any).__getPoint()).toEqual({ x: 12, y: 34 });
  });
  it("removes its listeners on unmount", async () => {
    const spy = vi.spyOn(window, "removeEventListener");
    const Probe = () => { usePointerFollower(); return null; };
    await dom.render(<Probe />);
    await dom.render(<></>);
    const removed = spy.mock.calls.map((c) => c[0]);
    expect(removed).toEqual(expect.arrayContaining(["pointermove", "pointerdown", "touchstart", "touchmove"]));
  });
  it("preview renders the same ribbon with the current values", async () => {
    await dom.render(<TrayPreview settings={{ ...on, width: 0.9, color: "#ff5fb4" }} />);
    expect(dom.host.querySelector('[data-testid="tray-preview"] [data-testid="flow-trail"]')).not.toBeNull();
    expect(trails.at(-1)).toMatchObject({ thickness: 0.9, color: "#ff5fb4" });
  });
  it("animation option drives the Flow snake wave; old saves stay animated", () => {
    expect(trayToTrail({ ...on, vibration: 0.5, animate: false }).vibration).toBe(0);
    expect(trayToTrail({ ...on, vibration: 0.5, animate: true }).vibration).toBe(0.5);
    expect(normalizeTraySettings({ enabled: true }).animate).toBe(true);
    expect(normalizeTraySettings({ animate: false }).animate).toBe(false);
  });
});
