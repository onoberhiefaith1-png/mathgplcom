import { Building2, ClipboardList, Compass, Users } from "lucide-react";

import { Link } from "@/lib/router-compat";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import DashboardHero from "@/components/workspace/DashboardHero";
import { ActivityList, EmptyNote, RailCard, StatCard } from "@/components/workspace/DashboardParts";
import { useStudentStats } from "@/lib/workspace/useWorkspaceStats";
import { useWorkspace } from "@/lib/accounts/useWorkspace";

const QUICK: { to: string; label: string }[] = [
  { to: "/student/classes", label: "My Classes" },
  { to: "/join", label: "Join a class" },
  { to: "/adventure", label: "Adventures" },
  { to: "/community", label: "Community" },
];

/**
 * The student's learning dashboard for the workspace they are in. School A and
 * School B stay separate: only the classes belonging to the active workspace,
 * and the work inside them, are counted here.
 */
const StudentDashboard = () => {
  const { data, isLoading } = useStudentStats();
  const { workspaces, activeOrgId, switchTo } = useWorkspace();
  const schools = workspaces.filter((w) => w.kind === "school" && !w.isOwner);

  const rail = (
    <>
      <RailCard title="My Schools" action={{ to: "/requests?view=schools", label: "Manage" }}>
        {schools.length === 0 ? (
          <EmptyNote>You are not connected to a school yet. Join a class or accept a school request.</EmptyNote>
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

      <RailCard title="My Progress">
        <div className="rounded-xl border border-border/50 bg-background/40 p-4 text-center">
          <div className="text-3xl font-semibold">{isLoading ? "—" : `${data?.progress ?? 0}%`}</div>
          <div className="mt-1 text-xs text-muted-foreground">Average course progress in this workspace</div>
        </div>
      </RailCard>

      <RailCard title="My Teachers" action={{ to: "/requests?view=teachers", label: "View" }}>
        <EmptyNote>Teachers you are connected to appear here.</EmptyNote>
      </RailCard>
    </>
  );

  return (
    <WorkspaceLayout title="Learning Hub" subtitle="Your learning workspace" rail={rail}>
      <DashboardHero blurb="Everything for the workspace you are in: classes, assignments and adventures." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Classes" value={data?.classes ?? 0} icon={Users} loading={isLoading} to="/student/classes" />
        <StatCard label="Assignments" value={data?.assignments ?? 0} icon={ClipboardList} loading={isLoading} to="/student/classes" />
        <StatCard label="Adventures" value={data?.adventures ?? 0} icon={Compass} loading={isLoading} to="/adventure" />
        <StatCard label="Schools" value={data?.schools ?? 0} icon={Building2} loading={isLoading} to="/requests?view=schools" />
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
        <ActivityList items={data?.activity ?? []} empty="No course activity in this workspace yet." />
      </section>
    </WorkspaceLayout>
  );
};

export default StudentDashboard;
