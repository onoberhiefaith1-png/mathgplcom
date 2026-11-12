// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: null as null | { id: string } }));
const upd = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/lib/router-compat", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/lib/auth/AuthProvider", () => ({ useAuth: () => ({ user: auth.user, ready: true }) }));
vi.mock("@/lib/auth/signOutEverywhere", () => ({ useSignOut: () => vi.fn() }));
vi.mock("@/lib/accounts/useAccount", () => ({ useAccount: () => ({ role: "teacher", isLoading: false }) }));
vi.mock("@/lib/appUpdate", async (orig) => ({ ...(await orig<typeof import("@/lib/appUpdate")>()), runUpdateApp: upd.run }));
import AccountMenu from "@/components/academy/AccountMenu";

let root: Root;
const byTest = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ""; vi.unstubAllGlobals(); upd.run.mockReset(); });

const openMenu = async () => {
  await act(async () => { root.render(<AccountMenu />); await flush(); });
  const trigger = document.querySelector('button[aria-haspopup="menu"]') as HTMLElement;
  await act(async () => { trigger.click(); await flush(); });
};

describe("Account menu: Update app", () => {
  for (const signedIn of [true, false]) {
    it(`sits right under Download apps (${signedIn ? "signed in" : "signed out"}) and shows its progress`, async () => {
      auth.user = signedIn ? { id: "u1" } : null;
      upd.run.mockImplementation(async (on: (s: string) => void) => { on("checking"); on("up-to-date"); return "up-to-date"; });
      await openMenu();
      const button = byTest("update-app");
      expect(button?.textContent).toContain("Update app");
      const items = Array.from(document.querySelectorAll("a, button")).map((e) => e.textContent?.trim());
      expect(items[items.findIndex((t) => t?.includes("Download apps")) + 1]).toContain("Update app");
      await act(async () => { button!.click(); await flush(); });
      expect(upd.run).toHaveBeenCalledOnce();
      expect(byTest("update-app")?.textContent).toContain("Already up to date");
    });
  }
});
