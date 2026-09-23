// Microphone permission, asked once and remembered. Every teacher on the
// platform has to grant it before Aura can hear anything, so this is the single
// place that asks, reads and reports that answer.

export type MicPermission =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied"
  | "no-microphone"
  | "unsupported";

const ASKED_KEY = "mathgpl:aura:mic-asked";

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

/** What the browser already knows, without showing a prompt. */
export async function readMicPermission(): Promise<MicPermission> {
  if (!micSupported()) return "unsupported";
  const permissions = navigator.permissions as
    | { query?: (descriptor: { name: string }) => Promise<{ state: string }> }
    | undefined;
  if (!permissions?.query) return "unknown";
  try {
    const status = await permissions.query({ name: "microphone" });
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "prompt";
  } catch {
    // Some browsers don't report the microphone; the prompt itself will tell us.
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
        else if (result.state === "denied") onChange("denied");
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
 * Show the browser's own permission prompt. The stream is released straight
 * away — this only settles the permission, it never keeps a microphone open.
 */
export async function requestMicAccess(): Promise<MicPermission> {
  if (!micSupported()) return "unsupported";
  rememberAsked();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return "granted";
  } catch (cause) {
    const name = (cause as { name?: string })?.name;
    if (name === "NotFoundError" || name === "DevicesNotFoundError") return "no-microphone";
    if (name === "NotAllowedError" || name === "SecurityError") return "denied";
    return "denied";
  }
}

export function describeMicPermission(state: MicPermission): string {
  if (state === "granted") return "Microphone allowed.";
  if (state === "denied")
    return "Your browser is blocking the microphone. Open the padlock beside the web address, set the microphone to Allow, then reload this page.";
  if (state === "no-microphone") return "No microphone was found on this device.";
  if (state === "unsupported") return "This browser can't use a microphone. You can still type to Aura.";
  return "Aura needs permission to use your microphone before she can listen.";
}
