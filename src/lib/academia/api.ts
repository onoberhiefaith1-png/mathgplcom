/**
 * ACADEMIA — the School's learning space (Class -> Subject -> Topic -> Subtopic
 * -> Session -> Activity). A separate system from the 3D Academy/Building.
 */
import { supabase } from "@/integrations/supabase/client";

// New tables are not yet in the generated types on first load; keep calls loose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type AcademiaRow = {
  id: string;
  org_id: string;
  name: string;
  visibility: "private" | "public";
  allow_teacher_assign: boolean;
};
export type Named = { id: string; name: string; position: number };
export type AcademiaClass = Named & { academia_id: string };
export type AcademiaSubject = Named & { class_id: string };
export type AcademiaTopic = Named & { subject_id: string };
export type AcademiaSubtopic = Named & { topic_id: string };

export async function ensureSchoolAcademia(orgId: string): Promise<AcademiaRow> {
  const { data: id, error } = await db.rpc("ensure_school_academia", { _org: orgId });
  if (error) throw error;
  const { data, error: e2 } = await db.from("academia").select("*").eq("id", id).single();
  if (e2) throw e2;
  return data as AcademiaRow;
}

export async function updateAcademia(id: string, patch: Partial<AcademiaRow>) {
  const { error } = await db.from("academia").update(patch).eq("id", id);
  if (error) throw error;
}

const list = async <T,>(table: string, col: string, ids: string[]): Promise<T[]> => {
  if (!ids.length) return [];
  const { data, error } = await db.from(table).select("*").in(col, ids).order("position").order("created_at");
  if (error) throw error;
  return (data ?? []) as T[];
};

export async function loadAcademiaTree(academiaId: string) {
  const classes = await list<AcademiaClass>("academia_classes", "academia_id", [academiaId]);
  const subjects = await list<AcademiaSubject>("academia_subjects", "class_id", classes.map((c) => c.id));
  const topics = await list<AcademiaTopic>("academia_topics", "subject_id", subjects.map((s) => s.id));
  const subtopics = await list<AcademiaSubtopic>("academia_subtopics", "topic_id", topics.map((t) => t.id));
  const { data: st } = subjects.length
    ? await db.from("academia_subject_teachers").select("subject_id, teacher_id").in("subject_id", subjects.map((s) => s.id))
    : { data: [] };
  return { classes, subjects, topics, subtopics, subjectTeachers: (st ?? []) as { subject_id: string; teacher_id: string }[] };
}

export async function addClass(academiaId: string, name: string, position: number) {
  const { error } = await db.from("academia_classes").insert({ academia_id: academiaId, name, position });
  if (error) throw error;
}
export async function addSubject(classId: string, name: string, position: number) {
  const { error } = await db.from("academia_subjects").insert({ class_id: classId, name, position });
  if (error) throw error;
}
export async function removeRow(table: "academia_classes" | "academia_subjects", id: string) {
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw error;
}
export async function setSubjectTeachers(subjectId: string, teacherIds: string[]) {
  const { error } = await db.from("academia_subject_teachers").delete().eq("subject_id", subjectId);
  if (error) throw error;
  if (teacherIds.length) {
    const { error: e2 } = await db
      .from("academia_subject_teachers")
      .insert(teacherIds.map((teacher_id) => ({ subject_id: subjectId, teacher_id })));
    if (e2) throw e2;
  }
}

// ---------------- Phase 2: teachers build Topics → Subtopics → Sessions → Activities
export type AcademiaSession = Named & { subtopic_id: string; title: string; video_url: string | null };
export type ActivityKind = "game" | "lesson_note" | "smartboard" | "adventure" | "question";
export type AcademiaActivity = {
  id: string;
  session_id: string;
  kind: ActivityKind;
  ref_id: string;
  title: string;
  difficulty: string | null;
  position: number;
  /** Practice / Play link code, set by Assign as Academia. */
  link_code?: string | null;
};

export async function academiaForOrg(orgId: string): Promise<AcademiaRow | null> {
  const { data, error } = await db.from("academia").select("*").eq("org_id", orgId).maybeSingle();
  if (error) throw error;
  return (data as AcademiaRow) ?? null;
}

export async function mySubjectIds(): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await db.from("academia_subject_teachers").select("subject_id").eq("teacher_id", u.user.id);
  return ((data ?? []) as { subject_id: string }[]).map((r) => r.subject_id);
}

export async function addTopic(subjectId: string, name: string, position: number) {
  const { error } = await db.from("academia_topics").insert({ subject_id: subjectId, name, position });
  if (error) throw error;
}
export async function addSubtopic(topicId: string, name: string, position: number) {
  const { error } = await db.from("academia_subtopics").insert({ topic_id: topicId, name, position });
  if (error) throw error;
}
export async function deleteFrom(table: string, id: string) {
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw error;
}

export async function loadSessions(subtopicId: string): Promise<AcademiaSession[]> {
  const { data, error } = await db.from("academia_sessions").select("*").eq("subtopic_id", subtopicId).order("position").order("created_at");
  if (error) throw error;
  return ((data ?? []) as AcademiaSession[]).map((s) => ({ ...s, name: s.title }));
}
export async function addSession(subtopicId: string, title: string, position: number) {
  const { data, error } = await db.from("academia_sessions").insert({ subtopic_id: subtopicId, title, position }).select("id").single();
  if (error) throw error;
  return data.id as string;
}
export async function updateSession(id: string, patch: { title?: string; video_url?: string | null }) {
  const { error } = await db.from("academia_sessions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function loadSessionContext(sessionId: string) {
  const { data: session, error } = await db.from("academia_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  if (!session) return null;
  const { data: sub } = await db.from("academia_subtopics").select("*").eq("id", session.subtopic_id).maybeSingle();
  const { data: topic } = sub ? await db.from("academia_topics").select("*").eq("id", sub.topic_id).maybeSingle() : { data: null };
  const { data: subject } = topic ? await db.from("academia_subjects").select("*").eq("id", topic.subject_id).maybeSingle() : { data: null };
  const { data: klass } = subject ? await db.from("academia_classes").select("*").eq("id", subject.class_id).maybeSingle() : { data: null };
  const siblings = await loadSessions(session.subtopic_id);
  const { data: acts } = await db.from("academia_activities").select("*").eq("session_id", sessionId).order("position").order("created_at");
  const canBuild = subject ? Boolean((await db.rpc("academia_can_build_subject", { _subject: subject.id })).data) : false;
  return {
    session: session as AcademiaSession,
    subtopic: sub as AcademiaSubtopic | null,
    topic: topic as AcademiaTopic | null,
    subject: subject as AcademiaSubject | null,
    klass: klass as AcademiaClass | null,
    siblings,
    activities: (acts ?? []) as AcademiaActivity[],
    canBuild,
  };
}

export async function addActivity(a: Omit<AcademiaActivity, "id">) {
  const { error } = await db.from("academia_activities").insert(a);
  if (error) throw error;
}
export async function reorderActivities(ids: string[]) {
  await Promise.all(ids.map((id, position) => db.from("academia_activities").update({ position }).eq("id", id)));
}

/** Existing items a teacher can point an Activity at — referenced, never copied. */
export async function activityCatalogue(orgId: string | null): Promise<{ kind: ActivityKind; id: string; title: string }[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const scope = (q: any) => (orgId ? q.or(`org_id.eq.${orgId},owner_id.eq.${u.user!.id}`) : q.eq("owner_id", u.user!.id));
  const [g, n, a] = await Promise.all([
    scope(db.from("games").select("id,title")).limit(200),
    scope(db.from("notebooks").select("id,title")).limit(200),
    db.from("adventure_games").select("id,name").eq("owner_id", u.user.id).limit(200),
  ]);
  return [
    ...((g.data ?? []) as any[]).map((r) => ({ kind: "game" as const, id: r.id, title: r.title || "Untitled game" })),
    ...((n.data ?? []) as any[]).flatMap((r) => [
      { kind: "lesson_note" as const, id: r.id, title: r.title || "Untitled note" },
      { kind: "smartboard" as const, id: r.id, title: r.title || "Untitled note" },
    ]),
    ...((a.data ?? []) as any[]).map((r) => ({ kind: "adventure" as const, id: r.id, title: r.name || "Untitled adventure" })),
  ];
}

export const activityRoute = (a: { kind: ActivityKind; ref_id: string }): string => {
  switch (a.kind) {
    case "game": return `/game/play/${a.ref_id}`;
    case "lesson_note": return `/lesson-notes/${a.ref_id}`;
    case "smartboard": return `/smartboard/${a.ref_id}`;
    case "adventure": return `/adventure`;
    default: return "";
  }
};

// ---------------- Presentation, thumbnails and remembered positions
export const ACADEMIA_BUCKET = "academia-media";

export type AcademiaPresentation = {
  cover_path?: string | null;
  presentation_path?: string | null;
  description?: string | null;
};

const signedCache = new Map<string, { url: string; at: number }>();
export async function mediaUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const hit = signedCache.get(path);
  if (hit && Date.now() - hit.at < 50 * 60_000) return hit.url;
  const { data } = await supabase.storage.from(ACADEMIA_BUCKET).createSignedUrl(path, 60 * 60);
  if (data?.signedUrl) signedCache.set(path, { url: data.signedUrl, at: Date.now() });
  return data?.signedUrl ?? null;
}

/** Store a picture under the Academia's own folder and return its path. */
export async function uploadAcademiaMedia(academiaId: string, file: Blob, label: string): Promise<string> {
  const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
  const path = `${academiaId}/${label}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(ACADEMIA_BUCKET).upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function updateSessionDetails(id: string, patch: { title?: string; description?: string | null; thumbnail_path?: string | null; video_url?: string | null }) {
  const { error } = await db.from("academia_sessions").update(patch).eq("id", id);
  if (error) throw error;
}
export async function updateActivity(id: string, patch: { thumbnail_path?: string | null; difficulty?: string | null; title?: string }) {
  const { error } = await db.from("academia_activities").update(patch).eq("id", id);
  if (error) throw error;
}

/** Which Academia a session belongs to (for storage folders). */
export async function academiaIdOfClass(classId: string): Promise<string | null> {
  const { data } = await db.from("academia_classes").select("academia_id").eq("id", classId).maybeSingle();
  return data?.academia_id ?? null;
}
export async function academiaById(id: string): Promise<(AcademiaRow & AcademiaPresentation) | null> {
  const { data } = await db.from("academia").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

export async function loadPosition(sessionId: string): Promise<number> {
  const { data } = await db.from("academia_session_positions").select("activity_index").eq("session_id", sessionId).maybeSingle();
  return Number(data?.activity_index ?? 0);
}
export async function savePosition(sessionId: string, index: number) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await db
    .from("academia_session_positions")
    .upsert({ user_id: u.user.id, session_id: sessionId, activity_index: index, updated_at: new Date().toISOString() });
}

/** The one Academia belonging to a workspace — created for its owner the first time. */
export async function academiaForWorkspace(orgId: string, isOwner: boolean): Promise<AcademiaRow | null> {
  const existing = await academiaForOrg(orgId);
  if (existing || !isOwner) return existing;
  return ensureSchoolAcademia(orgId);
}

// ---------------- Assign as Academia, Practice / Play and records
import { ensureGuestLink, updateGuestLink } from "@/lib/guests/guestLinks";
import { fetchGuestAttempts } from "@/lib/guests/guestApi";
import { guestLinkToken } from "@/lib/guests/guestSession";

/**
 * Assign a lesson-note question to an Academia Session (Shared Workspace only).
 * The question is compiled once, the same way an Assignment is, into the
 * teacher's private practice class; Practice and Play open it through a
 * shareable link so every account (School, Teacher, Student) can use it
 * without joining a class. The chosen Game is optional.
 */
export async function assignToAcademia(input: {
  sessionId: string;
  notebookId: string;
  subsectionId: string | null;
  title: string;
  gameId: string | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Please sign in again.");
  const [{ ensureTestClass }, pipeline, games] = await Promise.all([
    import("@/lib/floating/testBoard"),
    import("@/lib/assignments/pipeline"),
    import("@/lib/slate/gameAssignments"),
  ]);
  const classId = await ensureTestClass(u.user.id);
  const ref = await pipeline.resolveQuestionRef(input.subsectionId);
  if (!ref.sectionId) throw new Error("This question has no saved content yet.");
  await pipeline.assignAssessmentQuestion({
    classId, notebookId: input.notebookId, ref, kind: "practice", title: input.title, scoreLabel: "Marks",
  });
  const practice = await ensureGuestLink({ kind: "assignment", resourceId: input.notebookId, classId, title: input.title });
  await updateGuestLink(practice.id, { ask_name: false, enabled: true });

  const { data: existing } = await db.from("academia_activities").select("id, kind, ref_id").eq("session_id", input.sessionId);
  const rows = (existing ?? []) as { kind: string; ref_id: string }[];
  let position = rows.length;
  if (!rows.some((r) => r.kind === "question" && r.ref_id === input.notebookId)) {
    await addActivity({
      session_id: input.sessionId, kind: "question", ref_id: input.notebookId, title: input.title,
      difficulty: null, position: position++, link_code: practice.code,
    } as Omit<AcademiaActivity, "id">);
  }
  if (input.gameId) {
    await games.assignGameToClass({ gameId: input.gameId, classId, passPercentage: 70 });
    const play = await ensureGuestLink({ kind: "game", resourceId: input.gameId, classId, title: input.title });
    await updateGuestLink(play.id, { ask_name: false, enabled: true });
    if (!rows.some((r) => r.kind === "game" && r.ref_id === input.gameId)) {
      await addActivity({
        session_id: input.sessionId, kind: "game", ref_id: input.gameId, title: input.title,
        difficulty: null, position: position++, link_code: play.code,
      } as Omit<AcademiaActivity, "id">);
    }
  }
}

export type AcademiaAttempt = {
  id: string;
  session_id: string;
  mode: "practice" | "play";
  score: number;
  max_score: number;
  best_score: number;
  status: "in_progress" | "completed";
  attempts: number;
  updated_at: string;
};

/** Mark that this person opened Practice or Play (counts one more attempt). */
export async function startAttempt(sessionId: string, mode: "practice" | "play", activityId: string | null) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { data: row } = await db.from("academia_attempts").select("*")
    .eq("session_id", sessionId).eq("user_id", u.user.id).eq("mode", mode).maybeSingle();
  if (row) {
    await db.from("academia_attempts").update({ attempts: (row.attempts ?? 0) + 1 }).eq("id", row.id);
  } else {
    await db.from("academia_attempts").insert({ session_id: sessionId, user_id: u.user.id, mode, activity_id: activityId });
  }
}

/**
 * Bring this person's marks back from the Practice / Play link into their
 * Academia record. The best valid score is the one that counts.
 */
export async function syncAttempts(sessionId: string, activities: AcademiaActivity[]) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const token = guestLinkToken();
  for (const a of activities) {
    const code = (a as AcademiaActivity & { link_code?: string | null }).link_code;
    if (!code) continue;
    const mode = a.kind === "game" ? "play" : "practice";
    const { data: row } = await db.from("academia_attempts").select("*")
      .eq("session_id", sessionId).eq("user_id", u.user.id).eq("mode", mode).maybeSingle();
    if (!row) continue;
    const marks = await fetchGuestAttempts(code, token).catch(() => []);
    if (!marks.length) continue;
    const score = marks.reduce((s, m) => s + Number(m.score ?? 0), 0);
    const max = marks.reduce((s, m) => s + Number(m.total_marks ?? 0), 0);
    const best = Math.max(Number(row.best_score ?? 0), score);
    const done = max > 0 && marks.every((m) => /complete|submitted|passed/i.test(m.status ?? ""));
    await db.from("academia_attempts").update({
      score, max_score: Math.max(max, Number(row.max_score ?? 0)), best_score: best,
      status: done || (max > 0 && best >= max) ? "completed" : row.status,
    }).eq("id", row.id);
  }
}

export async function myAttempts(sessionIds?: string[]): Promise<AcademiaAttempt[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  let q = db.from("academia_attempts").select("*").eq("user_id", u.user.id).order("updated_at", { ascending: false });
  if (sessionIds) {
    if (!sessionIds.length) return [];
    q = q.in("session_id", sessionIds);
  }
  const { data } = await q.limit(500);
  return (data ?? []) as AcademiaAttempt[];
}

export type SessionStatus = "not_started" | "in_progress" | "completed";
export const sessionStatus = (attempts: AcademiaAttempt[], sessionId: string): SessionStatus => {
  const mine = attempts.filter((a) => a.session_id === sessionId);
  if (!mine.length) return "not_started";
  return mine.some((a) => a.status === "completed") ? "completed" : "in_progress";
};

/** Every session under a set of subtopics (for the student explorer). */
export async function sessionsOf(subtopicIds: string[]): Promise<AcademiaSession[]> {
  if (!subtopicIds.length) return [];
  const { data } = await db.from("academia_sessions").select("*").in("subtopic_id", subtopicIds).order("position").order("created_at");
  return ((data ?? []) as AcademiaSession[]).map((s) => ({ ...s, name: s.title }));
}

/** The Academias of every school workspace this person belongs to. */
export async function myAcademias(): Promise<(AcademiaRow & AcademiaPresentation)[]> {
  const { data: ws } = await supabase.rpc("my_workspaces");
  const orgIds = ((ws ?? []) as { org_id: string; kind: string; status: string }[])
    .filter((w) => w.kind === "school" && w.status === "active")
    .map((w) => w.org_id);
  if (!orgIds.length) return [];
  const { data } = await db.from("academia").select("*").in("org_id", orgIds);
  return (data ?? []) as (AcademiaRow & AcademiaPresentation)[];
}
