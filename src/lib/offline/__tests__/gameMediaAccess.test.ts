import { describe, expect, it } from "vitest";
import { isCompletionClipPath } from "../gameMediaAccess";
const flow = { clips: [{ id: "c", name: "c", path: "flow-a/original.mp4", processedPath: "flow-a/cutout.webm", duration: 10, removeBg: true }] };
describe("attached Game character authorization", () => {
  it("accepts exact original and processed references", () => {
    expect(isCompletionClipPath(flow, "flow-a/original.mp4")).toBe(true);
    expect(isCompletionClipPath(flow, "flow-a/cutout.webm")).toBe(true);
  });
  it("rejects sibling and unrelated private clips", () => {
    expect(isCompletionClipPath(flow, "flow-a/other.mp4")).toBe(false);
    expect(isCompletionClipPath(flow, "private-flow/original.mp4")).toBe(false);
    expect(isCompletionClipPath(null, "flow-a/original.mp4")).toBe(false);
    expect(isCompletionClipPath(flow, "flow-a/../original.mp4")).toBe(false);
  });
});