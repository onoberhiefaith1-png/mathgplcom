import { createClient } from "@supabase/supabase-js";
import {
  AUDIO_CONNECTION_NOT_SET,
  AUDIO_NOT_CONNECTED,
  audioConnectionConfig,
  audioRecord,
  audioRequestAllowed,
  readAudioEnv,
} from "@/lib/classroomAudio/diagnosis";

/**
 * Optional recording hook: audio-only Track Egress of the teacher's microphone.
 *
 * Off unless LIVEKIT_RECORDING_ENABLED is "true". Built for the self-hosted
 * egress service in infra/livekit: the file goes to the storage set in its
 * egress.yaml (Cloudflare R2, Supabase Storage or any S3-compatible bucket),
 * so no storage credentials pass through the app. Track egress copies the
 * Opus track as-is into an .ogg file, with no transcoding and no Chrome, so it
 * is light enough for the free ARM server. No UI calls it yet:
 *   POST /api/classroom-audio/recording { classId, command: "start" | "stop" }
 * Only the class teacher may start or stop.
 */

const CLASS_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function recordingEnabled(source: Record<string, string | undefined>): boolean {
  return /^(1|true|on|yes)$/i.test(source["LIVEKIT_RECORDING_ENABLED"]?.trim() ?? "");
}

/** Where a recording lands inside the egress bucket. */
export function recordingFilepath(room: string, now: Date = new Date()): string {
  return `classroom-audio/${room}/${now.toISOString().replace(/[:.]/g, "-")}.ogg`;
}

/** The LiveKit server API base (https) for a signalling URL (wss). */
export function livekitApiHost(websocketUrl: string): string {
  const url = new URL(websocketUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : url.protocol === "ws:" ? "http:" : url.protocol;
  return url.origin;
}

type Person = { identity: string; tracks?: Array<{ sid: string; source?: number; type?: number; muted?: boolean }> };

/** The teacher's published microphone track, if the teacher is in the room with the mic on. */
export function teacherMicrophoneTrack(
  people: Person[],
  teacherId: string,
  kinds: { microphone: number; audio: number },
): string | null {
  const teacher = people.find((person) => person.identity === teacherId);
  const track = teacher?.tracks?.find((t) => t.source === kinds.microphone && t.type === kinds.audio);
  return track?.sid ?? null;
}

function json(status: number, data: object, origin: string | null) {
  return Response.json(data, {
    status,
    headers: {
      ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Cache-Control": "no-store",
      Vary: "Origin",
    },
  });
}

export async function handleClassroomRecordingRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!audioRequestAllowed(origin, host)) return new Response(null, { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return json(405, { error: "Method not allowed", code: "method" }, origin);
  if (!recordingEnabled(process.env)) return json(404, { error: "Classroom recording is off", code: "recording_off" }, origin);
  const auth = request.headers.get("Authorization") ?? request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json(401, { error: "Sign in required", code: "unauthorized" }, origin);

  const env = readAudioEnv(process.env);
  if (!audioConnectionConfig(env).ok) return json(503, { error: AUDIO_CONNECTION_NOT_SET, code: "connection_not_set" }, origin);

  const body = await request.json().catch(() => null) as { classId?: unknown; command?: unknown } | null;
  const classId = typeof body?.classId === "string" ? body.classId.toLowerCase() : "";
  const command = body?.command === "start" || body?.command === "stop" ? body.command : null;
  if (!CLASS_ID.test(classId) || !command) return json(400, { error: "Invalid recording command", code: "command" }, origin);

  try {
    const db = createClient(env.supabaseUrl!, env.supabaseKey!, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await db.auth.getUser(auth.slice(7));
    if (authError || !user) return json(401, { error: "Sign in required", code: "unauthorized" }, origin);

    const { data, error } = await db.rpc("classroom_audio_command", { _class_id: classId, _command: "status" });
    if (error?.code === "42501") return json(403, { error: "Classroom access required", code: "forbidden" }, origin);
    if (audioRecord(data)?.teacher !== true) return json(403, { error: "Only the class teacher can record", code: "forbidden" }, origin);

    const { data: room } = await db.rpc("classroom_audio_room", { _class_id: classId });
    const roomName = typeof room === "string" ? room.trim() : "";
    if (!roomName.startsWith("classroom-") || !/^[a-z0-9-]+$/i.test(roomName)) {
      return json(503, { error: AUDIO_NOT_CONNECTED, code: "not_connected" }, origin);
    }

    const sdk = await import("livekit-server-sdk");
    const apiHost = livekitApiHost(env.livekitUrl!);
    const egress = new sdk.EgressClient(apiHost, env.livekitApiKey!, env.livekitApiSecret!);

    if (command === "stop") {
      const active = await egress.listEgress({ roomName, active: true });
      for (const item of active) await egress.stopEgress(item.egressId);
      return json(200, { stopped: active.length }, origin);
    }

    const relay = new sdk.RoomServiceClient(apiHost, env.livekitApiKey!, env.livekitApiSecret!);
    const people = await relay.listParticipants(roomName);
    const trackSid = teacherMicrophoneTrack(people, user.id, { microphone: sdk.TrackSource.MICROPHONE, audio: sdk.TrackType.AUDIO });
    if (!trackSid) return json(409, { error: "Turn the teacher microphone on first", code: "no_microphone" }, origin);
    const filepath = recordingFilepath(roomName);
    const info = await egress.startTrackEgress(roomName, new sdk.DirectFileOutput({ filepath }), trackSid);
    return json(200, { egressId: info.egressId, filepath }, origin);
  } catch (error) {
    console.error("[classroom-audio] recording failed", error instanceof Error ? error.message : "unknown");
    return json(503, { error: AUDIO_NOT_CONNECTED, code: "not_connected" }, origin);
  }
}
