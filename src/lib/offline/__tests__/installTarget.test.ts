import { describe, expect, it } from "vitest";
import { installTargetFor } from "../installTarget";
import { mediaToSave, offlineMediaUrl } from "../prepareOffline";

const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1";
const WHATSAPP_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.24";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

describe("install route per device", () => {
  it("iPhone Safari gets the Home Screen guide", () => expect(installTargetFor(SAFARI_IPHONE)).toBe("ios-safari"));
  it("Chrome on iPhone is told to open Safari", () => expect(installTargetFor(CHROME_IPHONE)).toBe("ios-other-browser"));
  it("WhatsApp's browser on iPhone is told to open Safari", () => expect(installTargetFor(WHATSAPP_IPHONE)).toBe("ios-other-browser"));
  it("an iPad that reports as a Mac is still treated as iPad", () => expect(installTargetFor(IPAD_AS_MAC, 5)).toBe("ios-safari"));
  it("a real Mac is a desktop", () => expect(installTargetFor(IPAD_AS_MAC, 0)).toBe("desktop"));
  it("Android gets the app file", () => expect(installTargetFor("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe("android"));
});

describe("offline videos", () => {
  it("YouTube links are never saved; uploaded videos are", () => {
    const school = { id: "s", name: "", schoolName: "", description: null, classes: [{ id: "c", name: "", subjects: [{ id: "x", name: "", topics: [{ id: "t", name: "", subtopics: [{ id: "st", name: "", sessions: [
      { id: "se", title: "", description: null, videoUrl: "https://youtu.be/abc", activities: [
        { id: "a", title: "", lines: [], videoUrl: "https://cdn.example.com/v.mp4" },
        { id: "b", title: "", lines: [], videoUrl: "https://cdn.example.com/v.mp4" },
      ] },
    ] }] }] }] }] };
    expect(mediaToSave([school])).toEqual(["https://cdn.example.com/v.mp4?_aof=1"]);
    expect(offlineMediaUrl("https://youtu.be/abc")).toBe("https://youtu.be/abc");
  });
});
