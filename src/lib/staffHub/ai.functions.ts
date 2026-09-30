import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AiReport = {
  verdict: string;
  delivery: string;
  timeliness: string;
  quality: string;
  strengths: string[];
  concerns: string[];
  next_steps: string[];
  not_recorded: string[];
  citations: string[];
};

const RULES = [
  "You are an impartial school operations reviewer. You assess a teacher's delivery of assigned staff tasks.",
  "Use ONLY the records given. Never invent facts, numbers, files or events. If something was not recorded, list it under not_recorded.",
  "Every strength and concern must cite record ids in square brackets, e.g. [task:3f2a] or [event:91c0].",
  "Be professional, fair and specific. The human manager makes the final decision; you only advise.",
  'Reply with strict JSON only: {"verdict":"one sentence","delivery":"...","timeliness":"...","quality":"...","strengths":["..."],"concerns":["..."],"next_steps":["..."],"not_recorded":["..."],"citations":["task:..."]}.',
  "Keep the whole reply under 350 words.",
].join(" ");

const short = (id: string) => id.slice(0, 8);

async function ensureManager(supabase: any, orgId: string) {
  const { data } = await supabase.rpc("staff_is_manager", { _org: orgId });
  if (!data) throw new Error("Only the school owner or a manager can run an AI review.");
}

async function run(input: string) {
  const { gatewayText, extractJson } = await import("@/lib/ai/gateway.server");
  const raw = await gatewayText(RULES, input);
  const r = extractJson<Partial<AiReport>>(raw);
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).slice(0, 8) : []);
  return {
    verdict: String(r.verdict ?? ""), delivery: String(r.delivery ?? ""), timeliness: String(r.timeliness ?? ""),
    quality: String(r.quality ?? ""), strengths: arr(r.strengths), concerns: arr(r.concerns),
    next_steps: arr(r.next_steps), not_recorded: arr(r.not_recorded), citations: arr(r.citations),
  } satisfies AiReport;
}

async function taskRecords(supabase: any, taskIds: string[], userId: string | null) {
  const { data: tasks } = await supabase.from("staff_tasks").select("*, staff_task_assignees(*)").in("id", taskIds);
  const out: unknown[] = [];
  for (const t of tasks ?? []) {
    const assignees = (t.staff_task_assignees ?? []).filter((a: any) => !userId || a.user_id === userId);
    const ids = assignees.map((a: any) => a.id);
    const [subs, ext, com, ev, evidence] = await Promise.all([
      ids.length ? supabase.from("staff_task_submissions").select("id, assignee_id, note, links, files, decision, review_note, created_at, reviewed_at").in("assignee_id", ids) : { data: [] },
      ids.length ? supabase.from("staff_extension_requests").select("id, assignee_id, reason, status, created_at").in("assignee_id", ids) : { data: [] },
      supabase.from("staff_task_comments").select("id, author_id, body, created_at").eq("task_id", t.id).limit(20),
      supabase.from("staff_work_events").select("id, kind, subject_user_id, created_at").eq("task_id", t.id).limit(40),
      supabase.rpc("staff_task_evidence", { _task: t.id }),
    ]);
    out.push({
      id: `task:${short(t.id)}`, title: t.title, brief: t.instructions, priority: t.priority, deadline: t.deadline,
      deadline_kind: t.deadline_kind, estimated_hours: t.estimated_hours, evidence_required: t.evidence_required,
      linked_item: t.link_kind ? { kind: t.link_kind, label: t.link_label } : null,
      assignees: assignees.map((a: any) => ({ id: `assignee:${short(a.id)}`, status: a.status, deadline: a.deadline, started_at: a.started_at, submitted_at: a.submitted_at, completed_at: a.completed_at, review_rounds: a.review_rounds })),
      submissions: (subs.data ?? []).map((s: any) => ({ id: `proof:${short(s.id)}`, note: s.note, links: s.links, files: (s.files ?? []).map((f: any) => f.name), decision: s.decision, review_note: s.review_note, at: s.created_at })),
      extension_requests: (ext.data ?? []).map((e: any) => ({ id: `ext:${short(e.id)}`, reason: e.reason, status: e.status, at: e.created_at })),
      comments: (com.data ?? []).map((c: any) => ({ id: `comment:${short(c.id)}`, body: String(c.body).slice(0, 400), at: c.created_at })),
      events: (ev.data ?? []).map((e: any) => ({ id: `event:${short(e.id)}`, kind: e.kind, at: e.created_at })),
      mathgpl_evidence: evidence.data ?? [],
    });
  }
  return out;
}

export const staffAiReviewTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ taskId: z.string().uuid(), userId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: t } = await sb.from("staff_tasks").select("org_id").eq("id", data.taskId).maybeSingle();
    if (!t) throw new Error("Task not found.");
    await ensureManager(sb, t.org_id);
    const records = await taskRecords(sb, [data.taskId], data.userId);
    const report = await run(`Review this task delivery. Now: ${new Date().toISOString()}.\nRECORDS:\n${JSON.stringify(records)}`);
    const { data: saved, error } = await sb.from("staff_ai_reports").insert({
      org_id: t.org_id, task_id: data.taskId, subject_user_id: data.userId, kind: "task", content: report,
    }).select("id, created_at").single();
    if (error) throw new Error(error.message);
    return { ...saved, report };
  });

export const staffAiTeacherReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orgId: z.string().uuid(), userId: z.string().uuid().nullable(), days: z.number().int().min(1).max(366) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await ensureManager(sb, data.orgId);
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    let q = sb.from("staff_task_assignees").select("task_id").eq("org_id", data.orgId).gte("created_at", since).limit(40);
    if (data.userId) q = q.eq("user_id", data.userId);
    const { data: rows } = await q;
    const ids = [...new Set((rows ?? []).map((r: any) => r.task_id as string))];
    const records = ids.length ? await taskRecords(sb, ids, data.userId) : [];
    const scope = data.userId ? "this teacher's performance" : "the whole team's week (who completed, who is late, who is at risk or overloaded)";
    const report = await run(`Assess ${scope} over the last ${data.days} days. Now: ${new Date().toISOString()}. Tasks in period: ${records.length}.\nRECORDS:\n${JSON.stringify(records)}`);
    const { data: saved, error } = await sb.from("staff_ai_reports").insert({
      org_id: data.orgId, subject_user_id: data.userId, kind: data.userId ? "teacher" : "team", period_days: data.days, content: report,
    }).select("id, created_at").single();
    if (error) throw new Error(error.message);
    return { ...saved, report };
  });
