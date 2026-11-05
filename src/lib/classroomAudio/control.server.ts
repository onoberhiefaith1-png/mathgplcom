import { createClient } from "@supabase/supabase-js";
import { RoomServiceClient, TrackSource } from "livekit-server-sdk";

export async function handleClassroomAudioRequest(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = ["https://mathgpl.com", "https://mathgplcom.lovable.app"];
  if (origin && !allowed.includes(origin)) return new Response(null, { status: 403 });
  const headers = {
    "Access-Control-Allow-Origin": origin ?? allowed[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store", Vary: "Origin",
  };
  const reply = (status: number, data: object) => Response.json(data, { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(405, { error: "Method not allowed" });
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Sign in required" });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.classId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.classId)
    || !["request", "release", "pass", "appoint", "mute-all", "allow-students", "reset", "renew"].includes(body.command)) {
    return reply(400, { error: "Invalid classroom command" });
  }
  const env = (name: string) => {
    const value = process.env[name];
    if (!value) throw new Error("Missing configuration");
    return value;
  };
  try {
    const dbUrl = env("SUPABASE_URL");
    const publicKey = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? env("SUPABASE_ANON_KEY");
    const userDb = createClient(dbUrl, publicKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await userDb.auth.getUser(authorization.slice(7));
    if (authError || !user) return reply(401, { error: "Sign in required" });
    if (body.command === "renew") {
      const renewed = await userDb.rpc("classroom_audio_command", {
        _class_id: body.classId, _command: "renew",
      });
      return renewed.error ? reply(403, { error: "Classroom access required" }) : reply(200, {});
    }
    if (body.command === "reset") {
      const reset = await userDb.rpc("reset_classroom_audio", { _class_id: body.classId });
      if (reset.error) return reply(403, { error: "Classroom owner required" });
      if (typeof reset.data === "string") {
        const previousEndpoint = new URL(env("LIVEKIT_URL"));
        previousEndpoint.protocol = "https:";
        try {
          await new RoomServiceClient(previousEndpoint.toString(), env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET"))
            .deleteRoom(reset.data);
        } catch (error) {
          if ((error as { status?: number }).status !== 404) throw error;
        }
      }
      return reply(200, { reset: true });
    }
    const serverDb = createClient(dbUrl, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    const { data: state, error } = await serverDb.rpc("begin_classroom_audio_control", {
      _class_id: body.classId, _command: body.command, _actor: user.id, _student_id: body.studentId ?? null,
    });
    if (error || !state) return reply(409, { error: "Classroom microphone control unavailable" });

    // Keep the lock on any relay failure. A partially completed handoff must
    // never allow a second controller to grant a different microphone.
    const endpoint = new URL(env("LIVEKIT_URL"));
    endpoint.protocol = "https:";
    const relay = new RoomServiceClient(endpoint.toString(), env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET"));
    const room = state.roomName;
    if (typeof room !== "string") throw new Error("Classroom audio room unavailable");
    const people = await relay.listParticipants(room);
    const { data: classroom, error: classError } = await userDb.from("classes")
      .select("owner_id").eq("id", body.classId).single();
    if (classError || !classroom) throw new Error("Classroom unavailable");
    for (const person of people) {
      if (person.identity === classroom.owner_id) continue;
      await relay.updateParticipant(room, person.identity, {
        attributes: { mathgpl_audio_role: person.identity === state.moderatorId ? "moderator" : "student" },
        permission: { canSubscribe: true, canPublish: false, canPublishData: false },
      });
    }
    const allowedSpeakers = new Set([state.speakerId, state.moderatorId].filter(Boolean));
    for (const identity of allowedSpeakers) {
      if (!people.some((person) => person.identity === identity)) continue;
      await relay.updateParticipant(room, identity, {
        permission: { canSubscribe: true, canPublish: true, canPublishData: false,
          canPublishSources: [TrackSource.MICROPHONE] },
      });
    }
    const completed = await serverDb.rpc("finish_classroom_audio_control", {
      _class_id: body.classId, _lock: state.controlLock,
    });
    if (completed.error) throw completed.error;
    return reply(200, { speakerId: state.speakerId, moderatorId: state.moderatorId, studentsMuted: state.studentsMuted });
  } catch {
    return reply(503, { error: "Audio control needs recovery. Please contact the teacher." });
  }
}
