// Phase 5 — how Aura's voice reaches the board.
//
// The cockpit and the Smartboard live in different parts of the page, so the
// teaching performance is announced on one small channel: she says which line
// she is on, and whichever board is on screen moves its active line there.
// Nothing mathematical travels here — only which line is being taught.

export type TeachingSignal =
  | { kind: "focus"; line: number }
  | { kind: "end" };

const CHANNEL = "aura:teaching";

export function publishTeaching(signal: TeachingSignal) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TeachingSignal>(CHANNEL, { detail: signal }));
}

export function subscribeTeaching(listener: (signal: TeachingSignal) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<TeachingSignal>).detail;
    if (detail) listener(detail);
  };
  window.addEventListener(CHANNEL, handler);
  return () => window.removeEventListener(CHANNEL, handler);
}
