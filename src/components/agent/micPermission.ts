// The one place Aura ever asks for a microphone. Every part of her — the wake
// word, the recorder button, the permission dialog — goes through this, so a
// microphone is requested exactly once and the stream it returns is kept and
// used rather than thrown away and asked for again.

export type MicPermission =
  | "unknown"
  | "prompt"
  | "granted"
  /** The browser is refusing: the person or their settings said no. */
  | "blocked"
  /** A real microphone exists but another app is holding it. */
  | "in-use"
  /** The device genuinely reports no audio input at all. */
  | "no-microphone"
  /** This browser has no microphone API. */
  | "unsupported"
  /** Not a secure page, so no browser will hand over a microphone. */
  | "insecure"
  /** Running inside a window that wasn't allowed to pass the microphone on. */
  | "framed"
  /** Something else went wrong; worth another try. */
  | "failed";

export type MicRequest = { state: MicPermission; stream?: MediaStream };

const ASKED_KEY = "mathgpl:aura:mic-asked";

/** States where the device itself is fine and another attempt makes sense. */
export const MIC_RETRYABLE: MicPermission[] = ["prompt", "unknown", "in-use", "failed"];

export function micSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Has this person been shown the request before, on this device? */
export function hasBeenAsked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberAsked() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* a blocked store only means we ask again next time */
  }
}

/**
 * Reasons the page itself can never get a microphone, whatever the device has.
 * Checked before any blame is put on the hardware.
 */
export function environmentIssue(): MicPermission | null {
  if (typeof window === "undefined") return null;
  if (!micSupported()) {
    // An insecure page hides the API entirely, which is the likelier cause.
    return window.isSecureContext === false ? "insecure" : "unsupported";
  }
  if (window.isSecureContext === false) return "insecure";
  const framed = window.self !== window.top;
  if (framed) {
    const policy = (document as unknown as {
      featurePolicy?: { allowsFeature?: (feature: string) => boolean };
    }).featurePolicy;
    if (policy?.allowsFeature && !policy.allowsFeature("microphone")) return "framed";
  }
  return null;
}

/** Does this device report any audio input at all? */
export async function hasAudioInput(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    // Unknown is not the same as none, so never claim a missing microphone.
    return true;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((device) => device.kind === "audioinput");
  } catch {
    return true;
  }
}

/**
 * Turn a failed microphone request into the honest reason. A missing device is
 * only ever reported after the device list confirms there is nothing to use.
 */
export async function classifyMicError(cause: unknown): Promise<MicPermission> {
  const name = (cause as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return "blocked";
  }
  if (name === "NotReadableError" || name === "TrackStartError") return "in-use";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return (await hasAudioInput()) ? "failed" : "no-microphone";
  }
  return "failed";
}

/** What the browser already knows, without showing a prompt. */
export async function readMicPermission(): Promise<MicPermission> {
  const environment = environmentIssue();
  if (environment) return environment;
  const permissions = navigator.permissions as
    | { query?: (descriptor: { name: string }) => Promise<{ state: string }> }
    | undefined;
  if (!permissions?.query) return "unknown";
  try {
    const status = await permissions.query({ name: "microphone" });
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "blocked";
    return "prompt";
  } catch {
    // Some browsers don't report the microphone; the request itself will tell us.
    return "unknown";
  }
}

/** Watch for the teacher changing the permission in their browser settings. */
export function watchMicPermission(onChange: (state: MicPermission) => void): () => void {
  if (typeof navigator === "undefined") return () => undefined;
  const permissions = navigator.permissions as
    | {
        query?: (descriptor: { name: string }) => Promise<{
          state: string;
          onchange: (() => void) | null;
        }>;
      }
    | undefined;
  if (!permissions?.query) return () => undefined;

  let status: { state: string; onchange: (() => void) | null } | null = null;
  let cancelled = false;
  void permissions
    .query({ name: "microphone" })
    .then((result) => {
      if (cancelled) return;
      status = result;
      result.onchange = () => {
        if (result.state === "granted") onChange("granted");
        else if (result.state === "denied") onChange("blocked");
        else onChange("prompt");
      };
    })
    .catch(() => undefined);

  return () => {
    cancelled = true;
    if (status) status.onchange = null;
  };
}

/**
 * The single entry point: ask the browser for the microphone and hand back the
 * live stream. The stream is deliberately kept open — Aura listens with this
 * exact one, so nothing is ever requested twice.
 */
export async function requestMicrophoneAccess(): Promise<MicRequest> {
  const environment = environmentIssue();
  if (environment) return { state: environment };
  rememberAsked();
  try {
    // Echo cancellation matters for the live conversation: without it Aura's own
    // voice comes back through the microphone and she interrupts herself.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((track) => track.stop());
      return { state: (await hasAudioInput()) ? "failed" : "no-microphone" };
    }
    return { state: "granted", stream };
  } catch (cause) {
    return { state: await classifyMicError(cause) };
  }
}

export function describeMicPermission(state: MicPermission): string {
  if (state === "granted") return "Microphone allowed — Aura is listening.";
  if (state === "blocked")
    return "Your browser is blocking the microphone. Open the padlock beside the web address, set the microphone to Allow, then reload this page.";
  if (state === "in-use")
    return "Another app is using your microphone. Close it — a call, a recorder or another tab — then try again.";
  if (state === "no-microphone") return "No microphone detected on this device.";
  if (state === "unsupported")
    return "This browser can't use a microphone. You can still type to Aura.";
  if (state === "insecure")
    return "A microphone only works on a secure address. Open MathGPL at its https address and try again.";
  if (state === "framed")
    return "The window MathGPL is shown in isn't allowed to pass the microphone through. Open MathGPL in its own browser tab.";
  if (state === "failed") return "The microphone didn't start. Try again.";
  return "Aura needs permission to use your microphone before she can listen.";
}

/** Short words for the status light in her panel. */
export function micStatusLabel(state: MicPermission, requesting: boolean, listening: boolean): string {
  if (requesting) return "Requesting microphone…";
  if (listening) return "Aura is listening";
  if (state === "granted") return "Microphone ready";
  if (state === "blocked") return "Microphone blocked";
  if (state === "in-use") return "Microphone in use";
  if (state === "no-microphone") return "No microphone detected";
  if (state === "unsupported" || state === "insecure" || state === "framed")
    return "Microphone unavailable";
  if (state === "failed") return "Microphone didn't start";
  return "Microphone not enabled";
}

export type MicTone = "off" | "requesting" | "live" | "error";

export function micStatusTone(state: MicPermission, requesting: boolean, listening: boolean): MicTone {
  if (requesting) return "requesting";
  if (listening) return "live";
  if (
    state === "blocked" ||
    state === "in-use" ||
    state === "no-microphone" ||
    state === "unsupported" ||
    state === "insecure" ||
    state === "framed" ||
    state === "failed"
  ) {
    return "error";
  }
  return "off";
}
