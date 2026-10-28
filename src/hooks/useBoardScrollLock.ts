import { useEffect } from "react";

/** Standalone touch boards own the viewport; embedded practice never does. */
export function useBoardScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow, bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlHeight: html.style.height, bodyHeight: body.style.height,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    html.style.height = "100%";
    body.style.height = "100%";
    return () => {
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      html.style.height = previous.htmlHeight;
      body.style.height = previous.bodyHeight;
    };
  }, [locked]);
}
