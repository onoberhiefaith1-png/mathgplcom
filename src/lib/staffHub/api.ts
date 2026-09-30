/**
 * Staff Hub reads and actions. Every write is a database action that checks
 * the caller (school owner, manager or the assigned teacher), records the
 * audit trail and sends the notification — the UI never decides permissions.
 */
import { supabase } from "@/integrations/supabase/client";

export type StaffMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  mathgplId: string | null;
  isManager: boolean;
};
export type TaskStatus = "assigned" | "in_progress" | "submitted" | "changes_requested" | "completed";
export type Priority = "low" | "medium" | "high" | "urgent";

function unwrap<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export async function fetchTeam(orgId: string): Promise<StaffMember[]> {
  const rows = unwrap(await supabase.rpc("staff_team", { _org: orgId })) ?? [];
  return rows.map((r) => ({
    userId: r.user_id,
    name: r.display_name,
    avatarUrl: r.avatar_url,
    mathgplId: r.mathgpl_id,
    isManager: r.is_manager,
  }));
}

export async function fetchIsManager(orgId: string): Promise<boolean> {
  return Boolean(unwrap(await supabase.rpc("staff_is_manager", { _org: orgId })));
}
export async function fetchIsAdmin(orgId: string): Promise<boolean> {
  return Boolean(unwrap(await supabase.rpc("staff_is_admin", { _org: orgId })));
}

export async function fetchTasks(orgId: string) {
  return unwrap(
    await supabase
      .from("staff_tasks")
      .select("*, staff_task_assignees(*)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
  ) ?? [];
}
export type TaskRow = Awaited<ReturnType<typeof fetchTasks>>[number];
export type AssigneeRow = TaskRow["staff_task_assignees"][number];

export async function fetchTaskExtras(taskId: string, assigneeIds: string[]) {
  const [comments, submissions, extensions, events] = await Promise.all([
    supabase.from("staff_task_comments").select("*").eq("task_id", taskId).order("created_at"),
    assigneeIds.length
      ? supabase.from("staff_task_submissions").select("*").in("assignee_id", assigneeIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    assigneeIds.length
      ? supabase.from("staff_extension_requests").select("*").in("assignee_id", assigneeIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("staff_work_events").select("*").eq("task_id", taskId).order("created_at", { ascending: false }).limit(50),
  ]);
  return {
    comments: unwrap(comments) ?? [],
    submissions: unwrap(submissions) ?? [],
    extensions: unwrap(extensions) ?? [],
    events: unwrap(events) ?? [],
  };
}

export async function fetchAvailability(orgId: string) {
  return unwrap(
    await supabase.from("staff_availability").select("*").eq("org_id", orgId).order("week_start", { ascending: false }).limit(200),
  ) ?? [];
}
export async function fetchProjects(orgId: string) {
  return unwrap(await supabase.from("staff_projects").select("*").eq("org_id", orgId).order("created_at", { ascending: false })) ?? [];
}
export async function fetchGoals(orgId: string) {
  return unwrap(await supabase.from("staff_goals").select("*").eq("org_id", orgId).order("created_at", { ascending: false })) ?? [];
}
export async function fetchEvents(orgId: string) {
  return unwrap(
    await supabase.from("staff_work_events").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(40),
  ) ?? [];
}

export type NewTask = {
  title: string;
  instructions: string;
  priority: Priority;
  deadline: string | null;
  deadline_kind: "date" | "datetime" | "flexible";
  estimated_hours: number;
  evidence_required: boolean;
  review_required: boolean;
  project_id?: string | null;
  goal_id?: string | null;
  link_kind?: string | null;
  link_id?: string | null;
  link_label?: string | null;
  is_template?: boolean;
};

export const createTask = async (orgId: string, task: NewTask, assignees: string[]) =>
  unwrap(await supabase.rpc("staff_create_task", { _org: orgId, _task: task as never, _assignees: assignees }));
export const deleteTask = async (id: string) => unwrap(await supabase.rpc("staff_delete_task", { _task: id }));
export const changeDeadline = async (id: string, deadline: string) =>
  unwrap(await supabase.rpc("staff_change_deadline", { _task: id, _deadline: deadline }));
export const addAssignees = async (id: string, users: string[]) =>
  unwrap(await supabase.rpc("staff_add_assignees", { _task: id, _users: users }));
export const startTask = async (a: string) => unwrap(await supabase.rpc("staff_start_task", { _assignee: a }));
export const submitTask = async (a: string, note: string, links: string[], files: { path: string; name: string }[]) =>
  unwrap(await supabase.rpc("staff_submit_task", { _assignee: a, _note: note, _links: links, _files: files as never }));
export const reviewTask = async (a: string, approve: boolean, note: string) =>
  unwrap(await supabase.rpc("staff_review_task", { _assignee: a, _approve: approve, _note: note }));
export const requestExtension = async (a: string, deadline: string, reason: string) =>
  unwrap(await supabase.rpc("staff_request_extension", { _assignee: a, _deadline: deadline, _reason: reason }));
export const decideExtension = async (id: string, approve: boolean) =>
  unwrap(await supabase.rpc("staff_decide_extension", { _request: id, _approve: approve }));
export const addComment = async (task: string, body: string) =>
  unwrap(await supabase.rpc("staff_add_comment", { _task: task, _body: body }));
export const setManager = async (org: string, user: string, on: boolean) =>
  unwrap(await supabase.rpc("staff_set_manager", { _org: org, _user: user, _on: on }));
export const submitAvailability = async (org: string, week: string, workerType: string, hours: number, days: Record<string, number>, note: string) =>
  unwrap(await supabase.rpc("staff_submit_availability", { _org: org, _week: week, _worker_type: workerType, _hours: hours, _days: days, _note: note }));
export const reviewAvailability = async (id: string, approve: boolean, note: string) =>
  unwrap(await supabase.rpc("staff_review_availability", { _id: id, _approve: approve, _note: note }));

export async function createProject(orgId: string, name: string, description: string) {
  unwrap(await supabase.from("staff_projects").insert({ org_id: orgId, name, description }).select().single());
}
export async function createGoal(orgId: string, title: string, projectId: string | null, targetDate: string | null) {
  unwrap(await supabase.from("staff_goals").insert({ org_id: orgId, title, project_id: projectId, target_date: targetDate }).select().single());
}

export async function uploadProof(orgId: string, file: File) {
  const path = `${orgId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const { error } = await supabase.storage.from("staff-hub-files").upload(path, file);
  if (error) throw new Error(error.message);
  return { path, name: file.name };
}
export async function openProof(path: string) {
  const { data, error } = await supabase.storage.from("staff-hub-files").createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  window.open(data.signedUrl, "_blank", "noopener");
}

// ---- derived facts -------------------------------------------------------

export const STATUS_LABEL: Record<TaskStatus, string> = {
  assigned: "Assigned",
  in_progress: "In progress",
  submitted: "Waiting for review",
  changes_requested: "Changes requested",
  completed: "Completed",
};

export const isOverdue = (a: { status: string; deadline: string | null }) =>
  a.status !== "completed" && !!a.deadline && new Date(a.deadline).getTime() < Date.now();

/** Per-teacher performance, computed only from recorded task facts. */
export function performance(tasks: TaskRow[], userId: string, sinceMs: number) {
  const mine = tasks
    .filter((t) => !t.is_template)
    .flatMap((t) => t.staff_task_assignees.filter((a) => a.user_id === userId).map((a) => ({ a, t })))
    .filter(({ a }) => new Date(a.created_at).getTime() >= sinceMs);
  const done = mine.filter(({ a }) => a.status === "completed");
  const onTime = done.filter(({ a }) => !a.deadline || (a.submitted_at && a.submitted_at <= a.deadline));
  const open = mine.filter(({ a }) => a.status !== "completed");
  const overdue = open.filter(({ a }) => isOverdue(a));
  const rounds = done.length ? done.reduce((s, { a }) => s + a.review_rounds, 0) / done.length : 0;
  const openHours = open.reduce((s, { t }) => s + Number(t.estimated_hours || 0), 0);
  return {
    assigned: mine.length,
    completed: done.length,
    onTimeRate: done.length ? Math.round((onTime.length / done.length) * 100) : null,
    overdue: overdue.length,
    open: open.length,
    avgRounds: Math.round(rounds * 10) / 10,
    openHours,
  };
}

export const mondayOf = (d = new Date()) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
};

export const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "No deadline";

export const EVENT_LABEL: Record<string, string> = {
  task_assigned: "Task assigned",
  template_created: "Template saved",
  task_started: "Started",
  task_submitted: "Submitted",
  task_approved: "Approved",
  changes_requested: "Changes requested",
  deadline_changed: "Deadline changed",
  extension_requested: "More time requested",
  extension_approved: "More time approved",
  extension_declined: "More time declined",
  manager_granted: "Made a manager",
  manager_removed: "Manager removed",
  availability_submitted: "Availability submitted",
  availability_approved: "Availability approved",
  availability_changes: "Availability change requested",
  task_deleted: "Task deleted",
};
