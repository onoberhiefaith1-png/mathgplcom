import { createClient } from "@supabase/supabase-js";
import { allowedPublishers, type AudioFloor } from "@/lib/classroomAudio/floor";
import {
  AUDIO_CONNECTION_NOT_SET,
  AUDIO_NOT_CONNECTED,
  audioConnectionConfig,
  audioRecord,
  audioRequestAllowed,
  audioText,
  readAudioEnv,
} from "@/lib/classroomAudio/diagnosis";

const COMMANDS = ["request", "release", "pass", "appoint", "mute", "mute-all", "allow-students", "reset", "renew"] as const;

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
 * Applies a floor command only after the database accepts it, then mirrors
 * publish rights onto the LiveKit room. A failed relay keeps the lock so a
 * second caller cannot grant a different microphone.
 */
export async function handleClassroomAudioRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!audioRequestAllowed(origin, host)) return new Response(null, { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return json(405, { error: "Method not allowed", code: "method" }, origin);
  const authorization = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json(401, { error: "Sign in required", code: "unauthorized" }, origin);

  const body = await request.json().catch(() => null) as { classId?: unknown; command?: unknown; studentId?: unknown } | null;
  const classId = typeof body?.classId === "string" ? body.classId.toLowerCase() : "";
  const command = typeof body?.command === "string" ? body.command : "";
  const studentId = typeof body?.studentId === "string" ? body.studentId : null;
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(classId) || !COMMANDS.includes(command as typeof COMMANDS[number])) {
    return json(400, { error: "Invalid classroom command", code: "command" }, origin);
  }

  const env = readAudioEnv(process.env);
  const config = audioConnectionConfig(env);
  if (!config.ok || !env.supabaseUrl || !env.supabaseKey) {
    return json(503, { error: AUDIO_CONNECTION_NOT_SET, code: "connection_not_set" }, origin);
  }

  try {
    const userDb = createClient(env.supabaseUrl, env.supabaseKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userDb.auth.getUser(authorization.slice(7));
    if (authError || !user) return json(401, { error: "Sign in required", code: "unauthorized" }, origin);

    if (command === "renew") {
      const renewed = await userDb.rpc("classroom_audio_command", { _class_id: classId, _command: "renew" });
      if (renewed.error?.code === "42501") return json(403, { error: "Classroom access required", code: "forbidden" }, origin);
      if (renewed.error) return json(503, { error: AUDIO_NOT_CONNECTED, code: "not_connected" }, origin);
      return json(200, {}, origin);
    }

    const endpoint = new URL(env.livekitUrl!);
    endpoint.protocol = "https:";
    const { RoomServiceClient, TrackSource } = await import("livekit-server-sdk");
    const relay = new RoomServiceClient(endpoint.toString(), env.livekitApiKey!, env.livekitApiSecret!);

    if (command === "reset") {
      const reset = await userDb.rpc("reset_classroom_audio", { _class_id: classId });
      if (reset.error) return json(403, { error: "Classroom owner required", code: "forbidden" }, origin);
      if (typeof reset.data === "string") {
        try {
          await relay.deleteRoom(reset.data);
        } catch (error) {
          if ((error as { status?: number }).status !== 404) throw error;
        }
      }
      return json(200, { reset: true }, origin);
    }

    if (!env.serviceRoleKey) return json(503, { error: "Audio connection not set", code: "connection_not_set" }, origin);
    const serverDb = createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: state, error } = await serverDb.rpc("begin_classroom_audio_control", {
      _class_id: classId, _command: command, _actor: user.id, _student_id: studentId,
    });
    const row = audioRecord(state);
    if (error || !row) {
      if (error?.code === "55000") {
        return json(409, { error: "Classroom microphone control unavailable", code: "busy" }, origin);
      }
      if (error?.code === "42501") return json(403, { error: "Classroom access required", code: "forbidden" }, origin);
      return json(503, { error: AUDIO_NOT_CONNECTED, code: "not_connected" }, origin);
    }

    const room = audioText(row.roomName);
    if (!room) throw new Error("Classroom audio room unavailable");
    const people = await relay.listParticipants(room);
    const { data: classroom, error: classError } = await userDb.from("classes").select("owner_id").eq("id", classId).single();
    if (classError || !classroom?.owner_id) throw new Error("Classroom unavailable");

    const floor: AudioFloor = {
      speakerId: audioText(row.speakerId),
      moderatorId: audioText(row.moderatorId),
      studentsMuted: row.studentsMuted === true,
    };
    const publishers = allowedPublishers(floor, classroom.owner_id);
    if (command === "mute" && studentId) publishers.delete(studentId);

    for (const person of people) {
      const publish = publishers.has(person.identity);
      await relay.updateParticipant(room, person.identity, {
        attributes: {
          mathgpl_audio_role: person.identity === classroom.owner_id
            ? "teacher"
            : person.identity === floor.moderatorId ? "moderator" : "student",
        },
        permission: {
          canSubscribe: true,
          canPublish: publish,
          canPublishData: false,
          ...(publish ? { canPublishSources: [TrackSource.MICROPHONE] } : {}),
        },
      });
    }

    const completed = await serverDb.rpc("finish_classroom_audio_control", {
      _class_id: classId, _lock: audioText(row.controlLock) ?? "",
    });
    if (completed.error) throw completed.error;
    return json(200, {
      speakerId: floor.speakerId,
      moderatorId: floor.moderatorId,
      studentsMuted: floor.studentsMuted,
    }, origin);
  } catch {
    return json(503, { error: AUDIO_NOT_CONNECTED, code: "not_connected" }, origin);
  }
}
