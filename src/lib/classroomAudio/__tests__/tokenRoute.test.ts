import { afterEach, describe, expect, it, vi } from "vitest";
import { AUDIO_CONNECTION_NOT_SET } from "../diagnosis";
import { handleClassroomAudioRequest } from "../token.server";

const KEYS = [
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "LIVEKITWebsocketURL",
  "LIVEKITAPIKEY",
  "LIVEKITAPIsecret",
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

  it("returns a join token when LiveKit room setup fails", async () => {
    for (const key of KEYS) previous.set(key, process.env[key]);
    process.env.LIVEKIT_URL = " wss://example.livekit.cloud\n";
    process.env.LIVEKIT_API_KEY = "APItestkey";
    process.env.LIVEKIT_API_SECRET = " secretsecretsecretsecretsecret12 ";
    process.env.SUPABASE_URL = "https://db.example.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    const calls: string[] = [];
    let roomBody = "";
    const original = globalThis.fetch;
    const urlOf = (input: RequestInfo | URL) => typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/twirp/livekit.RoomService/CreateRoom")) roomBody = String(init?.body ?? "");
      if (url.includes("/auth/v1/user")) {
        return Response.json({ id: "11111111-1111-1111-1111-111111111111", user_metadata: { full_name: "Ada Lovelace" } });
      }
      if (url.includes("/rpc/classroom_audio_command")) {
        return Response.json({ speakerId: null, moderatorId: null, studentsMuted: false, teacher: true });
      }
      if (url.includes("/rpc/classroom_audio_room")) return Response.json("classroom-room-key");
      if (url.includes("/twirp/livekit.RoomService/CreateRoom")) {
        return new Response(JSON.stringify({ msg: "upstream unavailable" }), { status: 503, headers: { "content-type": "application/json" } });
      }
      return new Response(`unexpected ${url}`, { status: 500 });
    }) as typeof fetch;
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await handleClassroomAudioRequest(new Request("https://mathgpl.com/api/classroom-audio/token", {
        method: "POST",
        headers: {
          Origin: "https://mathgpl.com",
          Authorization: "Bearer session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ classId: "29a02610-08c0-4c4a-a083-bccce8ec2354" }),
      }));
      expect(response.status).toBe(200);
      const body = await response.json() as { url: string; token: string };
      expect(body.url).toBe("wss://example.livekit.cloud");
      const payload = JSON.parse(Buffer.from(body.token.split(".")[1]!, "base64url").toString()) as {
        sub: string;
        name: string;
        video: { room: string; canPublish: boolean; canPublishSources: string[] };
      };
      expect(payload).toMatchObject({
        sub: "11111111-1111-1111-1111-111111111111",
        name: "Ada Lovelace",
        video: { room: "classroom-room-key", canPublish: true, canPublishSources: ["microphone"] },
      });
      const [header, payloadPart, signature] = body.token.split(".");
      const signingKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode("secretsecretsecretsecretsecret12"),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );
      const signed = await crypto.subtle.verify(
        "HMAC",
        signingKey,
        Buffer.from(signature!, "base64url"),
        new TextEncoder().encode(`${header}.${payloadPart}`),
      );
      expect(signed).toBe(true);
      expect(JSON.parse(Buffer.from(header!, "base64url").toString())).toEqual({ alg: "HS256" });
      expect(calls.some((call) => call.includes("/twirp/livekit.RoomService/CreateRoom"))).toBe(true);
      expect(JSON.parse(roomBody)).toMatchObject({ name: "classroom-room-key", maxParticipants: 21, emptyTimeout: 60, departureTimeout: 20 });
      const create = calls.find((call) => call.includes("CreateRoom"));
      expect(create?.startsWith("POST ")).toBe(true);
      expect(errorLog).toHaveBeenCalledWith("[classroom-audio] room setup failed", "upstream unavailable");
    } finally {
      globalThis.fetch = original;
      errorLog.mockRestore();
    }
  });

  it("returns the room service error when the room name cannot be issued", async () => {
    for (const key of KEYS) previous.set(key, process.env[key]);
    process.env.LIVEKIT_URL = "wss://example.livekit.cloud";
    process.env.LIVEKIT_API_KEY = "APItestkey";
    process.env.LIVEKIT_API_SECRET = "secretsecretsecretsecretsecret12";
    process.env.SUPABASE_URL = "https://db.example.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    const original = globalThis.fetch;
    const urlOf = (input: RequestInfo | URL) => typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/auth/v1/user")) {
        return Response.json({ id: "11111111-1111-1111-1111-111111111111", user_metadata: {} });
      }
      if (url.includes("/rpc/classroom_audio_command")) {
        return Response.json({ speakerId: null, moderatorId: null, studentsMuted: false, teacher: false });
      }
      if (url.includes("/rpc/classroom_audio_room")) {
        return Response.json({ code: "42703", message: "column room_key does not exist" }, { status: 400 });
      }
      return new Response(`unexpected ${url}`, { status: 500 });
    }) as typeof fetch;
    try {
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
        error: "column room_key does not exist",
        code: "not_connected",
      });
    } finally {
      globalThis.fetch = original;
    }
  });
});
