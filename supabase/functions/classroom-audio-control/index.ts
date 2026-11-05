import { createClient } from "npm:@supabase/supabase-js@2";
import { RoomServiceClient, TrackSource } from "npm:livekit-server-sdk@2";

Deno.serve(async (request) => {
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
    || !["request", "release", "pass", "appoint", "mute-all", "allow-students"].includes(body.command)) {
    return reply(400, { error: "Invalid classroom command" });
  }
  const env = (name: string) => {
    const value = Deno.env.get(name);
    if (!value) throw new Error("Missing configuration");
    return value;
  };
  try {
    const dbUrl = env("SUPABASE_URL");
    const userDb = createClient(dbUrl, env("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await userDb.auth.getUser(authorization.slice(7));
    if (authError || !user) return reply(401, { error: "Sign in required" });
    const { data: state, error } = await userDb.rpc("begin_classroom_audio_control", {
      _class_id: body.classId, _command: body.command, _student_id: body.studentId ?? null,
    });
    if (error || !state) return reply(409, { error: "Classroom microphone control unavailable" });

    // Keep the lock on any relay failure. A partially completed handoff must
    // never allow a second controller to grant a different microphone.
    const endpoint = new URL(env("LIVEKIT_URL"));
    endpoint.protocol = "https:";
    const relay = new RoomServiceClient(endpoint.toString(), env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET"));
    const room = `classroom-${body.classId.toLowerCase()}`;
    const people = await relay.listParticipants(room);
    const { data: classroom, error: classError } = await userDb.from("classes")
      .select("owner_id").eq("id", body.classId).single();
    if (classError || !classroom) throw new Error("Classroom unavailable");
    for (const person of people) {
      if (person.identity === classroom.owner_id) continue;
      await relay.updateParticipant(room, person.identity, {
        permission: { canSubscribe: true, canPublish: false, canPublishData: false },
      });
    }
    if (state.speakerId && people.some((person) => person.identity === state.speakerId)) {
      await relay.updateParticipant(room, state.speakerId, {
        permission: { canSubscribe: true, canPublish: true, canPublishData: false,
          canPublishSources: [TrackSource.MICROPHONE] },
      });
    }
    const serverDb = createClient(dbUrl, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    const completed = await serverDb.rpc("finish_classroom_audio_control", {
      _class_id: body.classId, _lock: state.controlLock,
    });
    if (completed.error) throw completed.error;
    return reply(200, { speakerId: state.speakerId, studentsMuted: state.studentsMuted });
  } catch {
    return reply(503, { error: "Audio control needs recovery. Please contact the teacher." });
  }
});
