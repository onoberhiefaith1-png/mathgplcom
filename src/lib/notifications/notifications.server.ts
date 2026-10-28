/**
 * Server-only notification engine.
 *
 * Audience expansion runs against the structures the platform already owns —
 * organizations, account_memberships, classes/class_members and connections —
 * so a sender can only ever reach people they are genuinely related to.
 */
import type { AppRole } from "@/lib/accounts/roles";
import {
  applyAudienceEdits,
  canUseAudience,
  canFilterByRegion,
  type AudienceRequest,
  type NotificationCategory,
  type NotificationKind,
} from "./audience";
import type { AudiencePerson, NotificationAttachment, NotificationContext } from "./types";

/* The notification tables are newer than the generated database types, so the
   admin client is used untyped for them only. */
type Db = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

const adminDb = async (): Promise<Db> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
};

const ids = (rows: unknown, key: string): string[] =>
  ((rows ?? []) as Record<string, string | null>[])
    .map((r) => r[key])
    .filter((v): v is string => !!v);

const unique = (values: string[]): string[] => [...new Set(values)];

/** Users holding a given role. */
const usersWithRole = async (db: Db, role: AppRole): Promise<string[]> => {
  const { data } = await db.from("user_roles").select("user_id").eq("role", role);
  return ids(data, "user_id");
};

/** Restrict a set of users to a region (profiles.country). */
const withinRegion = async (db: Db, userIds: string[], region: string): Promise<string[]> => {
  if (userIds.length === 0) return [];
  const { data } = await db
    .from("profiles")
    .select("user_id")
    .in("user_id", userIds)
    .eq("country", region);
  return ids(data, "user_id");
};

/** Users belonging to the given organizations with an active membership. */
const membersOfOrgs = async (db: Db, orgIds: string[], role?: AppRole): Promise<string[]> => {
  if (orgIds.length === 0) return [];
  let query = db
    .from("account_memberships")
    .select("user_id, role, status")
    .in("org_id", orgIds)
    .eq("status", "active");
  if (role) query = query.eq("role", role);
  const { data } = await query;
  return ids(data, "user_id");
};

/** Owners of the given organizations — the "school account" itself. */
const ownersOfOrgs = async (db: Db, orgIds: string[]): Promise<string[]> => {
  if (orgIds.length === 0) return [];
  const { data } = await db.from("organizations").select("owner_user_id").in("id", orgIds);
  return ids(data, "owner_user_id");
};

/** Accepted connection counterparts of a user for the given relations. */
const connectedUsers = async (
  db: Db,
  userId: string,
  relations: string[],
): Promise<string[]> => {
  const { data } = await db
    .from("connections")
    .select("from_user_id, to_user_id, relation, status")
    .eq("status", "accepted")
    .in("relation", relations)
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
  const rows = (data ?? []) as { from_user_id: string; to_user_id: string }[];
  return unique(
    rows.map((r) => (r.from_user_id === userId ? r.to_user_id : r.from_user_id)).filter((v) => v !== userId),
  );
};

/** Students in every class owned by a teacher. */
const studentsOfTeacher = async (db: Db, teacherId: string): Promise<string[]> => {
  const { data: classes } = await db.from("classes").select("id").eq("owner_id", teacherId);
  const classIds = ids(classes, "id");
  const rostered = await studentsOfClasses(db, classIds);
  const connected = await connectedUsers(db, teacherId, ["teacher_student"]);
  return unique([...rostered, ...connected]);
};

const studentsOfClasses = async (db: Db, classIds: string[]): Promise<string[]> => {
  if (classIds.length === 0) return [];
  const { data } = await db.from("class_members").select("user_id").in("class_id", classIds);
  return ids(data, "user_id");
};

/** Classes inside the organizations a school owns, optionally narrowed. */
const schoolClassIds = async (db: Db, orgIds: string[], requested: string[]): Promise<string[]> => {
  if (orgIds.length === 0) return [];
  const { data } = await db.from("classes").select("id").in("org_id", orgIds);
  const owned = ids(data, "id");
  return requested.length ? owned.filter((id) => requested.includes(id)) : owned;
};

/** Classes a teacher owns, optionally narrowed to the selected ones. */
const teacherClassIds = async (db: Db, teacherId: string, requested: string[]): Promise<string[]> => {
  const { data } = await db.from("classes").select("id").eq("owner_id", teacherId);
  const owned = ids(data, "id");
  return requested.length ? owned.filter((id) => requested.includes(id)) : owned;
};

/** Classes a sender may target, with roster sizes, for the composer. */
export const audienceClasses = async (
  role: AppRole,
  userId: string,
): Promise<{ id: string; name: string; members: number }[]> => {
  const db = await adminDb();
  let rows: { id: string; name: string | null }[] = [];
  if (role === "teacher") {
    const { data } = await db.from("classes").select("id, name").eq("owner_id", userId).order("name");
    rows = (data ?? []) as { id: string; name: string | null }[];
  } else if (role === "school") {
    const orgs = await ownedOrgIds(userId);
    if (orgs.length === 0) return [];
    const { data } = await db.from("classes").select("id, name").in("org_id", orgs).order("name");
    rows = (data ?? []) as { id: string; name: string | null }[];
  } else {
    return [];
  }
  const classIds = rows.map((r) => r.id);
  const counts = new Map<string, number>();
  if (classIds.length) {
    const { data } = await db.from("class_members").select("class_id").in("class_id", classIds);
    for (const m of (data ?? []) as { class_id: string }[]) {
      counts.set(m.class_id, (counts.get(m.class_id) ?? 0) + 1);
    }
  }
  return rows.map((r) => ({ id: r.id, name: r.name ?? "Class", members: counts.get(r.id) ?? 0 }));
};

/** Organizations a school account owns. */
export const ownedOrgIds = async (userId: string): Promise<string[]> => {
  const db = await adminDb();
  const { data } = await db.from("organizations").select("id").eq("owner_user_id", userId);
  return ids(data, "id");
};

/**
 * Everyone a sender may reach for one audience preset, before add/remove edits.
 */
export const reachableAudience = async (
  role: AppRole,
  userId: string,
  request: AudienceRequest,
): Promise<string[]> => {
  if (!canUseAudience(role, request.kind)) {
    throw new Error("This account cannot send to that audience.");
  }
  const db = await adminDb();
  const isAdmin = role === "platform_owner" || role === "co_admin";
  const region = canFilterByRegion(role) ? (request.region ?? null) : null;
  const selectedOrgs = request.orgIds ?? [];

  let base: string[] = [];

  if (isAdmin) {
    if (request.kind === "everyone") {
      const { data } = await db.from("profiles").select("user_id");
      base = ids(data, "user_id");
    } else if (request.kind === "schools") {
      base = selectedOrgs.length
        ? await ownersOfOrgs(db, selectedOrgs)
        : await usersWithRole(db, "school");
    } else if (request.kind === "individuals") {
      base = [];
    } else {
      const roleForKind: AppRole =
        request.kind === "teachers" ? "teacher" : request.kind === "students" ? "student" : "parent";
      base = await usersWithRole(db, roleForKind);
      if (selectedOrgs.length) {
        const inOrgs = new Set(await membersOfOrgs(db, selectedOrgs, roleForKind));
        base = base.filter((id) => inOrgs.has(id));
      }
    }
  } else if (role === "school") {
    const orgs = await ownedOrgIds(userId);
    const scoped = selectedOrgs.length ? selectedOrgs.filter((id) => orgs.includes(id)) : orgs;
    if (request.kind === "teachers") {
      base = unique([
        ...(await membersOfOrgs(db, scoped, "teacher")),
        ...(await connectedUsers(db, userId, ["school_teacher"])),
      ]);
    } else if (request.kind === "students") {
      const { data: classes } = await db.from("classes").select("id").in("org_id", scoped.length ? scoped : ["00000000-0000-0000-0000-000000000000"]);
      base = unique([
        ...(await studentsOfClasses(db, ids(classes, "id"))),
        ...(await membersOfOrgs(db, scoped, "student")),
        ...(await connectedUsers(db, userId, ["school_student"])),
      ]);
    } else if (request.kind === "parents") {
      base = await connectedUsers(db, userId, ["parent_school"]);
    } else if (request.kind === "classes") {
      base = await studentsOfClasses(db, await schoolClassIds(db, scoped, request.classIds ?? []));
    } else {
      base = [];
    }
  } else if (role === "teacher") {
    if (request.kind === "students") base = await studentsOfTeacher(db, userId);
    else if (request.kind === "classes")
      base = await studentsOfClasses(db, await teacherClassIds(db, userId, request.classIds ?? []));
    else base = [];
  } else if (role === "parent") {
    if (request.kind === "schools") base = await connectedUsers(db, userId, ["parent_school"]);
    else if (request.kind === "teachers") base = await connectedUsers(db, userId, ["parent_teacher"]);
    else base = [];
  }

  if (region) base = await withinRegion(db, base, region);
  return unique(base);
};

/** The complete set of people a sender may address, for validating individuals. */
const everyoneReachable = async (role: AppRole, userId: string): Promise<Set<string>> => {
  const kinds =
    role === "platform_owner" || role === "co_admin"
      ? (["everyone"] as const)
      : role === "school"
        ? (["teachers", "students", "parents"] as const)
        : role === "teacher"
          ? (["students"] as const)
          : role === "parent"
            ? (["schools", "teachers"] as const)
            : ([] as const);
  const all: string[] = [];
  for (const kind of kinds) {
    all.push(...(await reachableAudience(role, userId, { kind })));
  }
  return new Set(all);
};

export const resolveRecipients = async (
  role: AppRole,
  userId: string,
  request: AudienceRequest,
): Promise<string[]> => {
  const base = await reachableAudience(role, userId, request);
  const include = request.includeUserIds ?? [];
  if (include.length) {
    const allowed = await everyoneReachable(role, userId);
    const rejected = include.filter((id) => !allowed.has(id));
    if (rejected.length) throw new Error("Some selected people are outside this account's reach.");
  }
  return applyAudienceEdits(base, include, request.excludeUserIds ?? [], userId);
};

/** People a sender can search through when picking individuals. */
export const audiencePeople = async (
  role: AppRole,
  userId: string,
  request: AudienceRequest,
): Promise<AudiencePerson[]> => {
  const userIds = await reachableAudience(role, userId, request);
  if (userIds.length === 0) return [];
  const db = await adminDb();
  const capped = userIds.slice(0, 1000);
  const { data: profiles } = await db
    .from("profiles")
    .select("user_id, display_name, full_name, username, country")
    .in("user_id", capped);
  const { data: roles } = await db.from("user_roles").select("user_id, role").in("user_id", capped);
  const roleByUser = new Map<string, string>();
  for (const r of (roles ?? []) as { user_id: string; role: string }[]) roleByUser.set(r.user_id, r.role);

  return ((profiles ?? []) as Record<string, string | null>[]).map((p) => ({
    userId: p["user_id"] as string,
    name: p["display_name"] || p["full_name"] || p["username"] || "MathGPL account",
    username: p["username"] ?? null,
    role: roleByUser.get(p["user_id"] as string) ?? null,
    region: p["country"] ?? null,
    orgName: null,
  }));
};

export type CreateNotification = {
  kind: NotificationKind;
  senderUserId: string | null;
  senderRole: string | null;
  subject?: string | null;
  body: string;
  context?: NotificationContext;
  targetPath?: string | null;
  recipients: string[];
  threadRootId?: string | null;
  parentId?: string | null;
  category?: NotificationCategory;
  attachment?: NotificationAttachment | null;
  allowResponses?: boolean;
  audience?: unknown;
};

/** Insert one message and fan it out to its recipients. */
export const createNotification = async (input: CreateNotification): Promise<{ id: string; recipients: number }> => {
  if (input.recipients.length === 0) throw new Error("No recipients for this notification.");
  const db = await adminDb();
  const { data, error } = await db
    .from("notifications")
    .insert({
      kind: input.kind,
      sender_user_id: input.senderUserId,
      sender_role: input.senderRole,
      subject: input.subject ?? null,
      body: input.body,
      context: input.context ?? {},
      target_path: input.targetPath ?? null,
      category: input.category ?? (input.kind === "system" ? "system" : "announcement"),
      attachment: input.attachment ?? null,
      allow_responses: input.allowResponses ?? true,
      audience: input.audience ?? null,
      recipient_count: unique(input.recipients).length,
      thread_root_id: input.threadRootId ?? null,
      parent_id: input.parentId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = (data as { id: string }).id;

  if (!input.threadRootId) {
    await db.from("notifications").update({ thread_root_id: id }).eq("id", id);
  }

  const rows = unique(input.recipients).map((recipient_user_id) => ({
    notification_id: id,
    recipient_user_id,
  }));
  const { error: fanError } = await db.from("notification_recipients").insert(rows);
  if (fanError) throw new Error(fanError.message);
  return { id, recipients: rows.length };
};

/** Which teacher owns the activity a student is working on. */
export const teacherForStudentContext = async (
  studentId: string,
  context: NotificationContext,
): Promise<string[]> => {
  const db = await adminDb();

  if (context.assignmentId) {
    const { data } = await db
      .from("learning_assignments")
      .select("created_by, class_id")
      .eq("id", context.assignmentId)
      .maybeSingle();
    const row = data as { created_by: string | null; class_id: string | null } | null;
    if (row?.created_by) return [row.created_by];
    if (row?.class_id) {
      const owner = await classOwner(db, row.class_id);
      if (owner) return [owner];
    }
  }

  if (context.classId) {
    const owner = await classOwner(db, context.classId);
    if (owner) return [owner];
  }

  // Fall back to the teacher(s) of every class the student belongs to.
  const { data: memberships } = await db
    .from("class_members")
    .select("class_id")
    .eq("user_id", studentId);
  const classIds = ids(memberships, "class_id");
  if (classIds.length) {
    const { data: classes } = await db.from("classes").select("owner_id").in("id", classIds);
    const owners = unique(ids(classes, "owner_id"));
    if (owners.length) return owners;
  }

  // Last resort: any teacher directly connected to this student.
  return await connectedUsers(db, studentId, ["teacher_student"]);
};

const classOwner = async (db: Db, classId: string): Promise<string | null> => {
  const { data } = await db.from("classes").select("owner_id").eq("id", classId).maybeSingle();
  return (data as { owner_id: string | null } | null)?.owner_id ?? null;
};

/** Display names for a set of users, used when rendering a thread. */
export const namesFor = async (userIds: string[]): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  const list = unique(userIds.filter(Boolean));
  if (list.length === 0) return out;
  const db = await adminDb();
  const { data } = await db
    .from("profiles")
    .select("user_id, display_name, full_name, username")
    .in("user_id", list);
  for (const p of (data ?? []) as Record<string, string | null>[]) {
    out.set(
      p["user_id"] as string,
      p["display_name"] || p["full_name"] || p["username"] || "MathGPL account",
    );
  }
  return out;
};

/**
 * A response always goes back to whoever wrote the message being answered.
 * That keeps a broadcast from turning into a group conversation: the reply is
 * addressed to one person, in the same thread.
 */
export const replyRecipients = async (
  messageId: string,
  replierUserId: string,
): Promise<string[]> => {
  const db = await adminDb();
  const { data } = await db
    .from("notifications")
    .select("sender_user_id, thread_root_id")
    .eq("id", messageId)
    .maybeSingle();
  const row = data as { sender_user_id: string | null; thread_root_id: string | null } | null;
  const direct = row?.sender_user_id ?? null;
  if (direct && direct !== replierUserId) return [direct];

  const rootId = row?.thread_root_id ?? messageId;
  if (rootId !== messageId) {
    const { data: root } = await db
      .from("notifications")
      .select("sender_user_id")
      .eq("id", rootId)
      .maybeSingle();
    const rootSender = (root as { sender_user_id: string | null } | null)?.sender_user_id ?? null;
    if (rootSender && rootSender !== replierUserId) return [rootSender];
  }

  // Automatic system notifications have no author to answer.
  return [];
};


/** True when the user sent, or was addressed by, any message in the thread. */
export const isThreadParticipant = async (
  threadRootId: string,
  userId: string,
): Promise<boolean> => {
  const db = await adminDb();
  const { data: messages } = await db
    .from("notifications")
    .select("id, sender_user_id")
    .or(`id.eq.${threadRootId},thread_root_id.eq.${threadRootId}`);
  const rows = (messages ?? []) as { id: string; sender_user_id: string | null }[];
  if (rows.some((r) => r.sender_user_id === userId)) return true;
  const messageIds = rows.map((r) => r.id);
  if (messageIds.length === 0) return false;
  const { data } = await db
    .from("notification_recipients")
    .select("id")
    .in("notification_id", messageIds)
    .eq("recipient_user_id", userId)
    .limit(1);
  return ((data ?? []) as unknown[]).length > 0;
};

/** Does this thread accept responses? Decided by its root notification. */
export const threadAllowsResponses = async (rootId: string): Promise<boolean> => {
  const db = await adminDb();
  const { data } = await db
    .from("notifications")
    .select("allow_responses, kind")
    .eq("id", rootId)
    .maybeSingle();
  const row = data as { allow_responses: boolean | null; kind: string } | null;
  if (!row) return false;
  return row.allow_responses !== false;
};

const AUDIENCE_TEXT: Record<string, string> = {
  everyone: "Everyone",
  schools: "Schools",
  teachers: "Teachers",
  students: "Students",
  parents: "Parents",
  classes: "Classes",
  individuals: "Selected people",
};

const audienceLabel = (audience: unknown, kind: string): string => {
  const a = (audience ?? {}) as { kind?: string; region?: string | null; classIds?: string[] };
  if (kind === "system") return "System";
  if (kind === "student_question") return "Teacher";
  if (kind === "response") return "Response";
  const base = AUDIENCE_TEXT[a.kind ?? ""] ?? "Selected people";
  if (a.region) return `${base} · ${a.region}`;
  if (a.classIds?.length) return `${base} · ${a.classIds.length} class${a.classIds.length === 1 ? "" : "es"}`;
  return base;
};

/** History of notifications a sender has sent, with engagement. Admins see all. */
export const sentNotifications = async (
  role: AppRole,
  userId: string,
  limit = 100,
): Promise<
  {
    id: string;
    category: string;
    subject: string | null;
    body: string;
    audienceLabel: string;
    createdAt: string;
    recipients: number;
    read: number;
    responded: number;
  }[]
> => {
  const db = await adminDb();
  const isAdmin = role === "platform_owner" || role === "co_admin";
  let query = db
    .from("notifications")
    .select("id, kind, category, subject, body, audience, created_at, recipient_count")
    .in("kind", ["broadcast", "system"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!isAdmin) query = query.eq("sender_user_id", userId);
  const { data } = await query;
  const rows = (data ?? []) as Record<string, any>[];
  if (rows.length === 0) return [];

  const { data: recipientRows } = await db
    .from("notification_recipients")
    .select("notification_id, read_at, responded_at")
    .in("notification_id", rows.map((r) => r["id"]));
  const tally = new Map<string, { total: number; read: number; responded: number }>();
  for (const r of (recipientRows ?? []) as {
    notification_id: string;
    read_at: string | null;
    responded_at: string | null;
  }[]) {
    const entry = tally.get(r.notification_id) ?? { total: 0, read: 0, responded: 0 };
    entry.total += 1;
    if (r.read_at) entry.read += 1;
    if (r.responded_at) entry.responded += 1;
    tally.set(r.notification_id, entry);
  }

  return rows.map((r) => {
    const counts = tally.get(r["id"]) ?? { total: r["recipient_count"] ?? 0, read: 0, responded: 0 };
    return {
      id: r["id"],
      category: r["category"] ?? "announcement",
      subject: r["subject"] ?? null,
      body: r["body"] ?? "",
      audienceLabel: audienceLabel(r["audience"], r["kind"]),
      createdAt: r["created_at"],
      recipients: counts.total,
      read: counts.read,
      responded: counts.responded,
    };
  });
};

/** Overview totals for the sending dashboard. */
export const sentStats = async (
  role: AppRole,
  userId: string,
): Promise<{ sent: number; delivered: number; read: number; unread: number; responded: number }> => {
  const history = await sentNotifications(role, userId, 500);
  const delivered = history.reduce((sum, n) => sum + n.recipients, 0);
  const read = history.reduce((sum, n) => sum + n.read, 0);
  const responded = history.reduce((sum, n) => sum + n.responded, 0);
  return { sent: history.length, delivered, read, unread: Math.max(delivered - read, 0), responded };
};

/** Engagement for one notification the caller sent. */
export const engagementFor = async (
  notificationId: string,
): Promise<{ recipients: number; read: number; responded: number }> => {
  const db = await adminDb();
  const { data } = await db
    .from("notification_recipients")
    .select("read_at, responded_at")
    .eq("notification_id", notificationId);
  const rows = (data ?? []) as { read_at: string | null; responded_at: string | null }[];
  return {
    recipients: rows.length,
    read: rows.filter((r) => !!r.read_at).length,
    responded: rows.filter((r) => !!r.responded_at).length,
  };
};
