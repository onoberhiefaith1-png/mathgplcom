import type { TriggerEvent } from "./types";

type Handler = (event: TriggerEvent, sceneId: string) => void;
const listeners = new Set<Handler>();

export const sceneEvents = {
  subscribe(fn: Handler) { listeners.add(fn); return () => listeners.delete(fn); },
  emit(event: TriggerEvent, sceneId: string) {
    listeners.forEach((fn) => { try { fn(event, sceneId); } catch { /* noop */ } });
  },
};
