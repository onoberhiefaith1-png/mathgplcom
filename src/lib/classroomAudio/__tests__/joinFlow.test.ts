import { describe, expect, it } from "vitest";
import { friendlyAudioError, joinStatusLabel, microphoneHelpSteps, permissionBrowserFor } from "../joinFlow";
import { AUDIO_CONNECTION_NOT_SET } from "../diagnosis";

const SIGNATURE = "could not establish signal connection: invalid authorization token: token signature is invalid: signature is invalid";

describe("readable classroom audio errors", () => {
  it("explains a server key mismatch as a setup problem, not the device, and does not retry it", () => {
    const e = friendlyAudioError({ message: SIGNATURE }, true);
    expect(e.title).toBe("The audio server refused the connection");
    expect(e.detail).toContain("not your device or microphone");
    expect(e.retry).toBe(false);
    expect(e.technical).toBe(SIGNATURE);
  });
  it("network trouble is retried; offline waits for the internet", () => {
    expect(friendlyAudioError({ message: "could not establish signal connection: Failed to fetch" }, true)).toMatchObject({ title: "Couldn't reach the audio server", retry: true });
    expect(friendlyAudioError({ message: "anything" }, false)).toMatchObject({ phase: "offline", retry: true });
  });
  it("connection not set and sign-in ended get their own words", () => {
    expect(friendlyAudioError({ code: "connection_not_set", message: AUDIO_CONNECTION_NOT_SET }, true)).toMatchObject({ phase: "not_set", retry: false });
    expect(friendlyAudioError({ code: "unauthorized", message: "Sign in required" }, true).title).toBe("Please sign in again");
  });
  it("never shows a token or secret in the technical details", () => {
    expect(friendlyAudioError({ message: "bad token eyJhbGciOiJIUzI1NiJ9.abc" }, true).technical).toBe("");
    expect(friendlyAudioError({ message: "LIVEKIT_API_SECRET missing" }, true).technical).toBe("");
  });
});

describe("how to allow a blocked microphone", () => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
  it("knows iPhone Safari, iPhone Chrome, Android, Samsung, desktop browsers and iPad desktop mode", () => {
    expect(permissionBrowserFor(IPHONE)).toBe("ios-safari");
    expect(permissionBrowserFor(IPHONE.replace("Version/17.0", "CriOS/130"))).toBe("ios-other");
    expect(permissionBrowserFor("Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile")).toBe("android-chrome");
    expect(permissionBrowserFor("Mozilla/5.0 (Linux; Android 14) SamsungBrowser/25 Chrome/130")).toBe("samsung");
    expect(permissionBrowserFor("Mozilla/5.0 (Windows NT 10.0) Chrome/130 Edg/130")).toBe("edge");
    expect(permissionBrowserFor("Mozilla/5.0 (Windows NT 10.0) Chrome/130")).toBe("chrome");
    expect(permissionBrowserFor("Mozilla/5.0 (Macintosh) Version/17 Safari/605", 5)).toBe("ios-safari");
  });
  it("gives the right menu path", () => {
    expect(microphoneHelpSteps("ios-safari").join(" ")).toContain("Website Settings");
    expect(microphoneHelpSteps("ios-safari").join(" ")).toContain("Settings app, then Safari, then Microphone");
    expect(microphoneHelpSteps("android-chrome").join(" ")).toContain("Permissions");
    expect(microphoneHelpSteps("chrome").join(" ")).toContain("Set Microphone to Allow");
  });
});

describe("status labels", () => {
  it("reads like a call app", () => {
    expect(joinStatusLabel("idle", false)).toBe("Join audio");
    expect(joinStatusLabel("requesting", false)).toBe("Allow microphone…");
    expect(joinStatusLabel("connecting", false)).toBe("Connecting…");
    expect(joinStatusLabel("connected", true)).toBe("Connected · mic on");
    expect(joinStatusLabel("denied", false)).toBe("Microphone blocked");
  });
});
