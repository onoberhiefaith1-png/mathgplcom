import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  EVENT_LABEL,
  createGoal,
  createProject,
  fetchAvailability,
  fetchEvents,
  fetchGoals,
  fetchProjects,
  fmt,
  mondayOf,
  performance,
  reviewAvailability,
  setManager,
  submitAvailability,
  type StaffMember,
  type TaskRow,
} from "@/lib/staffHub/api";
import type { Ctx } from "./StaffHubPage";
import { Avatar, Empty, Panel, btn, btnGhost, field } from "./ui";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TeamTab({ ctx, team, tasks }: { ctx: Ctx; team: StaffMember[]; tasks: TaskRow[] }) {
  const qc = useQueryClient();
  const since = Date.now() - 30 * 86400000;
  return (
    <Panel title={`Teachers connected to this school (${team.length})`}>
      {team.length === 0 ? (
        <Empty>No teachers are connected yet. Teachers who join this school's workspace appear here automatically.</Empty>
      ) : (
        <ul className="divide-y divide-border">
          {team.map((m) => {
            const p = performance(tasks, m.userId, since);
            return (
              <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-3">
                  <Avatar name={m.name} url={m.avatarUrl} />
                  <span>
                    <span className="block text-sm font-medium">
                      {m.name} {m.isManager && <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary">Manager</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {m.mathgplId ?? ""} · {p.open} open · {p.openHours}h · {p.overdue} overdue
                    </span>
                  </span>
                </span>
                {ctx.isAdmin && (
                  <button
                    type="button"
                    className={m.isManager ? btnGhost : btn}
                    onClick={async () => {
                      try {
                        await setManager(ctx.orgId, m.userId, !m.isManager);
                        toast.success(m.isManager ? "Manager removed" : `${m.name} is now a manager`);
                        await qc.invalidateQueries({ queryKey: ["staff-team", ctx.orgId] });
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    {m.isManager ? "Remove manager" : "Make manager"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Managers can assign and review tasks, change deadlines, approve availability and see reports. Billing, plans and account settings stay with the school owner.
      </p>
    </Panel>
  );
}

export function AvailabilityTab({ ctx, team, tasks }: { ctx: Ctx; team: StaffMember[]; tasks: TaskRow[] }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["staff-availability", ctx.orgId], queryFn: () => fetchAvailability(ctx.orgId) });
  const week = mondayOf();
  const mineNow = (list.data ?? []).find((r) => r.user_id === ctx.userId && r.week_start === week);
  const [days, setDays] = useState<Record<string, number>>(() => (mineNow?.days as Record<string, number>) ?? {});
  const [type, setType] = useState(mineNow?.worker_type ?? "full_time");
  const [note, setNote] = useState("");
  const total = Object.values(days).reduce((s, h) => s + (Number(h) || 0), 0);
  const isTeacher = team.some((m) => m.userId === ctx.userId);
  const name = (id: string) => team.find((m) => m.userId === id)?.name ?? "Teacher";
  const refresh = () => qc.invalidateQueries({ queryKey: ["staff-availability", ctx.orgId] });

  return (
    <div className="space-y-6">
      {isTeacher && (
        <Panel title={`My availability — week of ${week}`}>
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((d) => (
              <label key={d} className="text-center text-xs text-muted-foreground">
                {d}
                <input
                  type="number"
                  min={0}
                  max={24}
                  className={`${field} text-center`}
                  value={days[d] ?? 0}
                  onChange={(e) => setDays((x) => ({ ...x, [d]: Number(e.target.value) }))}
                />
              </label>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <select className={field} value={type} onChange={(e) => setType(e.target.value)} aria-label="Working arrangement">
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="contract">Contract</option>
              <option value="flexible">Flexible</option>
            </select>
            <input className={`${field} sm:col-span-2`} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span>
              {total}h this week{mineNow ? ` · ${mineNow.status.replace("_", " ")}` : ""}
            </span>
            <button
              type="button"
              className={btn}
              onClick={async () => {
                try {
                  await submitAvailability(ctx.orgId, week, type, total, days, note);
                  toast.success("Availability sent");
                  await refresh();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Submit
            </button>
          </div>
          {mineNow?.review_note && <p className="mt-2 text-xs italic">Manager: {mineNow.review_note}</p>}
        </Panel>
      )}

      {ctx.isManager && (
        <Panel title="Team availability and workload">
          {(list.data ?? []).length === 0 ? (
            <Empty>No availability submitted yet.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {(list.data ?? []).map((r) => {
                const load = performance(tasks, r.user_id, 0).openHours;
                const over = Number(r.hours) > 0 && load > Number(r.hours);
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <span>
                      <span className="font-medium">{name(r.user_id)}</span>
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · week of {r.week_start} · {r.hours}h available · {r.worker_type.replace("_", " ")}
                      </span>
                      <span className={`block text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
                        {load}h of open work{over ? " — more than available" : ""}
                        {r.note ? ` · ${r.note}` : ""}
                      </span>
                    </span>
                    {r.status === "pending" ? (
                      <span className="flex gap-2">
                        <button type="button" className={btn} onClick={() => reviewAvailability(r.id, true, "").then(refresh, (e: Error) => toast.error(e.message))}>
                          Approve
                        </button>
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => {
                            const n = prompt("What should change?") ?? "";
                            if (n) void reviewAvailability(r.id, false, n).then(refresh, (e: Error) => toast.error(e.message));
                          }}
                        >
                          Ask for changes
                        </button>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{r.status.replace("_", " ")}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

export function ProjectsTab({ ctx }: { ctx: Ctx }) {
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ["staff-projects", ctx.orgId], queryFn: () => fetchProjects(ctx.orgId) });
  const goals = useQuery({ queryKey: ["staff-goals", ctx.orgId], queryFn: () => fetchGoals(ctx.orgId) });
  const [p, setP] = useState({ name: "", description: "" });
  const [g, setG] = useState({ title: "", project: "", date: "" });
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Panel title="Projects">
        <div className="mb-4 space-y-2">
          <input className={field} placeholder="Project name, e.g. Term 2 Statistics" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          <input className={field} placeholder="Description" value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} />
          <button
            type="button"
            className={btn}
            disabled={!p.name.trim()}
            onClick={async () => {
              try {
                await createProject(ctx.orgId, p.name.trim(), p.description);
                setP({ name: "", description: "" });
                await qc.invalidateQueries({ queryKey: ["staff-projects", ctx.orgId] });
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Add project
          </button>
        </div>
        {(projects.data ?? []).length === 0 ? (
          <Empty>No projects yet.</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {(projects.data ?? []).map((x) => (
              <li key={x.id} className="rounded-lg border border-border px-3 py-2">
                <div className="font-medium">{x.name}</div>
                {x.description && <div className="text-xs text-muted-foreground">{x.description}</div>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Goals">
        <div className="mb-4 space-y-2">
          <input className={field} placeholder="Goal, e.g. Every Year 10 topic has 4 activities" value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className={field} value={g.project} onChange={(e) => setG({ ...g, project: e.target.value })} aria-label="Project">
              <option value="">No project</option>
              {(projects.data ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <input type="date" className={field} value={g.date} onChange={(e) => setG({ ...g, date: e.target.value })} aria-label="Target date" />
          </div>
          <button
            type="button"
            className={btn}
            disabled={!g.title.trim()}
            onClick={async () => {
              try {
                await createGoal(ctx.orgId, g.title.trim(), g.project || null, g.date || null);
                setG({ title: "", project: "", date: "" });
                await qc.invalidateQueries({ queryKey: ["staff-goals", ctx.orgId] });
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Add goal
          </button>
        </div>
        {(goals.data ?? []).length === 0 ? (
          <Empty>No goals yet.</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {(goals.data ?? []).map((x) => (
              <li key={x.id} className="rounded-lg border border-border px-3 py-2">
                <div className="font-medium">{x.title}</div>
                <div className="text-xs text-muted-foreground">{x.target_date ? `Target ${x.target_date}` : "No target date"}</div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

const PERIODS = [
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["90", "Last term (90 days)"],
  ["365", "Last year"],
] as const;

export function ReportsTab({ team, tasks }: { team: StaffMember[]; tasks: TaskRow[] }) {
  const [days, setDays] = useState<string>("30");
  const since = Date.now() - Number(days) * 86400000;
  const rows = team.map((m) => ({ m, p: performance(tasks, m.userId, since) }));

  const exportCsv = () => {
    const head = "Teacher,MathGPL ID,Assigned,Completed,On-time %,Overdue,Open,Avg review rounds,Open hours";
    const body = rows.map(({ m, p }) =>
      [m.name, m.mathgplId ?? "", p.assigned, p.completed, p.onTimeRate ?? "", p.overdue, p.open, p.avgRounds, p.openHours]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[head, ...body].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `staff-report-${days}d.csv`;
    a.click();
  };

  return (
    <Panel
      title="Staff performance"
      action={
        <span className="flex gap-2">
          <select className={`${field} w-auto`} value={days} onChange={(e) => setDays(e.target.value)} aria-label="Period">
            {PERIODS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <button type="button" className={btnGhost} onClick={exportCsv}>
            Export
          </button>
          <button type="button" className={btnGhost} onClick={() => window.print()}>
            Print
          </button>
        </span>
      }
    >
      {rows.length === 0 ? (
        <Empty>No teachers yet.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Teacher</th>
                <th>Assigned</th>
                <th>Completed</th>
                <th>On time</th>
                <th>Overdue</th>
                <th>Avg review rounds</th>
                <th>Open hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ m, p }) => (
                <tr key={m.userId}>
                  <td className="py-2 font-medium">{m.name}</td>
                  <td>{p.assigned}</td>
                  <td>{p.completed}</td>
                  <td>{p.onTimeRate === null ? "—" : `${p.onTimeRate}%`}</td>
                  <td className={p.overdue ? "text-destructive" : ""}>{p.overdue}</td>
                  <td>{p.avgRounds || "—"}</td>
                  <td>{p.openHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Every figure comes from recorded task facts — assigned, submitted, reviewed, deadlines. Staff Hub never tracks clicks or screen time.
      </p>
    </Panel>
  );
}

export function ActivityTab({ ctx, team }: { ctx: Ctx; team: StaffMember[] }) {
  const events = useQuery({ queryKey: ["staff-events", ctx.orgId], queryFn: () => fetchEvents(ctx.orgId) });
  const name = (id: string | null) => (id === ctx.userId ? "You" : team.find((m) => m.userId === id)?.name ?? "School");
  return (
    <Panel title="Recent activity">
      {(events.data ?? []).length === 0 ? (
        <Empty>Nothing yet.</Empty>
      ) : (
        <ul className="space-y-2 text-sm">
          {(events.data ?? []).map((e) => (
            <li key={e.id} className="flex justify-between gap-3">
              <span>
                <span className="font-medium">{EVENT_LABEL[e.kind] ?? e.kind}</span>
                {e.subject_user_id ? ` · ${name(e.subject_user_id)}` : ""}
                <span className="text-muted-foreground"> by {name(e.actor_id)}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{fmt(e.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
