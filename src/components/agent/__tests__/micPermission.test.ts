import { describe, expect, it, vi } from "vitest";

import {
  classifyMicError,
  describeMicPermission,
  micStatusLabel,
  micStatusTone,
} from "../micPermission";

function failure(name: string) {
  return Object.assign(new Error(name), { name });
}

function withDevices(kinds: string[]) {
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: () => Promise.reject(new Error("unused")),
      enumerateDevices: () => Promise.resolve(kinds.map((kind) => ({ kind }))),
    },
  });
}

describe("why the microphone failed", () => {
  it("names a refusal as blocked, never as a missing device", async () => {
    withDevices(["audioinput"]);
    expect(await classifyMicError(failure("NotAllowedError"))).toBe("blocked");
    expect(await classifyMicError(failure("SecurityError"))).toBe("blocked");
    expect(describeMicPermission("blocked")).toMatch(/padlock/i);
  });

  it("says a microphone held by another app is in use", async () => {
    withDevices(["audioinput"]);
    expect(await classifyMicError(failure("NotReadableError"))).toBe("in-use");
    expect(await classifyMicError(failure("TrackStartError"))).toBe("in-use");
    expect(describeMicPermission("in-use")).toMatch(/another app/i);
  });

  it("only reports no microphone when the device list has no audio input", async () => {
    withDevices(["audioinput", "videoinput"]);
    expect(await classifyMicError(failure("NotFoundError"))).toBe("failed");

    withDevices(["videoinput"]);
    expect(await classifyMicError(failure("NotFoundError"))).toBe("no-microphone");
    expect(describeMicPermission("no-microphone")).toMatch(/no microphone detected/i);
  });

  it("falls back to a plain retry for anything unknown", async () => {
    withDevices(["audioinput"]);
    expect(await classifyMicError(failure("AbortError"))).toBe("failed");
    expect(await classifyMicError(failure("OverconstrainedError"))).toBe("failed");
    expect(describeMicPermission("failed")).toMatch(/try again/i);
  });
});

describe("what the teacher is told", () => {
  it("asks plainly before anything is granted", () => {
    expect(describeMicPermission("prompt")).toMatch(/permission/i);
    expect(describeMicPermission("unknown")).toMatch(/permission/i);
  });

  it("separates an insecure page and an embedded window from a broken device", () => {
    expect(describeMicPermission("insecure")).toMatch(/https/i);
    expect(describeMicPermission("framed")).toMatch(/own browser tab/i);
    expect(describeMicPermission("unsupported")).toMatch(/type to Aura/i);
  });
});

describe("the status light", () => {
  it("shows requesting, then listening", () => {
    expect(micStatusLabel("prompt", true, false)).toMatch(/requesting/i);
    expect(micStatusTone("prompt", true, false)).toBe("requesting");
    expect(micStatusLabel("granted", false, true)).toMatch(/listening/i);
    expect(micStatusTone("granted", false, true)).toBe("live");
  });

  it("is quiet before permission and red on every failure", () => {
    expect(micStatusTone("prompt", false, false)).toBe("off");
    expect(micStatusLabel("prompt", false, false)).toMatch(/not enabled/i);
    for (const state of ["blocked", "in-use", "no-microphone", "framed", "failed"] as const) {
      expect(micStatusTone(state, false, false)).toBe("error");
    }
  });
});
