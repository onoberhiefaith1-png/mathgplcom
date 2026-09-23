import { describe, expect, it } from "vitest";

import { describeMicPermission } from "../micPermission";

describe("what the teacher is told about the microphone", () => {
  it("asks plainly before anything is granted", () => {
    expect(describeMicPermission("prompt")).toMatch(/permission/i);
    expect(describeMicPermission("unknown")).toMatch(/permission/i);
  });

  it("explains how to unblock a blocked microphone", () => {
    expect(describeMicPermission("denied")).toMatch(/padlock/i);
    expect(describeMicPermission("denied")).toMatch(/reload/i);
  });

  it("separates a missing microphone from a browser that cannot use one", () => {
    expect(describeMicPermission("no-microphone")).toMatch(/no microphone/i);
    expect(describeMicPermission("unsupported")).toMatch(/type to Aura/i);
  });

  it("confirms once it is allowed", () => {
    expect(describeMicPermission("granted")).toMatch(/allowed/i);
  });
});
