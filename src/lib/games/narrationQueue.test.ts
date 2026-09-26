// @vitest-environment jsdom
//
// The narration channel must be a queue: clips due at the same moment are heard
// one after the other instead of overwriting each other.
import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeAudio {
  src = "";
  volume = 1;
  loop = false;
  paused = true;
  ended = false;
  currentTime = 0;
  preload = "";
  onended: (() => void) | null = null;
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  finish() {
    this.ended = true;
    this.paused = true;
    this.onended?.();
  }
}

let created: FakeAudio[] = [];

beforeEach(() => {
  created = [];
  vi.stubGlobal(
    "Audio",
    class extends FakeAudio {
      constructor() {
        super();
        created.push(this as unknown as FakeAudio);
      }
    },
  );
  vi.resetModules();
});

const load = async () => {
  const mod = await import("./audio");
  mod.unlockAudio();
  return mod;
};

describe("narration queue", () => {
  it("plays a batch in order, one clip at a time", async () => {
    const { enqueueNarration } = await load();
    enqueueNarration([{ src: "a.mp3" }, { src: "b.mp3" }]);

    const el = created[0]!;
    expect(el.src).toBe("a.mp3");
    await Promise.resolve();

    el.finish();
    expect(el.src).toBe("b.mp3");
  });

  it("does not lose the second clip of a batch", async () => {
    const { enqueueNarration } = await load();
    enqueueNarration([{ src: "one.mp3" }, { src: "two.mp3" }, { src: "three.mp3" }]);
    const el = created[0]!;
    const heard = [el.src];
    el.finish();
    heard.push(el.src);
    el.finish();
    heard.push(el.src);
    expect(heard).toEqual(["one.mp3", "two.mp3", "three.mp3"]);
  });

  it("queues behind a speaking clip without interrupting it", async () => {
    const { enqueueNarration, queueNarration } = await load();
    enqueueNarration([{ src: "first.mp3" }]);
    const el = created[0]!;
    queueNarration([{ src: "later.mp3" }]);
    expect(el.src).toBe("first.mp3");
    el.finish();
    expect(el.src).toBe("later.mp3");
  });

  it("reports the stage that owns the speaking clip", async () => {
    const { enqueueNarration, narrationOwner } = await load();
    enqueueNarration([{ src: "loop.mp3", owner: "lp-1" }]);
    expect(narrationOwner()).toBe("lp-1");
  });

  it("holds position on pause and continues on resume", async () => {
    const { enqueueNarration, pauseChannel, resumeChannelPlayback } = await load();
    enqueueNarration([{ src: "hold.mp3" }]);
    const el = created[0]!;
    el.currentTime = 4.2;
    pauseChannel("narration");
    expect(el.paused).toBe(true);
    resumeChannelPlayback("narration");
    expect(el.currentTime).toBe(4.2);
    expect(el.src).toBe("hold.mp3");
  });

  it("stopping clears anything still queued", async () => {
    const { enqueueNarration, stopChannel } = await load();
    enqueueNarration([{ src: "x.mp3" }, { src: "y.mp3" }]);
    const el = created[0]!;
    stopChannel("narration", 0);
    expect(el.onended).toBeNull();
  });
});
