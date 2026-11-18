/** Save and restore the Smartboard (and window) scroll when the table graph
 *  covers the screen, so Close returns the student to exactly where they were
 *  without a reload. */

export type ScrollSnapshot = {
  windowX: number;
  windowY: number;
  elements: Array<{ el: Element; top: number; left: number }>;
  htmlOverflow: string;
  bodyOverflow: string;
  bodyPosition: string;
};

const isScrollable = (el: Element): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const style = typeof window !== "undefined" ? window.getComputedStyle(el) : null;
  const oy = style?.overflowY ?? "";
  const ox = style?.overflowX ?? "";
  const canY = oy === "auto" || oy === "scroll" || oy === "overlay";
  const canX = ox === "auto" || ox === "scroll" || ox === "overlay";
  if (!canY && !canX) return false;
  return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
};

/** Capture window + board (and any other) scroll positions. Prefer the
 *  marked Smartboard scroller; always include every current scrollable. */
export function snapshotScroll(root: ParentNode = document): ScrollSnapshot {
  const elements: ScrollSnapshot["elements"] = [];
  const seen = new Set<Element>();
  const add = (el: Element | null) => {
    if (!el || seen.has(el) || !(el instanceof HTMLElement)) return;
    seen.add(el);
    elements.push({ el, top: el.scrollTop, left: el.scrollLeft });
  };
  if (typeof (root as { querySelectorAll?: unknown }).querySelectorAll === "function") {
    (root as ParentNode).querySelectorAll("[data-board-scroll]").forEach(add);
  }
  const scope: ParentNode = root;
  const nodes = scope.querySelectorAll("*");
  nodes.forEach((el) => {
    if (isScrollable(el)) add(el);
  });
  const html = document.documentElement;
  const body = document.body;
  return {
    windowX: typeof window !== "undefined" ? window.scrollX : 0,
    windowY: typeof window !== "undefined" ? window.scrollY : 0,
    elements,
    htmlOverflow: html?.style.overflow ?? "",
    bodyOverflow: body?.style.overflow ?? "",
    bodyPosition: body?.style.position ?? "",
  };
}

export function lockBackgroundScroll(): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

export function restoreScroll(snap: ScrollSnapshot | null | undefined): void {
  if (!snap) return;
  if (typeof document !== "undefined") {
    document.documentElement.style.overflow = snap.htmlOverflow;
    document.body.style.overflow = snap.bodyOverflow;
    document.body.style.position = snap.bodyPosition;
  }
  const apply = () => {
    if (typeof window !== "undefined" && !/jsdom/i.test(window.navigator?.userAgent ?? "")) {
      window.scrollTo(snap.windowX, snap.windowY);
    }
    for (const { el, top, left } of snap.elements) {
      if (!(el instanceof HTMLElement)) continue;
      el.scrollTop = top;
      el.scrollLeft = left;
    }
  };
  apply();
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(apply);
}

/** Hold a snapshot, lock the background, and return a cleanup that restores
 *  both the lock and the exact scroll positions. */
export function holdBoardScroll(): () => void {
  const snap = snapshotScroll();
  lockBackgroundScroll();
  return () => restoreScroll(snap);
}
