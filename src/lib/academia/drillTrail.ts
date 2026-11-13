/**
 * Academia drill-down trail: Class → Subject → Topic → Subtopic → Session.
 *
 * The signed-in account is the source of truth (see drillTrailRemote). This
 * module is pure: it restores the deepest level that still exists, clears only
 * the levels below a change, and mirrors the trail into the URL for back/forward.
 * localStorage is a first paint, keyed by user id so accounts never share it.
 */

export const DRILL_TRAIL_STORAGE_PREFIX = "mathgpl.academia.drillTrail:";
/** A device write that has not been acknowledged yet keeps winning for this long. */
export const DRILL_TRAIL_PENDING_MS = 60_000;

export const DRILL_TRAIL_KEYS = [
  "academiaId",
  "classId",
  "subjectId",
  "topicId",
  "subtopicId",
  "sessionId",
] as const;
export type DrillTrailKey = (typeof DRILL_TRAIL_KEYS)[number];

export type DrillTrail = Record<DrillTrailKey, string | null>;

export const EMPTY_DRILL_TRAIL: DrillTrail = {
  academiaId: null,
  classId: null,
  subjectId: null,
  topicId: null,
  subtopicId: null,
  sessionId: null,
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DRILL_QUERY_KEYS: Record<DrillTrailKey, string> = {
  academiaId: "academia",
  classId: "class",
  subjectId: "subject",
  topicId: "topic",
  subtopicId: "subtopic",
  sessionId: "session",
};

export type DrillCatalog = {
  classes: { id: string; academia_id?: string | null }[];
  subjects: { id: string; class_id: string }[];
  topics: { id: string; subject_id: string }[];
  subtopics: { id: string; topic_id: string }[];
  /** Omit while the subtopic's sessions are still loading — the session id is kept. */
  sessions?: { id: string; subtopic_id?: string | null }[];
};

export type DrillTrailEnvelope = {
  trail: DrillTrail;
  /** Server `updated_at` after a save was acknowledged. */
  updatedAt: string | null;
  /** A save was started and the server has not confirmed it yet. */
  pending: boolean;
  pendingAt: number | null;
};

export type DrillTrailRecord = { trail: DrillTrail; updatedAt: string };

export function cleanId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return UUID_RE.test(id) ? id : null;
}

export function normalizeDrillTrail(value: unknown): DrillTrail {
  const rec =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    academiaId: cleanId(rec.academiaId ?? rec.academia_id),
    classId: cleanId(rec.classId ?? rec.class_id),
    subjectId: cleanId(rec.subjectId ?? rec.subject_id),
    topicId: cleanId(rec.topicId ?? rec.topic_id),
    subtopicId: cleanId(rec.subtopicId ?? rec.subtopic_id),
    sessionId: cleanId(rec.sessionId ?? rec.session_id),
  };
}

export function sameDrillTrail(a: DrillTrail, b: DrillTrail): boolean {
  return DRILL_TRAIL_KEYS.every((key) => a[key] === b[key]);
}

export function isEmptyDrillTrail(trail: DrillTrail): boolean {
  return DRILL_TRAIL_KEYS.every((key) => !trail[key]);
}

export function drillTrailKey(trail: DrillTrail): string {
  return DRILL_TRAIL_KEYS.map((key) => trail[key] ?? "").join("|");
}

/** Set one level and clear only the levels under it. */
export function selectDrillLevel(
  trail: DrillTrail,
  level: DrillTrailKey,
  id: string | null,
): DrillTrail {
  const next: DrillTrail = { ...trail, [level]: cleanId(id) };
  const index = DRILL_TRAIL_KEYS.indexOf(level);
  for (let i = index + 1; i < DRILL_TRAIL_KEYS.length; i += 1)
    next[DRILL_TRAIL_KEYS[i]] = null;
  return next;
}

/**
 * Keep the deepest prefix that still exists and still belongs to its parent.
 * A subject the caller cannot see is simply absent from `subjects`.
 */
export function restoreDrillTrail(
  saved: DrillTrail | null | undefined,
  catalog: DrillCatalog,
): DrillTrail {
  const src = saved ? normalizeDrillTrail(saved) : EMPTY_DRILL_TRAIL;
  const out: DrillTrail = { ...EMPTY_DRILL_TRAIL, academiaId: src.academiaId };

  const klass = catalog.classes.find((row) => row.id === src.classId);
  if (!klass) return out;
  if (
    klass.academia_id &&
    src.academiaId &&
    klass.academia_id !== src.academiaId
  )
    return out;
  if (klass.academia_id && !out.academiaId) out.academiaId = klass.academia_id;
  out.classId = klass.id;

  const subject = catalog.subjects.find(
    (row) => row.id === src.subjectId && row.class_id === klass.id,
  );
  if (!subject) return out;
  out.subjectId = subject.id;

  const topic = catalog.topics.find(
    (row) => row.id === src.topicId && row.subject_id === subject.id,
  );
  if (!topic) return out;
  out.topicId = topic.id;

  const subtopic = catalog.subtopics.find(
    (row) => row.id === src.subtopicId && row.topic_id === topic.id,
  );
  if (!subtopic) return out;
  out.subtopicId = subtopic.id;

  if (!catalog.sessions) {
    out.sessionId = src.sessionId;
    return out;
  }
  const session = catalog.sessions.find(
    (row) =>
      row.id === src.sessionId &&
      (!row.subtopic_id || row.subtopic_id === subtopic.id),
  );
  if (session) out.sessionId = session.id;
  return out;
}

/**
 * Show `saved` inside one Academia. A trail for a different Academia (or a
 * class this Academia does not contain, when the trail has no Academia yet)
 * is displayed empty and must not be written back.
 */
export function trailVisibleInAcademia(
  saved: DrillTrail,
  academiaId: string | null,
  classes?: { id: string; academia_id?: string | null }[],
): { trail: DrillTrail; owned: boolean } {
  if (!academiaId) return { trail: saved, owned: true };
  if (saved.academiaId && saved.academiaId !== academiaId) {
    return { trail: { ...EMPTY_DRILL_TRAIL, academiaId }, owned: false };
  }
  if (!saved.academiaId && saved.classId && classes) {
    const klass = classes.find((row) => row.id === saved.classId);
    if (!klass || (klass.academia_id && klass.academia_id !== academiaId)) {
      return { trail: { ...EMPTY_DRILL_TRAIL, academiaId }, owned: false };
    }
  }
  if (saved.academiaId === academiaId) return { trail: saved, owned: true };
  return { trail: { ...saved, academiaId }, owned: true };
}

export function trailTime(value: string | null | undefined): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

/**
 * Before the server answers, the device copy is only a first paint.
 * Once it has answered, its row wins — unless this device still has a recent
 * save the server has not acknowledged, or a newer acknowledgement.
 */
export function chooseStoredTrail(
  local: DrillTrailEnvelope | null,
  server: DrillTrailRecord | null,
  serverKnown: boolean,
  now = Date.now(),
): DrillTrail {
  const localTrail = local?.trail ?? EMPTY_DRILL_TRAIL;
  if (!serverKnown) return localTrail;
  if (!server) return localTrail;
  const pendingFresh =
    !!local?.pending &&
    local.pendingAt != null &&
    now - local.pendingAt < DRILL_TRAIL_PENDING_MS;
  if (pendingFresh) return localTrail;
  if (
    local?.updatedAt &&
    trailTime(local.updatedAt) > trailTime(server.updatedAt)
  )
    return localTrail;
  return server.trail;
}

export function parseDrillEnvelope(
  raw: string | null,
): DrillTrailEnvelope | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const rec = value as Record<string, unknown>;
    const bare = !("trail" in rec);
    const trail = normalizeDrillTrail(bare ? rec : rec.trail);
    if (bare && isEmptyDrillTrail(trail)) return null;
    return {
      trail,
      updatedAt:
        bare || typeof rec.updatedAt !== "string" ? null : rec.updatedAt,
      pending: bare ? false : rec.pending === true,
      pendingAt:
        bare || typeof rec.pendingAt !== "number" ? null : rec.pendingAt,
    };
  } catch {
    return null;
  }
}

export function drillTrailStorageKey(userId: string) {
  return `${DRILL_TRAIL_STORAGE_PREFIX}${userId}`;
}

export function readDrillEnvelope(
  userId: string | null | undefined,
  storage?: Storage | null,
): DrillTrailEnvelope | null {
  if (!userId) return null;
  const store = storage === undefined ? browserStorage() : storage;
  if (!store) return null;
  try {
    return parseDrillEnvelope(store.getItem(drillTrailStorageKey(userId)));
  } catch {
    return null;
  }
}

export function writeDrillEnvelope(
  userId: string,
  envelope: DrillTrailEnvelope,
  storage?: Storage,
) {
  const store = storage ?? browserStorage();
  if (!store || !userId) return;
  const trail = normalizeDrillTrail(envelope.trail);
  try {
    store.setItem(
      drillTrailStorageKey(userId),
      JSON.stringify({ ...envelope, trail }),
    );
  } catch {
    /* private mode */
  }
  if (storage) return;
  commitMemory(userId, trail);
}

export function readStoredDrillTrail(
  userId: string | null | undefined,
  storage?: Storage | null,
): DrillTrail {
  return readDrillEnvelope(userId, storage)?.trail ?? EMPTY_DRILL_TRAIL;
}

export function trailToSearchParams(
  trail: DrillTrail,
  base?: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(base);
  for (const key of DRILL_TRAIL_KEYS) {
    const query = DRILL_QUERY_KEYS[key];
    const id = trail[key];
    if (id) next.set(query, id);
    else next.delete(query);
  }
  return next;
}

export function trailFromSearchParams(params: URLSearchParams): DrillTrail {
  const trail = { ...EMPTY_DRILL_TRAIL };
  for (const key of DRILL_TRAIL_KEYS)
    trail[key] = cleanId(params.get(DRILL_QUERY_KEYS[key]));
  return trail;
}

export function searchParamsEqual(
  a: URLSearchParams,
  b: URLSearchParams,
): boolean {
  const norm = (params: URLSearchParams) =>
    [...params.entries()]
      .sort(([left], [right]) => left.localeCompare(right) || 0)
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
  return norm(a) === norm(b);
}

export function drillTrailHref(path: string, trail: DrillTrail): string {
  const query = trailToSearchParams(trail).toString();
  return query ? `${path}?${query}` : path;
}

function browserStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

let memoryUser: string | null = null;
let memoryTrail: DrillTrail = EMPTY_DRILL_TRAIL;
const listeners = new Set<() => void>();

function commitMemory(userId: string, trail: DrillTrail) {
  if (memoryUser === userId && sameDrillTrail(memoryTrail, trail)) return;
  memoryUser = userId;
  memoryTrail = trail;
  listeners.forEach((listener) => listener());
}

/** In-memory snapshot for the signed-in user. Same reference until the trail changes. */
export function currentDrillTrail(userId: string | null): DrillTrail {
  if (!userId) return EMPTY_DRILL_TRAIL;
  if (memoryUser === userId) return memoryTrail;
  memoryUser = userId;
  memoryTrail = readStoredDrillTrail(userId);
  return memoryTrail;
}

export function subscribeDrillTrail(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test isolation for the module snapshot. */
export function resetDrillTrailMemory() {
  memoryUser = null;
  memoryTrail = EMPTY_DRILL_TRAIL;
  listeners.clear();
}
