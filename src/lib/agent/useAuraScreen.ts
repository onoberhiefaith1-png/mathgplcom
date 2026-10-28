// A screen tells Aura what it is showing.
//
// Drop this into any page or panel that knows something Aura cannot read off the
// address: the class name, the lesson section open, the line being worked on, the
// Floating Numbers currently picked up. It is cleared when the screen closes.

import { useEffect, useRef } from "react";

import { setAuraScreenContext, type AuraPlatformContext } from "./context";

export function useAuraScreen(detail: AuraPlatformContext): void {
  // Compared by value so a fresh object on every render does not re-report.
  const key = JSON.stringify(detail ?? {});
  const last = useRef<string>("");

  useEffect(() => {
    if (last.current !== key) {
      last.current = key;
      setAuraScreenContext(JSON.parse(key) as AuraPlatformContext);
    }
    return () => {
      setAuraScreenContext(null);
      last.current = "";
    };
  }, [key]);
}
