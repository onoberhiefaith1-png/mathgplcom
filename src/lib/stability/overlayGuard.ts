/**
 * Overlay leak guard — the actual cause of the "click death" freeze.
 *
 * The interface never hangs: instrumented stress runs showed the main thread
 * answering in 0-26ms while every click was swallowed. What blocks input is a
 * dismissed Radix dialog / sheet / drawer / popover whose portal stays mounted,
 * or the `pointer-events: none` lock it writes on <body> and never removes when
 * its unmount is interrupted (route change, suspense boundary, WebGL stall).
 *
 * This module is the single place that puts that state back:
 *  - a full-screen overlay that is closed (or has no open dialog behind it) is
 *    removed;
 *  - the body pointer-events lock is released when nothing is actually open.
 *
 * It is conservative: while a real dialog is open nothing is touched.
 */

const OPEN_SELECTOR = [
  '[data-state="open"][role="dialog"]',
  '[data-state="open"][role="alertdialog"]',
  '[data-state="open"][role="menu"]',
  '[data-state="open"][role="listbox"]',
  '[data-state="open"][data-radix-popper-content-wrapper]',
  '[data-radix-popper-content-wrapper] [data-state="open"]',
  '[data-state="open"][data-sonner-toast]',
].join(",");

const OVERLAY_SELECTOR = [
  "[data-radix-dialog-overlay]",
  "[data-radix-alert-dialog-overlay]",
  "[vaul-overlay]",
  "[data-sonner-overlay]",
].join(",");

let healed = 0;

const isFullScreen = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.9;
};

/** Overlay-shaped nodes that are not tagged by Radix (custom bg-black/80 layers). */
const candidateOverlays = (): HTMLElement[] => {
  const out = new Set<HTMLElement>();
  for (const el of document.querySelectorAll<HTMLElement>(OVERLAY_SELECTOR)) out.add(el);
  for (const el of document.querySelectorAll<HTMLElement>("body > div[data-radix-portal], body > div[data-state]")) {
    if (isFullScreen(el)) out.add(el);
  }
  return [...out];
};

const somethingIsOpen = (): boolean => !!document.querySelector(OPEN_SELECTOR);

/**
 * Clear leaked overlay state. Returns the number of things fixed.
 * Safe to call on a timer — it only undoes state that should already be gone.
 */
export function healLeakedOverlays(reason: string): number {
  if (typeof document === "undefined") return 0;
  let fixed = 0;
  const open = somethingIsOpen();

  for (const el of candidateOverlays()) {
    const state = el.getAttribute("data-state");
    const closed = state === "closed";
    // A closed overlay is always garbage. An untagged full-screen overlay is
    // only garbage when no dialog is actually open behind it.
    if (closed || (!open && isFullScreen(el) && getComputedStyle(el).pointerEvents !== "none")) {
      try {
        el.remove();
        fixed += 1;
      } catch {
        /* detached already */
      }
    }
  }

  // The pointer-events lock: Radix sets it while a modal is open and removes it
  // on close. If nothing is open it must not be there.
  if (!somethingIsOpen()) {
    const body = document.body;
    if (body.style.pointerEvents === "none") {
      body.style.removeProperty("pointer-events");
      fixed += 1;
    }
    if (body.hasAttribute("data-scroll-locked")) {
      body.removeAttribute("data-scroll-locked");
      body.style.removeProperty("overflow");
      fixed += 1;
    }
    if (body.getAttribute("aria-hidden") === "true") {
      body.removeAttribute("aria-hidden");
      fixed += 1;
    }
    for (const el of document.querySelectorAll<HTMLElement>("#root[aria-hidden='true'],main[aria-hidden='true']")) {
      el.removeAttribute("aria-hidden");
      fixed += 1;
    }
  }

  if (fixed) {
    healed += fixed;
    console.warn("[stability] cleared leaked overlay state", { reason, fixed });
  }
  return fixed;
}

export function overlayHealCount() {
  return healed;
}

/** Install the guard: periodic sweep plus a sweep on every swallowed click. */
export function startOverlayGuard(): () => void {
  if (typeof window === "undefined") return () => {};

  const sweep = window.setInterval(() => healLeakedOverlays("sweep"), 1_000);

  // A click that lands on nothing but a full-screen layer is the user telling
  // us input is dead — heal immediately rather than waiting for the sweep.
  const onPointerDown = (event: PointerEvent) => {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    if (!el) return;
    if (document.body.style.pointerEvents === "none" || isFullScreen(el)) {
      healLeakedOverlays("pointerdown");
    }
  };
  window.addEventListener("pointerdown", onPointerDown, true);

  const onVisible = () => {
    if (!document.hidden) healLeakedOverlays("visible");
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);

  return () => {
    window.clearInterval(sweep);
    window.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
  };
}
