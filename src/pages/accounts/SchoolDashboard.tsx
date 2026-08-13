import { Building2, GraduationCap, Inbox, Users } from "lucide-react";

import { Link } from "@/lib/router-compat";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import DashboardHero from "@/components/workspace/DashboardHero";
import { ActivityList, EmptyNote, RailCard, StatCard } from "@/components/workspace/DashboardParts";
import { useSchoolStats } from "@/lib/workspace/useWorkspaceStats";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import PlanSection from "@/components/plans/PlanSection";

const QUICK: { to: string; label: string }[] = [
  { to: "/school/teachers", label: "Teachers" },
  { to: "/school/students", label: "Students" },
  { to: "/requests", label: "Requests" },
  { to: "/school/pricing", label: "Pricing" },
  { to: "/community/discover", label: "Find teachers" },
  { to: "/account", label: "School Code & Go Live" },
];

/**
 * The School Administrative Workspace — a command centre, not a teaching
 * surface. The school oversees the teachers and students connected to it; it
 * never creates accounts and never edits another account's work.
 */
const SchoolDashboard = () => {
  const { data, isLoading } = useSchoolStats();
  const { active } = useWorkspace();

  const rail = (
    <>
      <RailCard title="Directories">
        <ul className="space-y-2 text-sm">
          <li>
            <Link to="/school/teachers" className="block rounded-xl border border-border/50 bg-background/40 p-3 hover:border-primary/40">
              Teachers ({isLoading ? "—" : data?.teachers ?? 0})
            </Link>
          </li>
          <li>
            <Link to="/school/students" className="block rounded-xl border border-border/50 bg-background/40 p-3 hover:border-primary/40">
              Students ({isLoading ? "—" : data?.students ?? 0})
            </Link>
          </li>
          <li>
            <Link to="/requests" className="block rounded-xl border border-border/50 bg-background/40 p-3 hover:border-primary/40">
              Requests ({isLoading ? "—" : data?.pendingRequests ?? 0})
            </Link>
          </li>
        </ul>
      </RailCard>

      <RailCard title="School Report">
        <p className="text-xs text-muted-foreground">
          The School Report combines the records of this school&rsquo;s teachers and students into one picture of school
          performance. A student in five classes is still one student in the school&rsquo;s unique count.
        </p>
      </RailCard>

      <RailCard title="Community" action={{ to: "/community/discover", label: "Open" }}>
        <EmptyNote>Discover teachers and students who are Live, and invite them to this school.</EmptyNote>
      </RailCard>
    </>
  );

  return (
    <WorkspaceLayout
      title={active?.name ?? "School Console"}
      subtitle="School administration"
      rail={rail}
    >
      <DashboardHero blurb="Oversee the teachers and students connected to this school." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Teachers" value={data?.teachers ?? 0} icon={GraduationCap} loading={isLoading} to="/school/teachers" />
        <StatCard label="Students" value={data?.students ?? 0} icon={Users} loading={isLoading} to="/school/students" />
        <StatCard label="Classes" value={data?.classes ?? 0} icon={Building2} loading={isLoading} />
        <StatCard label="Pending requests" value={data?.pendingRequests ?? 0} icon={Inbox} loading={isLoading} to="/requests" />
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Classes in this school</h2>
        <ActivityList items={data?.activity ?? []} empty="No classes have been created inside this school yet." />
      </section>
      <PlanSection />
    </WorkspaceLayout>
  );
};

export default SchoolDashboard;
