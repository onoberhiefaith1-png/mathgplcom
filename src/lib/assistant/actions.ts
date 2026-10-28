// Tutor's action bus. Screens that Tutor can drive (Create Note, Copilot,
// AI Edit, Floating Numbers, the Guide) register named handlers while they are
// mounted. Tutor only calls these handlers — it never reads or clicks the screen.

export type ActionResult = { ok: boolean; say?: string };
export type ActionHandler = (args: Record<string, unknown>) => Promise<ActionResult> | ActionResult;

const handlers = new Map<string, ActionHandler>();
const waiters = new Map<string, Set<() => void>>();

/** Register a handler; returns the unregister function (use in an effect). */
export function registerTutorAction(name: string, handler: ActionHandler): () => void {
  handlers.set(name, handler);
  waiters.get(name)?.forEach((wake) => wake());
  waiters.delete(name);
  return () => {
    if (handlers.get(name) === handler) handlers.delete(name);
  };
}

export const hasTutorAction = (name: string) => handlers.has(name);

/** Resolve true once the named handler is mounted (or false after the timeout). */
export function waitForTutorAction(name: string, timeoutMs = 8000): Promise<boolean> {
  if (handlers.has(name)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const set = waiters.get(name) ?? new Set();
    const wake = () => { clearTimeout(timer); resolve(true); };
    const timer = setTimeout(() => { set.delete(wake); resolve(false); }, timeoutMs);
    set.add(wake);
    waiters.set(name, set);
  });
}

/** Call a handler and report its result; a missing handler is a clear failure. */
export async function callTutorAction(name: string, args: Record<string, unknown> = {}): Promise<ActionResult> {
  const handler = handlers.get(name);
  if (!handler) return { ok: false, say: "That screen isn't open yet." };
  try {
    return await handler(args);
  } catch (error) {
    return { ok: false, say: (error as Error).message || "That didn't work." };
  }
}

// ── What's on screen ────────────────────────────────────────────────────────
// Question screens publish what is open so Tutor never asks for it again.
export type ScreenInfo = { page: string; question?: string | null; hasSolution?: boolean };
export type ScreenSummary = { page: string; question: string | null; hasSolution: boolean; available: string[] };

let screen: ScreenInfo | null = null;

/** Publish the open screen; returns the unpublish function (use in an effect). */
export function publishScreen(info: ScreenInfo): () => void {
  screen = info;
  return () => { if (screen === info) screen = null; };
}

/** The open screen plus every Tutor action ready on it right now. */
export function screenSummary(): ScreenSummary {
  return {
    page: screen?.page ?? "other",
    question: screen?.question ?? null,
    hasSolution: !!screen?.hasSolution,
    available: [...handlers.keys()].sort(),
  };
}
