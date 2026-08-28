// Store once → reference many. These tests lock the two properties that keep
// sharing free of duplicated video files.
import { describe, expect, it, vi, beforeEach } from "vitest";

const createSignedUrl = vi.fn();
const copy = vi.fn();
const upload = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "owner-1" } } }) },
    storage: { from: () => ({ createSignedUrl, copy, upload }) },
  },
}));
vi.mock("@/lib/costs/clientMeter", () => ({
  bytesToGb: () => 1,
  meterClientUsage: () => undefined,
}));

import { resolveCourseMedia, uploadCourseMedia } from "@/lib/courses/media";

beforeEach(() => {
  createSignedUrl.mockReset();
  copy.mockReset();
  upload.mockReset();
});

describe("course media references", () => {
  it("uploads exactly once, under the owner's own folder", async () => {
    upload.mockResolvedValue({ error: null });
    const path = await uploadCourseMedia("course-9", new File(["x"], "clip.mp4"));
    expect(path.startsWith("owner-1/course-9/")).toBe(true);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(copy).not.toHaveBeenCalled();
  });

  it("streams the original path for an authorised viewer — no copy is made", async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://cdn/x" }, error: null });
    const res = await resolveCourseMedia("owner-1/course-9/123.mp4");
    expect(res.state).toBe("ready");
    expect(createSignedUrl).toHaveBeenCalledWith("owner-1/course-9/123.mp4", 60 * 60 * 8);
    expect(copy).not.toHaveBeenCalled();
  });

  it("reports a deleted or unauthorised asset as unavailable, never regenerated", async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: { message: "Object not found" } });
    const res = await resolveCourseMedia("owner-1/course-9/gone.mp4");
    expect(res).toEqual({ url: null, state: "unavailable" });
    expect(upload).not.toHaveBeenCalled();
    expect(copy).not.toHaveBeenCalled();
  });

  it("treats a missing reference as 'not set', not as unavailable", async () => {
    expect(await resolveCourseMedia(null)).toEqual({ url: null, state: "empty" });
  });

  it("passes absolute links (YouTube/Vimeo) straight through", async () => {
    const res = await resolveCourseMedia("https://youtu.be/abcdef");
    expect(res).toEqual({ url: "https://youtu.be/abcdef", state: "ready" });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
