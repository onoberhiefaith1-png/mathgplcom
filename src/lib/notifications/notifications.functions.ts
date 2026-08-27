import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "@/lib/accounts/roles";
import { canAskQuestion, canSendNotifications } from "./audience";
import type { NotificationItem, NotificationThread } from "./types";

const ROLE_PRIORITY: AppRole[] = ["platform_owner", "co_admin", "school", "teacher", "parent", "student"];

type Db = { from: (table: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => any };

const roleOf = async (supabase: unknown, userId: string): Promise<AppRole | null> => {
  const db = supabase as Db;
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  const held = new Set(((data ?? []) as { role: string }[]).map((r) => r.role));
  return ROLE_PRIORITY.find((r) => held.has(r)) ?? null;
};

const audienceSchema = z.object({
  kind: z.enum(["everyone", "schools", "teachers", "students", "parents", "individuals"]),
  orgIds: z.array(z.string().uuid()).optional(),
  region: z.string().trim().max(80).nullable().optional(),
  includeUserIds: z.array(z.string().uuid()).optional(),
  excludeUserIds: z.array(z.string().uuid()).optional(),
});

const contextSchema = z
  .object({
    orgId: z.string().uuid().nullable().optional(),
    orgName: z.string().max(160).nullable().optional(),
    classId: z.string().uuid().nullable().optional(),
    className: z.string().max(160).nullable().optional(),
    courseId: z.string().uuid().nullable().optional(),
    courseName: z.string().max(160).nullable().optional(),
    lessonId: z.string().nullable().optional(),
    lessonName: z.string().max(200).nullable().optional(),
    assignmentId: z.string().uuid().nullable().optional(),
    assignmentTitle: z.string().max(200).nullable().optional(),
    adventureId: z.string().uuid().nullable().optional(),
    adventureTitle: z.string().max(200).nullable().optional(),
    notebookId: z.string().uuid().nullable().optional(),
    boardQuestionId: z.string().max(120).nullable().optional(),
    workspace: z.string().max(60).nullable().optional(),
    source: z.string().max(60).nullable().optional(),
  })
  .partial();

const toItem = (
  row: Record<string, any>,
  names: Map<string, string>,
  viewerId: string,
  readAt?: string | null,
): NotificationItem => ({
  id: row["id"],
  kind: row["kind"],
  subject: row["subject"] ?? null,
  body: row["body"] ?? "",
  context: (row["context"] ?? {}) as NotificationItem["context"],
  targetPath: row["target_path"] ?? null,
  threadRootId: row["thread_root_id"] ?? null,
  parentId: row["parent_id"] ?? null,
  createdAt: row["created_at"],
  senderUserId: row["sender_user_id"] ?? null,
  senderName: row["sender_user_id"] ? (names.get(row["sender_user_id"]) ?? "MathGPL") : "MathGPL",
  senderRole: row["sender_role"] ?? null,
  readAt: readAt ?? null,
  mine: row["sender_user_id"] === viewerId,
});

/** Everything addressed to the signed-in person, newest first. */
export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ tab: z.enum(["all", "unread", "questions", "announcements"]).default("all") })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { namesFor } = await import("./notifications.server");
    const db = context.supabase as unknown as Db;

    let query = db
      .from("notification_recipients")
      .select("read_at, notification:notifications(*)")
      .eq("recipient_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.tab === "unread") query = query.is("read_at", null);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    let list = ((rows ?? []) as { read_at: string | null; notification: Record<string, any> | null }[])
      .filter((r) => !!r.notification)
      .filter((r) => {
        const kind = r.notification!["kind"];
        if (data.tab === "questions") return kind === "student_question" || kind === "response";
        if (data.tab === "announcements") return kind === "broadcast" || kind === "system";
        return true;
      });

    const names = await namesFor(list.map((r) => r.notification!["sender_user_id"]).filter(Boolean));
    const items = list.map((r) => toItem(r.notification!, names, context.userId, r.read_at));
    const { data: count } = await db.rpc("unread_notification_count");
    return { items, unread: typeof count === "number" ? count : 0 };
  });

export const unreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Db;
    const { data } = await db.rpc("unread_notification_count");
    return { unread: typeof data === "number" ? data : 0 };
  });

/** One notification plus its responses. Marks the viewer's copy as read. */
export const fetchNotificationThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<NotificationThread> => {
    const { namesFor } = await import("./notifications.server");
    const db = context.supabase as unknown as Db;

    const { data: message, error } = await db
      .from("notifications")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!message) throw new Error("Notification not found.");

    const rootId = (message as Record<string, any>)["thread_root_id"] ?? data.id;
    const { data: rows } = await db
      .from("notifications")
      .select("*")
      .or(`id.eq.${rootId},thread_root_id.eq.${rootId}`)
      .order("created_at", { ascending: true });
    const messages = (rows ?? []) as Record<string, any>[];

    const { data: readRows } = await db
      .from("notification_recipients")
      .select("notification_id, read_at")
      .eq("recipient_user_id", context.userId)
      .in("notification_id", messages.map((m) => m["id"]));
    const readBy = new Map(
      ((readRows ?? []) as { notification_id: string; read_at: string | null }[]).map((r) => [
        r.notification_id,
        r.read_at,
      ]),
    );

    // Opening a thread marks the reader's own copies as read.
    const unread = [...readBy.entries()].filter(([, read]) => !read).map(([id]) => id);
    if (unread.length) {
      await db
        .from("notification_recipients")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_user_id", context.userId)
        .in("notification_id", unread);
    }

    const names = await namesFor(messages.map((m) => m["sender_user_id"]).filter(Boolean));
    const items = messages.map((m) => toItem(m, names, context.userId, readBy.get(m["id"]) ?? null));
    const root = items.find((i) => i.id === rootId) ?? items[0]!;
    return { root, replies: items.filter((i) => i.id !== root.id) };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).optional(), all: z.boolean().default(false) }).parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as Db;
    let query = db
      .from("notification_recipients")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_user_id", context.userId)
      .is("read_at", null);
    if (!data.all) query = query.in("notification_id", data.ids ?? []);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Audience size and people, used by the composer before sending. */
export const previewAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ audience: audienceSchema }).parse(data))
  .handler(async ({ context, data }) => {
    const role = await roleOf(context.supabase, context.userId);
    if (!canSendNotifications(role)) throw new Error("This account cannot send notifications.");
    const { audiencePeople, resolveRecipients } = await import("./notifications.server");
    const people = await audiencePeople(role!, context.userId, data.audience);
    const recipients = await resolveRecipients(role!, context.userId, data.audience);
    return { count: recipients.length, people };
  });

/** Schools an administrator can narrow an audience to. */
export const listSchoolsForAudience = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await roleOf(context.supabase, context.userId);
    if (role !== "platform_owner" && role !== "co_admin") return { schools: [] };
    const db = context.supabase as unknown as Db;
    const { data } = await db.from("organizations").select("id, name, country").order("name");
    return { schools: (data ?? []) as { id: string; name: string; country: string | null }[] };
  });

/** Send a notification. Permission is decided here, never by the UI. */
export const sendNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        audience: audienceSchema,
        subject: z.string().trim().min(1).max(160),
        body: z.string().trim().min(1).max(4000),
        targetPath: z.string().max(300).nullable().optional(),
        context: contextSchema.optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const role = await roleOf(context.supabase, context.userId);
    // A student can never start a notification, whatever the client sends.
    if (!canSendNotifications(role)) throw new Error("This account cannot send notifications.");
    const { createNotification, resolveRecipients } = await import("./notifications.server");
    const recipients = await resolveRecipients(role!, context.userId, data.audience);
    if (recipients.length === 0) throw new Error("That audience has nobody in it.");
    return createNotification({
      kind: "broadcast",
      senderUserId: context.userId,
      senderRole: role,
      subject: data.subject,
      body: data.body,
      context: data.context ?? {},
      targetPath: data.targetPath ?? null,
      recipients,
    });
  });

/** The only message a student can start: a question from their workspace. */
export const askQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        body: z.string().trim().min(3).max(2000),
        context: contextSchema.optional(),
        targetPath: z.string().max(300).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const role = await roleOf(context.supabase, context.userId);
    if (!canAskQuestion(role)) throw new Error("Only a student can ask a question this way.");
    const { createNotification, teacherForStudentContext } = await import("./notifications.server");
    const ctx = { ...(data.context ?? {}), source: "smartboard" };
    const teachers = await teacherForStudentContext(context.userId, ctx);
    if (teachers.length === 0) throw new Error("No teacher is connected to this activity yet.");
    const label =
      ctx.assignmentTitle || ctx.adventureTitle || ctx.lessonName || ctx.courseName || ctx.className || "their work";
    return createNotification({
      kind: "student_question",
      senderUserId: context.userId,
      senderRole: role,
      subject: `Student question about ${label}`,
      body: data.body,
      context: ctx,
      targetPath: data.targetPath ?? null,
      recipients: teachers,
    });
  });

/** Anyone who received a message may answer it — students included. */
export const respondToNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ messageId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const role = await roleOf(context.supabase, context.userId);
    const { createNotification, isThreadParticipant, replyRecipients } = await import(
      "./notifications.server"
    );
    const db = context.supabase as unknown as Db;
    const { data: message } = await db
      .from("notifications")
      .select("id, subject, context, target_path, thread_root_id")
      .eq("id", data.messageId)
      .maybeSingle();
    const row = message as Record<string, any> | null;
    if (!row) throw new Error("Notification not found.");

    const rootId = row["thread_root_id"] ?? row["id"];
    if (!(await isThreadParticipant(rootId, context.userId))) {
      throw new Error("This notification is not addressed to you.");
    }
    const recipients = await replyRecipients(data.messageId, context.userId);
    if (recipients.length === 0) throw new Error("This notification cannot be answered.");

    const result = await createNotification({
      kind: "response",
      senderUserId: context.userId,
      senderRole: role,
      subject: row["subject"] ?? null,
      body: data.body,
      context: row["context"] ?? {},
      targetPath: row["target_path"] ?? null,
      recipients,
      threadRootId: rootId,
      parentId: data.messageId,
    });

    await db
      .from("notification_recipients")
      .update({ responded_at: new Date().toISOString() })
      .eq("recipient_user_id", context.userId)
      .eq("notification_id", data.messageId);

    return result;
  });
