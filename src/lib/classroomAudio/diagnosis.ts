// Classroom voice fails closed before the browser is asked for a microphone.
// These helpers are the decisions the token route and the Smartboard share.

export const AUDIO_CONNECTION_NOT_SET = "Audio connection not set";
export const AUDIO_NOT_CONNECTED = "Audio not connected";
export const MICROPHONE_NOT_REQUESTED = "The microphone was not requested.";

/** Configured room size. This is not a measured 21-person test. */
export const CLASSROOM_AUDIO_MAX_PARTICIPANTS = 21;

/** Long enough for a lesson and for LiveKit's own reconnect to reuse the grant. */
export const CLASSROOM_AUDIO_TOKEN_TTL_SECONDS = 4 * 60 * 60;

export function audioRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function audioText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export type LiveKitTarget = "cloud" | "self-hosted";

export type AudioEnv = {
  /** Which LiveKit server the secrets point at. Absent when LIVEKIT_TARGET is not a known value. */
  livekitTarget?: LiveKitTarget;
  livekitUrl?: string;
  livekitApiKey?: string;
  livekitApiSecret?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  serviceRoleKey?: string;
};

export type AudioConfigFailure = {
  ok: false;
  code: "connection_not_set";
  message: typeof AUDIO_CONNECTION_NOT_SET;
};

export type AudioConfigOk = { ok: true };

/**
 * LiveKit is the media relay. Without its websocket URL and API credentials,
 * plus the app database URL and key, no room is created and no browser
 * permission prompt is allowed to stand in for that missing connection.
 */
export function audioConnectionConfig(env: AudioEnv): AudioConfigOk | AudioConfigFailure {
  const url = env.livekitUrl?.trim() ?? "";
  const key = env.livekitApiKey?.trim() ?? "";
  const secret = env.livekitApiSecret?.trim() ?? "";
  const dbUrl = env.supabaseUrl?.trim() ?? "";
  const dbKey = env.supabaseKey?.trim() ?? "";
  if (!url.startsWith("wss://") || !key || !secret || !dbUrl || !dbKey) {
    return { ok: false, code: "connection_not_set", message: AUDIO_CONNECTION_NOT_SET };
  }
  return { ok: true };
}

function firstNonBlank(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim() !== "");
}

function trimmed(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

/**
 * LIVEKIT_TARGET picks the LiveKit server, so moving between LiveKit Cloud and
 * the self-hosted server (infra/livekit) is one secret change, with both sets
 * of credentials kept side by side:
 * - blank or "cloud": LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET
 *   (or the older stored names LIVEKITWebsocketURL / LIVEKITAPIKEY / LIVEKITAPIsecret);
 * - "self-hosted": LIVEKIT_SELF_HOSTED_URL / LIVEKIT_SELF_HOSTED_API_KEY / LIVEKIT_SELF_HOSTED_API_SECRET.
 * Any other value fails closed ("Audio connection not set") rather than guessing a server.
 */
export function liveKitTarget(value: string | undefined): LiveKitTarget | null {
  const v = (value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (v === "" || v === "cloud" || v === "livekitcloud") return "cloud";
  if (v === "selfhosted" || v === "self" || v === "selfhost") return "self-hosted";
  return null;
}

export function readAudioEnv(source: Record<string, string | undefined>): AudioEnv {
  const target = liveKitTarget(source["LIVEKIT_TARGET"]);
  const livekit = target === "self-hosted"
    ? {
      livekitUrl: trimmed(source["LIVEKIT_SELF_HOSTED_URL"]),
      livekitApiKey: trimmed(source["LIVEKIT_SELF_HOSTED_API_KEY"]),
      livekitApiSecret: trimmed(source["LIVEKIT_SELF_HOSTED_API_SECRET"]),
    }
    : target === "cloud"
      ? {
        // Underscore names win. Blank ones fall back to the names stored in Lovable Secrets.
        // Values are trimmed: a pasted newline must not be signed into the LiveKit grant.
        livekitUrl: trimmed(firstNonBlank(source["LIVEKIT_URL"], source["LIVEKITWebsocketURL"])),
        livekitApiKey: trimmed(firstNonBlank(source["LIVEKIT_API_KEY"], source["LIVEKITAPIKEY"])),
        livekitApiSecret: trimmed(firstNonBlank(source["LIVEKIT_API_SECRET"], source["LIVEKITAPIsecret"])),
      }
      : {};
  return {
    ...(target ? { livekitTarget: target } : {}),
    ...livekit,
    supabaseUrl: trimmed(source["SUPABASE_URL"] ?? source["VITE_SUPABASE_URL"]),
    supabaseKey: trimmed(
      source["SUPABASE_PUBLISHABLE_KEY"] ??
      source["SUPABASE_ANON_KEY"] ??
      source["VITE_SUPABASE_PUBLISHABLE_KEY"],
    ),
    serviceRoleKey: trimmed(source["SUPABASE_SERVICE_ROLE_KEY"]),
  };
}

/**
 * A failure the Smartboard can show. Connection-not-set stays the fixed sentence.
 * Anything else keeps the server or LiveKit message, with secrets and pages stripped out.
 */
export function publicAudioMessage(message: string | null | undefined): string {
  const clean = message?.replace(/\s+/g, " ").trim() ?? "";
  if (!clean || clean.length > 240) return AUDIO_NOT_CONNECTED;
  if (/^<!doctype|^<html/i.test(clean)) return AUDIO_NOT_CONNECTED;
  if (/(api[_-]?secret|livekitapikey|livekit[_-]?api[_-]?secret|bearer\s+\S|eyJ[A-Za-z0-9_-]{8,})/i.test(clean)) {
    return AUDIO_NOT_CONNECTED;
  }
  return clean;
}

export function audioErrorInput(error: unknown): { code?: string; message?: string } {
  if (typeof error === "string") return { message: error };
  if (!error || typeof error !== "object") return {};
  const record = error as { code?: unknown; message?: unknown };
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
  };
}

const KNOWN_ORIGINS = new Set([
  "https://mathgpl.com",
  "https://www.mathgpl.com",
  "https://mathgplcom.lovable.app",
]);

/** Same site as this request, or one of the known app origins. Cross-site callers are refused. */
export function audioRequestAllowed(origin: string | null, host: string | null): boolean {
  if (!origin) return true;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (KNOWN_ORIGINS.has(parsed.origin)) return true;
  const forwarded = host?.split(",")[0]?.trim().toLowerCase() ?? "";
  return forwarded.length > 0 && parsed.host.toLowerCase() === forwarded;
}

export type AudioPhase =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline"
  | "connection_not_set"
  | "not_connected";

export type MicrophonePermission = "unknown" | "granted" | "prompt" | "blocked" | "missing";

export function retryDelayMs(attempt: number): number {
  const step = Math.max(0, Math.min(4, Math.floor(attempt)));
  return Math.min(30_000, 3_000 * 2 ** step);
}

export function connectAction(online: boolean): "wait" | "connect" {
  return online ? "connect" : "wait";
}

export type AudioFailure = {
  phase: "connection_not_set" | "not_connected" | "offline";
  message: string;
  microphone: typeof MICROPHONE_NOT_REQUESTED;
  retry: boolean;
};

export function diagnoseAudioError(error: { code?: string; message?: string } | null, online: boolean): AudioFailure {
  if (!online) {
    return {
      phase: "offline",
      message: "You are offline. Classroom audio will reconnect when the internet returns.",
      microphone: MICROPHONE_NOT_REQUESTED,
      retry: true,
    };
  }
  if (error?.code === "connection_not_set" || error?.message === AUDIO_CONNECTION_NOT_SET) {
    return {
      phase: "connection_not_set",
      message: AUDIO_CONNECTION_NOT_SET,
      microphone: MICROPHONE_NOT_REQUESTED,
      retry: false,
    };
  }
  return {
    phase: "not_connected",
    message: publicAudioMessage(error?.message),
    microphone: MICROPHONE_NOT_REQUESTED,
    retry: true,
  };
}

const BLOCKED_MICROPHONE =
  "The browser has blocked the microphone for this site. Allow the microphone in the browser's site settings, then try again. The browser will not show the permission prompt again until that changes.";

/**
 * The microphone is requested only after a room is actually connected, and only
 * from the click that follows. A missing service or a dropped room must not be
 * reported as a microphone denial.
 */
export function planMicrophoneRequest(input: {
  phase: AudioPhase;
  permission: MicrophonePermission;
}): { request: boolean; message: string } {
  if (input.phase === "connection_not_set") {
    return { request: false, message: `${AUDIO_CONNECTION_NOT_SET}. ${MICROPHONE_NOT_REQUESTED}` };
  }
  if (input.phase !== "connected") {
    return { request: false, message: `${AUDIO_NOT_CONNECTED}. ${MICROPHONE_NOT_REQUESTED}` };
  }
  if (input.permission === "blocked") {
    return { request: false, message: BLOCKED_MICROPHONE };
  }
  if (input.permission === "missing") {
    return { request: false, message: "This browser has no microphone this page can use." };
  }
  return { request: true, message: "" };
}

export function classifyMicrophoneFailure(name: string): "blocked" | "missing" | "failed" {
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return "blocked";
  if (name === "NotFoundError" || name === "NotSupportedError" || name === "OverconstrainedError") return "missing";
  return "failed";
}

export function permissionFromQuery(state: string | null): MicrophonePermission {
  if (state === "granted") return "granted";
  if (state === "prompt") return "prompt";
  if (state === "denied") return "blocked";
  return "unknown";
}

export type RtcStat = {
  type?: string;
  packetsLost?: number;
  packetsSent?: number;
  packetsReceived?: number;
  nominated?: boolean;
  state?: string;
  currentRoundTripTime?: number;
  availableOutgoingBitrate?: number;
};

export type TransportCounters = {
  packetsLost: number;
  packets: number;
  roundTripMs: number;
  availableOutgoingBitrate?: number;
};

/** Read one RTC stats report. Cumulative counters are turned into an interval by the caller. */
export function readTransportCounters(report: { forEach: (fn: (stat: RtcStat) => void) => void } | null): TransportCounters | null {
  if (!report) return null;
  let packetsLost = 0;
  let packets = 0;
  let roundTripMs: number | null = null;
  let available: number | undefined;
  let sawMedia = false;
  report.forEach((stat) => {
    if (stat.type === "outbound-rtp" || stat.type === "inbound-rtp") {
      if (typeof stat.packetsLost === "number") packetsLost += stat.packetsLost;
      const count = stat.packetsSent ?? stat.packetsReceived;
      if (typeof count === "number") packets += count;
      sawMedia = true;
    }
    const selected = stat.type === "candidate-pair" && (stat.nominated === true || stat.state === "succeeded");
    if (selected && typeof stat.currentRoundTripTime === "number") {
      roundTripMs = stat.currentRoundTripTime * 1000;
      if (typeof stat.availableOutgoingBitrate === "number") available = stat.availableOutgoingBitrate;
    }
  });
  if (!sawMedia || roundTripMs === null) return null;
  return { packetsLost, packets, roundTripMs, availableOutgoingBitrate: available };
}

export function intervalLoss(previous: TransportCounters | null, next: TransportCounters) {
  const lost = Math.max(0, next.packetsLost - (previous?.packetsLost ?? 0));
  const packets = Math.max(0, next.packets - (previous?.packets ?? 0));
  const total = lost + packets;
  return {
    packetLoss: total > 0 ? lost / total : 0,
    roundTripMs: next.roundTripMs,
    availableOutgoingBitrate: next.availableOutgoingBitrate,
  };
}
