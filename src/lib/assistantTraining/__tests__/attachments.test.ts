import { describe, expect, it } from "vitest";
import { attachmentReading, describeAttachments } from "../attachments";
import { approvedGuidanceText } from "@/lib/mcp/tools/guide";

describe("training attachments", () => {
  it("never claims a video was studied", () => {
    expect(attachmentReading("video/mp4")).toBe("name-only");
    expect(
      describeAttachments([
        { path: "a", name: "demo.mp4", mime: "video/mp4", size: 1 },
      ]),
    ).toContain("NOT studied");
  });
  it("views screenshots", () => {
    expect(attachmentReading("image/png")).toBe("studied");
  });
});

describe("approved guidance for assistants", () => {
  it("adds nothing until a version is approved", () => {
    expect(approvedGuidanceText(null)).toBe("");
  });
  it("includes the approved version number", () => {
    const t = approvedGuidanceText({
      version: 3,
      approvedAt: "",
      mandatory: "M",
      recommended: "",
      techniques: "",
      examples: [],
    });
    expect(t).toContain("version 3");
  });
});
