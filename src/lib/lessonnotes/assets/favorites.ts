// Per-device favourite assets. Simple localStorage-backed set keyed by asset id.

const KEY = "lessonnotes.assetFavorites";
type Listener = () => void;
const listeners = new Set<Listener>();

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

function write(s: Set<string>) {
  try { localStorage.setItem(KEY, JSON.stringify(Array.from(s))); } catch { /* noop */ }
  listeners.forEach((l) => l());
}

export function isFavorite(id: string): boolean {
  return read().has(id);
}

export function toggleFavorite(id: string): boolean {
  const s = read();
  if (s.has(id)) s.delete(id); else s.add(id);
  write(s);
  return s.has(id);
}

export function listFavorites(): string[] {
  return Array.from(read());
}

export function subscribeFavorites(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
