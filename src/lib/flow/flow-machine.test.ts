import { describe, it, expect } from "vitest";
import { flowReducer, initialFlow } from "@/lib/flow/machine";
import { withRanges } from "@/lib/flow/segments";
import type { FlowScene } from "@/lib/flow/types";

const scenes: FlowScene[] = [
  { id: "b", end: 0.8, name: "Listening", type: "base" },
  { id: "c", end: 2.1, name: "Curious", type: "emotion" },
  { id: "h", end: 3.4, name: "Happy", type: "emotion" },
  { id: "o", end: 5, name: "Out", type: "flow_out" },
  { id: "i", end: 6.5, name: "In", type: "flow_in" },
];
const r = flowReducer(scenes);

describe("flow", () => {
  it("derives start from previous end", () => {
    const rs = withRanges(scenes);
    expect(rs[1].start).toBe(0.8);
    expect(rs[0].start).toBe(0);
  });
  it("cuts the base loop at once, then queues further emotions", () => {
    let s = initialFlow(scenes);
    s = r(s, { type: "EMOTION", id: "c" });
    expect(s.current).toBe("c");
    expect(s.queue).toEqual([]);
    s = r(s, { type: "EMOTION", id: "h" });
    expect(s.current).toBe("c");
    expect(s.queue).toEqual(["h"]);
    s = r(s, { type: "SCENE_END" });
    expect(s.current).toBe("h");
    s = r(s, { type: "SCENE_END" });
    expect(s.current).toBe("b");
  });
  it("runs the full sensor cycle", () => {
    let s = initialFlow(scenes);
    s = r(s, { type: "HASH_ON" });
    expect(s.current).toBe("b");
    s = r(s, { type: "SCENE_END" });
    expect(s.mode).toBe("flow_out");
    s = r(s, { type: "SCENE_END" });
    expect(s.mode).toBe("sensor");
    s = r(s, { type: "HASH_OFF" });
    expect(s.current).toBe("i");
    s = r(s, { type: "SCENE_END" });
    expect(s.mode).toBe("character");
    expect(s.current).toBe("b");
  });
});

import { describe as d2, it as i2, expect as e2 } from "vitest";
import { flowReducer as fr, initialFlow as inf } from "@/lib/flow/machine";
d2("flow queue + hash during transitions", () => {
  const sc = [
    { id: "b", end: 2, name: "B", type: "base" as const },
    { id: "e1", end: 3, name: "😊", type: "emotion" as const },
    { id: "e2", end: 4, name: "🤔", type: "emotion" as const },
    { id: "o", end: 5, name: "O", type: "flow_out" as const },
    { id: "i", end: 6, name: "I", type: "flow_in" as const },
  ];
  const r = fr(sc);
  i2("plays the first pick now and the rest in click order", () => {
    let s = inf(sc);
    s = r(s, { type: "EMOTION", id: "e1" });
    e2(s.current).toBe("e1");
    s = r(s, { type: "EMOTION", id: "e2" });
    e2(s.current).toBe("e1");
    s = r(s, { type: "SCENE_END" }); e2(s.current).toBe("e2");
    s = r(s, { type: "SCENE_END" }); e2(s.current).toBe("b");
  });
  i2("# off during flow out returns via flow in", () => {
    let s = r(inf(sc), { type: "HASH_ON" });
    s = r(s, { type: "SCENE_END" }); e2(s.mode).toBe("flow_out");
    s = r(s, { type: "HASH_OFF" });
    s = r(s, { type: "SCENE_END" }); e2(s.mode).toBe("flow_in");
    s = r(s, { type: "SCENE_END" }); e2(s.mode).toBe("character");
  });
});
