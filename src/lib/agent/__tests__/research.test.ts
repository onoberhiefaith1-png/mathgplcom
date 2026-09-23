import { describe, expect, it } from "vitest";

import {
  captionTracks,
  pageTitle,
  publicUrl,
  readableText,
  transcriptFromJson3,
  transcriptSteps,
  youTubeId,
} from "../research.server";

describe("publicUrl", () => {
  it("accepts a public page", () => {
    expect(publicUrl("https://example.com/a").hostname).toBe("example.com");
  });

  it("refuses private and non-web addresses", () => {
    expect(() => publicUrl("http://localhost:8080")).toThrow();
    expect(() => publicUrl("http://192.168.1.4/admin")).toThrow();
    expect(() => publicUrl("file:///etc/passwd")).toThrow();
    expect(() => publicUrl("not a url")).toThrow();
  });
});

describe("readableText", () => {
  it("strips scripts, styles and markup", () => {
    const html =
      "<html><head><title>Lesson</title><style>b{}</style></head><body><script>alert(1)</script><p>Step one</p><p>Step two</p></body></html>";
    const text = readableText(html);
    expect(text).toContain("Step one");
    expect(text).toContain("Step two");
    expect(text).not.toContain("alert");
    expect(pageTitle(html)).toBe("Lesson");
  });
});

describe("youTubeId", () => {
  it("reads every ordinary address shape", () => {
    expect(youTubeId("https://www.youtube.com/watch?v=abc123XYZ_-")).toBe("abc123XYZ_-");
    expect(youTubeId("https://youtu.be/abc123XYZ_-")).toBe("abc123XYZ_-");
    expect(youTubeId("https://www.youtube.com/shorts/abc123XYZ_-")).toBe("abc123XYZ_-");
    expect(youTubeId("https://example.com/watch?v=abc")).toBeNull();
  });
});

describe("captions", () => {
  it("finds the advertised caption tracks", () => {
    const page =
      '{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=x\\u0026lang=en","name":{},"languageCode":"en"}]}';
    const tracks = captionTracks(page);
    expect(tracks).toHaveLength(1);
    expect(tracks[0]!.language).toBe("en");
    expect(tracks[0]!.url).toContain("&lang=en");
  });

  it("reads the spoken words out of a json3 transcript", () => {
    const body = JSON.stringify({
      events: [
        { segs: [{ utf8: "First " }, { utf8: "open the note." }] },
        { segs: [{ utf8: "\n" }] },
        { segs: [{ utf8: "Then add a session." }] },
      ],
    });
    expect(transcriptFromJson3(body)).toBe("First open the note. Then add a session.");
    expect(transcriptFromJson3("not json")).toBe("");
  });

  it("breaks a transcript into steps", () => {
    const transcript = Array.from(
      { length: 6 },
      (_, i) => `This is step number ${i + 1} of the tutorial and it explains something useful.`,
    ).join(" ");
    const steps = transcriptSteps(transcript);
    expect(steps.length).toBeGreaterThan(1);
    expect(steps[0]).toContain("step number 1");
  });
});
