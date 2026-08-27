import type { NotificationKind } from "./audience";

export type NotificationContext = {
  orgId?: string | null;
  orgName?: string | null;
  classId?: string | null;
  className?: string | null;
  courseId?: string | null;
  courseName?: string | null;
  lessonId?: string | null;
  lessonName?: string | null;
  assignmentId?: string | null;
  assignmentTitle?: string | null;
  adventureId?: string | null;
  adventureTitle?: string | null;
  notebookId?: string | null;
  boardQuestionId?: string | null;
  workspace?: string | null;
  source?: string | null;
};

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  subject: string | null;
  body: string;
  context: NotificationContext;
  targetPath: string | null;
  threadRootId: string | null;
  parentId: string | null;
  createdAt: string;
  senderUserId: string | null;
  senderName: string;
  senderRole: string | null;
  /** Present when the signed-in person is a recipient of this message. */
  readAt?: string | null;
  /** True when the signed-in person sent it (thread view). */
  mine?: boolean;
};

export type NotificationThread = {
  root: NotificationItem;
  replies: NotificationItem[];
};

export type AudiencePerson = {
  userId: string;
  name: string;
  username: string | null;
  role: string | null;
  region: string | null;
  orgName: string | null;
};
