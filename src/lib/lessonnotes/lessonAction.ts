/** Give the newly opened lesson action a paint before reading or syncing data. */
export function afterLessonActionPaint(run: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frame = requestAnimationFrame(() => { timer = setTimeout(run, 0); });
  return () => {
    cancelAnimationFrame(frame);
    if (timer !== undefined) clearTimeout(timer);
  };
}

export async function loadLessonAction<T>(
  work: (signal: AbortSignal) => Promise<T>,
  parent: AbortSignal,
  timeout = 8000,
): Promise<T> {
  parent.throwIfAborted();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("You’re offline. Reconnect and retry to load the saved settings.");
  }
  const controller = new AbortController();
  const cancel = () => controller.abort(parent.reason);
  parent.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(
    new Error("The connection is taking too long. Try again when it’s ready."),
  ), timeout);
  let onAbort: (() => void) | undefined;
  try {
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener("abort", onAbort, { once: true });
    });
    return await Promise.race([work(controller.signal), aborted]);
  } finally {
    clearTimeout(timer);
    parent.removeEventListener("abort", cancel);
    if (onAbort) controller.signal.removeEventListener("abort", onAbort);
  }
}

const pendingSyncs = new WeakMap<object, Promise<void>>();

export function syncLessonActionDocument(document: object, sync: () => Promise<void>): Promise<void> {
  const pending = pendingSyncs.get(document);
  if (pending) return pending;
  const next = Promise.resolve().then(sync).finally(() => pendingSyncs.delete(document));
  pendingSyncs.set(document, next);
  return next;
}
