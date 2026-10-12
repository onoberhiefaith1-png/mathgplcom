import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Website sign-out must end only this browser's session; a global sign-out
// also revokes the separately approved ChatGPT connection.
const FILES = [
  "src/lib/auth/signOutEverywhere.ts",
  "src/lib/auth/sessionReset.ts",
  "src/lib/auth/AuthProvider.tsx",
  "src/lib/accounts/impersonation.ts",
  "src/lib/accounts/useAccount.ts",
];
describe("website sign-out scope", () => {
  for (const f of FILES) {
    it(`${f} signs out locally only`, () => {
      const src = readFileSync(f, "utf8");
      const calls = src.match(/auth\.signOut\([^)]*\)/g) ?? [];
      expect(calls.length).toBeGreaterThan(0);
      for (const c of calls) expect(c).toContain('scope: "local"');
    });
  }
});

import { RECONNECT_MESSAGE } from "@/lib/mcp/supabase-user";
describe("MCP reconnect message", () => {
  it("tells the teacher to reconnect in ChatGPT", () => {
    expect(RECONNECT_MESSAGE).toMatch(/Reconnect MathGPL in ChatGPT settings/);
  });
});
