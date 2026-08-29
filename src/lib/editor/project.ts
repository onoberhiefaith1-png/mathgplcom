import { useCallback, useMemo, useRef, useState } from "react";
import {
  MIN_CLIP_DURATION,
  type Clip,
  type ProjectState,
  buildSegments,
  clipDuration,
  makeId,
  totalDuration,
} from "./types";

export type EditAction =
  | { type: "load"; state: ProjectState }
  | { type: "setTitle"; title: string }
  | { type: "split"; time: number }
  | { type: "delete"; id: string }
  | { type: "trim"; id: string; side: "start" | "end"; sourceTime: number }
  | { type: "reorder"; from: number; to: number };

export function createProject(title: string, duration: number): ProjectState {
  return {
    title,
    clips: [{ id: makeId(), sourceStart: 0, sourceEnd: duration }],
  };
}

export function reduceProject(state: ProjectState, action: EditAction): ProjectState {
  switch (action.type) {
    case "load":
      return action.state;

    case "setTitle":
      return { ...state, title: action.title };

    case "split": {
      const segments = buildSegments(state.clips);
      const seg = segments.find(
        (s) => action.time > s.tlStart + MIN_CLIP_DURATION && action.time < s.tlEnd - MIN_CLIP_DURATION,
      );
      if (!seg) return state;
      const cutSource = seg.clip.sourceStart + (action.time - seg.tlStart);
      const left: Clip = { ...seg.clip, sourceEnd: cutSource };
      const right: Clip = { id: makeId(), sourceStart: cutSource, sourceEnd: seg.clip.sourceEnd };
      const clips = [...state.clips];
      clips.splice(seg.index, 1, left, right);
      return { ...state, clips };
    }

    case "delete": {
      if (state.clips.length <= 1) return state;
      return { ...state, clips: state.clips.filter((c) => c.id !== action.id) };
    }

    case "trim": {
      const clips = state.clips.map((c) => {
        if (c.id !== action.id) return c;
        if (action.side === "start") {
          const sourceStart = Math.min(
            Math.max(0, action.sourceTime),
            c.sourceEnd - MIN_CLIP_DURATION,
          );
          return { ...c, sourceStart };
        }
        const sourceEnd = Math.max(action.sourceTime, c.sourceStart + MIN_CLIP_DURATION);
        return { ...c, sourceEnd };
      });
      return { ...state, clips };
    }

    case "reorder": {
      const { from, to } = action;
      if (from === to || from < 0 || to < 0 || from >= state.clips.length || to >= state.clips.length) {
        return state;
      }
      const clips = [...state.clips];
      const moved = clips.splice(from, 1)[0]!;
      clips.splice(to, 0, moved);
      return { ...state, clips };
    }

    default:
      return state;
  }
}

interface History {
  past: ProjectState[];
  present: ProjectState;
  future: ProjectState[];
}

const MERGE_WINDOW_MS = 400;

/** Project state with undo/redo. Trims coalesce while dragging. */
export function useProjectHistory(initial: ProjectState) {
  const [history, setHistory] = useState<History>({ past: [], present: initial, future: [] });
  const lastCommit = useRef<{ key: string; at: number } | null>(null);

  const dispatch = useCallback((action: EditAction, options?: { coalesceKey?: string }) => {
    setHistory((h) => {
      const next = reduceProject(h.present, action);
      if (next === h.present) return h;
      if (action.type === "load") {
        lastCommit.current = null;
        return { past: [], present: next, future: [] };
      }
      const now = Date.now();
      const key = options?.coalesceKey;
      const merge =
        key != null &&
        lastCommit.current?.key === key &&
        now - lastCommit.current.at < MERGE_WINDOW_MS;
      lastCommit.current = key ? { key, at: now } : null;
      return {
        past: merge ? h.past : [...h.past, h.present].slice(-100),
        present: next,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    lastCommit.current = null;
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const previous = h.past[h.past.length - 1]!;
      return {
        past: h.past.slice(0, -1),
        present: previous,
        future: [h.present, ...h.future].slice(0, 100),
      };
    });
  }, []);

  const redo = useCallback(() => {
    lastCommit.current = null;
    setHistory((h) => {
      if (h.future.length === 0) return h;
      return {
        past: [...h.past, h.present],
        present: h.future[0]!,
        future: h.future.slice(1),
      };
    });
  }, []);

  const project = history.present;
  const segments = useMemo(() => buildSegments(project.clips), [project.clips]);
  const duration = useMemo(() => totalDuration(project.clips), [project.clips]);

  return {
    project,
    segments,
    duration,
    dispatch,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

export { clipDuration };