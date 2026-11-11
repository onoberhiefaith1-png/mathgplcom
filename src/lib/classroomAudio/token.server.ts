import { createClient } from "@supabase/supabase-js";
import {
  AUDIO_NOT_CONNECTED,
  CLASSROOM_AUDIO_MAX_PARTICIPANTS,
  audioConnectionConfig,
  audioRecord,
  audioRequestAllowed,
  audioText,
  publicAudioMessage,
  readAudioEnv,
} from "@/lib/classroomAudio/diagnosis";
import { openLiveKitRoom, signClassroomJoinToken } from "@/lib/classroomAudio/livekitJwt.server";
import { joinGrant } from "@/lib/classroomAudio/floor";

const CLASS_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function failureText(message: string | undefined, fallback: string): string {
  if (!message?.trim()) return fallback;
  const safe = publicAudioMessage(message);
  if (safe === AUDIO_NOT_CONNECTED && message.trim() !== AUDIO_NOT_CONNECTED) return fallback;
  return safe;
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

/**
 * Admits one signed-in class member to that class's LiveKit room.
 * LiveKit is the media relay (SFU plus TURN): LiveKit Cloud, or the
 * self-hosted server in infra/livekit, chosen by LIVEKIT_TARGET (see readAudioEnv). This route does not call the Lovable AI gateway.
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
  if (error || !floor) {
    return json(503, {
      error: failureText(error?.message, "Classroom audio status could not be read"),
      code: "not_connected",
    }, origin);
  }

  const { data: room, error: roomError } = await db.rpc("classroom_audio_room", { _class_id: classId });
  const roomName = typeof room === "string" ? room.trim() : "";
  if (roomError || !roomName.startsWith("classroom-") || !/^[a-z0-9-]+$/i.test(roomName)) {
    return json(503, {
      error: failureText(roomError?.message, "Classroom audio room was not issued"),
      code: "not_connected",
    }, origin);
  }

  let signalUrl = env.livekitUrl!;
  try {
    const parsed = new URL(signalUrl);
    if (parsed.protocol !== "wss:" || parsed.username || parsed.password) throw new Error("invalid");
    signalUrl = signalUrl.trim();
  } catch {
    return json(503, { error: "The LiveKit websocket URL is not valid", code: "not_connected" }, origin);
  }

  // Room limits are best-effort. LiveKit creates the room on the first join,
  // and RoomServiceClient.createRoom was the call that failed closed.
  const roomSetup = await openLiveKitRoom({
    websocketUrl: signalUrl,
    apiKey: env.livekitApiKey!,
    apiSecret: env.livekitApiSecret!,
    room: roomName,
    maxParticipants: CLASSROOM_AUDIO_MAX_PARTICIPANTS,
  });
  if (roomSetup) console.error("[classroom-audio] room setup failed", roomSetup);

  try {
    const metadata = audioRecord(user.user_metadata);
    const displayName = audioText(metadata?.full_name) ?? audioText(metadata?.name);
    const { role, canPublish } = joinGrant(floor, user.id);
    const token = await signClassroomJoinToken({
      apiKey: env.livekitApiKey!,
      apiSecret: env.livekitApiSecret!,
      identity: user.id,
      name: displayName ? displayName.slice(0, 80) : "Class participant",
      room: roomName,
      role,
      canPublish,
    });
    return json(200, { url: signalUrl, token }, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return json(503, { error: publicAudioMessage(message || AUDIO_NOT_CONNECTED), code: "not_connected" }, origin);
  }
}
