import { describe, expect, it } from "vitest";
import { oauthReturnPath } from "../oauth-return-path";

describe("oauthReturnPath", () => {
  it("keeps the ChatGPT approval screen address with its query", () => {
    expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc")).toBe("/.lovable/oauth/consent?authorization_id=abc");
  });
  it("rejects other sites", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "/\u0000x", 42]) {
      expect(oauthReturnPath(bad)).toBe("");
    }
  });
});
