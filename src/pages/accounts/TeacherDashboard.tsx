import { Building2, ClipboardList, GraduationCap, Users } from "lucide-react";

import { Link } from "@/lib/router-compat";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import { ActivityList, EmptyNote, RailCard, StatCard } from "@/components/workspace/DashboardParts";
import DashboardHero from "@/components/workspace/DashboardHero";
import { useTeacherStats } from "@/lib/workspace/useWorkspaceStats";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import WorkspaceInvitations from "@/components/accounts/WorkspaceInvitations";
import WorkspaceVisibilityCard from "@/components/accounts/WorkspaceVisibilityCard";

const QUICK: { to: string; label: string }[] = [
  { to: "/lesson-notes", label: "Lesson Notes" },
  { to: "/smartboard", label: "SmartBoard" },
  { to: "/teaching-hub/classes", label: "Classes" },
  { to: "/adventure", label: "Adventure" },
  { to: "/course-builder", label: "Skill Builder" },
  { to: "/live", label: "MathGPL Live" },
];

/**
 * The teacher's own workspace: what they teach, who they teach, and the schools
 * they are connected to. Schools they belong to are context on the right — the
 * teaching itself always belongs to the teacher.
 */
const TeacherDashboard = () => {
  const { data, isLoading } = useTeacherStats();
  const { workspaces, activeOrgId, switchTo } = useWorkspace();
  const schools = workspaces.filter((w) => w.kind === "school" && !w.isOwner);

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
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border/50 bg-background/40 p-3 text-left transition hover:border-primary/40"
                >
                  <span className="truncate text-sm">{school.name}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {school.orgId === activeOrgId ? "Active" : "Enter"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </RailCard>

      <RailCard title="My Students" action={{ to: "/requests?view=students", label: "View" }}>
        <p className="text-sm text-muted-foreground">
          {isLoading ? "—" : `${data?.students ?? 0} students`} in this workspace.
        </p>
      </RailCard>

      <WorkspaceInvitations />
      <WorkspaceVisibilityCard />
    </>
  );

  return (
    <WorkspaceLayout title="Teaching Hub" subtitle="Your teaching workspace" rail={rail}>
      <DashboardHero />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Schools connected" value={data?.schools ?? 0} icon={Building2} loading={isLoading} to="/requests?view=schools" />
        <StatCard label="Students" value={data?.students ?? 0} icon={Users} loading={isLoading} to="/requests?view=students" />
        <StatCard label="Classes" value={data?.classes ?? 0} icon={GraduationCap} loading={isLoading} to="/teaching-hub/classes" />
        <StatCard label="Assignments" value={data?.assignments ?? 0} icon={ClipboardList} loading={isLoading} to="/teaching-hub/classes" />
      </div>

      <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quick actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="min-h-[44px] rounded-full border border-border bg-background/50 px-4 py-2 text-sm transition hover:border-primary/50"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recent activity</h2>
        <ActivityList items={data?.activity ?? []} empty="No lesson notes in this workspace yet." />
      </section>
    </WorkspaceLayout>
  );
};

export default TeacherDashboard;
