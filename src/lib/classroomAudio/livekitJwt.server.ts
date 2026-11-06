import { CLASSROOM_AUDIO_TOKEN_TTL_SECONDS, publicAudioMessage } from "@/lib/classroomAudio/diagnosis";

const textEncoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * LiveKit participant grant. Same claims AccessToken.toJwt writes
 * (HS256, header {"alg":"HS256"}), without loading livekit-server-sdk.
 * That package pulls in the whole protocol runtime; on the classroom
 * worker the import or RoomServiceClient.createRoom was throwing, and the
 * empty catch turned it into 503 before a token existed.
 */
export async function signLiveKitJwt(
  apiKey: string,
  apiSecret: string,
  payload: Record<string, unknown>,
): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("LiveKit token signing is unavailable");
  const header = base64Url(textEncoder.encode(JSON.stringify({ alg: "HS256" })));
  const body = base64Url(textEncoder.encode(JSON.stringify(payload)));
  const unsigned = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(unsigned)));
  return `${unsigned}.${base64Url(signature)}`;
}

export async function signClassroomJoinToken(input: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  name: string;
  room: string;
  role: "teacher" | "moderator" | "student";
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signLiveKitJwt(input.apiKey, input.apiSecret, {
    name: input.name,
    attributes: { mathgpl_audio_role: input.role },
    video: {
      room: input.room,
      roomJoin: true,
      canSubscribe: true,
      canPublish: input.role === "teacher" || input.role === "moderator",
      canPublishSources: ["microphone"],
      canPublishData: false,
    },
    iss: input.apiKey,
    nbf: now - 10,
    exp: now + CLASSROOM_AUDIO_TOKEN_TTL_SECONDS,
    sub: input.identity,
  });
}

export function livekitRoomEndpoint(websocketUrl: string): string {
  const endpoint = new URL(websocketUrl);
  endpoint.username = "";
  endpoint.password = "";
  endpoint.protocol = endpoint.protocol === "wss:" ? "https:" : endpoint.protocol === "ws:" ? "http:" : endpoint.protocol;
  endpoint.pathname = "/twirp/livekit.RoomService/CreateRoom";
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint.toString();
}

function liveKitBodyMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { msg?: unknown; message?: unknown };
    const message = typeof parsed.msg === "string" ? parsed.msg : typeof parsed.message === "string" ? parsed.message : "";
    return message.trim() ? message.trim() : null;
  } catch {
    const text = body.replace(/\s+/g, " ").trim();
    return text && !text.startsWith("<") ? text : null;
  }
}

/**
 * Applies the classroom room limits when the LiveKit API answers.
 * Rooms are also created on the first join, so a setup failure is reported
 * and does not block the participant token.
 */
export async function openLiveKitRoom(input: {
  websocketUrl: string;
  apiKey: string;
  apiSecret: string;
  room: string;
  maxParticipants: number;
}): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const admin = await signLiveKitJwt(input.apiKey, input.apiSecret, {
      iss: input.apiKey,
      nbf: now - 10,
      exp: now + 60,
      video: { roomCreate: true },
    });
    const response = await fetch(livekitRoomEndpoint(input.websocketUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${admin}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: input.room,
        emptyTimeout: 60,
        maxParticipants: input.maxParticipants,
        departureTimeout: 20,
      }),
      signal: AbortSignal.timeout(4_000),
    });
    if (response.ok) return null;
    const message = liveKitBodyMessage(await response.text().catch(() => ""));
    return publicAudioMessage(message ?? `LiveKit room setup failed (${response.status})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return publicAudioMessage(message || "LiveKit room setup failed");
  }
}
