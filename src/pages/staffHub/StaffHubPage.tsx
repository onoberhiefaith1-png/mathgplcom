import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import SchoolShell from "@/components/accounts/SchoolShell";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/lib/accounts/useAccount";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { fetchIsAdmin, fetchIsManager, fetchTasks, fetchTeam } from "@/lib/staffHub/api";
import { OverviewTab, TasksTab } from "./tasks";
import { TeamTab, AvailabilityTab, ProjectsTab, ReportsTab, ActivityTab } from "./panels";
import TaskDrawer from "./TaskDrawer";

export type Ctx = { orgId: string; isManager: boolean; isAdmin: boolean; userId: string };

const TABS = [
  ["overview", "Overview"],
  ["tasks", "Tasks"],
  ["team", "Team"],
  ["availability", "Availability"],
  ["projects", "Projects & Goals"],
  ["reports", "Reports"],
  ["activity", "Activity"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function StaffHubPage() {
  const { role, orgId: accountOrg, userId, isLoading } = useAccount();
  const { workspaces, activeOrgId } = useWorkspace();
  const schools = workspaces.filter((w) => w.kind === "school");
  const defaultOrg =
    role === "school"
      ? accountOrg
      : (schools.find((w) => w.orgId === activeOrgId) ?? schools[0])?.orgId ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const orgId = picked ?? defaultOrg;

  const search = useSearch({ from: "/staff-hub" });
  const navigate = useNavigate({ from: "/staff-hub" });
  const qc = useQueryClient();

  const perms = useQuery({
    queryKey: ["staff-perms", orgId],
    enabled: !!orgId,
    queryFn: async () => ({ manager: await fetchIsManager(orgId!), admin: await fetchIsAdmin(orgId!) }),
  });
  const team = useQuery({ queryKey: ["staff-team", orgId], enabled: !!orgId, queryFn: () => fetchTeam(orgId!) });
  const tasks = useQuery({ queryKey: ["staff-tasks", orgId], enabled: !!orgId, queryFn: () => fetchTasks(orgId!) });

  // Late work is recorded as Overdue (once per teacher) whenever the hub opens.
  useEffect(() => {
    if (!orgId) return;
    void (supabase.rpc as unknown as (f: string, a: object) => Promise<unknown>)("staff_mark_overdue", { _org: orgId });
  }, [orgId]);

  // Live: any task, assignee, comment or proof change refreshes everyone's view.
  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel(`staff-hub-${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_task_assignees", filter: `org_id=eq.${orgId}` }, () => {
        void qc.invalidateQueries({ queryKey: ["staff-tasks", orgId] });
        void qc.invalidateQueries({ queryKey: ["staff-task-extras"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_tasks", filter: `org_id=eq.${orgId}` }, () =>
        qc.invalidateQueries({ queryKey: ["staff-tasks", orgId] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_task_comments", filter: `org_id=eq.${orgId}` }, () =>
        qc.invalidateQueries({ queryKey: ["staff-task-extras"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_task_submissions", filter: `org_id=eq.${orgId}` }, () =>
        qc.invalidateQueries({ queryKey: ["staff-task-extras"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [orgId, qc]);

  const isManager = !!perms.data?.manager;
  const visibleTabs = useMemo(
    () => (isManager ? TABS : TABS.filter(([k]) => k === "overview" || k === "tasks" || k === "availability")),
    [isManager],
  );
  const tab: Tab = (search.tab && visibleTabs.some(([k]) => k === search.tab) ? search.tab : "overview") as Tab;

  if (isLoading || (orgId && perms.isLoading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orgId || !userId || (perms.data && !perms.data.manager && !team.data?.some((m) => m.userId === userId) && !team.isLoading)) {
    return (
      <SchoolShell title="Staff Hub" nav={false}>
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Staff Hub belongs to a school. When you are connected to a school as a teacher, the tasks that school gives you appear here.
        </div>
      </SchoolShell>
    );
  }

  const ctx: Ctx = { orgId, isManager, isAdmin: !!perms.data?.admin, userId };
  const schoolName = schools.find((w) => w.orgId === orgId)?.name;
  const openTask = (id: string | undefined) => void navigate({ search: (s) => ({ ...s, task: id }) });

  return (
    <SchoolShell
      title="Staff Hub"
      nav={false}
      subtitle={
        isManager
          ? `Assign work to ${schoolName ?? "your school"}'s teachers, review proof and see how the team is doing.`
          : `Tasks ${schoolName ?? "your school"} has given you. Start, submit proof, ask for more time.`
      }
    >
      {role !== "school" && schools.length > 1 && (
        <select
          value={orgId}
          onChange={(e) => setPicked(e.target.value)}
          className="mb-4 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          aria-label="School"
        >
          {schools.map((s) => (
            <option key={s.orgId} value={s.orgId}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      <nav className="sticky top-0 z-10 mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card/95 p-1 shadow-sm backdrop-blur">
        {visibleTabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => void navigate({ search: (s) => ({ ...s, tab: k }) })}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition ${tab === k ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab ctx={ctx} tasks={tasks.data ?? []} team={team.data ?? []} onOpen={openTask} />}
      {tab === "tasks" && <TasksTab ctx={ctx} tasks={tasks.data ?? []} team={team.data ?? []} onOpen={openTask} />}
      {tab === "team" && <TeamTab ctx={ctx} team={team.data ?? []} tasks={tasks.data ?? []} />}
      {tab === "availability" && <AvailabilityTab ctx={ctx} team={team.data ?? []} tasks={tasks.data ?? []} />}
      {tab === "projects" && <ProjectsTab ctx={ctx} />}
      {tab === "reports" && <ReportsTab team={team.data ?? []} tasks={tasks.data ?? []} orgId={orgId} />}
      {tab === "activity" && <ActivityTab ctx={ctx} team={team.data ?? []} />}

      {search.task && (
        <TaskDrawer
          ctx={ctx}
          task={(tasks.data ?? []).find((t) => t.id === search.task) ?? null}
          team={team.data ?? []}
          onClose={() => openTask(undefined)}
        />
      )}
    </SchoolShell>
  );
}
