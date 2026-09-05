import { useState } from "react";
import { BarChart3, Building2, GraduationCap, Inbox, LayoutDashboard, Users, Zap } from "lucide-react";

import { Link } from "@/lib/router-compat";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import DashboardHero from "@/components/workspace/DashboardHero";
import { ActivityList, EmptyNote, RailCard, StatCard } from "@/components/workspace/DashboardParts";
import { useSchoolStats } from "@/lib/workspace/useWorkspaceStats";
import { useWorkspace } from "@/lib/accounts/useWorkspace";

const QUICK: { to: string; label: string }[] = [
  { to: "/school/teachers", label: "Teachers" },
  { to: "/school/students", label: "Students" },
  { to: "/requests", label: "Requests" },
  { to: "/school/pricing", label: "Pricing" },
  { to: "/community/discover", label: "Find teachers" },
  { to: "/account", label: "School Code & Go Live" },
];

/** The four permanent workspace areas, exactly as the Student bar works. */
type Area = "quick" | "overview" | "classes" | "reports";

/** Height reserved for the viewport-fixed bottom bar. */
const BAR_INSET = 92;

const NAV: { id: Area; label: string; icon: typeof Users }[] = [
  { id: "quick", label: "Quick Action", icon: Zap },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "classes", label: "Classes", icon: GraduationCap },
  { id: "reports", label: "Reports", icon: BarChart3 },
];

/**
 * The School Administrative Workspace — a command centre, not a teaching
 * surface. Its four areas are chosen from the bar pinned to the bottom of the
 * screen; Plan, Credits, Pricing and Refer & Earn live in the navigation.
 */
const SchoolDashboard = () => {
  const { data, isLoading } = useSchoolStats();
  const { active } = useWorkspace();
  const [area, setArea] = useState<Area>("quick");

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
      collapsibleNav
      bottomInset={BAR_INSET}
    >
      <DashboardHero blurb="Oversee the teachers and students connected to this school." />

      {/* 1 · Quick action */}
      {area === "quick" && (
        <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quick action</h2>
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
      )}

      {/* 2 · Overview */}
      {area === "overview" && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Teachers" value={data?.teachers ?? 0} icon={GraduationCap} loading={isLoading} to="/school/teachers" />
            <StatCard label="Students" value={data?.students ?? 0} icon={Users} loading={isLoading} to="/school/students" />
            <StatCard label="Classes" value={data?.classes ?? 0} icon={Building2} loading={isLoading} />
            <StatCard label="Pending requests" value={data?.pendingRequests ?? 0} icon={Inbox} loading={isLoading} to="/requests" />
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">This school</h2>
            <p className="text-xs text-muted-foreground">
              Every teacher and student connected to this school is counted once, however many classes they belong to.
            </p>
          </div>
        </section>
      )}

      {/* 3 · Classes */}
      {area === "classes" && (
        <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Classes in this school</h2>
          <ActivityList items={data?.activity ?? []} empty="No classes have been created inside this school yet." />
        </section>
      )}

      {/* 4 · Reports */}
      {area === "reports" && (
        <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Reports</h2>
          <p className="text-sm text-muted-foreground">
            The School Report combines the records of this school&rsquo;s teachers and students into one picture of school
            performance. A student in five classes is still one student in the school&rsquo;s unique count.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/school/teachers"
              className="min-h-[44px] rounded-full border border-border bg-background/50 px-4 py-2 text-sm transition hover:border-primary/50"
            >
              Teacher records
            </Link>
            <Link
              to="/school/students"
              className="min-h-[44px] rounded-full border border-border bg-background/50 px-4 py-2 text-sm transition hover:border-primary/50"
            >
              Student records
            </Link>
          </div>
        </section>
      )}

      <nav
        aria-label="School workspace areas"
        style={{ bottom: 0 }}
        className="fixed inset-x-0 z-[70] grid grid-cols-4 gap-2 border-t border-border/60 bg-card/95 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur"
      >
        {NAV.map((item) => {
          const activeArea = area === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setArea(item.id)}
              aria-current={activeArea ? "page" : undefined}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-medium transition ${
                activeArea
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </WorkspaceLayout>
  );
};

export default SchoolDashboard;
