import { describe, expect, it } from "vitest";
import { activeNotePayload, clearSnapshotPayload } from "../classBoardState";

describe("class board live-note payload", () => {
  it("never writes a null board snapshot alongside the live note", () => {
    const payload = activeNotePayload("c1", "nb2", "2026-01-01T00:00:00.000Z");
    expect(payload).toEqual({
      class_id: "c1",
      notebook_id: "nb2",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect("state_json" in payload).toBe(false);
  });

  it("switching notes always carries the new notebook id", () => {
    expect(activeNotePayload("c1", "quadratic").notebook_id).toBe("quadratic");
    expect(activeNotePayload("c1", "linear").notebook_id).toBe("linear");
  });

  it("clears the snapshot with a legal empty object, never null", () => {
    const payload = clearSnapshotPayload("2026-01-01T00:00:00.000Z");
    expect(payload.state_json).toEqual({});
    expect(payload.state_json).not.toBeNull();
  });
});
