import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken, RoomServiceClient, TrackSource } from "npm:livekit-server-sdk@2";

const origins = new Set(["https://mathgpl.com", "https://mathgplcom.lovable.app"]);

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (origin && !origins.has(origin)) return new Response(null, { status: 403 });
  const headers = {
    "Access-Control-Allow-Origin": origin ?? "https://mathgpl.com",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  const respond = (status: number, data: object) => Response.json(data, { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond(405, { error: "Method not allowed" });
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return respond(401, { error: "Sign in required" });
  const body = await request.json().catch(() => null);
  const classId = body?.classId;
  if (typeof classId !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(classId)) {
    return respond(400, { error: "A valid classroom is required" });
  }

  const url = Deno.env.get("LIVEKIT_URL");
  const apiKey = Deno.env.get("LIVEKIT_API_KEY");
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
  const dbUrl = Deno.env.get("SUPABASE_URL");
  const dbKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url?.startsWith("wss://") || !apiKey || !apiSecret || !dbUrl || !dbKey) {
    return respond(503, { error: "Classroom audio is unavailable" });
  }

  const db = createClient(dbUrl, dbKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await db.auth.getUser(auth.slice(7));
  if (authError || !user) return respond(401, { error: "Sign in required" });
  const { data, error } = await db.rpc("classroom_audio_command", {
    _class_id: classId.toLowerCase(),
    _command: "status",
  });
  if (error?.code === "42501") return respond(403, { error: "Classroom access required" });
  if (error || !data) return respond(503, { error: "Classroom audio is unavailable" });

  const room = `classroom-${classId.toLowerCase()}`;
  const endpoint = new URL(url);
  endpoint.protocol = "https:";
  try {
    await new RoomServiceClient(endpoint.toString(), apiKey, apiSecret).createRoom({
      name: room,
      maxParticipants: 21,
      emptyTimeout: 60,
      departureTimeout: 20,
    });
  } catch {
    return respond(503, { error: "The classroom audio service could not be reached" });
  }
  const displayName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const token = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: typeof displayName === "string" ? displayName.slice(0, 80) : "Class participant",
    ttl: 120,
  });
  token.addGrant({
    room,
    roomJoin: true,
    canSubscribe: true,
    canPublish: data.teacher === true,
    canPublishSources: [TrackSource.MICROPHONE],
    canPublishData: false,
  });
  return respond(200, { url, token: await token.toJwt() });
});
