import { afterEach, describe, expect, it } from "vitest";
import { AUDIO_CONNECTION_NOT_SET } from "../diagnosis";
import { handleClassroomAudioRequest } from "../token.server";

const KEYS = [
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const;

const previous = new Map<string, string | undefined>();

afterEach(() => {
  for (const key of KEYS) {
    const value = previous.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previous.clear();
});

function blankEnv() {
  for (const key of KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
}

describe("classroom audio token route", () => {
  it("returns audio connection not set before any microphone or relay call", async () => {
    blankEnv();
    const response = await handleClassroomAudioRequest(new Request("https://mathgpl.com/api/classroom-audio/token", {
      method: "POST",
      headers: {
        Origin: "https://mathgpl.com",
        Authorization: "Bearer session-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ classId: "29a02610-08c0-4c4a-a083-bccce8ec2354" }),
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: AUDIO_CONNECTION_NOT_SET,
      code: "connection_not_set",
    });
  });

  it("rejects a cross-site request even when it presents a bearer token", async () => {
    blankEnv();
    const response = await handleClassroomAudioRequest(new Request("https://mathgpl.com/api/classroom-audio/token", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        Authorization: "Bearer session-token",
      },
      body: JSON.stringify({ classId: "29a02610-08c0-4c4a-a083-bccce8ec2354" }),
    }));
    expect(response.status).toBe(403);
  });
});
