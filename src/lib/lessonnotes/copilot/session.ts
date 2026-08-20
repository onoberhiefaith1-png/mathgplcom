// MathGPL Co-Pilot — the PERSISTENT lesson conversation.
//
// One lesson note = one Co-Pilot session. The conversation, the lesson state,
// the blueprint and the per-item build progress all live in the database, so
// closing the panel, refreshing, navigating away or signing back in resumes
// exactly where the teacher left off. Nothing here is browser-only.

import { supabase } from "@/integrations/supabase/client";
import type { CoPilotMessage } from "./actions";
import type { BuildItem, CoPilotAnalysis, CoPilotStage, StructureCounts } from "./procedure";

export interface CoPilotSessionState {
  id: string;
  notebookId: string;
  topic: string;
  subtopic: string;
  cycle: number;
  structure: StructureCounts;
  analysis: CoPilotAnalysis | null;
  queue: BuildItem[];
  stage: CoPilotStage;
  currentItem: string | null;
  /** False for a brand-new session: the greeting only fires then. */
  existing: boolean;
}

export interface StoredMessage extends CoPilotMessage {
  /** Which subtopic cycle this message belongs to. */
  cycle: number;
}

const TABLE_SESSIONS = "notebook_copilot_sessions";
const TABLE_MESSAGES = "notebook_copilot_messages";

const asCounts = (v: unknown): StructureCounts =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as StructureCounts) : {};

const asQueue = (v: unknown): BuildItem[] => (Array.isArray(v) ? (v as BuildItem[]) : []);

/** Load the note's conversation, creating it the first time only. */
export async function loadOrCreateSession(notebookId: string): Promise<CoPilotSessionState | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  const existing = await supabase
    .from(TABLE_SESSIONS as never)
    .select("*")
    .eq("notebook_id", notebookId)
    .maybeSingle();

  const row = (existing.data ?? null) as any;
  if (row) {
    return {
      id: row.id,
      notebookId,
      topic: row.topic ?? "",
      subtopic: row.subtopic ?? "",
      cycle: Number(row.cycle ?? 1),
      structure: asCounts(row.structure),
      analysis: (row.analysis ?? null) as CoPilotAnalysis | null,
      queue: asQueue(row.queue),
      stage: (row.stage ?? "greeting") as CoPilotStage,
      currentItem: row.current_item ?? null,
      existing: true,
    };
  }

  const created = await supabase
    .from(TABLE_SESSIONS as never)
    .insert({ notebook_id: notebookId, user_id: userId } as never)
    .select("*")
    .single();

  const fresh = (created.data ?? null) as any;
  if (!fresh) return null;
  return {
    id: fresh.id,
    notebookId,
    topic: "",
    subtopic: "",
    cycle: 1,
    structure: {},
    analysis: null,
    queue: [],
    stage: "greeting",
    currentItem: null,
    existing: false,
  };
}

/** Persist any part of the durable lesson state. Fire-and-forget by design. */
export async function patchSession(
  sessionId: string,
  patch: Partial<{
    topic: string;
    subtopic: string;
    cycle: number;
    structure: StructureCounts;
    analysis: CoPilotAnalysis | null;
    queue: BuildItem[];
    stage: CoPilotStage;
    currentItem: string | null;
  }>,
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.topic !== undefined) body["topic"] = patch.topic;
  if (patch.subtopic !== undefined) body["subtopic"] = patch.subtopic;
  if (patch.cycle !== undefined) body["cycle"] = patch.cycle;
  if (patch.structure !== undefined) body["structure"] = patch.structure;
  if (patch.analysis !== undefined) body["analysis"] = patch.analysis;
  if (patch.queue !== undefined) body["queue"] = patch.queue;
  if (patch.stage !== undefined) body["stage"] = patch.stage;
  if (patch.currentItem !== undefined) body["current_item"] = patch.currentItem;
  if (!Object.keys(body).length) return;
  await supabase.from(TABLE_SESSIONS as never).update(body as never).eq("id", sessionId);
}

/** The whole conversation, oldest first — this is the lesson's discourse. */
export async function loadMessages(sessionId: string): Promise<StoredMessage[]> {
  const { data } = await supabase
    .from(TABLE_MESSAGES as never)
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    role: r.role === "teacher" ? "teacher" : "copilot",
    text: r.text ?? "",
    cycle: Number(r.cycle ?? 1),
    ...((r.payload ?? {}) as Record<string, unknown>),
  })) as StoredMessage[];
}

/** Append one message. Returns the stored row id so later patches find it. */
export async function appendMessage(
  sessionId: string,
  msg: { role: "teacher" | "copilot"; text: string; cycle: number; payload?: Record<string, unknown> },
): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;
  const { data } = await supabase
    .from(TABLE_MESSAGES as never)
    .insert({
      session_id: sessionId,
      user_id: userId,
      role: msg.role,
      text: msg.text,
      cycle: msg.cycle,
      payload: msg.payload ?? null,
    } as never)
    .select("id")
    .single();
  return (data as any)?.id ?? null;
}

/** Keep a stored message in step with the live one (proposal run progress). */
export async function updateMessage(
  messageId: string,
  next: { text?: string; payload?: Record<string, unknown> },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (next.text !== undefined) body["text"] = next.text;
  if (next.payload !== undefined) body["payload"] = next.payload;
  if (!Object.keys(body).length) return;
  await supabase.from(TABLE_MESSAGES as never).update(body as never).eq("id", messageId);
}

/** Human summary of where the lesson stands — used to resume the conversation. */
export function resumeSummary(s: CoPilotSessionState): string {
  const label = s.subtopic || s.topic;
  const done = s.queue.filter((q) => q.state === "done");
  const pending = s.queue.filter((q) => q.state !== "done");
  const head = label
    ? `Welcome back — we're continuing ${label}.`
    : "Welcome back — we're continuing this lesson.";

  if (!s.queue.length) {
    return `${head} We hadn't settled the lesson structure yet, so set the numbers below and I'll plan it.`;
  }
  if (!done.length) {
    return `${head} The plan is ready and nothing has been written into the note yet — approve it and I'll build ${s.queue.length} items.`;
  }
  if (!pending.length) {
    return `${head} All ${done.length} items are built. Tell me what you'd like changed — name the item, for example "change Example 2".`;
  }
  return `${head} Built so far: ${done.map((q) => q.label).join(", ")}. Still to do: ${pending
    .map((q) => q.label)
    .join(", ")}. Say "carry on" and I'll continue from ${pending[0].label}.`;
}
