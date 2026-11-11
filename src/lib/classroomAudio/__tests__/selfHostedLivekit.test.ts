import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { audioConnectionConfig, liveKitTarget, readAudioEnv } from "../diagnosis";
import { joinGrant } from "../floor";
import { signClassroomJoinToken } from "../livekitJwt.server";
import { handleClassroomAudioRequest } from "../token.server";
import {
  handleClassroomRecordingRequest,
  livekitApiHost,
  recordingEnabled,
  recordingFilepath,
  teacherMicrophoneTrack,
} from "../recording.server";

const DB = { SUPABASE_URL: "https://db.example", SUPABASE_PUBLISHABLE_KEY: "publishable" };
const CLOUD = { LIVEKIT_URL: "wss://cloud.example.livekit.cloud", LIVEKIT_API_KEY: "cloud-key", LIVEKIT_API_SECRET: "cloud-secret" };
const SELF = {
  LIVEKIT_SELF_HOSTED_URL: " wss://livekit.mathgpl.com\n",
  LIVEKIT_SELF_HOSTED_API_KEY: "self-key",
  LIVEKIT_SELF_HOSTED_API_SECRET: " self-secret ",
};
const decode = (token: string) => JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()) as {
  sub: string; video: { canPublish: boolean; canSubscribe: boolean; canPublishData: boolean; canPublishSources: string[]; room: string };
  attributes: { mathgpl_audio_role: string };
};

describe("choosing LiveKit Cloud or the self-hosted server is one secret", () => {
  it("uses LiveKit Cloud names when LIVEKIT_TARGET is blank or cloud", () => {
    for (const target of [undefined, "", "cloud", " Cloud "]) {
      const env = readAudioEnv({ ...DB, ...CLOUD, ...SELF, LIVEKIT_TARGET: target });
      expect(env).toMatchObject({ livekitTarget: "cloud", livekitUrl: CLOUD.LIVEKIT_URL, livekitApiKey: "cloud-key", livekitApiSecret: "cloud-secret" });
      expect(audioConnectionConfig(env).ok).toBe(true);
    }
  });

  it("uses the self-hosted names, trimmed, when LIVEKIT_TARGET is self-hosted", () => {
    for (const target of ["self-hosted", "self_hosted", "SELF HOSTED", "selfhosted", "self"]) {
      const env = readAudioEnv({ ...DB, ...CLOUD, ...SELF, LIVEKIT_TARGET: target });
      expect(env).toMatchObject({ livekitTarget: "self-hosted", livekitUrl: "wss://livekit.mathgpl.com", livekitApiKey: "self-key", livekitApiSecret: "self-secret" });
      expect(audioConnectionConfig(env).ok).toBe(true);
    }
  });

  it("never falls back to Cloud when self-hosted is chosen but not filled in", () => {
    const env = readAudioEnv({ ...DB, ...CLOUD, LIVEKIT_TARGET: "self-hosted" });
    expect(env.livekitUrl).toBeUndefined();
    expect(audioConnectionConfig(env).ok).toBe(false);
  });

  it("fails closed on an unknown target instead of guessing a server", () => {
    expect(liveKitTarget("hetzner")).toBeNull();
    const env = readAudioEnv({ ...DB, ...CLOUD, ...SELF, LIVEKIT_TARGET: "hetzner" });
    expect(env.livekitUrl).toBeUndefined();
    expect(audioConnectionConfig(env)).toMatchObject({ ok: false, code: "connection_not_set" });
  });

  it("has no LiveKit Cloud address written into the app code", () => {
    for (const f of ["diagnosis.ts", "token.server.ts", "control.server.ts", "livekitJwt.server.ts", "recording.server.ts", "connectRelay.ts"]) {
      expect(readFileSync(join(process.cwd(), "src/lib/classroomAudio", f), "utf8")).not.toMatch(/livekit\.cloud|wss:\/\/[a-z]/i);
    }
  });
});

describe("class join tokens: teachers speak, students listen unless granted", () => {
  it("lets the teacher and the promoted admin publish their microphone", () => {
    expect(joinGrant({ teacher: true }, "t")).toEqual({ role: "teacher", canPublish: true });
    expect(joinGrant({ teacher: false, moderatorId: "m" }, "m")).toEqual({ role: "moderator", canPublish: true });
  });

  it("gives a student a listen-only grant", () => {
    expect(joinGrant({ teacher: false, moderatorId: null, speakerId: null, studentsMuted: false }, "s")).toEqual({ role: "student", canPublish: false });
    expect(joinGrant({ teacher: false, speakerId: "other", studentsMuted: false }, "s").canPublish).toBe(false);
  });

  it("keeps the floor for a student granted to speak who reconnects, unless students are muted", () => {
    expect(joinGrant({ teacher: false, speakerId: "s", studentsMuted: false }, "s")).toEqual({ role: "student", canPublish: true });
    expect(joinGrant({ teacher: false, speakerId: "s", studentsMuted: true }, "s").canPublish).toBe(false);
  });

  it("signs exactly those rights: microphone only, never data, always listen", async () => {
    const base = { apiKey: "APIk", apiSecret: "s".repeat(32), identity: "u", name: "U", room: "classroom-x" };
    const student = decode(await signClassroomJoinToken({ ...base, role: "student" }));
    expect(student.video).toMatchObject({ room: "classroom-x", canSubscribe: true, canPublish: false, canPublishData: false });
    const teacher = decode(await signClassroomJoinToken({ ...base, role: "teacher" }));
    expect(teacher.video).toMatchObject({ canPublish: true, canPublishSources: ["microphone"], canPublishData: false });
    const speaking = decode(await signClassroomJoinToken({ ...base, role: "student", canPublish: true }));
    expect(speaking.video.canPublish).toBe(true);
    expect(speaking.attributes.mathgpl_audio_role).toBe("student");
  });
});

const KEYS = ["LIVEKIT_TARGET", "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKITWebsocketURL", "LIVEKITAPIKEY", "LIVEKITAPIsecret",
  "LIVEKIT_SELF_HOSTED_URL", "LIVEKIT_SELF_HOSTED_API_KEY", "LIVEKIT_SELF_HOSTED_API_SECRET", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "LIVEKIT_RECORDING_ENABLED"];
const saved = new Map<string, string | undefined>();
const setEnv = (vars: Record<string, string>) => {
  for (const k of KEYS) { saved.set(k, process.env[k]); delete process.env[k]; }
  Object.assign(process.env, vars);
};
const original = globalThis.fetch;
afterEach(() => {
  for (const [k, v] of saved) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  saved.clear();
  globalThis.fetch = original;
  vi.restoreAllMocks();
});
const urlOf = (input: RequestInfo | URL) => typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
const post = (path: string, body: object) => new Request(`https://mathgpl.com${path}`, {
  method: "POST",
  headers: { Origin: "https://mathgpl.com", Authorization: "Bearer session", "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const CLASS = "29a02610-08c0-4c4a-a083-bccce8ec2354";

describe("token route against the self-hosted server", () => {
  const run = async (status: object) => {
    setEnv({ ...DB, ...CLOUD, ...SELF, LIVEKIT_TARGET: "self-hosted", LIVEKIT_SELF_HOSTED_API_SECRET: "x".repeat(32) });
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      calls.push(url);
      if (url.includes("/auth/v1/user")) return Response.json({ id: "student-1", user_metadata: {} });
      if (url.includes("/rpc/classroom_audio_command")) return Response.json(status);
      if (url.includes("/rpc/classroom_audio_room")) return Response.json("classroom-abc");
      if (url.includes("CreateRoom")) return Response.json({});
      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;
    const response = await handleClassroomAudioRequest(post("/api/classroom-audio/token", { classId: CLASS }));
    expect(response.status).toBe(200);
    const body = await response.json() as { url: string; token: string };
    return { body, calls, claims: decode(body.token) };
  };

  it("hands the browser the self-hosted URL and creates the room there", async () => {
    const { body, calls } = await run({ teacher: false, speakerId: null, moderatorId: null, studentsMuted: false });
    expect(body.url).toBe("wss://livekit.mathgpl.com");
    expect(calls).toContain("https://livekit.mathgpl.com/twirp/livekit.RoomService/CreateRoom");
    expect(calls.some((c) => c.includes("livekit.cloud"))).toBe(false);
  });

  it("issues a listen-only token to a student, and a speaking one to the student holding the floor", async () => {
    expect((await run({ teacher: false, speakerId: null, studentsMuted: false })).claims.video.canPublish).toBe(false);
    expect((await run({ teacher: false, speakerId: "student-1", studentsMuted: false })).claims.video.canPublish).toBe(true);
    expect((await run({ teacher: false, speakerId: "student-1", studentsMuted: true })).claims.video.canPublish).toBe(false);
  });
});

describe("optional recording hook", () => {
  it("is off unless LIVEKIT_RECORDING_ENABLED is true", async () => {
    expect(recordingEnabled({})).toBe(false);
    expect(recordingEnabled({ LIVEKIT_RECORDING_ENABLED: "false" })).toBe(false);
    expect(recordingEnabled({ LIVEKIT_RECORDING_ENABLED: " true " })).toBe(true);
    setEnv({ ...DB, ...CLOUD });
    const response = await handleClassroomRecordingRequest(post("/api/classroom-audio/recording", { classId: CLASS, command: "start" }));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: "recording_off" });
  });

  it("lets only the class teacher start a recording", async () => {
    setEnv({ ...DB, ...CLOUD, LIVEKIT_RECORDING_ENABLED: "true" });
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/auth/v1/user")) return Response.json({ id: "student-1", user_metadata: {} });
      if (url.includes("/rpc/classroom_audio_command")) return Response.json({ teacher: false });
      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;
    const response = await handleClassroomRecordingRequest(post("/api/classroom-audio/recording", { classId: CLASS, command: "start" }));
    expect(response.status).toBe(403);
  });

  it("records only the teacher's microphone track, into a per-room .ogg path", () => {
    const kinds = { microphone: 2, audio: 0 };
    const people = [
      { identity: "student", tracks: [{ sid: "TR_student", source: 2, type: 0 }] },
      { identity: "teacher", tracks: [{ sid: "TR_screen", source: 3, type: 1 }, { sid: "TR_mic", source: 2, type: 0 }] },
    ];
    expect(teacherMicrophoneTrack(people, "teacher", kinds)).toBe("TR_mic");
    expect(teacherMicrophoneTrack(people, "absent", kinds)).toBeNull();
    expect(recordingFilepath("classroom-abc", new Date("2026-11-11T13:05:09.123Z"))).toBe("classroom-audio/classroom-abc/2026-11-11T13-05-09-123Z.ogg");
    expect(livekitApiHost("wss://livekit.mathgpl.com")).toBe("https://livekit.mathgpl.com");
  });
});

describe("infra/livekit holds no real secrets", () => {
  it("keeps the API key pair out of livekit.yaml and only placeholders in .env.example", () => {
    const dir = join(process.cwd(), "infra/livekit");
    const lk = readFileSync(join(dir, "livekit.yaml"), "utf8");
    expect(lk).not.toMatch(/^keys:/m);
    expect(lk).toContain("domain: ${LK_TURN_DOMAIN}");
    expect(lk).toMatch(/use_external_ip: true/);
    expect(readFileSync(join(dir, "docker-compose.yaml"), "utf8")).toContain('LIVEKIT_KEYS: "${LIVEKIT_API_KEY');
    const example = readFileSync(join(dir, ".env.example"), "utf8");
    expect(example).toContain("LIVEKIT_API_KEY=APIchangeme");
    expect(example).toMatch(/^EGRESS_S3_SECRET=$/m);
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toMatch(/^\.env$/m);
  });
});
