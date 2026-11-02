import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  classifyMedia,
  type HistoryAction,
  type IssueStatus,
  type MediaRole,
} from "./model";

const nullableText = z.string().nullable();
const nullableNumber = z
  .union([z.number(), z.string(), z.null()])
  .transform((value) => (value == null || value === "" ? null : Number(value)))
  .refine(
    (value): value is number | null => value == null || Number.isFinite(value),
  );

const mediaSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["issue", "completion"]),
  kind: z.enum(["link", "image", "video", "audio", "file"]),
  label: nullableText,
  url: nullableText,
  mime: nullableText,
  byteSize: nullableNumber,
  createdByName: z.string(),
  createdAt: z.string(),
});

const historySchema = z.object({
  id: z.string().uuid(),
  action: z.enum([
    "created",
    "in_progress",
    "completed",
    "reopened",
    "deleted",
  ]),
  fromStatus: z.string().nullable(),
  toStatus: z.string(),
  actorName: z.string(),
  createdAt: z.string(),
});

const issueSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  status: z.enum(["not_started", "in_progress", "completed"]),
  createdByName: z.string(),
  workerName: nullableText,
  workerAt: nullableText,
  completerName: nullableText,
  completedAt: nullableText,
  createdAt: z.string(),
  updatedAt: z.string(),
  media: z.array(mediaSchema),
  history: z.array(historySchema),
});

const boardSchema = z.object({
  schoolName: z.string(),
  canManage: z.boolean(),
  orgId: z.string().uuid().nullable(),
  issues: z.array(issueSchema),
});

export type QuickIssueMedia = z.infer<typeof mediaSchema>;
export type QuickIssueEvent = z.infer<typeof historySchema> & {
  action: HistoryAction;
  toStatus: IssueStatus;
};
export type QuickIssue = z.infer<typeof issueSchema>;
export type QuickIssueBoard = z.infer<typeof boardSchema>;

function unwrap<T>(result: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function fetchQuickIssues(
  token: string,
): Promise<QuickIssueBoard> {
  const data = unwrap(
    await supabase.rpc("quick_issue_list", { _token: token.toLowerCase() }),
  );
  const parsed = boardSchema.safeParse(data);
  if (!parsed.success) throw new Error("The tracker could not be read.");
  return parsed.data;
}

export async function ensureQuickIssueLink(orgId: string): Promise<string> {
  const data = unwrap(
    await supabase.rpc("quick_issue_ensure", { _org: orgId }),
  );
  const parsed = z.object({ token: z.string() }).safeParse(data);
  if (!parsed.success) throw new Error("The school link could not be opened.");
  return parsed.data.token;
}

export async function regenerateQuickIssueLink(orgId: string): Promise<string> {
  const token = unwrap(
    await supabase.rpc("quick_issue_regenerate", { _org: orgId }),
  );
  if (!token) throw new Error("The school link could not be replaced.");
  return token;
}

export async function createQuickIssue(
  token: string,
  name: string,
  description: string,
  actor: string,
): Promise<string> {
  const id = unwrap(
    await supabase.rpc("quick_issue_create", {
      _token: token.toLowerCase(),
      _name: name,
      _description: description,
      _actor: actor,
    }),
  );
  if (!id) throw new Error("The issue was not saved.");
  return id;
}

export async function setQuickIssueStatus(
  token: string,
  issueId: string,
  status: "in_progress" | "completed",
  actor: string,
): Promise<void> {
  unwrap(
    await supabase.rpc("quick_issue_set_status", {
      _token: token.toLowerCase(),
      _issue: issueId,
      _status: status,
      _actor: actor,
    }),
  );
}

export async function addQuickIssueLink(
  token: string,
  issueId: string,
  url: string,
  role: MediaRole,
  actor: string,
  label: string,
): Promise<void> {
  unwrap(
    await supabase.rpc("quick_issue_add_link", {
      _token: token.toLowerCase(),
      _issue: issueId,
      _url: url,
      _role: role,
      _actor: actor,
      _label: label,
    }),
  );
}

export async function deleteQuickIssue(issueId: string): Promise<void> {
  unwrap(await supabase.rpc("quick_issue_delete", { _issue: issueId }));
}

export async function reopenQuickIssue(
  issueId: string,
  status: "in_progress" | "not_started",
): Promise<void> {
  unwrap(
    await supabase.rpc("quick_issue_reopen", {
      _issue: issueId,
      _status: status,
    }),
  );
}

const BUCKET = "quick-issue-media";

export async function uploadQuickIssueFile(
  token: string,
  issueId: string,
  file: File,
  role: MediaRole,
  actor: string,
): Promise<void> {
  const prepared = unwrap(
    await supabase.rpc("quick_issue_prepare_upload", {
      _token: token.toLowerCase(),
      _issue: issueId,
      _role: role,
      _actor: actor,
      _file_name: file.name || "file",
      _mime: file.type || "application/octet-stream",
      _bytes: file.size,
    }),
  );
  const path = z.object({ path: z.string().min(1) }).parse(prepared).path;
  const uploaded = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploaded.error) throw new Error(uploaded.error.message);
  const kind = classifyMedia(file.type || "", file.name || "");
  unwrap(
    await supabase.rpc("quick_issue_commit_upload", {
      _token: token.toLowerCase(),
      _issue: issueId,
      _role: role,
      _actor: actor,
      _kind: kind,
      _label: file.name || "",
      _path: path,
      _mime: file.type || "",
      _bytes: file.size,
    }),
  );
}

const objectUrls = new Map<string, string>();

/** Playback address for a stored attachment. Signed URL when the bucket allows it, otherwise a local blob. */
export async function quickIssueFileUrl(
  token: string,
  mediaId: string,
): Promise<string> {
  const cached = objectUrls.get(mediaId);
  if (cached) return cached;
  const located = unwrap(
    await supabase.rpc("quick_issue_media_location", {
      _token: token.toLowerCase(),
      _media: mediaId,
    }),
  );
  const path = z.object({ path: z.string().min(1) }).parse(located).path;
  const signed = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (signed.data?.signedUrl) return signed.data.signedUrl;
  const downloaded = await supabase.storage.from(BUCKET).download(path);
  if (downloaded.error || !downloaded.data)
    throw new Error(downloaded.error?.message ?? "Attachment not found.");
  const url = URL.createObjectURL(downloaded.data);
  objectUrls.set(mediaId, url);
  return url;
}
