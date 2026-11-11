import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allowedPublishers, updateAudioFloor, type AudioFloor } from "../floor";
import { createSpeechQualityController } from "../quality";
import { captureMicrophone } from "../permission";
import {
  AUDIO_CONNECTION_NOT_SET,
  AUDIO_NOT_CONNECTED,
  CLASSROOM_AUDIO_MAX_PARTICIPANTS,
  classroomRoomMaxParticipants,
  audioConnectionConfig,
  audioRequestAllowed,
  classifyMicrophoneFailure,
  connectAction,
  diagnoseAudioError,
  publicAudioMessage,
  intervalLoss,
  planMicrophoneRequest,
  readAudioEnv,
  readTransportCounters,
  retryDelayMs,
} from "../diagnosis";

const floor = (patch: Partial<AudioFloor> = {}): AudioFloor => ({
  speakerId: null,
  moderatorId: null,
  studentsMuted: false,
  ...patch,
});

const students = new Set(["student-a", "student-b", "admin-student"]);

describe("classroom audio connection", () => {
  it("reports the connection as not set when LiveKit or the database is missing", () => {
    expect(audioConnectionConfig({})).toEqual({
      ok: false,
      code: "connection_not_set",
      message: AUDIO_CONNECTION_NOT_SET,
    });
    expect(audioConnectionConfig({
      livekitUrl: "https://example.livekit.cloud",
      livekitApiKey: "key",
      livekitApiSecret: "secret",
      supabaseUrl: "https://db.example",
      supabaseKey: "publishable",
    }).ok).toBe(false);
    expect(audioConnectionConfig({
      livekitUrl: "wss://example.livekit.cloud",
      livekitApiKey: "key",
      livekitApiSecret: "secret",
      supabaseUrl: "https://db.example",
      supabaseKey: "publishable",
    }).ok).toBe(true);
  });

  it("reads LiveKit from underscore names, and from the stored names when those are blank", () => {
    const database = {
      SUPABASE_URL: "https://db.example",
      SUPABASE_PUBLISHABLE_KEY: "publishable",
    };
    const underscore = readAudioEnv({
      ...database,
      LIVEKIT_URL: "wss://example.livekit.cloud",
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
    });
    expect(audioConnectionConfig(underscore)).toEqual({ ok: true });

    const stored = readAudioEnv({
      ...database,
      LIVEKITWebsocketURL: "wss://example.livekit.cloud",
      LIVEKITAPIKEY: "key",
      LIVEKITAPIsecret: "secret",
    });
    expect(audioConnectionConfig(stored)).toEqual({ ok: true });
    expect(stored).toMatchObject({
      livekitUrl: "wss://example.livekit.cloud",
      livekitApiKey: "key",
      livekitApiSecret: "secret",
    });

    const preferred = readAudioEnv({
      ...database,
      LIVEKIT_URL: "wss://preferred.livekit.cloud",
      LIVEKIT_API_KEY: "",
      LIVEKIT_API_SECRET: "   ",
      LIVEKITWebsocketURL: "wss://stored.livekit.cloud",
      LIVEKITAPIKEY: "stored-key",
      LIVEKITAPIsecret: "stored-secret",
    });
    expect(audioConnectionConfig(preferred)).toEqual({ ok: true });
    expect(preferred).toMatchObject({
      livekitUrl: "wss://preferred.livekit.cloud",
      livekitApiKey: "stored-key",
      livekitApiSecret: "stored-secret",
    });

    const pasted = readAudioEnv({
      ...database,
      LIVEKITWebsocketURL: " wss://stored.livekit.cloud\n",
      LIVEKITAPIKEY: " stored-key ",
      LIVEKITAPIsecret: " stored-secret\r\n",
    });
    expect(pasted).toMatchObject({
      livekitUrl: "wss://stored.livekit.cloud",
      livekitApiKey: "stored-key",
      livekitApiSecret: "stored-secret",
    });
  });

  it("does not ask for the microphone when the connection was never set", () => {
    const plan = planMicrophoneRequest({ phase: "connection_not_set", permission: "prompt" });
    expect(plan.request).toBe(false);
    expect(plan.message).toContain(AUDIO_CONNECTION_NOT_SET);
    expect(plan.message).toContain("The microphone was not requested.");
  });

  it("does not ask for the microphone when the room is not connected", () => {
    const failure = diagnoseAudioError({ code: "not_connected", message: AUDIO_NOT_CONNECTED }, true);
    expect(failure.phase).toBe("not_connected");
    expect(failure.microphone).toBe("The microphone was not requested.");
    expect(failure.retry).toBe(true);
    const relay = diagnoseAudioError({ code: "not_connected", message: "invalid API key" }, true);
    expect(relay.message).toBe("invalid API key");
    expect(relay.microphone).toBe("The microphone was not requested.");
    expect(diagnoseAudioError({ code: "forbidden", message: "Classroom access required" }, true).message)
      .toBe("Classroom access required");
    expect(diagnoseAudioError({ code: "connection_not_set", message: "invalid API key" }, true).message)
      .toBe(AUDIO_CONNECTION_NOT_SET);
    expect(publicAudioMessage("Bearer eyJhbGciOiJIUzI1NiJ9.secret")).toBe(AUDIO_NOT_CONNECTED);
    const plan = planMicrophoneRequest({ phase: failure.phase, permission: "granted" });
    expect(plan.request).toBe(false);
    expect(plan.message).toContain(AUDIO_NOT_CONNECTED);
  });

  it("asks from a connected room unless the browser has already blocked the microphone", () => {
    expect(planMicrophoneRequest({ phase: "connected", permission: "prompt" }).request).toBe(true);
    expect(planMicrophoneRequest({ phase: "connected", permission: "granted" }).request).toBe(true);
    const blocked = planMicrophoneRequest({ phase: "connected", permission: "blocked" });
    expect(blocked.request).toBe(false);
    expect(blocked.message).toMatch(/will not show the permission prompt again/i);
    expect(classifyMicrophoneFailure("NotAllowedError")).toBe("blocked");
    expect(classifyMicrophoneFailure("NotFoundError")).toBe("missing");
  });

  it("starts the microphone capture with the constraints before any later await", async () => {
    const calls: MediaStreamConstraints[] = [];
    const pending = captureMicrophone((constraints) => {
      calls.push(constraints);
      return Promise.resolve({ getTracks: () => [] } as unknown as MediaStream);
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ audio: { echoCancellation: true } });
    await pending;
  });

  it("refuses a cross-site caller and allows the app's own host", () => {
    expect(audioRequestAllowed("https://evil.example", "mathgpl.com")).toBe(false);
    expect(audioRequestAllowed("https://mathgpl.com", "preview.example")).toBe(true);
    expect(audioRequestAllowed("https://preview.example", "preview.example")).toBe(true);
    expect(audioRequestAllowed(null, null)).toBe(true);
  });

  it("waits while offline and retries with a capped delay", () => {
    expect(connectAction(false)).toBe("wait");
    expect(connectAction(true)).toBe("connect");
    expect(retryDelayMs(0)).toBe(3_000);
    expect(retryDelayMs(1)).toBe(6_000);
    expect(retryDelayMs(8)).toBe(30_000);
    expect(diagnoseAudioError({ code: "not_connected" }, false).phase).toBe("offline");
    expect(diagnoseAudioError({ code: "connection_not_set" }, true).retry).toBe(false);
  });

  it("sizes a class room for one teacher and 1,000 listeners by default", () => {
    expect(CLASSROOM_AUDIO_MAX_PARTICIPANTS).toBe(1001);
    expect(classroomRoomMaxParticipants({})).toBe(1001);
    expect(classroomRoomMaxParticipants({ CLASSROOM_AUDIO_MAX_PARTICIPANTS: "  " })).toBe(1001);
  });

  it("takes the room size from CLASSROOM_AUDIO_MAX_PARTICIPANTS within bounds", () => {
    expect(classroomRoomMaxParticipants({ CLASSROOM_AUDIO_MAX_PARTICIPANTS: "21" })).toBe(21);
    expect(classroomRoomMaxParticipants({ CLASSROOM_AUDIO_MAX_PARTICIPANTS: " 2001\n" })).toBe(2001);
    expect(classroomRoomMaxParticipants({ CLASSROOM_AUDIO_MAX_PARTICIPANTS: "1,001" })).toBe(1001);
    expect(classroomRoomMaxParticipants({ CLASSROOM_AUDIO_MAX_PARTICIPANTS: "2" })).toBe(2);
    expect(classroomRoomMaxParticipants({ CLASSROOM_AUDIO_MAX_PARTICIPANTS: "10000" })).toBe(10_000);
    for (const bad of ["0", "1", "-5", "10001", "50.5", "lots", "1e3", "999999999999999999999"]) {
      expect(classroomRoomMaxParticipants({ CLASSROOM_AUDIO_MAX_PARTICIPANTS: bad })).toBe(1001);
    }
  });
});

describe("classroom audio floor and moderation", () => {
  it("lets one student speak, and refuses a second until the floor is free", () => {
    const first = updateAudioFloor(floor(), { type: "request" }, "student-a", "teacher", students);
    expect(first.speakerId).toBe("student-a");
    const second = updateAudioFloor(first, { type: "request" }, "student-b", "teacher", students);
    expect(second.speakerId).toBe("student-a");
    expect(allowedPublishers(first, "teacher")).toEqual(new Set(["teacher", "student-a"]));
  });

  it("lets the teacher and a promoted admin mute the current student, and nobody else", () => {
    const speaking = floor({ speakerId: "student-a", moderatorId: "admin-student" });
    const byStudent = updateAudioFloor(speaking, { type: "mute", studentId: "student-a" }, "student-b", "teacher", students);
    expect(byStudent.speakerId).toBe("student-a");
    const byAdmin = updateAudioFloor(speaking, { type: "mute", studentId: "student-a" }, "admin-student", "teacher", students);
    expect(byAdmin.speakerId).toBeNull();
    const byTeacher = updateAudioFloor(speaking, { type: "mute-all" }, "teacher", "teacher", students);
    expect(byTeacher).toMatchObject({ speakerId: null, studentsMuted: true });
    const silenced = updateAudioFloor(byTeacher, { type: "request" }, "student-b", "teacher", students);
    expect(silenced.speakerId).toBeNull();
  });

  it("lets only the teacher promote a classroom audio admin", () => {
    const promoted = updateAudioFloor(floor(), { type: "appoint", studentId: "admin-student" }, "teacher", "teacher", students);
    expect(promoted.moderatorId).toBe("admin-student");
    const refused = updateAudioFloor(floor(), { type: "appoint", studentId: "student-b" }, "admin-student", "teacher", students);
    expect(refused.moderatorId).toBeNull();
    const outsider = updateAudioFloor(floor(), { type: "appoint", studentId: "stranger" }, "teacher", "teacher", students);
    expect(outsider.moderatorId).toBeNull();
    expect(allowedPublishers(promoted, "teacher").has("admin-student")).toBe(true);
  });

  it("does not let a student mute the teacher or take the floor while muted", () => {
    const held = floor({ speakerId: "student-a" });
    expect(updateAudioFloor(held, { type: "mute", studentId: "teacher" }, "student-b", "teacher", students).speakerId)
      .toBe("student-a");
    expect(updateAudioFloor(held, { type: "mute", studentId: "teacher" }, "teacher", "teacher", students).speakerId)
      .toBe("student-a");
    expect(updateAudioFloor(held, { type: "mute-all" }, "student-b", "teacher", students)).toEqual(held);
  });

  it("enforces mute and the actor claim in the database function", () => {
    const sql = readFileSync("supabase/migrations/20261105210000_classroom_audio_mute_and_claims.sql", "utf8");
    expect(sql).toContain("WHEN 'mute'");
    expect(sql).toContain("Moderator required");
    expect(sql).toContain("The classroom teacher cannot be muted from this control");
    expect(sql).toContain("Student is not a classroom member");
    expect(sql).toContain("request.jwt.claim.sub");
    expect(sql).toContain("request.jwt.claims");
    expect(sql).not.toContain("ai.gateway.lovable.dev");
  });
});

describe("classroom audio quality recovery", () => {
  it("drops to a constrained rate after poor intervals and recovers more slowly", () => {
    const decide = createSpeechQualityController();
    const poor = { packetLoss: 0.2, roundTripMs: 800, availableOutgoingBitrate: 20_000 };
    const healthy = { packetLoss: 0, roundTripMs: 40, availableOutgoingBitrate: 200_000 };
    expect(decide(poor)).toBe("clear");
    expect(decide(poor)).toBe("constrained");
    expect(decide(healthy)).toBe("constrained");
    expect(decide(healthy)).toBe("constrained");
    expect(decide(healthy)).toBe("constrained");
    expect(decide(healthy)).toBe("constrained");
    expect(decide(healthy)).toBe("clear");
    expect(decide(null)).toBe("clear");
  });

  it("turns fresh packet counters into an interval, and ignores a report with no media", () => {
    const stats = [
      { type: "outbound-rtp", packetsLost: 4, packetsSent: 96 },
      { type: "candidate-pair", nominated: true, currentRoundTripTime: 0.08, availableOutgoingBitrate: 120_000 },
    ];
    const report = { forEach: (fn: (stat: typeof stats[number]) => void) => stats.forEach(fn) };
    const counters = readTransportCounters(report);
    expect(counters).toMatchObject({ packetsLost: 4, packets: 96, roundTripMs: 80 });
    expect(intervalLoss(counters, {
      packetsLost: 10,
      packets: 146,
      roundTripMs: 90,
      availableOutgoingBitrate: 50_000,
    })).toEqual({ packetLoss: 6 / 56, roundTripMs: 90, availableOutgoingBitrate: 50_000 });
    expect(readTransportCounters({ forEach: () => undefined })).toBeNull();
  });
});
