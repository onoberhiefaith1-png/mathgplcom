/** Pure Quick Issue Tracker rules. The database enforces the same limits. */

export const ISSUE_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const STATUS_LABEL: Record<IssueStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

export const MAX_ISSUE_NAME = 140;
export const MAX_DESCRIPTION = 8000;
export const MAX_ACTOR_NAME = 80;
export const MAX_LINK_LENGTH = 2000;
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "dll",
  "scr",
  "ps1",
]);

export type MediaKind = "link" | "image" | "video" | "audio" | "file";
export type MediaRole = "issue" | "completion";

export function isIssueStatus(value: string): value is IssueStatus {
  return (ISSUE_STATUSES as readonly string[]).includes(value);
}

/** Link holders may move an open issue to In Progress or Completed. */
export function participantCanSet(
  current: IssueStatus,
  next: IssueStatus,
): boolean {
  if (next !== "in_progress" && next !== "completed") return false;
  return current !== "completed";
}

/** Owner and manager only. The issue row stays; status leaves Completed. */
export function managerCanReopen(
  current: IssueStatus,
  next: IssueStatus,
): boolean {
  return (
    current === "completed" &&
    (next === "in_progress" || next === "not_started")
  );
}

export function cleanActorName(value: string): string | null {
  const name = value.trim();
  if (name.length < 1 || name.length > MAX_ACTOR_NAME) return null;
  return name;
}

export function cleanIssueName(value: string): string | null {
  const name = value.trim();
  if (name.length < 1 || name.length > MAX_ISSUE_NAME) return null;
  return name;
}

export function cleanDescription(value: string): string | null {
  const text = value.trim();
  if (text.length > MAX_DESCRIPTION) return null;
  return text;
}

/** http(s) links only. Returns the canonical URL, or null when it is not usable. */
export function parseIssueLink(raw: string): string | null {
  const value = raw.trim();
  if (value.length < 8 || value.length > MAX_LINK_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.toString();
}

export function fileExtension(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function mediaRejection(file: {
  name: string;
  size: number;
}): string | null {
  if (file.size <= 0) return "That file is empty.";
  if (file.size > MAX_MEDIA_BYTES) return "Files must be 50 MB or smaller.";
  if (BLOCKED_EXTENSIONS.has(fileExtension(file.name)))
    return "That file type can't be attached.";
  return null;
}

export function classifyMedia(
  mime: string,
  name: string,
): Exclude<MediaKind, "link"> {
  const type = mime.toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  const ext = fileExtension(name);
  if (["png", "jpg", "jpeg", "gif", "webp", "heic", "bmp"].includes(ext))
    return "image";
  if (["mp4", "mov", "mkv", "m4v"].includes(ext)) return "video";
  if (["mp3", "wav", "m4a", "aac", "ogg", "oga"].includes(ext)) return "audio";
  if (ext === "webm") return type.startsWith("audio/") ? "audio" : "video";
  return "file";
}

export type HistoryAction =
  "created" | "in_progress" | "completed" | "reopened" | "deleted";

export function historyLine(
  action: HistoryAction,
  actorName: string,
  toStatus: IssueStatus,
): string {
  if (action === "created") return `${actorName} reported this`;
  if (action === "in_progress") return `${actorName} set In Progress`;
  if (action === "completed") return `${actorName} set Completed`;
  if (action === "reopened")
    return `${actorName} reopened this to ${STATUS_LABEL[toStatus]}`;
  return `${actorName} removed this from the list`;
}

/** Resume the remembered issue when it is still in the list. Never the first row. */
export function issueToResume(
  issueIds: readonly string[],
  remembered: string | null,
): string | null {
  if (!remembered) return null;
  return issueIds.includes(remembered) ? remembered : null;
}

/** Collapsed rows expose only these two fields. */
export function collapsedRow(issue: { name: string; status: IssueStatus }): {
  name: string;
  status: IssueStatus;
} {
  return { name: issue.name, status: issue.status };
}

export function quickIssuePath(token: string): string {
  return `/issues/${token.toLowerCase()}`;
}

export function quickIssueShareUrl(token: string, origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${quickIssuePath(token)}`;
}

export function isSchoolToken(token: string): boolean {
  return /^[0-9a-f]{64}$/i.test(token);
}

export function mediaKindLabel(kind: MediaKind): string {
  if (kind === "link") return "Link";
  if (kind === "image") return "Image";
  if (kind === "video") return "Video";
  if (kind === "audio") return "Voice or audio";
  return "File";
}
