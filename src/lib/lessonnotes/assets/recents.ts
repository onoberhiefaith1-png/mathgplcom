// Recently used assets, per device. Ordered newest-first, capped at 20.

const KEY = "lessonnotes.assetRecents";
const CAP = 20;
type Listener = () => void;
const listeners = new Set<Listener>();

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

function write(a: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, CAP))); } catch { /* noop */ }
  listeners.forEach((l) => l());
}

export function pushRecent(id: string) {
  const cur = read().filter((x) => x !== id);
  cur.unshift(id);
  write(cur);
}

export function listRecent(n = 10): string[] {
  return read().slice(0, n);
}

export function getLastInserted(): string | null {
  return read()[0] ?? null;
}

export function subscribeRecents(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
