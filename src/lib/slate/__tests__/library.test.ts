import { describe, expect, it } from "vitest";
import { forkLibrarySample, libraryReaderView, type LibrarySample } from "../library";

const sample = (): LibrarySample => ({
  id: "sample-1",
  name: "Linear equations",
  library: true,
  ownerId: "faith",
  slots: ["line 1"],
});

describe("game library source", () => {
  it("gives every reader the sample row, including a later edit", () => {
    const original = sample();
    expect(libraryReaderView(original)).toBe(original);
    const edited = { ...original, name: "Solving linear equations", slots: ["line 1", "line 2"] };
    const seen = libraryReaderView(edited);
    expect(seen.id).toBe("sample-1");
    expect(seen.slots).toEqual(["line 1", "line 2"]);
    expect(seen.name).toBe("Solving linear equations");
  });

  it("keeps a private copy where it was when it was made", () => {
    const original = sample();
    const mine = forkLibrarySample(original, { id: "mine-1", ownerId: "teacher" });
    const edited = { ...original, slots: ["line 1", "line 2"] };
    expect(mine).toMatchObject({
      id: "mine-1",
      ownerId: "teacher",
      library: false,
      name: "Linear equations copy",
      slots: ["line 1"],
    });
    expect(libraryReaderView(edited).slots).toEqual(["line 1", "line 2"]);
    expect(mine.slots).toEqual(["line 1"]);
  });
});
