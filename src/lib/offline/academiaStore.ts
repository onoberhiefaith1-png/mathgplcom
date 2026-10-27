/**
 * On-device store for the offline Academia app (IndexedDB). Holds the public
 * school catalogue, the schools a learner added, and queued attempts. Browser
 * only — call from effects or handlers.
 */
import {learningDatabaseName,savedLearningAt,importIsNewer} from "./accountMerge";
import type { FullPackActivity } from "@/lib/offline/academiaPack";
import type { SessionAttempt } from "@/lib/offline/evaluation";

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
export type PackSubject = { id: string; name: string; papers?: import("./extendedActivities").OfflinePaper[]; topics: PackTopic[] };
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
const STORES = ["kv", "attempts", "runs", "sessionAttempts"] as const;

let accountScope = typeof window !== "undefined" ? localStorage.getItem("mathemagine.learningAccount") : null;
export const learningAccount = () => accountScope;
function open(scope = accountScope): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(learningDatabaseName(scope), 3);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: (typeof STORES)[number], mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest, scope=accountScope): Promise<T> {
  const db = await open(scope);
  return new Promise<T>((resolve, reject) => {
    const r = run(db.transaction(store, mode).objectStore(store));
    r.onsuccess = () => {
      if(mode === "readwrite") window.dispatchEvent(new Event("mathemagine:progress"));
      resolve(r.result as T);
    };
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

export const getRun = async <T,>(activityId: string, mode: "practice" | "play") => {
 const value=await tx<T & {_mmDeleted?:boolean} | undefined>("runs", "readonly", (s) => s.get(`${activityId}:${mode}`));
 return value?._mmDeleted?undefined:value;
};
export const saveRun = (activityId: string, mode: "practice" | "play", value: unknown) =>
  tx("runs", "readwrite", (s) => s.put({...(value as object), _mmSavedAt:new Date().toISOString()}, `${activityId}:${mode}`));
export const clearRun = (activityId: string, mode: "practice" | "play") =>
  tx("runs", "readwrite", (s) => s.put({_mmDeleted:true,_mmSavedAt:new Date().toISOString()},`${activityId}:${mode}`));

/** Session attempts for History and My Evaluation (see evaluation.ts). */
export const saveSessionAttempt = (a: SessionAttempt) => tx("sessionAttempts", "readwrite", (s) => s.put(a, a.id));
export const allSessionAttempts = () => tx<SessionAttempt[]>("sessionAttempts", "readonly", (s) => s.getAll());

export type CloudRecord = { kind: "attempts" | "sessionAttempts" | "runs"; key: string; value: any; updated_at: string };
export async function exportLearning(): Promise<CloudRecord[]> {
 const db=await open(); const out:CloudRecord[]=[];
 for(const kind of ["attempts","sessionAttempts","runs"] as const) {
  const rows=await new Promise<[IDBValidKey[],any[]]>((resolve,reject)=>{
   const t=db.transaction(kind,"readonly"), s=t.objectStore(kind), k=s.getAllKeys(), v=s.getAll();
   t.oncomplete=()=>resolve([k.result,v.result]); t.onerror=()=>reject(t.error);
  });
  rows[1].forEach((value,i)=>out.push({kind,key:String(rows[0][i]),value,updated_at:savedLearningAt(value)}));
 }
 db.close(); return out;
}
export async function importLearning(rows:CloudRecord[],scope=accountScope) {
 for(const row of rows) {
  if(!["attempts","sessionAttempts","runs"].includes(row.kind)) continue;
  const old=await tx<any>(row.kind,"readonly",s=>s.get(row.key),scope);
  if(!importIsNewer(old,row)) continue;
  await tx(row.kind,"readwrite",s=>s.put(row.value,row.key),scope);
 }
}
export async function switchLearningAccount(id:string|null,claimGuest=false) {
 if(id===accountScope) return;
 const common = await Promise.all([getCatalogue(),getAdded(),getKv("currentSchool")]);
 const guest = claimGuest && !accountScope && !localStorage.getItem("mathemagine.guestClaimed") ? await exportLearning() : [];
 accountScope=id;
 if(id) localStorage.setItem("mathemagine.learningAccount",id); else localStorage.removeItem("mathemagine.learningAccount");
 if(common[0]) await saveCatalogue(common[0]); await setAdded(common[1]); if(common[2]) await setKv("currentSchool",common[2]);
 if(guest.length && id) {await importLearning(guest);localStorage.setItem("mathemagine.guestClaimed",id);}
}
