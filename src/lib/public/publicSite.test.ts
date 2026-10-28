import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_SITE, liveInviteUrl, publicOrigin } from "./publicSite";

const openedOn = (origin: string) => {
  const { hostname } = new URL(origin);
  vi.stubGlobal("window", { location: { origin, hostname } });
};

describe("publicOrigin", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is https://mathgpl.com", () => {
    expect(PUBLIC_SITE).toBe("https://mathgpl.com");
  });

  it("is mathgpl.com on the server (no window)", () => {
    expect(publicOrigin()).toBe("https://mathgpl.com");
  });

  it.each([
    "https://mathgpl.com",
    "https://www.mathgpl.com",
    "https://showmatchgpl.com",
    "https://some-alias.example.org",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "https://abc.lovableproject.com",
    "https://id-preview--abc.lovable.app",
    "https://abc.sandbox.lovable.dev",
  ])("share links use mathgpl.com when the app is open on %s", (origin) => {
    openedOn(origin);
    expect(publicOrigin()).toBe("https://mathgpl.com");
    expect(`${publicOrigin()}/arena/TA9J8FEZFKJL`).toBe("https://mathgpl.com/arena/TA9J8FEZFKJL");
    expect(`${publicOrigin()}/arena/live/TA9J8FEZFKJL`).toBe("https://mathgpl.com/arena/live/TA9J8FEZFKJL");
    expect(liveInviteUrl("AB12")).toBe("https://mathgpl.com/live/join/AB12");
  });
});
