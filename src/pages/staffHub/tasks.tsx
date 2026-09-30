import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  createTask,
  fetchGoals,
  fetchProjects,
  fmt,
  isOverdue,
  mondayOf,
  type NewTask,
  type StaffMember,
  type TaskRow,
} from "@/lib/staffHub/api";
import type { Ctx } from "./StaffHubPage";
import { Empty, Panel, PriorityPill, Stat, StatusPill, btn, btnGhost, field } from "./ui";

type Props = { ctx: Ctx; tasks: TaskRow[]; team: StaffMember[]; onOpen: (id: string) => void };

export function OverviewTab({ ctx, tasks, team, onOpen }: Props) {
  const live = tasks.filter((t) => !t.is_template);
  const rows = live.flatMap((t) =>
    t.staff_task_assignees.filter((a) => ctx.isManager || a.user_id === ctx.userId).map((a) => ({ t, a })),
  );
  const open = rows.filter(({ a }) => a.status !== "completed");
  const overdue = open.filter(({ a }) => isOverdue(a));
  const review = rows.filter(({ a }) => a.status === "submitted");
  const weekStart = new Date(mondayOf()).getTime();
  const doneWeek = rows.filter(({ a }) => a.completed_at && new Date(a.completed_at).getTime() >= weekStart);
  const soon = open
    .filter(({ a }) => a.deadline)
    .sort((x, y) => (x.a.deadline! < y.a.deadline! ? -1 : 1))
    .slice(0, 8);
  const name = (id: string) => team.find((m) => m.userId === id)?.name ?? "Teacher";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open tasks" value={open.length} />
        <Stat label="Overdue" value={overdue.length} />
        <Stat label={ctx.isManager ? "Waiting for your review" : "Waiting for review"} value={review.length} />
        <Stat label="Completed this week" value={doneWeek.length} />
      </div>
      <Panel title="Coming up">
        {soon.length === 0 ? (
          <Empty>No deadlines coming up.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {soon.map(({ t, a }) => (
              <li key={a.id}>
                <button type="button" onClick={() => onOpen(t.id)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{t.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {ctx.isManager ? `${name(a.user_id)} · ` : ""}
                      {fmt(a.deadline)}
                    </span>
                  </span>
                  <StatusPill status={a.status} overdue={isOverdue(a)} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {ctx.isManager && review.length > 0 && (
        <Panel title="Review queue">
          <ul className="divide-y divide-border">
            {review.map(({ t, a }) => (
              <li key={a.id}>
                <button type="button" onClick={() => onOpen(t.id)} className="flex w-full justify-between py-3 text-left text-sm">
                  <span>{t.title}</span>
                  <span className="text-muted-foreground">{name(a.user_id)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

export function TasksTab({ ctx, tasks, team, onOpen }: Props) {
  const [creating, setCreating] = useState<Partial<NewTask> | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "review" | "overdue" | "done">("open");
  const [who, setWho] = useState<string>("");
  const templates = tasks.filter((t) => t.is_template);

  const list = useMemo(() => {
    return tasks
      .filter((t) => !t.is_template)
      .filter((t) => {
        const as = t.staff_task_assignees.filter((a) => (ctx.isManager ? !who || a.user_id === who : a.user_id === ctx.userId));
        if (as.length === 0) return false;
        if (filter === "all") return true;
        if (filter === "open") return as.some((a) => a.status !== "completed");
        if (filter === "review") return as.some((a) => a.status === "submitted");
        if (filter === "overdue") return as.some((a) => isOverdue(a));
        return as.every((a) => a.status === "completed");
      });
  }, [tasks, filter, who, ctx]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["open", "review", "overdue", "done", "all"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={filter === f ? btn : btnGhost}>
            {{ open: "Open", review: "Waiting for review", overdue: "Overdue", done: "Completed", all: "All" }[f]}
          </button>
        ))}
        {ctx.isManager && (
          <>
            <select value={who} onChange={(e) => setWho(e.target.value)} className={`${field} w-auto`} aria-label="Teacher">
              <option value="">Every teacher</option>
              {team.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
            <button type="button" className={`${btn} ml-auto`} onClick={() => setCreating({})}>
              <Plus className="h-4 w-4" /> New task
            </button>
          </>
        )}
      </div>

      {ctx.isManager && templates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          Start from a template:
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className="rounded-full border border-border px-3 py-1 hover:bg-muted"
              onClick={() =>
                setCreating({
                  title: t.title,
                  instructions: t.instructions,
                  priority: t.priority as NewTask["priority"],
                  estimated_hours: Number(t.estimated_hours),
                  evidence_required: t.evidence_required,
                  review_required: t.review_required,
                  link_kind: t.link_kind,
                  link_id: t.link_id,
                  link_label: t.link_label,
                })
              }
            >
              {t.title}
            </button>
          ))}
        </div>
      )}

      <Panel title={`Tasks (${list.length})`}>
        {list.length === 0 ? (
          <Empty>{ctx.isManager ? "No tasks here. Create one with New task." : "No tasks here."}</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((t) => {
              const as = t.staff_task_assignees;
              const done = as.filter((a) => a.status === "completed").length;
              const mine = as.find((a) => a.user_id === ctx.userId);
              return (
                <li key={t.id}>
                  <button type="button" onClick={() => onOpen(t.id)} className="flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{t.title}</span>
                        <PriorityPill p={t.priority} />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {fmt(mine?.deadline ?? t.deadline)} · {t.estimated_hours}h
                        {ctx.isManager ? ` · ${done}/${as.length} done` : ""}
                      </span>
                    </span>
                    {mine ? (
                      <StatusPill status={mine.status} overdue={isOverdue(mine)} />
                    ) : (
                      <span className="text-xs text-muted-foreground">{as.some(isOverdue) ? "Has overdue" : ""}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {creating && <NewTaskDialog ctx={ctx} team={team} tasks={tasks} initial={creating} onClose={() => setCreating(null)} />}
    </div>
  );
}

function NewTaskDialog({
  ctx,
  team,
  tasks,
  initial,
  onClose,
}: {
  ctx: Ctx;
  team: StaffMember[];
  tasks: TaskRow[];
  initial: Partial<NewTask>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ["staff-projects", ctx.orgId], queryFn: () => fetchProjects(ctx.orgId) });
  const goals = useQuery({ queryKey: ["staff-goals", ctx.orgId], queryFn: () => fetchGoals(ctx.orgId) });
  const [f, setF] = useState<NewTask>({
    title: "",
    instructions: "",
    priority: "medium",
    deadline: null,
    deadline_kind: "datetime",
    estimated_hours: 1,
    evidence_required: true,
    review_required: true,
    ...initial,
  } as NewTask);
  const [who, setWho] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof NewTask>(k: K, v: NewTask[K]) => setF((x) => ({ ...x, [k]: v }));

  // Workload: open estimated hours per teacher, so nobody is overloaded blindly.
  const load = (uid: string) =>
    tasks
      .filter((t) => !t.is_template)
      .flatMap((t) => t.staff_task_assignees.filter((a) => a.user_id === uid && a.status !== "completed").map(() => Number(t.estimated_hours)))
      .reduce((s, h) => s + h, 0);

  const save = async (template: boolean) => {
    if (!f.title.trim()) return toast.error("Give the task a title");
    if (!template && who.length === 0) return toast.error("Choose at least one teacher");
    setBusy(true);
    try {
      const deadline =
        f.deadline_kind === "flexible" || !f.deadline
          ? null
          : new Date(f.deadline_kind === "date" ? `${f.deadline.slice(0, 10)}T23:59` : f.deadline).toISOString();
      await createTask(ctx.orgId, { ...f, deadline, is_template: template }, template ? [] : who);
      toast.success(template ? "Template saved" : "Task assigned");
      await qc.invalidateQueries({ queryKey: ["staff-tasks", ctx.orgId] });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur">
      <div className="w-full max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold">New task</h2>
        <input className={field} placeholder="Title, e.g. Create four Standard Deviation activities" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <textarea
          className={`${field} min-h-[110px]`}
          placeholder="Instructions: what done looks like, where to do it, what to hand in"
          value={f.instructions}
          onChange={(e) => set("instructions", e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted-foreground">
            Priority
            <select className={field} value={f.priority} onChange={(e) => set("priority", e.target.value as NewTask["priority"])}>
              {["low", "medium", "high", "urgent"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Deadline type
            <select className={field} value={f.deadline_kind} onChange={(e) => set("deadline_kind", e.target.value as NewTask["deadline_kind"])}>
              <option value="datetime">Date and time</option>
              <option value="date">End of a day</option>
              <option value="flexible">Flexible</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Estimated hours
            <input type="number" min={0.25} step={0.25} className={field} value={f.estimated_hours} onChange={(e) => set("estimated_hours", Number(e.target.value))} />
          </label>
        </div>
        {f.deadline_kind !== "flexible" && (
          <input
            type={f.deadline_kind === "date" ? "date" : "datetime-local"}
            className={field}
            value={f.deadline ?? ""}
            onChange={(e) => set("deadline", e.target.value)}
            aria-label="Deadline"
          />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <select className={field} value={f.project_id ?? ""} onChange={(e) => set("project_id", e.target.value || null)} aria-label="Project">
            <option value="">No project</option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className={field} value={f.goal_id ?? ""} onChange={(e) => set("goal_id", e.target.value || null)} aria-label="Goal">
            <option value="">No goal</option>
            {(goals.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="space-y-2 rounded-xl border border-border p-3">
          <legend className="px-1 text-xs text-muted-foreground">Link to MathGPL work (optional)</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            <select className={field} value={f.link_kind ?? ""} onChange={(e) => set("link_kind", e.target.value || null)}>
              <option value="">Nothing linked</option>
              <option value="academia_session">Academia session</option>
              <option value="lesson_note">Lesson note</option>
              <option value="game">Game</option>
              <option value="assessment">Assignment</option>
              <option value="url">Other page</option>
            </select>
            <input
              className={`${field} sm:col-span-2`}
              placeholder="Paste the page link from MathGPL"
              value={f.link_id ?? ""}
              onChange={(e) => set("link_id", e.target.value)}
              disabled={!f.link_kind}
            />
          </div>
          {f.link_kind && <input className={field} placeholder="Short label, e.g. Standard Deviation session" value={f.link_label ?? ""} onChange={(e) => set("link_label", e.target.value)} />}
        </fieldset>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.evidence_required} onChange={(e) => set("evidence_required", e.target.checked)} /> Proof required
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.review_required} onChange={(e) => set("review_required", e.target.checked)} /> Review before completion
          </label>
        </div>
        <div>
          <div className="mb-2 text-xs text-muted-foreground">Assign to (only teachers connected to this school)</div>
          {team.length === 0 ? (
            <Empty>No teachers are connected to this school yet.</Empty>
          ) : (
            <div className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
              {team.map((m) => {
                const h = load(m.userId);
                return (
                  <label key={m.userId} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={who.includes(m.userId)}
                        onChange={(e) => setWho((w) => (e.target.checked ? [...w, m.userId] : w.filter((x) => x !== m.userId)))}
                      />
                      {m.name}
                    </span>
                    <span className={`text-xs ${h >= 20 ? "text-destructive" : "text-muted-foreground"}`}>{h}h open</span>
                  </label>
                );
              })}
            </div>
          )}
          <button type="button" className="mt-2 text-xs text-primary underline" onClick={() => setWho(team.map((m) => m.userId))}>
            Select every teacher
          </button>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btnGhost} disabled={busy} onClick={() => save(true)}>
            Save as template
          </button>
          <button type="button" className={btn} disabled={busy} onClick={() => save(false)}>
            Assign task
          </button>
        </div>
      </div>
    </div>
  );
}
