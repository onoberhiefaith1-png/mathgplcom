import { describe, expect, it } from "vitest";
import { isRecoverableModuleError } from "./chunkRecovery";

describe("isRecoverableModuleError", () => {
  it.each([
    "Failed to fetch dynamically imported module",
    "Importing a module script failed",
    "Failed to load module script: server responded with 504",
    "Dev server returned 504 for /node_modules/.vite/deps/@tanstack_router-core.js",
    "Outdated Optimize Dep",
  ])("recognizes a recoverable module failure: %s", (message) => {
    expect(isRecoverableModuleError(new Error(message))).toBe(true);
  });

  it("does not reload for ordinary application errors", () => {
    expect(isRecoverableModuleError(new Error("Invalid lesson title"))).toBe(false);
  });
});