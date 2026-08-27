/**
 * Who may send what.
 *
 * These are pure rules so they can be tested and so the same table drives the
 * composer UI and the server check. The UI never decides permission on its
 * own: `sendNotification` applies exactly these rules again on the server.
 */
import type { AppRole } from "@/lib/accounts/roles";

export type NotificationKind = "broadcast" | "system" | "student_question" | "response";

/** Audience presets a sender can choose from. */
export type AudienceKind =
  | "everyone"
  | "schools"
  | "teachers"
  | "students"
  | "parents"
  | "individuals";

export type AudienceRequest = {
  kind: AudienceKind;
  /** Selected schools (organization ids) used to narrow teachers/students/parents. */
  orgIds?: string[];
  /** Region filter (profiles.country). Administrator only. */
  region?: string | null;
  /** People added on top of the resolved audience. */
  includeUserIds?: string[];
  /** People removed from the resolved audience. */
  excludeUserIds?: string[];
};

export const AUDIENCE_LABEL: Record<AudienceKind, string> = {
  everyone: "Everyone",
  schools: "Schools",
  teachers: "Teachers",
  students: "Students",
  parents: "Parents",
  individuals: "Selected people",
};

/**
 * Audiences each role may address. A student has none: the only message a
 * student can start is an Ask a Question, which is a different action.
 */
export const SENDER_AUDIENCES: Record<AppRole, AudienceKind[]> = {
  platform_owner: ["everyone", "schools", "teachers", "students", "parents", "individuals"],
  co_admin: ["everyone", "schools", "teachers", "students", "parents", "individuals"],
  school: ["teachers", "students", "parents", "individuals"],
  teacher: ["students", "individuals"],
  parent: ["schools", "teachers", "individuals"],
  student: [],
};

/** Only the administrator may filter the whole platform by region. */
export const canFilterByRegion = (role: AppRole | null): boolean =>
  role === "platform_owner" || role === "co_admin";

export const canSendNotifications = (role: AppRole | null): boolean =>
  !!role && SENDER_AUDIENCES[role].length > 0;

export const canUseAudience = (role: AppRole | null, kind: AudienceKind): boolean =>
  !!role && SENDER_AUDIENCES[role].includes(kind);

/** Everyone who receives a message may reply to it, students included. */
export const canRespond = (): boolean => true;

export const canAskQuestion = (role: AppRole | null): boolean => role === "student";

/**
 * Apply the composer's add/remove list to a resolved audience, keeping the
 * result unique and free of the sender themselves.
 */
export const applyAudienceEdits = (
  base: string[],
  include: string[] = [],
  exclude: string[] = [],
  senderUserId?: string | null,
): string[] => {
  const removed = new Set(exclude);
  const out = new Set<string>();
  for (const id of [...base, ...include]) {
    if (!id || removed.has(id)) continue;
    if (senderUserId && id === senderUserId) continue;
    out.add(id);
  }
  return [...out];
};
