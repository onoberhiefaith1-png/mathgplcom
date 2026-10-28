// Teacher actions taken while offline wait here and are sent, after the teacher
// confirms them, once the device is back online.

export type QueuedAction = { id: string; toolId: string; args: Record<string, unknown>; label: string; at: string };

const KEY = "mathgpl:tutor:queue";

export function readQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as QueuedAction[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const write = (list: QueuedAction[]) => localStorage.setItem(KEY, JSON.stringify(list));

export function enqueue(action: Omit<QueuedAction, "id" | "at">): QueuedAction {
  const item = { ...action, id: crypto.randomUUID(), at: new Date().toISOString() };
  write([...readQueue(), item]);
  return item;
}

export function dequeue(id: string): void {
  write(readQueue().filter((a) => a.id !== id));
}
