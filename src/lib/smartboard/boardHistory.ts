// useBoardHistory — a tiny per-board undo/redo stack.
//
// Each board (Board 1 = main writing board, Board 2 = tools board) owns its
// own instance, so undoing on one board never touches the other.

import { useCallback, useRef, useState } from "react";

export interface BoardHistory<T> {
  value: T;
  /** Replace the value AND push the previous one onto the undo stack. */
  set: (next: T | ((cur: T) => T)) => void;
  /** Replace the value WITHOUT touching history (loads, restores). */
  reset: (next: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useBoardHistory<T>(initial: T | (() => T)): BoardHistory<T> {
  const [value, setValue] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [, bump] = useState(0);

  const set = useCallback((next: T | ((cur: T) => T)) => {
    setValue((cur) => {
      const resolved = typeof next === "function" ? (next as (c: T) => T)(cur) : next;
      if (resolved === cur) return cur;
      past.current = [...past.current.slice(-99), cur];
      future.current = [];
      bump((n) => n + 1);
      return resolved;
    });
  }, []);

  const reset = useCallback((next: T) => {
    past.current = [];
    future.current = [];
    bump((n) => n + 1);
    setValue(next);
  }, []);

  const undo = useCallback(() => {
    setValue((cur) => {
      const prev = past.current.pop();
      if (prev === undefined) return cur;
      future.current = [...future.current, cur];
      bump((n) => n + 1);
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setValue((cur) => {
      const next = future.current.pop();
      if (next === undefined) return cur;
      past.current = [...past.current, cur];
      bump((n) => n + 1);
      return next;
    });
  }, []);

  return {
    value,
    set,
    reset,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
