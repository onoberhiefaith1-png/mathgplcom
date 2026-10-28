import { afterEach, describe, expect, it, vi } from "vitest";
import { goToReturnPath, isOAuthConsentReturn, oauthReturnPath } from "../oauth-return-path";

const consent = "/.lovable/oauth/consent?authorization_id=req-123";

describe("OAuth return after teacher sign-in", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("decodes the encoded next from /auth and keeps authorization_id", () => {
    const next = new URLSearchParams("next=%2F.lovable%2Foauth%2Fconsent%3Fauthorization_id%3Dreq-123").get("next");
    expect(oauthReturnPath(next)).toBe(consent);
    expect(isOAuthConsentReturn(next!)).toBe(true);
  });

  it("opens the consent page with its full query after sign-in", () => {
    const replace = vi.fn();
    vi.stubGlobal("window", { location: { replace } });
    const navigate = vi.fn();
    goToReturnPath(consent, navigate);
    expect(replace).toHaveBeenCalledWith(consent);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("ordinary teacher login still uses in-app navigation", () => {
    const replace = vi.fn();
    vi.stubGlobal("window", { location: { replace } });
    const navigate = vi.fn();
    goToReturnPath("/home", navigate);
    expect(navigate).toHaveBeenCalledWith("/home", { replace: true });
    expect(replace).not.toHaveBeenCalled();
  });

  it("never treats unsafe targets as consent returns", () => {
    for (const bad of ["//evil.example/.lovable/oauth/consent?authorization_id=x", "https://evil.example/.lovable/oauth/consent", "/\\evil.example"]) {
      expect(isOAuthConsentReturn(bad)).toBe(false);
      expect(oauthReturnPath(bad)).toBe("");
    }
  });
});
