import { describe, expect, it } from "vitest";
import { isPrivateFlowFork, libraryFlowContent, type FlowLibraryRecord } from "./library";

const record = (patch: Partial<FlowLibraryRecord>): FlowLibraryRecord => ({
  id: "lib",
  scope: "mathgpl",
  sourceFlowId: "src",
  name: "Fairy",
  clips: ["wave"],
  scenes: [{ id: "base" }],
  cover_path: null,
  cover_type: null,
  position: { dx: 0 },
  updatedAt: "2026-11-01T00:00:00.000Z",
  ...patch,
});

describe("flow library source", () => {
  it("plays the newer source through the library id everyone already selected", () => {
    const library = record({});
    const source = record({
      id: "src",
      scope: "personal",
      sourceFlowId: null,
      name: "Fairy revised",
      clips: ["wave", "bow"],
      updatedAt: "2026-11-05T00:00:00.000Z",
    });
    const seen = libraryFlowContent(library, source);
    expect(seen.id).toBe("lib");
    expect(seen.name).toBe("Fairy revised");
    expect(seen.clips).toEqual(["wave", "bow"]);
    expect(seen.sourceFlowId).toBe("src");
  });

  it("keeps a library save that is newer than the working flow", () => {
    const library = record({ name: "Shelf edit", updatedAt: "2026-11-06T00:00:00.000Z" });
    const source = record({
      id: "src",
      scope: "personal",
      sourceFlowId: null,
      name: "Older draft",
      updatedAt: "2026-11-02T00:00:00.000Z",
    });
    expect(libraryFlowContent(library, source).name).toBe("Shelf edit");
  });

  it("does not pull library edits into a private copy", () => {
    const fork = record({
      id: "copy",
      scope: "personal",
      sourceFlowId: "lib",
      name: "My fairy",
      clips: ["wave"],
    });
    const source = record({ clips: ["replaced"], updatedAt: "2026-11-08T00:00:00.000Z" });
    expect(isPrivateFlowFork(fork)).toBe(true);
    expect(libraryFlowContent(fork, source)).toEqual(fork);
  });
});
