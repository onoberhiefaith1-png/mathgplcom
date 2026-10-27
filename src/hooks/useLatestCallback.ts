import { useCallback, useRef } from "react";

/** Long-lived editor extensions keep one callback while calling the current render. */
export function useLatestCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result): (...args: Args) => Result {
  const latest = useRef(callback);
  latest.current = callback;
  return useCallback((...args: Args) => latest.current(...args), []);
}
