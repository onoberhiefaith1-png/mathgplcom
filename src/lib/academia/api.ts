/**
 * ACADEMIA — the School's learning space (Class -> Subject -> Topic -> Subtopic
 * -> Session -> Activity). A separate system from the 3D Academy/Building.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  assertSingleTier,
  buildClassSubjectReport,
  normalizeTier,
  rollUpTier,
  sortByTier,
  type AcademiaTier,
  type ActivityScores,
  type ClassSubjectReport,
} from "@/lib/academia/tiers";
export type { AcademiaTier } from "@/lib/academia/tiers";

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
export type AcademiaSession = Named & {
  subtopic_id: string;
  title: string;
  video_url: string | null;
  lesson_note_id?: string | null;
};
export type ActivityKind = "game" | "lesson_note" | "smartboard" | "adventure" | "question" | "mcq";
export type AcademiaActivity = {
  id: string;
  session_id: string;
  kind: ActivityKind;
  ref_id: string;
  title: string;
  difficulty: string | null;
  position: number;
  /** Tier batch inside the Session, chosen at assignment. Old rows: beginner. */
  tier: AcademiaTier;
  /** Practice / Play link code, set by Assign as Academia. */
  link_code?: string | null;
  /** Play link for the Game attached to this question (same card). */
  game_link_code?: string | null;
  /** Direct Practice: the compiled question in the hidden Academia class. */
  assessment_id?: string | null;
  /** Direct Play: the Game that carries this question as a Level. */
  game_id?: string | null;
  class_id?: string | null;
  question_key?: string | null;
  subsection_id?: string | null;
  practice_video?: import("@/lib/courses/questionVideo").QuestionVideoConfig | null;
  play_video?: import("@/lib/courses/questionVideo").QuestionVideoConfig | null;
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
  const activities = sortByTier(((acts ?? []) as AcademiaActivity[]).map((a) => ({ ...a, tier: normalizeTier(a.tier) })));
  const canBuild = subject ? Boolean((await db.rpc("academia_can_build_subject", { _subject: subject.id })).data) : false;
  return {
    session: session as AcademiaSession,
    subtopic: sub as AcademiaSubtopic | null,
    topic: topic as AcademiaTopic | null,
    subject: subject as AcademiaSubject | null,
    klass: klass as AcademiaClass | null,
    siblings,
    activities,
    canBuild,
  };
}

export async function addActivity(a: Omit<AcademiaActivity, "id" | "tier"> & { tier?: AcademiaTier | null }) {
  const { error } = await db.from("academia_activities").insert({ ...a, tier: normalizeTier(a.tier) });
  if (error) throw error;
}
/** Reorder ONE tier batch of a Session. Cross-tier moves are refused here and
 *  again by the database (academia_reorder_tier + tier lock trigger). */
export async function reorderActivities(ids: string[], sessionId?: string) {
  if (!ids.length) return;
  const { data, error } = await db.from("academia_activities").select("id, session_id, tier").in("id", ids);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; session_id: string; tier: string | null }[];
  const tier = assertSingleTier(rows, ids);
  const session = sessionId ?? rows[0]?.session_id;
  if (!session || rows.some((r) => r.session_id !== session)) throw new Error("Those activities are not in this Session.");
  const { error: e2 } = await db.rpc("academia_reorder_tier", { _session: session, _tier: tier, _ids: ids });
  if (e2) throw e2;
}

/** Existing items a teacher can point an Activity at — referenced, never copied. */
export async function activityCatalogue(orgId: string | null): Promise<{ kind: ActivityKind; id: string; title: string }[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const scope = (q: any) => (orgId ? q.or(`org_id.eq.${orgId},owner_id.eq.${u.user!.id}`) : q.eq("owner_id", u.user!.id));
  const [g, n, a] = await Promise.all([
    scope(db.from("games").select("id,title")).limit(200),
    scope(db.from("notebooks").select("id,title")).limit(200),
    import("@/lib/adventures/classAdventureLinks").then((m) => m.listLinkableAdventures()).then((data) => ({ data })).catch(() => ({ data: [] })),
  ]);
  return [
    ...((g.data ?? []) as any[]).map((r) => ({ kind: "game" as const, id: r.id, title: r.title || "Untitled game" })),
    ...((n.data ?? []) as any[]).flatMap((r) => [
      { kind: "lesson_note" as const, id: r.id, title: r.title || "Untitled note" },
      { kind: "smartboard" as const, id: r.id, title: r.title || "Untitled note" },
    ]),
    ...((a.data ?? []) as any[]).map((r) => ({ kind: "adventure" as const, id: r.id, title: r.title || "Untitled adventure" })),
  ];
}

export const activityRoute = (a: { kind: ActivityKind; ref_id: string; class_id?: string | null }): string => {
  switch (a.kind) {
    case "game": return `/game/play/${a.ref_id}`;
    case "lesson_note": return `/lesson-notes/${a.ref_id}`;
    case "smartboard": return `/smartboard/${a.ref_id}${a.class_id ? `?classId=${a.class_id}` : ""}`;
    case "adventure": return `/adventure/games/${a.ref_id}`;
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
  const named = file instanceof File ? file.name.split(".").pop()?.toLowerCase() : "";
  const ext = file.type.startsWith("video/") || file.type.startsWith("audio/")
    ? (named || file.type.split("/")[1] || "mp4")
    : file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
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

/** One hidden Academia class per teacher. Learners join it silently when they
 *  open a question, so marking is exactly the class-assignment engine. It is
 *  never listed as a class and never counts towards a plan's student limit. */
async function ensureAcademiaClass(ownerId: string): Promise<string> {
  const { data: existing } = await supabase.from("classes").select("id")
    .eq("owner_id", ownerId).eq("workspace", "academia").order("created_at").limit(1);
  const hit = (existing ?? [])[0]?.id as string | undefined;
  if (hit) return hit;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = "AC";
    for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    const { data, error } = await supabase.from("classes").insert({
      name: "Academia", description: "Hidden Academia questions — never listed as a class.",
      class_code: code, owner_id: ownerId, workspace: "academia",
    }).select("id").single();
    if (!error && data) return data.id as string;
    lastError = error;
    if ((error as { code?: string } | null)?.code !== "23505") break;
  }
  throw new Error(String((lastError as { message?: string })?.message ?? "Could not prepare Academia"));
}

/**
 * Assign a lesson-note question to an Academia Session (Shared Workspace only).
 * ONE card = ONE question. Practice opens the normal student board for that
 * question; Play opens the Game with this question as its Level. No guest links.
 */
export async function assignToAcademia(input: {
  sessionId: string;
  notebookId: string;
  subsectionId: string | null;
  title: string;
  gameId: string | null;
  /** Tier batch chosen in the Assign picker (default Beginner). */
  tier?: AcademiaTier | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Please sign in again.");
  const tier = normalizeTier(input.tier);
  const [pipeline, games] = await Promise.all([
    import("@/lib/assignments/pipeline"),
    import("@/lib/slate/gameAssignments"),
  ]);
  const classId = await ensureAcademiaClass(u.user.id);
  const ref = await pipeline.resolveQuestionRef(input.subsectionId);
  if (!ref.sectionId) throw new Error("This question has no saved content yet.");
  const assessmentId = await pipeline.assignAssessmentQuestion({
    classId, notebookId: input.notebookId, ref, kind: "practice", title: input.title, scoreLabel: "Marks",
  });

  if (input.gameId) {
    const { assignQuestion } = await import("@/lib/slate/gameQuestions");
    const { ensureGameBoards } = await import("@/lib/slate/gameBoard");
    await games.assignGameToClass({ gameId: input.gameId, classId, passPercentage: 100 });
    if (!input.subsectionId) throw new Error("Choose a question to add to the Game.");
    const joined = await assignQuestion(input.gameId, input.notebookId, input.subsectionId, classId);
    if (!joined) throw new Error("This question could not be added to the Game.");
    // Compile this Class + Game collection now, so Play opens straight away.
    await ensureGameBoards({ gameId: input.gameId, classId, questionClassId: classId });
  }


  const fields = {
    class_id: classId, assessment_id: assessmentId, question_key: ref.questionKey ?? null,
    subsection_id: input.subsectionId,
    game_id: input.gameId, link_code: null, game_link_code: null,
  };
  const { data: existing } = await db.from("academia_activities").select("id, kind, subsection_id, tier").eq("session_id", input.sessionId);
  const rows = (existing ?? []) as { id: string; kind: string; subsection_id: string | null; tier: string | null }[];
  // One card per question: only the exact same question refreshes its card;
  // every other question — even through the same Game — becomes a new card.
  const card = input.subsectionId
    ? rows.find((r) => r.kind === "question" && r.subsection_id === input.subsectionId)
    : undefined;
  if (card && normalizeTier(card.tier) !== tier) {
    // Never cross tiers: the card keeps the batch it was first assigned to.
    const { TIER_LABEL } = await import("@/lib/academia/tiers");
    throw new Error(`This question is already in the ${TIER_LABEL[normalizeTier(card.tier)]} batch. Remove it there first to move it.`);
  }
  if (card) {
    await db.from("academia_activities").update({ ...fields, title: input.title, question_design: null }).eq("id", card.id);
  } else {
    await addActivity({
      session_id: input.sessionId, kind: "question", ref_id: input.notebookId, title: input.title,
      difficulty: null, tier, position: rows.filter((r) => normalizeTier(r.tier) === tier).length, ...fields,
    } as unknown as Omit<AcademiaActivity, "id">);
  }
}

/** Add one video Adventure to a Session. It is referenced, never copied, and
 *  sits after the question cards. Students reach it through the Session's
 *  hidden Academia class, so its progress bars carry this Session's questions. */
export async function addSessionAdventure(input: { sessionId: string; gameId: string; title: string; tier?: AcademiaTier | null }) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Please sign in again.");
  const classId = await ensureAcademiaClass(u.user.id);
  const { linkAdventure } = await import("@/lib/adventures/classAdventureLinks");
  await linkAdventure(classId, input.gameId);
  const { data: existing } = await db.from("academia_activities").select("id, kind, ref_id, position, tier").eq("session_id", input.sessionId);
  const rows = (existing ?? []) as { id: string; kind: string; ref_id: string; position: number; tier: string | null }[];
  if (rows.some((r) => r.kind === "adventure" && r.ref_id === input.gameId)) throw new Error("This Adventure is already in the Session.");
  const tier = normalizeTier(input.tier);
  const position = rows.filter((r) => normalizeTier(r.tier) === tier).reduce((m, r) => Math.max(m, r.position ?? 0), 0) + 1;
  const { error } = await db.from("academia_activities").insert({
    session_id: input.sessionId, kind: "adventure", ref_id: input.gameId, title: input.title,
    class_id: classId, created_by: u.user.id, position, tier,
  });
  if (error) throw error;
}

/** Adventures already added to a Session. */
export async function sessionAdventures(sessionId: string): Promise<{ id: string; gameId: string; title: string; classId: string | null }[]> {
  const { data, error } = await db.from("academia_activities").select("id, ref_id, title, class_id").eq("session_id", sessionId).eq("kind", "adventure").order("position");
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({ id: r.id, gameId: r.ref_id, title: r.title, classId: r.class_id }));
}

/** Put one lesson-note question on a progress bar of a Session's Adventure.
 *  Repeating on the same bar adds the next question in order. */
export async function assignToAcademiaAdventure(input: {
  activityId: string; barId: string; barLabel?: string; notebookId: string; subsectionId: string | null;
}) {
  const { data: act, error } = await db.from("academia_activities").select("id, kind, ref_id, class_id, title").eq("id", input.activityId).maybeSingle();
  if (error) throw error;
  if (!act || act.kind !== "adventure" || !act.class_id) throw new Error("Add this Adventure to the Session again.");
  const pipeline = await import("@/lib/assignments/pipeline");
  const ref = await pipeline.resolveQuestionRef(input.subsectionId);
  if (!ref.sectionId) throw new Error("This question has no saved content yet.");
  const { assignQuestionToBar } = await import("@/lib/adventures/barQuestions");
  await assignQuestionToBar({
    classId: act.class_id, gameId: act.ref_id, barId: input.barId, notebookId: input.notebookId,
    sectionId: ref.sectionId, questionKey: ref.questionKey ?? null, barLabel: input.barLabel, adventureTitle: act.title,
  });
}

/** Attach one original lesson note to a Session. The note is referenced once;
 * visiting teachers make their own independent workspace copy when requested. */
export async function attachSessionLessonNote(sessionId: string, notebookId: string | null) {
  const { error } = await db.from("academia_sessions").update({ lesson_note_id: notebookId }).eq("id", sessionId);
  if (error) throw error;
}

export async function listMyWorkspaceNotebooks(): Promise<{ id: string; title: string }[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { activeSchoolOrgId, withWorkspaceScope } = await import("@/lib/accounts/workspaceScope");
  const orgId = await activeSchoolOrgId();
  let query = db.from("notebooks").select("id,title").eq("owner_id", userData.user.id).eq("storage_scope", "workspace");
  query = withWorkspaceScope(query, orgId);
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(200);
  if (error) throw error;
  return ((data ?? []) as { id: string; title: string | null }[]).map((row) => ({ id: row.id, title: row.title || "Untitled note" }));
}

export async function copySessionLessonNoteToWorkspace(notebookId: string): Promise<string> {
  const { duplicateNotebook } = await import("@/lib/lessonnotes/notebookCopy");
  return duplicateNotebook(notebookId, { scope: "workspace", titleSuffix: " (Academia copy)" });
}

/** A visiting teacher assigns every question in this Session to one of their
 * own classes. Source activities remain immutable and shared. */
export async function assignSessionToOwnClass(sessionId: string, classId: string): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Please sign in again.");
  const { data: owned } = await supabase.from("classes").select("id").eq("id", classId).eq("owner_id", uid).neq("workspace", "academia").maybeSingle();
  if (!owned) throw new Error("Choose one of your own classes.");
  const { data, error } = await db.from("academia_activities").select("*").eq("session_id", sessionId).eq("kind", "question").order("position");
  if (error) throw error;
  const activities = (data ?? []) as AcademiaActivity[];
  const pipeline = await import("@/lib/assignments/pipeline");
  let assigned = 0;
  for (const activity of activities) {
    if (!activity.subsection_id) continue;
    const ref = await pipeline.resolveQuestionRef(activity.subsection_id);
    await pipeline.assignAssessmentQuestion({
      classId,
      notebookId: activity.ref_id,
      ref,
      kind: "practice",
      title: activity.title,
      scoreLabel: "Marks",
      gameId: activity.game_id ?? null,
    });
    if (activity.game_id) {
      const [{ assignGameToClass }, { assignQuestion }, { ensureGameBoards }] = await Promise.all([
        import("@/lib/slate/gameAssignments"),
        import("@/lib/slate/gameQuestions"),
        import("@/lib/slate/gameBoard"),
      ]);
      await assignGameToClass({ gameId: activity.game_id, classId, passPercentage: 100 });
      await assignQuestion(activity.game_id, activity.ref_id, activity.subsection_id, classId);
      await ensureGameBoards({ gameId: activity.game_id, classId, questionClassId: classId });
    }
    assigned += 1;
  }
  if (assigned) {
    // Teacher-assigned: learners in this class cannot cancel the Session themselves.
    const { error: recordError } = await db.from("academia_session_assignments")
      .upsert({ session_id: sessionId, class_id: classId, assigned_by: uid }, { onConflict: "session_id,class_id", ignoreDuplicates: true });
    if (recordError) throw recordError;
  }
  return assigned;
}

export async function saveActivityVideo(
  activityId: string,
  mode: "practice" | "play",
  config: import("@/lib/courses/questionVideo").QuestionVideoConfig | null,
) {
  const field = mode === "practice" ? "practice_video" : "play_video";
  const { error } = await db.from("academia_activities").update({ [field]: config }).eq("id", activityId);
  if (error) throw error;
}

export async function activityVideoLines(subsectionId: string | null | undefined) {
  if (!subsectionId) return [];
  const { data, error } = await db.from("notebook_subsections").select("floating_lines").eq("id", subsectionId).maybeSingle();
  if (error) throw error;
  const lines = Array.isArray(data?.floating_lines) ? data.floating_lines as Array<{ lineId?: string; equation?: string; explanation?: string }> : [];
  return lines.map((line, index) => ({
    lineId: line.lineId || `${subsectionId}:${index}`,
    label: `Line ${index + 1}`,
    preview: line.equation ?? null,
    note: line.explanation ?? null,
  }));
}

export async function loadActivity(id: string): Promise<AcademiaActivity | null> {
  const { data } = await db.from("academia_activities").select("*").eq("id", id).maybeSingle();
  return data ? ({ ...(data as AcademiaActivity), tier: normalizeTier((data as AcademiaActivity).tier) }) : null;
}

export type AcademiaEntry = {
  ready: boolean;
  class_id?: string;
  assessment_id?: string | null;
  game_id?: string | null;
  question_key?: string | null;
  session_id?: string;
  title?: string;
};

/** Let this signed-in learner into the question (silently joins its hidden class). */
export async function enterActivity(activityId: string): Promise<AcademiaEntry> {
  const { data, error } = await db.rpc("academia_enter_activity", { _activity: activityId });
  if (error) throw error;
  return (data ?? { ready: false }) as AcademiaEntry;
}

export type AcademiaAttempt = {
  id: string;
  session_id: string;
  user_id?: string;
  mode: "practice" | "play";
  /** Each tier has its own attempt and evaluation. Old rows: beginner. */
  tier: AcademiaTier;
  score: number;
  max_score: number;
  best_score: number;
  status: "in_progress" | "completed";
  attempts: number;
  activity_scores?: ActivityScores;
  updated_at: string;
};

const asAttempt = (r: AcademiaAttempt): AcademiaAttempt => ({ ...r, tier: normalizeTier(r.tier) });
/** Activities that carry marks: Practice questions and Multiple Choice. */
const isScored = (a: { kind?: string; assessment_id?: string | null }) => a.kind === "mcq" || !!a.assessment_id;

async function tierOfActivity(activityId: string | null): Promise<AcademiaTier> {
  if (!activityId) return normalizeTier(null);
  const { data } = await db.from("academia_activities").select("tier").eq("id", activityId).maybeSingle();
  return normalizeTier(data?.tier);
}

/** Mark that this person opened Practice or Play in one tier (counts one more attempt). */
export async function startAttempt(sessionId: string, mode: "practice" | "play", activityId: string | null, tier?: AcademiaTier | null) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const t = tier ? normalizeTier(tier) : await tierOfActivity(activityId);
  const { data: row } = await db.from("academia_attempts").select("*")
    .eq("session_id", sessionId).eq("user_id", u.user.id).eq("mode", mode).eq("tier", t).maybeSingle();
  if (row) {
    await db.from("academia_attempts").update({ attempts: (row.attempts ?? 0) + 1 }).eq("id", row.id);
  } else {
    await db.from("academia_attempts").insert({ session_id: sessionId, user_id: u.user.id, mode, tier: t, activity_id: activityId });
  }
}

/** Write one tier's activity marks and its rolled-up score. Best marks count. */
async function saveTierScores(row: AcademiaAttempt & { activity_scores?: ActivityScores | null }, scores: ActivityScores, tierActivityIds: string[]) {
  const roll = rollUpTier(scores, tierActivityIds);
  await db.from("academia_attempts").update({
    activity_scores: scores,
    score: roll.score,
    max_score: roll.max,
    best_score: Math.max(Number(row.best_score ?? 0), roll.score),
    status: roll.completed ? "completed" : row.status,
  }).eq("id", row.id);
}

/**
 * Bring this person's own marks (the normal assignment records) back into
 * their Academia record, separately for each tier. The best valid score per
 * activity is the one that counts; a tier never borrows another tier's marks.
 */
export async function syncAttempts(sessionId: string, activities: AcademiaActivity[]) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const uid = u.user.id;
  const { data: rowsData } = await db.from("academia_attempts").select("*")
    .eq("session_id", sessionId).eq("user_id", uid).eq("mode", "practice");
  const rows = ((rowsData ?? []) as AcademiaAttempt[]).map(asAttempt);
  if (!rows.length) return;
  const assessmentIds = activities.map((a) => a.assessment_id).filter(Boolean) as string[];
  const [{ data: progs }, { data: asmts }] = assessmentIds.length
    ? await Promise.all([
      db.from("assessment_progress").select("assessment_id, score, status").in("assessment_id", assessmentIds).eq("student_id", uid),
      db.from("assessments").select("id, total_marks").in("id", assessmentIds),
    ])
    : [{ data: [] }, { data: [] }];
  const progBy = new Map(((progs ?? []) as { assessment_id: string; score: number; status: string }[]).map((p) => [p.assessment_id, p]));
  const maxBy = new Map(((asmts ?? []) as { id: string; total_marks: number }[]).map((a) => [a.id, Number(a.total_marks ?? 0)]));
  for (const row of rows) {
    const tierActs = activities.filter((a) => normalizeTier(a.tier) === row.tier && isScored(a));
    const scores: ActivityScores = { ...((row.activity_scores ?? {}) as ActivityScores) };
    for (const a of tierActs) {
      if (!a.assessment_id) continue;
      const prog = progBy.get(a.assessment_id);
      if (!prog) continue;
      const max = maxBy.get(a.assessment_id) ?? 0;
      const score = Math.max(Number(scores[a.id]?.score ?? 0), Number(prog.score ?? 0));
      const done = /complete|submitted/i.test(String(prog.status ?? "")) || (max > 0 && score >= max);
      scores[a.id] = { score, max, done: done || !!scores[a.id]?.done };
    }
    await saveTierScores(row, scores, tierActs.map((a) => a.id));
  }
}

/** Record a finished Multiple-Choice card into its tier's evaluation. */
export async function recordActivityResult(activity: Pick<AcademiaActivity, "id" | "session_id" | "tier">, score: number, max: number) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const tier = normalizeTier(activity.tier ?? (await tierOfActivity(activity.id)));
  const find = () => db.from("academia_attempts").select("*")
    .eq("session_id", activity.session_id).eq("user_id", u.user!.id).eq("mode", "practice").eq("tier", tier).maybeSingle();
  let { data: row } = await find();
  if (!row) {
    await startAttempt(activity.session_id, "practice", activity.id, tier);
    ({ data: row } = await find());
    if (!row) return;
  }
  const { data: acts } = await db.from("academia_activities").select("id, kind, assessment_id, tier").eq("session_id", activity.session_id);
  const tierIds = ((acts ?? []) as AcademiaActivity[]).filter((a) => normalizeTier(a.tier) === tier && isScored(a)).map((a) => a.id);
  const scores: ActivityScores = { ...((row.activity_scores ?? {}) as ActivityScores) };
  const best = Math.max(Number(scores[activity.id]?.score ?? 0), score);
  scores[activity.id] = { score: best, max, done: true };
  await saveTierScores(asAttempt(row as AcademiaAttempt), scores, tierIds);
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
  return ((data ?? []) as AcademiaAttempt[]).map(asAttempt);
}

export type SessionStatus = "not_started" | "in_progress" | "completed";
export const sessionStatus = (attempts: AcademiaAttempt[], sessionId: string): SessionStatus => {
  const mine = attempts.filter((a) => a.session_id === sessionId);
  if (!mine.length) return "not_started";
  return mine.some((a) => a.status === "completed") ? "completed" : "in_progress";
};

// ---------------- Cancel (one per learner per Session, logged for teachers)

export type CancelState = {
  caller_is_learner: boolean;
  caller_is_teacher: boolean;
  teacher_assigned: boolean;
  already_cancelled: boolean;
  cancelled_at: string | null;
  cancelled_by_role: "learner" | "teacher" | null;
  has_attempt: boolean;
};
export type AttemptCancel = {
  id: string;
  session_id: string;
  learner_id: string;
  cancelled_by: string;
  cancelled_by_role: "learner" | "teacher";
  snapshot: { mode: string; tier: string; score: number; best_score: number; max_score: number; status: string; attempts: number }[];
  reason: string | null;
  created_at: string;
};

export async function cancelState(sessionId: string, learnerId?: string | null): Promise<CancelState | null> {
  const { data, error } = await db.rpc("academia_cancel_state", { _session: sessionId, _learner: learnerId ?? null });
  if (error) return null;
  return (data ?? null) as CancelState | null;
}

/** Wipe this learner's Session attempt (every tier) and drop it from totals.
 *  Only a cancel — it never writes a score. */
export async function cancelSessionAttempt(sessionId: string, learnerId?: string | null, reason?: string) {
  const { error } = await db.rpc("academia_cancel_session_attempt", { _session: sessionId, _learner: learnerId ?? null, _reason: reason ?? null });
  if (error) {
    const { CANCEL_REASON_TEXT } = await import("@/lib/academia/tiers");
    const key = (Object.keys(CANCEL_REASON_TEXT) as (keyof typeof CANCEL_REASON_TEXT)[]).find((k) => String(error.message ?? "").includes(k));
    throw new Error(key ? CANCEL_REASON_TEXT[key] : error.message || "Could not cancel.");
  }
}

export async function sessionCancels(sessionIds: string[]): Promise<AttemptCancel[]> {
  if (!sessionIds.length) return [];
  const { data, error } = await db.from("academia_attempt_cancels").select("*").in("session_id", sessionIds).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AttemptCancel[];
}

// ---------------- Class + subject evaluation (never combined across pairs)

export type ClassSubjectScope = {
  subject: AcademiaSubject;
  klass: AcademiaClass | null;
  /** e.g. "Year One · Mathematics". */
  label: string;
  sessions: { id: string; title: string; topic: string; subtopic: string }[];
  activities: { id: string; session_id: string; tier: AcademiaTier; kind: ActivityKind; max: number }[];
  canBuild: boolean;
};

/** Everything that can be scored in ONE class + subject pair, with its marks. */
export async function classSubjectScope(subjectId: string): Promise<ClassSubjectScope | null> {
  const { data: subject } = await db.from("academia_subjects").select("*").eq("id", subjectId).maybeSingle();
  if (!subject) return null;
  const { data: klass } = await db.from("academia_classes").select("*").eq("id", subject.class_id).maybeSingle();
  const topics = await list<AcademiaTopic>("academia_topics", "subject_id", [subjectId]);
  const subtopics = await list<AcademiaSubtopic>("academia_subtopics", "topic_id", topics.map((t) => t.id));
  const sessions = await sessionsOf(subtopics.map((s) => s.id));
  const sessionIds = sessions.map((s) => s.id);
  const { data: acts } = sessionIds.length
    ? await db.from("academia_activities").select("id, session_id, tier, kind, assessment_id").in("session_id", sessionIds)
    : { data: [] };
  const rows = ((acts ?? []) as { id: string; session_id: string; tier: string | null; kind: ActivityKind; assessment_id: string | null }[]).filter(isScored);
  const assessmentIds = rows.map((r) => r.assessment_id).filter(Boolean) as string[];
  const mcqIds = rows.filter((r) => r.kind === "mcq").map((r) => r.id);
  const [{ data: asmts }, { data: items }] = await Promise.all([
    assessmentIds.length ? db.from("assessments").select("id, total_marks").in("id", assessmentIds) : Promise.resolve({ data: [] }),
    mcqIds.length ? db.from("academia_mcq_items").select("activity_id").in("activity_id", mcqIds) : Promise.resolve({ data: [] }),
  ]);
  const maxBy = new Map(((asmts ?? []) as { id: string; total_marks: number }[]).map((a) => [a.id, Number(a.total_marks ?? 0)]));
  const mcqCount = new Map<string, number>();
  for (const it of (items ?? []) as { activity_id: string }[]) mcqCount.set(it.activity_id, (mcqCount.get(it.activity_id) ?? 0) + 1);
  const subById = new Map(subtopics.map((s) => [s.id, s]));
  const topById = new Map(topics.map((t) => [t.id, t]));
  const canBuild = Boolean((await db.rpc("academia_can_build_subject", { _subject: subjectId })).data);
  return {
    subject: subject as AcademiaSubject,
    klass: (klass ?? null) as AcademiaClass | null,
    label: [klass?.name, subject.name].filter(Boolean).join(" · "),
    sessions: sessions.map((s) => {
      const sub = subById.get(s.subtopic_id);
      return { id: s.id, title: s.title, subtopic: sub?.name ?? "", topic: (sub && topById.get(sub.topic_id)?.name) ?? "" };
    }),
    activities: rows.map((r) => ({
      id: r.id, session_id: r.session_id, tier: normalizeTier(r.tier), kind: r.kind,
      max: r.kind === "mcq" ? (mcqCount.get(r.id) ?? 0) : (maxBy.get(r.assessment_id ?? "") ?? 0),
    })),
    canBuild,
  };
}

export const reportFor = (scope: ClassSubjectScope, attempts: AcademiaAttempt[]): ClassSubjectReport =>
  buildClassSubjectReport({ sessions: scope.sessions, activities: scope.activities, attempts });

export type LearnerReport = { userId: string; name: string; report: ClassSubjectReport };

/** Teachers: every learner's evaluation in this class + subject only. */
export async function classSubjectLearnerReports(scope: ClassSubjectScope): Promise<LearnerReport[]> {
  const ids = scope.sessions.map((s) => s.id);
  if (!ids.length) return [];
  const { data, error } = await db.from("academia_attempts").select("*").in("session_id", ids).limit(5000);
  if (error) throw error;
  const attempts = ((data ?? []) as AcademiaAttempt[]).map(asAttempt);
  const byUser = new Map<string, AcademiaAttempt[]>();
  for (const a of attempts) if (a.user_id) byUser.set(a.user_id, [...(byUser.get(a.user_id) ?? []), a]);
  const userIds = [...byUser.keys()];
  const { data: profiles } = userIds.length
    ? await db.from("profiles").select("user_id, full_name, display_name").in("user_id", userIds)
    : { data: [] };
  const nameBy = new Map(((profiles ?? []) as { user_id: string; full_name: string | null; display_name: string | null }[])
    .map((p) => [p.user_id, p.display_name || p.full_name || "Learner"]));
  return userIds
    .map((userId) => ({ userId, name: nameBy.get(userId) ?? "Learner", report: reportFor(scope, byUser.get(userId) ?? []) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Which subject a Session belongs to (for its class–subject progress view). */
export async function subjectOfSession(sessionId: string): Promise<string | null> {
  const { data } = await db.rpc("academia_subject_of_session", { _session: sessionId });
  return (data as string | null) ?? null;
}

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
  const enrolled = await myEnrolmentIds();
  const parts: (AcademiaRow & AcademiaPresentation)[] = [];
  if (orgIds.length) {
    const { data } = await db.from("academia").select("*").in("org_id", orgIds);
    parts.push(...((data ?? []) as (AcademiaRow & AcademiaPresentation)[]));
  }
  const extra = enrolled.filter((id) => !parts.some((p) => p.id === id));
  if (extra.length) {
    const { data } = await db.from("academia").select("*").in("id", extra);
    parts.push(...((data ?? []) as (AcademiaRow & AcademiaPresentation)[]));
  }
  return parts;
}

export type DiscoveredAcademia = AcademiaRow & AcademiaPresentation & { school_name: string };

/** Public Academias plus the caller's own school ones, searchable by name. */
export async function discoverAcademias(q = ""): Promise<DiscoveredAcademia[]> {
  const { data, error } = await db.rpc("discover_academias", { _q: q.trim().slice(0, 80) });
  if (error) throw error;
  return (data ?? []) as DiscoveredAcademia[];
}
export async function myEnrolmentIds(): Promise<string[]> {
  const { data } = await db.from("academia_enrolments").select("academia_id");
  return ((data ?? []) as { academia_id: string }[]).map((r) => r.academia_id);
}
export async function enrolAcademia(academiaId: string) {
  const { error } = await db.from("academia_enrolments").upsert({ academia_id: academiaId }, { onConflict: "user_id,academia_id", ignoreDuplicates: true });
  if (error) throw error;
}
export async function unenrolAcademia(academiaId: string) {
  const { error } = await db.from("academia_enrolments").delete().eq("academia_id", academiaId);
  if (error) throw error;
}
