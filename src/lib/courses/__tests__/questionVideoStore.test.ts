// The teaching video for one Exercise Card question lives inside the card's own
// settings, so saving works without any new store.
import { beforeEach, describe, expect, it, vi } from "vitest";

const B = "b1";
const Q1 = "11111111-1111-4111-8111-111111111111";
const Q2 = "22222222-2222-4222-8222-222222222222";

let config: Record<string, unknown> = {};
const updates: any[] = [];

const query = () => {
  const q: any = {
    select: () => q,
    eq: () => q,
    update: (row: any) => {
      updates.push(row);
      config = row.config;
      return q;
    },
    maybeSingle: async () => ({ data: { config }, error: null }),
    then: (res: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(res),
  };
  return q;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "teacher-1" } } }) },
    from: () => query(),
  },
}));

const cfg = (path: string, segments: { key: string; start: number; end: number }[]) => ({
  videoPath: path,
  duration: 256,
  checkpoints: {},
  segments,
  introEnabled: true,
  conclusionEnabled: false,
});

describe("question video store", () => {
  beforeEach(() => {
    config = { name: "Algebra drill", passMark: 80 };
    updates.length = 0;
  });

  it("saves and loads one question's video", async () => {
    const store = await import("../questionVideoStore");
    const segments = [
      { key: "intro", start: 0, end: 23 },
      { key: "line:a", start: 51, end: 62 },
    ];
    await store.saveQuestionVideo(B, Q1, cfg("teacher-1/v.mp4", segments));

    // The card's other settings survive the write.
    expect((config as any).name).toBe("Algebra drill");

    const loaded = await store.loadQuestionVideo(B, Q1);
    expect(loaded?.videoPath).toBe("teacher-1/v.mp4");
    expect(loaded?.duration).toBe(256);
    expect(loaded?.segments).toEqual(segments);
    expect(loaded?.introEnabled).toBe(true);
    expect(loaded?.conclusionEnabled).toBe(false);
  });

  it("keeps questions of the same card apart and reports the flags", async () => {
    const store = await import("../questionVideoStore");
    await store.saveQuestionVideo(B, Q1, cfg("a.mp4", []));
    await store.saveQuestionVideo(B, Q2, cfg("b.mp4", []));

    expect((await store.loadQuestionVideo(B, Q1))?.videoPath).toBe("a.mp4");
    expect((await store.loadQuestionVideo(B, Q2))?.videoPath).toBe("b.mp4");
    expect([...(await store.loadCardVideoFlags(B))].sort()).toEqual([Q1, Q2].sort());

    await store.removeQuestionVideo(B, Q1);
    expect(await store.loadQuestionVideo(B, Q1)).toBeNull();
    expect([...(await store.loadCardVideoFlags(B))]).toEqual([Q2]);
  });

  it("returns null for a question with no video", async () => {
    const store = await import("../questionVideoStore");
    expect(await store.loadQuestionVideo(B, Q1)).toBeNull();
    expect([...(await store.loadCardVideoFlags(B))]).toEqual([]);
  });
});

describe("media type and lock", () => {
  beforeEach(() => {
    config = {};
  });

  it("round-trips the media kind, the lock and the saved order", async () => {
    const store = await import("../questionVideoStore");
    await store.saveQuestionVideo(B, Q1, {
      ...cfg("teacher-1/talk.m4a", [{ key: "line:a", start: 2, end: 9 }]),
      mediaType: "audio",
      sectionOrder: ["line:a"],
      locked: false,
    } as never);

    const loaded = await store.loadQuestionVideo(B, Q1);
    expect(loaded?.mediaType).toBe("audio");
    expect(loaded?.locked).toBe(true);
    expect(loaded?.sectionOrder).toEqual(["line:a"]);
  });

  it("treats an older saved record as locked video", async () => {
    config = {
      questionVideos: {
        [Q1]: { videoPath: "old.mp4", duration: 10, segments: [] },
      },
    };
    const store = await import("../questionVideoStore");
    const loaded = await store.loadQuestionVideo(B, Q1);
    expect(loaded?.mediaType).toBe("video");
    expect(loaded?.locked).toBe(true);
  });
});
