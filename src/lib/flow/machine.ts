// Pure Flow state machine. A playing scene is NEVER cut: every transition is
// decided at SCENE_END.
import type { FlowScene } from "./types";

export type FlowMode = "character" | "flow_out" | "sensor" | "flow_in";

export interface FlowState {
  mode: FlowMode;
  current: string | null; // scene id playing (null in sensor mode)
  queue: string[]; // queued emotion ids
  pendingOut: boolean; // # ON requested, waiting for current scene end
  pendingIn: boolean; // # OFF requested during flow_out
}

export type FlowEvent =
  | { type: "EMOTION"; id: string }
  | { type: "HASH_ON" }
  | { type: "HASH_OFF" }
  | { type: "SCENE_END" };

const idOf = (scenes: FlowScene[], t: FlowScene["type"]) =>
  scenes.find((s) => s.type === t)?.id ?? null;

export const initialFlow = (scenes: FlowScene[]): FlowState => ({
  mode: "character",
  current: idOf(scenes, "base"),
  queue: [],
  pendingOut: false,
  pendingIn: false,
});

export const flowReducer =
  (scenes: FlowScene[]) =>
  (s: FlowState, e: FlowEvent): FlowState => {
    const base = idOf(scenes, "base");
    const out = idOf(scenes, "flow_out");
    const inn = idOf(scenes, "flow_in");
    switch (e.type) {
      case "EMOTION":
        if (s.mode !== "character" || s.pendingOut) return s;
        // The base loop is never precious: switch to the emotion at once.
        if (s.current === base) return { ...s, current: e.id };
        // An emotion always finishes; further picks wait in click order.
        return { ...s, queue: [...s.queue, e.id] };
      case "HASH_ON":
        if (s.mode === "character") return { ...s, pendingOut: true };
        if (s.mode === "flow_in") return { ...s, pendingOut: true };
        if (s.mode === "flow_out") return { ...s, pendingIn: false };
        return s;
      case "HASH_OFF":
        if (s.mode === "sensor") return { ...s, mode: "flow_in", current: inn, pendingIn: false };
        if (s.mode === "flow_out") return { ...s, pendingIn: true };
        return { ...s, pendingOut: false };
      case "SCENE_END": {
        if (s.mode === "flow_out") {
          if (s.pendingIn) return { ...s, mode: "flow_in", current: inn, pendingIn: false };
          return { ...s, mode: "sensor", current: null };
        }
        if (s.mode === "flow_in") {
          if (s.pendingOut) return { ...s, mode: "flow_out", current: out, pendingOut: false, queue: [] };
          return { ...s, mode: "character", current: base };
        }
        if (s.mode === "character") {
          if (s.pendingOut) return { ...s, mode: "flow_out", current: out, pendingOut: false, queue: [] };
          if (s.queue.length) {
            const [next, ...rest] = s.queue;
            return { ...s, current: next, queue: rest };
          }
          return { ...s, current: base };
        }
        return s;
      }
    }
  };
