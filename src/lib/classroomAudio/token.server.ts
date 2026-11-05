import { createClient } from "@supabase/supabase-js";
import {
  AUDIO_NOT_CONNECTED,
  CLASSROOM_AUDIO_MAX_PARTICIPANTS,
  CLASSROOM_AUDIO_TOKEN_TTL_SECONDS,
  audioConnectionConfig,
  audioRecord,
  audioRequestAllowed,
  audioText,
  readAudioEnv,
} from "@/lib/classroomAudio/diagnosis";

const CLASS_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

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

/**
 * Admits one signed-in class member to that class's LiveKit room.
 * LiveKit is a hosted media relay (SFU, and on LiveKit Cloud a TURN service).
 * It is not free. This route does not call the Lovable AI gateway.
 */
export async function handleClassroomAudioRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!audioRequestAllowed(origin, host)) return new Response(null, { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return json(405, { error: "Method not allowed", code: "method" }, origin);
  const auth = request.headers.get("Authorization") ?? request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json(401, { error: "Sign in required", code: "unauthorized" }, origin);

  const config = audioConnectionConfig(readAudioEnv(process.env));
  if (!config.ok) return json(503, { error: config.message, code: config.code }, origin);

  const body = await request.json().catch(() => null) as { classId?: unknown } | null;
  const classId = typeof body?.classId === "string" ? body.classId.toLowerCase() : "";
  if (!CLASS_ID.test(classId)) return json(400, { error: "A valid classroom is required", code: "class" }, origin);

  const env = readAudioEnv(process.env);
  const db = createClient(env.supabaseUrl!, env.supabaseKey!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await db.auth.getUser(auth.slice(7));
  if (authError || !user) return json(401, { error: "Sign in required", code: "unauthorized" }, origin);

  const { data, error } = await db.rpc("classroom_audio_command", { _class_id: classId, _command: "status" });
  const floor = audioRecord(data);
  if (error?.code === "42501") return json(403, { error: "Classroom access required", code: "forbidden" }, origin);
  if (error || !floor) return json(503, { error: AUDIO_NOT_CONNECTED, code: "not_connected" }, origin);

  const { data: room, error: roomError } = await db.rpc("classroom_audio_room", { _class_id: classId });
  if (roomError || typeof room !== "string" || !room.startsWith("classroom-")) {
    return json(503, { error: AUDIO_NOT_CONNECTED, code: "not_connected" }, origin);
  }

  const endpoint = new URL(env.livekitUrl!);
  endpoint.protocol = "https:";
  try {
    const { RoomServiceClient, AccessToken, TrackSource } = await import("livekit-server-sdk");
    await new RoomServiceClient(endpoint.toString(), env.livekitApiKey!, env.livekitApiSecret!).createRoom({
      name: room,
      maxParticipants: CLASSROOM_AUDIO_MAX_PARTICIPANTS,
      emptyTimeout: 60,
      departureTimeout: 20,
    });
    const metadata = audioRecord(user.user_metadata);
    const displayName = audioText(metadata?.full_name) ?? audioText(metadata?.name);
    const role = floor.teacher === true ? "teacher" : floor.moderatorId === user.id ? "moderator" : "student";
    const token = new AccessToken(env.livekitApiKey!, env.livekitApiSecret!, {
      identity: user.id,
      name: displayName ? displayName.slice(0, 80) : "Class participant",
      ttl: CLASSROOM_AUDIO_TOKEN_TTL_SECONDS,
      attributes: { mathgpl_audio_role: role },
    });
    token.addGrant({
      room,
      roomJoin: true,
      canSubscribe: true,
      canPublish: role === "teacher" || role === "moderator",
      canPublishSources: [TrackSource.MICROPHONE],
      canPublishData: false,
    });
    return json(200, { url: env.livekitUrl, token: await token.toJwt() }, origin);
  } catch {
    return json(503, { error: AUDIO_NOT_CONNECTED, code: "not_connected" }, origin);
  }
}
