/**
 * Automatic system notifications.
 *
 * The platform speaks for itself when something important happens: a new
 * assignment, a changed date, new course access, an answered question, a class
 * update. These are server-only and never accept responses — there is nobody
 * to answer.
 */
import type { NotificationCategory } from "./audience";
import { createNotification } from "./notifications.server";
import type { NotificationContext } from "./types";

export type SystemEvent =
  | "assignment_new"
  | "assignment_updated"
  | "course_access"
  | "question_answered"
  | "class_updated";

type Db = { from: (table: string) => any };

const adminDb = async (): Promise<Db> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
};

const TEMPLATE: Record<
  SystemEvent,
  { category: NotificationCategory; subject: string; body: (ctx: NotificationContext) => string }
> = {
  assignment_new: {
    category: "assignment",
    subject: "New assignment",
    body: (c) =>
      `Your teacher has assigned you ${c.assignmentTitle ? `“${c.assignmentTitle}”` : "a new assignment"}.`,
  },
  assignment_updated: {
    category: "assignment",
    subject: "Assignment updated",
    body: (c) =>
      `The completion date for ${c.assignmentTitle ? `“${c.assignmentTitle}”` : "your assignment"} has changed.`,
  },
  course_access: {
    category: "course",
    subject: "New course",
    body: (c) =>
      `You have been given access to ${c.courseName ? `“${c.courseName}”` : "a new course"}.`,
  },
  question_answered: {
    category: "class",
    subject: "Question answered",
    body: () => "Your teacher has responded to your question.",
  },
  class_updated: {
    category: "class",
    subject: "Class update",
    body: (c) => `${c.className ? `“${c.className}”` : "Your class"} has been updated.`,
  },
};

/** Every student on a class roster. */
export const studentsInClass = async (classId: string): Promise<string[]> => {
  const db = await adminDb();
  const { data } = await db.from("class_members").select("user_id").eq("class_id", classId);
  return [
    ...new Set(
      ((data ?? []) as { user_id: string | null }[])
        .map((r) => r.user_id)
        .filter((v): v is string => !!v),
    ),
  ];
};

/**
 * Send one system notification. Recipients may be given directly or resolved
 * from the class in the context. Never throws into the calling feature: a
 * notification failure must not break an assignment or a course.
 */
export const notifySystemEvent = async (input: {
  event: SystemEvent;
  recipients?: string[];
  context?: NotificationContext;
  targetPath?: string | null;
  bodyOverride?: string;
}): Promise<{ id: string; recipients: number } | null> => {
  try {
    const ctx = input.context ?? {};
    const recipients = input.recipients?.length
      ? input.recipients
      : ctx.classId
        ? await studentsInClass(ctx.classId)
        : [];
    if (recipients.length === 0) return null;
    const template = TEMPLATE[input.event];
    return await createNotification({
      kind: "system",
      senderUserId: null,
      senderRole: "system",
      subject: template.subject,
      body: input.bodyOverride ?? template.body(ctx),
      context: ctx,
      targetPath: input.targetPath ?? null,
      recipients,
      category: template.category,
      allowResponses: false,
    });
  } catch {
    return null;
  }
};
