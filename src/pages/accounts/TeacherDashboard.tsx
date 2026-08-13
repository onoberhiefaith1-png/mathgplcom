import { Building2, CalendarClock, ClipboardList, GraduationCap, Users } from "lucide-react";

import { Link } from "@/lib/router-compat";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import { ActivityList, EmptyNote, RailCard, StatCard } from "@/components/workspace/DashboardParts";
import DashboardHero from "@/components/workspace/DashboardHero";
import { useTeacherStats } from "@/lib/workspace/useWorkspaceStats";
import { useUpcomingSessions } from "@/lib/workspace/useUpcomingSessions";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { useConnections, useConnectionCounts } from "@/lib/connections/useConnections";
import WorkspaceInvitations from "@/components/accounts/WorkspaceInvitations";
import PlanSection from "@/components/plans/PlanSection";
import CreditsSection from "@/components/plans/CreditsSection";
import { useUpgradeGuard } from "@/lib/entitlements/useUpgradeGuard";
import type { FeatureKey } from "@/lib/entitlements/features";

const QUICK: { to: string; label: string; feature?: FeatureKey }[] = [
  { to: "/lesson-notes", label: "Lesson Notes", feature: "create_lesson_notes" },
  { to: "/smartboard", label: "SmartBoard", feature: "smartboard" },
  { to: "/teaching-hub/classes", label: "Classes", feature: "classes" },
  { to: "/adventure", label: "Adventure", feature: "adventure" },
  { to: "/course-builder", label: "Skill Builder", feature: "skill_builder" },
  { to: "/live", label: "MathGPL Live", feature: "mathgpl_live" },
  { to: "/teaching-hub/pricing", label: "Pricing" },
];


const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * The teacher's own workspace: what they teach, who they teach, and the schools
 * they are connected to. Schools they belong to are context on the right — the
 * teaching itself always belongs to the teacher.
 */
const TeacherDashboard = () => {
  const { data, isLoading } = useTeacherStats();
  const { workspaces, activeOrgId, switchTo } = useWorkspace();
  const schedule = useUpcomingSessions();
  const { counts } = useConnectionCounts();
  const { data: accepted } = useConnections("accepted");
  const schools = workspaces.filter((w) => w.kind === "school" && !w.isOwner);
  const students = (accepted ?? []).filter((c) => c.counterpartRole === "student");


  const rail = (
    <>
      <RailCard title="My Schools" action={{ to: "/requests?view=schools", label: "Manage" }}>
        {schools.length === 0 ? (
          <EmptyNote>You are not connected to a school yet. Requests and invitations appear here.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {schools.map((school) => (
              <li key={school.orgId}>
                <button
                  type="button"
                  onClick={() => void switchTo(school.orgId)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-ws-border/70 bg-ws-panel/60 p-3 text-left transition hover:border-ws-gold/50"
                >
                  <span className="truncate text-sm">{school.name}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-ws-gold/80">
                    {school.orgId === activeOrgId ? "Active" : "Enter"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </RailCard>

      <RailCard title="Manage Connections" action={{ to: "/requests", label: "Open" }}>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <span className="truncate">Pending requests</span>
            <span className="shrink-0 font-semibold text-ws-gold">{counts.pendingIncoming}</span>
          </li>
          <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <span className="truncate">Schools</span>
            <span className="shrink-0 font-semibold text-foreground">{counts.schools}</span>
          </li>
          <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <span className="truncate">Students</span>
            <span className="shrink-0 font-semibold text-foreground">{counts.students}</span>
          </li>
          <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <span className="truncate">Parents</span>
            <span className="shrink-0 font-semibold text-foreground">{counts.parents}</span>
          </li>
        </ul>
      </RailCard>

      <RailCard title="My Students Overview" action={{ to: "/teaching-hub/students", label: "View all" }}>
        {students.length === 0 ? (
          <EmptyNote>No connected students yet. Accepted student connections appear here.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {students.slice(0, 5).map((student) => (
              <li key={student.id}>
                <Link
                  to={`/teaching-hub/students/${student.counterpartUserId}`}
                  className="block rounded-xl border border-ws-border/70 bg-ws-panel/60 p-3 transition hover:border-ws-gold/50"
                >
                  <span className="block truncate text-sm">{student.counterpartName}</span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {student.counterpartUsername ? `@${student.counterpartUsername}` : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </RailCard>

      <WorkspaceInvitations />
    </>
  );

  return (
    <WorkspaceLayout title="Teaching Hub" subtitle="Your teaching workspace" rail={rail}>
      <DashboardHero />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Schools connected" value={data?.schools ?? 0} icon={Building2} loading={isLoading} to="/requests?view=schools" />
        <StatCard label="Students" value={data?.students ?? 0} icon={Users} loading={isLoading} to="/teaching-hub/students" />
        <StatCard label="Classes" value={data?.classes ?? 0} icon={GraduationCap} loading={isLoading} to="/teaching-hub/classes" />
        <StatCard label="Assignments" value={data?.assignments ?? 0} icon={ClipboardList} loading={isLoading} to="/teaching-hub/classes" />
      </div>

      <section className="rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h2 className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-ws-gold/80">
            Upcoming schedule
          </h2>
          <Link to="/live" className="shrink-0 text-xs text-ws-gold hover:underline">
            MathGPL Live
          </Link>
        </div>
        {schedule.isLoading ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (schedule.data ?? []).length === 0 ? (
          <EmptyNote>Nothing scheduled. Sessions you plan in MathGPL Live appear here.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {(schedule.data ?? []).map((session) => (
              <li
                key={session.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-ws-border/60 bg-ws-canvas/40 p-3"
              >
                <CalendarClock className="h-4 w-4 shrink-0 text-ws-violet" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{session.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{when(session.startsAt)}</span>
                </span>
                {session.durationMinutes && (
                  <span className="shrink-0 text-xs text-muted-foreground">{session.durationMinutes} min</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ws-gold/80">Quick actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK.map((item) =>
            !item.feature || allowed(item.feature) ? (
              <Link
                key={item.to}
                to={item.to}
                className="min-h-[44px] rounded-full border border-ws-border/70 bg-ws-canvas/40 px-4 py-2 text-sm transition hover:border-ws-gold/50"
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.to}
                type="button"
                onClick={() => guard(item.feature!, () => {})}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ws-border/40 bg-ws-canvas/20 px-4 py-2 text-sm text-muted-foreground transition hover:border-ws-gold/40"
              >
                <Lock className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ),
          )}
        </div>
        {upgradeDialog}

      </section>

      <section className="rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-ws-gold/80">Recent activity</h2>
        <ActivityList items={data?.activity ?? []} empty="No lesson notes in this workspace yet." />
      </section>
      <PlanSection />
      <CreditsSection />
    </WorkspaceLayout>
  );
};

export default TeacherDashboard;
