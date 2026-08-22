/**
 * Interaction-state reset.
 *
 * The freeze that looked like "the hand cursor kills the page" was a stale
 * interaction state surviving the thing that created it: a 3D scene wrote
 * `document.body.style.cursor = "pointer"` on hover, then lost its graphics
 * context (or unmounted) before the matching pointer-out ever fired. The page
 * stayed painted, the cursor stayed a hand, and the scene no longer raycasted —
 * so nothing responded until a refresh rebuilt the body style.
 *
 * This module is the single place that clears every temporary interaction
 * state: cursor overrides, pointer capture, drag/selection state and any
 * tool/overlay flag a feature registers here. Nothing temporary is allowed to
 * outlive the operation that created it.
 */

type Resetter = (reason: string) => void;

const resetters = new Set<Resetter>();
/** Elements whose cursor we overrode, so we can always put them back. */
const cursorTargets = new Set<HTMLElement>();
/** Elements currently holding pointer capture (tracked by patching the API). */
const captured = new Set<{ el: Element; pointerId: number }>();

let patched = false;
let pointersDown = 0;
let guardsStarted = 0;

/** Scope a cursor to one element — never to <body>. */
export function setScopedCursor(el: HTMLElement | null | undefined, cursor: string) {
  if (!el) return;
  el.style.cursor = cursor;
  if (cursor && cursor !== "default" && cursor !== "auto") cursorTargets.add(el);
  else cursorTargets.delete(el);
}

/** Put every overridden cursor back, including any legacy global write. */
export function clearCursorOverrides() {
  if (typeof document === "undefined") return;
  document.body.style.removeProperty("cursor");
  document.documentElement.style.removeProperty("cursor");
  for (const el of cursorTargets) {
    try {
      el.style.cursor = "default";
    } catch {
      /* detached node */
    }
  }
  cursorTargets.clear();
}

function releasePointerCaptures() {
  for (const { el, pointerId } of [...captured]) {
    try {
      (el as Element & { releasePointerCapture(id: number): void }).releasePointerCapture(pointerId);
    } catch {
      /* already released or detached */
    }
  }
  captured.clear();
}

/**
 * Register a feature-owned cleanup (drag state, tool mode, overlay flag…).
 * Returns an unregister function.
 */
export function registerInteractionResetter(fn: Resetter): () => void {
  resetters.add(fn);
  return () => {
    resetters.delete(fn);
  };
}

/**
 * Clear all temporary interaction state. Safe to call often — it only undoes
 * things that should already be gone.
 */
export function resetInteractionState(reason: string) {
  clearCursorOverrides();
  releasePointerCaptures();
  for (const fn of [...resetters]) {
    try {
      fn(reason);
    } catch (err) {
      console.warn("[interaction] resetter failed", reason, err);
    }
  }
}

/**
 * Install the always-on guards: window blur, tab hide, pointer release and
 * page hide all end any in-flight interaction. Returns a cleanup function.
 */
export function startInteractionResetGuards(): () => void {
  if (typeof window === "undefined") return () => {};

  guardsStarted += 1;
  if (!patched && typeof Element !== "undefined") {
    patched = true;
    const proto = Element.prototype as Element & {
      setPointerCapture(id: number): void;
      releasePointerCapture(id: number): void;
    };
    const set = proto.setPointerCapture;
    const release = proto.releasePointerCapture;
    proto.setPointerCapture = function patchedSet(this: Element, pointerId: number) {
      captured.add({ el: this, pointerId });
      return set.call(this, pointerId);
    };
    proto.releasePointerCapture = function patchedRelease(this: Element, pointerId: number) {
      for (const entry of captured) {
        if (entry.el === this && entry.pointerId === pointerId) captured.delete(entry);
      }
      return release.call(this, pointerId);
    };
  }

  const onBlur = () => resetInteractionState("window-blur");
  const onVisibility = () => {
    if (document.hidden) resetInteractionState("tab-hidden");
  };
  const onPointerDown = () => {
    pointersDown += 1;
  };
  const onPointerUp = () => {
    pointersDown = Math.max(0, pointersDown - 1);
    releasePointerCaptures();
  };
  const onPointerCancel = () => {
    pointersDown = 0;
    resetInteractionState("pointer-cancel");
  };

  window.addEventListener("blur", onBlur);
  window.addEventListener("pageshow", onBlur);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointerup", onPointerUp, true);
  window.addEventListener("pointercancel", onPointerCancel, true);

  return () => {
    guardsStarted = Math.max(0, guardsStarted - 1);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("pageshow", onBlur);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pointerdown", onPointerDown, true);
  window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("pointercancel", onPointerCancel, true);
  };
}

/**
 * True while the teacher is actively pressing/drawing. The freeze monitor must
 * never tear down a live drag, so it skips healing while this is true.
 */
export function pointerInteractionActive() {
  return pointersDown > 0;
}

/** True when the guards are installed (used by diagnostics). */
export function interactionGuardsActive() {
  return guardsStarted > 0;
}

/**
 * Diagnostic: what is actually under the pointer right now, and does anything
 * hold a cursor override. Used by the freeze monitor before it self-heals.
 */
export function describeInteractionState(x?: number, y?: number) {
  if (typeof document === "undefined") return null;
  const px = x ?? window.innerWidth / 2;
  const py = y ?? window.innerHeight / 2;
  const el = document.elementFromPoint(px, py);
  return {
    bodyCursor: document.body.style.cursor || null,
    cursorOverrides: cursorTargets.size,
    pointerCaptures: captured.size,
    topElement: el
      ? `${el.tagName.toLowerCase()}${
          typeof el.className === "string" && el.className
            ? `.${el.className.split(/\s+/).slice(0, 4).join(".")}`
            : ""
        }`
      : null,
    topCursor: el ? getComputedStyle(el).cursor : null,
  };
}
