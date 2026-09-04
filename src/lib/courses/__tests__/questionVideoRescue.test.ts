// A saved timeline must never degrade to "Not set" because the question was
// recompiled and its line ids changed.
import { describe, expect, it } from "vitest";
import { emptyVideoConfig, sectionsFor, type VideoLine } from "../questionVideo";

const lines = (ids: string[]): VideoLine[] =>
  ids.map((id, i) => ({ lineId: id, label: `Line ${i + 1}` }));

describe("saved timeline resolution", () => {
  const saved = {
    ...emptyVideoConfig(),
    videoPath: "v.mp4",
    duration: 100,
    segments: [
      { key: "line:a", start: 1, end: 9 },
      { key: "line:b", start: 10, end: 19 },
    ],
    sectionOrder: ["line:a", "line:b"],
  };

  it("matches by line id when the ids are unchanged", () => {
    const s = sectionsFor(lines(["a", "b"]), saved);
    expect(s.map((x) => [x.startAt, x.endAt])).toEqual([
      [1, 9],
      [10, 19],
    ]);
  });

  it("recovers a range by position when a line id has changed", () => {
    const s = sectionsFor(lines(["a", "b2"]), saved);
    expect(s[0]?.startAt).toBe(1);
    expect(s[1]?.startAt).toBe(10);
    expect(s[1]?.endAt).toBe(19);
    expect(s[1]?.configured).toBe(true);
  });

  it("leaves a genuinely new extra line unset", () => {
    const s = sectionsFor(lines(["a", "b", "c"]), saved);
    expect(s[2]?.startAt).toBeNull();
    expect(s[2]?.endAt).toBeNull();
  });
});
