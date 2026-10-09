/**
 * On-device store for the offline Academia app (IndexedDB). Holds the public
 * school catalogue, the schools a learner added, and queued attempts. Browser
 * only — call from effects or handlers.
 */
import type { FullPackActivity } from "@/lib/offline/academiaPack";

export type PackLine = { id?: string; equation: string; marks: number; fillers: string[]; timerSeconds?: number | null };
export type PackSegment = { lineId: string; start: number; end: number };
export type PackActivity = {
  id: string;
  title: string;
  lines: FullPackActivity["lines"];
  /** Legacy aliases retained while existing v1 downloads upgrade in place. */
  videoUrl: string | null;
  videoSegments?: PackSegment[];
} & Partial<Omit<FullPackActivity, "id" | "title" | "lines">>;
export type PackSession = { id: string; title: string; description: string | null; videoUrl: string | null; activities: PackActivity[] };
export type PackSubtopic = { id: string; name: string; sessions: PackSession[] };
export type PackTopic = { id: string; name: string; subtopics: PackSubtopic[] };
export type PackSubject = { id: string; name: string; topics: PackTopic[] };
export type PackClass = { id: string; name: string; subjects: PackSubject[] };
export type PackSchool = { id: string; name: string; schoolName: string; description: string | null; classes: PackClass[] };
export type Catalogue = { schema?: number; version: string; schools: PackSchool[] };

export type LocalAttempt = {
  id: string;
  activityId: string;
  sessionId: string;
  mode: "practice" | "play";
  score: number;
  maxScore: number;
  at: string;
  synced: boolean;
  /** Per-line outcome (older attempts on a device may not have these). */
  lines?: { written: string; correct: boolean; marks: number; seconds: number }[];
  seconds?: number;
};

const DB = "mathgpl-academia";
const STORES = ["kv", "attempts", "runs"] as const;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: (typeof STORES)[number], mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const r = run(db.transaction(store, mode).objectStore(store));
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}

export const getKv = <T,>(key: string) => tx<T | undefined>("kv", "readonly", (s) => s.get(key));
export const setKv = (key: string, value: unknown) => tx("kv", "readwrite", (s) => s.put(value, key));

export const getCatalogue = () => getKv<Catalogue>("catalogue");
export const saveCatalogue = (c: Catalogue) => setKv("catalogue", c);
export const getAdded = async () => (await getKv<string[]>("added")) ?? [];
export const setAdded = (ids: string[]) => setKv("added", ids);

export async function deviceId(): Promise<string> {
  let id = await getKv<string>("device");
  if (!id) {
    id = crypto.randomUUID();
    await setKv("device", id);
  }
  return id;
}

export const saveAttempt = (a: LocalAttempt) => tx("attempts", "readwrite", (s) => s.put(a, a.id));
export const allAttempts = () => tx<LocalAttempt[]>("attempts", "readonly", (s) => s.getAll());

export const getRun = <T,>(activityId: string, mode: "practice" | "play") =>
  tx<T | undefined>("runs", "readonly", (s) => s.get(`${activityId}:${mode}`));
export const saveRun = (activityId: string, mode: "practice" | "play", value: unknown) =>
  tx("runs", "readwrite", (s) => s.put(value, `${activityId}:${mode}`));
export const clearRun = (activityId: string, mode: "practice" | "play") =>
  tx("runs", "readwrite", (s) => s.delete(`${activityId}:${mode}`));
