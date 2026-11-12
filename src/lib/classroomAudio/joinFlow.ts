// The classroom audio join flow, Meet/Zoom style: nothing connects and no
// microphone is asked for until the person taps Join. Joining with the
// microphone asks the browser first (the prompt must start inside the tap),
// then connects; Listen only connects without a microphone at all.
import { AUDIO_CONNECTION_NOT_SET } from "@/lib/classroomAudio/diagnosis";

export type JoinPhase =
  | "idle"
  | "requesting"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "denied"
  | "no_mic"
  | "offline"
  | "not_set"
  | "error";

export type JoinMode = "mic" | "listen";

export type FriendlyAudioError = {
  phase: "offline" | "not_set" | "error";
  title: string;
  detail: string;
  /** The raw message, for the "Technical details" line. Never contains a token or secret. */
  technical: string;
  /** Worth retrying by itself (network blips); a setup problem is not. */
  retry: boolean;
};

const SECRETISH = /(api[_-]?secret|livekitapikey|livekit[_-]?api[_-]?secret|bearer\s+\S|eyJ[A-Za-z0-9_-]{8,})/i;

function technicalText(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  if (!clean || /^<!doctype|^<html/i.test(clean)) return "";
  if (SECRETISH.test(clean)) return "";
  return clean.length > 240 ? `${clean.slice(0, 237)}…` : clean;
}

/** Turns a token-route, LiveKit or network failure into words a teacher or student can act on. */
export function friendlyAudioError(error: { code?: string; message?: string } | null, online: boolean): FriendlyAudioError {
  const raw = error?.message ?? "";
  const technical = technicalText(raw);
  const m = raw.toLowerCase();
  if (!online) {
    return { phase: "offline", title: "You're offline", detail: "Classroom audio will reconnect by itself when the internet comes back.", technical, retry: true };
  }
  if (error?.code === "connection_not_set" || raw === AUDIO_CONNECTION_NOT_SET) {
    return { phase: "not_set", title: "Classroom audio isn't set up yet", detail: "The audio service for this site has not been configured. Ask the school or site admin to finish the audio setup.", technical, retry: false };
  }
  if (error?.code === "unauthorized" || /sign in required/.test(m)) {
    return { phase: "error", title: "Please sign in again", detail: "Your sign-in has ended. Sign in again, then join the audio.", technical, retry: false };
  }
  if (/signature is invalid|invalid authorization token|invalid api key|token is expired|unauthori[sz]ed|\b401\b/.test(m)) {
    return {
      phase: "error",
      title: "The audio server refused the connection",
      detail: "This is a setup problem on our side, not your device or microphone. The site's audio key does not match the audio server. Ask the site admin to check the classroom audio key; you can try again afterwards.",
      technical,
      retry: false,
    };
  }
  if (/room.*full|max.*participants|participant limit/.test(m)) {
    return { phase: "error", title: "The class audio is full", detail: "This class has reached its audio limit. Ask your teacher, or try again in a moment.", technical, retry: true };
  }
  if (/permission|not allowed|forbidden|\b403\b|not a member|not in this class/.test(m)) {
    return { phase: "error", title: "You can't join this class's audio", detail: "This account is not allowed in this class's audio. Check you are signed in with the right account.", technical, retry: false };
  }
  if (/could not establish|signal connection|websocket|timed? ?out|network|failed to fetch|ice|pc connection|turn/.test(m)) {
    return { phase: "error", title: "Couldn't reach the audio server", detail: "Check your internet connection, then tap Reconnect. On school Wi-Fi, the network may be blocking calls.", technical, retry: true };
  }
  return { phase: "error", title: "Classroom audio couldn't connect", detail: "Something went wrong while connecting. Tap Reconnect to try again.", technical, retry: true };
}

export type PermissionBrowser = "ios-safari" | "ios-other" | "android-chrome" | "samsung" | "chrome" | "edge" | "firefox" | "safari" | "other";

export function permissionBrowserFor(ua: string, maxTouchPoints = 0): PermissionBrowser {
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && maxTouchPoints > 1);
  if (ios) return /crios|fxios|edgios/i.test(ua) ? "ios-other" : "ios-safari";
  if (/samsungbrowser/i.test(ua)) return "samsung";
  if (/android/i.test(ua)) return "android-chrome";
  if (/edg\//i.test(ua)) return "edge";
  if (/firefox\//i.test(ua)) return "firefox";
  if (/chrome\//i.test(ua)) return "chrome";
  if (/safari\//i.test(ua)) return "safari";
  return "other";
}

/** How to turn the microphone back on after it was blocked, for this browser. */
export function microphoneHelpSteps(browser: PermissionBrowser): string[] {
  switch (browser) {
    case "ios-safari":
      return [
        "Tap the aA (or page settings) button in the address bar, then Website Settings.",
        "Set Microphone to Allow (or Ask).",
        "If it is still blocked: open the Settings app, then Safari, then Microphone, and choose Allow or Ask.",
        "Come back and tap Try again.",
      ];
    case "ios-other":
      return [
        "Open the Settings app, scroll to this browser (Chrome, Edge or Firefox) and turn Microphone on.",
        "Come back, reload the page and tap Try again.",
      ];
    case "android-chrome":
      return [
        "Tap the icon to the left of the address (the lock or settings icon), then Permissions.",
        "Turn Microphone on (Allow).",
        "If Chrome itself has no microphone access: Android Settings, Apps, Chrome, Permissions, Microphone, Allow.",
        "Come back and tap Try again.",
      ];
    case "samsung":
      return [
        "Tap the lock icon in the address bar, then Permissions, and allow Microphone.",
        "If needed: Android Settings, Apps, Samsung Internet, Permissions, Microphone, Allow.",
        "Come back and tap Try again.",
      ];
    case "chrome":
    case "edge":
      return [
        "Click the icon at the left of the address bar (the lock or settings icon).",
        "Set Microphone to Allow, then reload if asked.",
        "On a Mac, also check System Settings, Privacy & Security, Microphone, and turn on this browser.",
        "Tap Try again.",
      ];
    case "firefox":
      return [
        "Click the microphone icon (crossed out) at the left of the address bar.",
        "Remove the Blocked setting, then tap Try again and choose Allow.",
      ];
    case "safari":
      return [
        "In the menu bar choose Safari, then Settings for This Website (or Settings, Websites, Microphone).",
        "Set Microphone to Allow, then tap Try again.",
      ];
    default:
      return [
        "Open this site's settings from the address bar and allow the microphone.",
        "Then tap Try again, or join with Listen only.",
      ];
  }
}

/** The short label on the floating audio button. */
export function joinStatusLabel(phase: JoinPhase, speaking: boolean): string {
  switch (phase) {
    case "idle": return "Join audio";
    case "requesting": return "Allow microphone…";
    case "connecting": return "Connecting…";
    case "reconnecting": return "Reconnecting…";
    case "connected": return speaking ? "Connected · mic on" : "Connected";
    case "denied": return "Microphone blocked";
    case "no_mic": return "No microphone";
    case "offline": return "Offline";
    case "not_set": return "Audio not set up";
    default: return "Audio error";
  }
}
