import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupDom } from "@/test/domRender";

const guide = { open: false, tutorials: [], view: "main", setView: vi.fn(), openGuide: vi.fn(), openManager: vi.fn(), hasTutorial: true, pageKey: "", canManage: false };
vi.mock("@/components/guides/PageGuideProvider", () => ({ usePageGuide: () => guide }));
vi.mock("@/lib/guides/placement", () => ({ DEFAULT_PLACEMENT: { xPct: 90, yPct: 90 }, clampPlacement: (p: unknown) => p, loadPlacement: async () => null, savePlacement: async () => undefined }));
vi.mock("@/components/student/BoardViewSwitcher", () => ({ default: () => <span data-testid="switcher" /> }));
vi.mock("@/lib/theme/AppearanceProvider", () => ({ useAppearance: () => ({ welcome: "dark", app: "dark", toggle: vi.fn(), registerAppHost: () => () => undefined, welcomeColor: "ocean", appColor: "ocean", setColorTheme: vi.fn(), appHosts: 0, signedIn: true, authReady: true }) }));
vi.mock("@tanstack/react-router", () => ({ useRouterState: () => "/class/x" }));

import { claimImmersiveSurface, isImmersiveSurfaceActive, useClaimImmersiveSurface } from "../immersiveSurface";
import PageGuideLauncher from "@/components/guides/PageGuideLauncher";
import { AppThemeFallback, ThemeModeButton } from "@/components/theme/ThemeModeButton";

let dom: ReturnType<typeof setupDom>;
beforeEach(() => { dom = setupDom(); guide.open = false; });
afterEach(async () => { await dom.cleanup(); });

const Chrome = ({ board }: { board: boolean }) => {
  const Board = () => { useClaimImmersiveSurface(); return <div data-testid="board" />; };
  return <>{board && <Board />}<PageGuideLauncher /><AppThemeFallback /><ThemeModeButton scope="app" variant="hub" /></>;
};
const count = () => ({
  tutorial: dom.host.querySelectorAll('[aria-label="Moments"], [title*="tutorial"]').length,
  palette: dom.host.querySelectorAll('[aria-label="Colour theme"]').length,
  mode: dom.host.querySelectorAll('[aria-label^="Switch to"]').length,
});

describe("global chrome inside the Smartboard / active Game", () => {
  it("shows tutorial, palette and light/dark on ordinary pages", async () => {
    await dom.render(<Chrome board={false} />);
    const c = count();
    expect(c.tutorial).toBe(1); expect(c.palette).toBeGreaterThan(0); expect(c.mode).toBeGreaterThan(0);
  });
  it("hides all three while a board is mounted, and restores them on unmount", async () => {
    await dom.render(<Chrome board />);
    expect(count()).toEqual({ tutorial: 0, palette: 0, mode: 0 });
    await dom.render(<Chrome board={false} />);
    expect(count().tutorial).toBe(1);
    expect(count().mode).toBeGreaterThan(0);
  });
  it("keeps an already-open tutorial's switcher so it can be closed", async () => {
    guide.open = true;
    await dom.render(<Chrome board />);
    expect(dom.host.querySelector('[data-testid="switcher"]')).not.toBeNull();
  });
  it("claims are counted and released once", () => {
    const a = claimImmersiveSurface(); const b = claimImmersiveSurface();
    a(); a();
    expect(isImmersiveSurfaceActive()).toBe(true);
    b();
    expect(isImmersiveSurfaceActive()).toBe(false);
  });
  it("PresentationView claims the surface", () => {
    const src = readFileSync(resolve(__dirname, "../../../components/smartboard/PresentationView.tsx"), "utf8");
    expect(src).toMatch(/\n  useClaimImmersiveSurface\(\);\n/);
  });
});
