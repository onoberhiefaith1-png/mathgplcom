import type { ProjectState } from "./types";
import type { WorkflowState } from "./workflow";

const DB_NAME = "mathgpl-video-editor";
const STORE = "projects";
const META = "meta";
const LEGACY_KEY = "current";

export type ProjectStatus = "draft" | "processing" | "complete";

export interface ProjectMeta {
  key: string;
  title: string;
  course: string;
  createdAt: number;
  savedAt: number;
  duration: number;
  status: ProjectStatus;
  languages: string[];
  thumbnail?: string | undefined;
  fileName: string;
  /** sharing preference chosen in the gallery */
  visibility?: "private" | "link" | "members";
  /** true when a rendered final video (source picture + generated audio) exists */
  hasGeneratedVideo?: boolean;
}

export interface StoredProject extends ProjectMeta {
  project: ProjectState;
  file: Blob;
  fileType: string;
  sourceDuration: number;
  workflow?: WorkflowState;
  audioBlob?: Blob | null;
  voiceClips?: Record<string, Blob>;
  trackBlob?: Blob | null;
  /** the rendered final video — this is what Download must always deliver */
  generatedVideoBlob?: Blob | null;
  generatedVideoName?: string;
  versionTracks?: Record<string, Blob>;
  /** per language version: generated clips and mixed track */
  branchClips?: Record<string, Record<string, Blob>>;
  branchTracks?: Record<string, Blob>;
}

export function newProjectId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function put<T>(db: IDBDatabase, store: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

function get<T>(db: IDBDatabase, store: string, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

function remove(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function metaOf(entry: StoredProject): ProjectMeta {
  return {
    key: entry.key,
    title: entry.title,
    course: entry.course,
    createdAt: entry.createdAt,
    savedAt: entry.savedAt,
    duration: entry.duration,
    status: entry.status,
    languages: entry.languages,
    thumbnail: entry.thumbnail,
    fileName: entry.fileName,
    ...(entry.generatedVideoBlob ? { hasGeneratedVideo: true } : {}),
    ...(entry.visibility ? { visibility: entry.visibility } : {}),
  };
}

/** Moves a pre-multi-project save into the new keyed layout. */
async function migrateLegacy(db: IDBDatabase): Promise<void> {
  const legacy = await get<StoredProject & { project: ProjectState }>(db, STORE, LEGACY_KEY);
  if (!legacy) return;
  const key = newProjectId();
  const migrated: StoredProject = {
    ...legacy,
    key,
    title: legacy.project?.title ?? legacy.fileName ?? "Untitled lesson",
    course: legacy.course ?? "My course",
    createdAt: legacy.savedAt ?? Date.now(),
    savedAt: legacy.savedAt ?? Date.now(),
    duration: legacy.sourceDuration ?? 0,
    status: legacy.status ?? "draft",
    languages: legacy.languages ?? ["Original"],
  };
  await put(db, STORE, migrated);
  await put(db, META, metaOf(migrated));
  await remove(db, STORE, LEGACY_KEY);
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await openDb();
  try {
    await migrateLegacy(db);
    const metas = await getAll<ProjectMeta>(db, META);
    return metas.sort((a, b) => b.savedAt - a.savedAt);
  } finally {
    db.close();
  }
}

export async function saveProject(entry: StoredProject): Promise<void> {
  const db = await openDb();
  try {
    const record = { ...entry, savedAt: Date.now() };
    await put(db, STORE, record);
    await put(db, META, metaOf(record));
  } finally {
    db.close();
  }
}

export async function loadProject(key: string): Promise<StoredProject | null> {
  const db = await openDb();
  try {
    await migrateLegacy(db);
    return await get<StoredProject>(db, STORE, key);
  } finally {
    db.close();
  }
}

export async function loadLatestProject(): Promise<StoredProject | null> {
  const metas = await listProjects();
  const first = metas[0];
  return first ? loadProject(first.key) : null;
}

export async function deleteProject(key: string): Promise<void> {
  const db = await openDb();
  try {
    await remove(db, STORE, key);
    await remove(db, META, key);
  } finally {
    db.close();
  }
}

export async function duplicateProject(key: string): Promise<string | null> {
  const existing = await loadProject(key);
  if (!existing) return null;
  const copy: StoredProject = {
    ...existing,
    key: newProjectId(),
    title: `${existing.title} (copy)`,
    createdAt: Date.now(),
    savedAt: Date.now(),
  };
  await saveProject(copy);
  return copy.key;
}

export async function updateProjectMeta(
  key: string,
  patch: Partial<Pick<ProjectMeta, "title" | "course" | "visibility" | "status">>,
): Promise<void> {
  const existing = await loadProject(key);
  if (!existing) return;
  await saveProject({ ...existing, ...patch });
}
