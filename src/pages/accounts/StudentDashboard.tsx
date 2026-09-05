import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Building2,
  ClipboardList,
  Compass,
  Gauge,
  GraduationCap,
  Lock,
  Users,
} from "lucide-react";

import { Link, useLocation, useNavigate } from "@/lib/router-compat";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import DashboardHero from "@/components/workspace/DashboardHero";
import { EmptyNote, RailCard } from "@/components/workspace/DashboardParts";
import { useMyProgress, useMySkillBuilders } from "@/lib/student/useLearning";
import { connectedOwners } from "@/lib/student/workspaceAccess";
import PlanSection from "@/components/plans/PlanSection";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import StudentClassesPage from "@/pages/accounts/StudentClassesPage";
import StudentAllAssignmentsPage from "@/pages/student/StudentAllAssignmentsPage";
import StudentAllAdventuresPage from "@/pages/student/StudentAllAdventuresPage";
import StudentAllSkillBuilderPage from "@/pages/student/StudentAllSkillBuilderPage";
import RequestsPage from "@/pages/connections/RequestsPage";
import MyAccountPage from "@/pages/accounts/MyAccountPage";
import WorkspaceGoLive from "@/components/workspace/WorkspaceGoLive";

type Area = "learning" | "connections" | "courses" | "overall";

/** Everything the left navigation can open inside the workspace itself. */
type Panel =
  | "classes"
  | "assignments"
  | "adventure"
  | "courses"
  | "schools"
  | "teachers"
  | "requests"
  | "account"
  | "golive";

const PANELS: Panel[] = [
  "classes",
  "assignments",
  "adventure",
  "courses",
  "schools",
  "teachers",
  "requests",
  "account",
  "golive",
];

const PANEL_TITLE: Record<Panel, string> = {
  classes: "My Classes",
  assignments: "Assignments",
  adventure: "Adventure",
  courses: "Courses",
  schools: "My Schools",
  teachers: "My Teachers",
  requests: "Requests",
  account: "Account",
  golive: "Go Live",
};

/** Height reserved for the viewport-fixed four-area bar. */
const BAR_INSET = 92;

const NAV: { id: Area; label: string; icon: typeof Users }[] = [
  { id: "learning", label: "Learning", icon: GraduationCap },
  { id: "connections", label: "Connections", icon: Building2 },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "overall", label: "Overall View", icon: Gauge },
];

/** The learning layer: everything the student has activated, across workspaces. */
const AREAS: { to: string; label: string; blurb: string; icon: typeof Users }[] = [
  { to: "/student?panel=classes", label: "My Classes", blurb: "Open a class to see only its content.", icon: Users },
  {
    to: "/student?panel=assignments",
    label: "Assignments",
    blurb: "Work from every class you belong to.",
    icon: ClipboardList,
  },
  {
    to: "/student?panel=adventure",
    label: "Adventure",
    blurb: "Play the Adventures your teachers prepared.",
    icon: Compass,
  },
  { to: "/student?panel=courses", label: "Courses", blurb: "Practice pathways across your classes.", icon: GraduationCap },
];

/**
 * The student's front door: one quiet screen with four destinations.
 *
 * LEARNING is the home — what the student can do right now. CONNECTIONS,
 * COURSES and OVERALL VIEW are the same dashboard showing a different area,
 * chosen from the bar pinned to the bottom of the screen. Everything the left
 * navigation offers opens here too, as a panel, so the student never leaves.
 */
const StudentDashboard = () => {
  const [area, setArea] = useState<Area>("learning");
  const location = useLocation();
  const navigate = useNavigate();
  // On phones the student tab bar already owns the very bottom of the screen,
  // so the four areas sit directly above it instead of underneath.
  const phone = useBreakpoint() === "phone";
  const tabBar = phone ? 56 : 0;
  const panel = useMemo<Panel | null>(() => {
    const value = new URLSearchParams((location.search ?? "").replace(/^\?+/, "")).get("panel");
    return PANELS.includes(value as Panel) ? (value as Panel) : null;
  }, [location.search]);
  const { data: progress, isLoading } = useMyProgress();
  const owners = useQuery({ queryKey: ["student-connected-owners"], queryFn: connectedOwners, staleTime: 30_000 });
  const skills = useMySkillBuilders();

  const classes = progress?.classes ?? [];
  const schools = (owners.data ?? []).filter((o) => o.kind === "school");
  const teachers = (owners.data ?? []).filter((o) => o.kind === "teacher");
  const waiting = (owners.data ?? []).filter((o) => !o.entered);

  const pathFor = (owner: { kind: "school" | "teacher"; ownerId: string; orgId: string | null; entered: boolean }) => {
    const base = owner.kind === "school" ? `/student/schools/${owner.orgId ?? ""}` : `/student/teachers/${owner.ownerId}`;
    return owner.entered ? `${base}/dashboard` : base;
  };

  const ownerList = (list: typeof schools, empty: string) =>
    list.length === 0 ? (
      <EmptyNote>{empty}</EmptyNote>
    ) : (
      <ul className="space-y-2">
        {list.map((owner) => (
          <li key={owner.ownerId}>
            <Link
              to={pathFor(owner)}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border/50 bg-background/40 p-3 transition hover:border-primary/40"
            >
              <span className="truncate text-sm">{owner.name}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {owner.entered ? "Open" : "Enter"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );

  // ── Overall View: the existing overview data, in one place ──────────────
  const overall = (
    <>
      <RailCard title="Overall progress">
        <div className="rounded-xl border border-border/50 bg-background/40 p-4 text-center">
          <div className="text-3xl font-semibold">{isLoading ? "—" : `${progress?.overall ?? 0}%`}</div>
          <div className="mt-1 text-xs text-muted-foreground">Across all of your classes</div>
        </div>
      </RailCard>

      <RailCard title="Class progress">
        {classes.length === 0 ? (
          <EmptyNote>Enter a school or teacher, then join a class to start tracking progress.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {classes.map((cls) => (
              <li key={cls.id}>
                <Link
                  to={`/student/class/${cls.id}`}
                  className="block rounded-xl border border-border/50 bg-background/40 p-3 transition hover:border-primary/40"
                >
                  <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <span className="truncate text-sm">{cls.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{cls.progress}%</span>
                  </span>
                  <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, Math.max(0, cls.progress))}%` }}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </RailCard>

      <RailCard title="Waiting to be opened">
        {waiting.length === 0 ? (
          <EmptyNote>Nothing is waiting — every connection you have is already open.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {waiting.map((owner) => (
              <li key={`waiting-${owner.ownerId}`}>
                <Link
                  to={pathFor(owner)}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-500/10 p-3 text-sm transition hover:border-amber-300"
                >
                  <span className="truncate">Open {owner.name} to activate their learning</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-amber-200">Enter</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </RailCard>
    </>
  );

  // ── Courses: the student's pathways, grouped by the class they came from ─
  const courseRows = skills.data ?? [];
  const courseClasses = Array.from(new Set(courseRows.map((r) => r.className)));

  const coursesView = (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Courses</h2>
      {skills.isLoading ? (
        <EmptyNote>Loading…</EmptyNote>
      ) : courseRows.length === 0 ? (
        <EmptyNote>No courses yet. They appear here once a teacher adds one to your class.</EmptyNote>
      ) : (
        <div className="space-y-5">
          {courseClasses.map((className) => (
            <div key={className}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {className}
              </h3>
              <ul className="space-y-2">
                {courseRows
                  .filter((r) => r.className === className)
                  .map((row) => {
                    const card = (
                      <div
                        className={`grid min-h-[64px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-4 ${
                          row.unlocked ? "border-border/60 bg-background/40" : "border-dashed border-border/60 bg-muted/20"
                        }`}
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                          {row.unlocked ? <BookOpen className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{row.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {row.unlocked
                              ? row.status === "completed"
                                ? "Completed"
                                : row.status === "in_progress"
                                  ? "In progress"
                                  : "Ready to start"
                              : `Complete ${row.blockedBy || "the previous course"} first`}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {row.unlocked ? "Open" : "Locked"}
                        </span>
                      </div>
                    );
                    return (
                      <li key={`${row.classId}:${row.courseId}`}>
                        {row.unlocked ? (
                          <Link to={`/student/class/${row.classId}/courses/${row.courseId}`} className="block">
                            {card}
                          </Link>
                        ) : (
                          <div aria-disabled className="cursor-not-allowed">
                            {card}
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const connectionsView = (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Connections</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">My Schools</span>
              <span className="block truncate text-xs text-muted-foreground">Your connected schools</span>
            </span>
          </div>
          <div className="mt-3">
            {owners.isLoading ? <EmptyNote>Loading…</EmptyNote> : ownerList(schools, "No school connection yet.")}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">My Teachers</span>
              <span className="block truncate text-xs text-muted-foreground">Your connected teachers</span>
            </span>
          </div>
          <div className="mt-3">
            {owners.isLoading ? <EmptyNote>Loading…</EmptyNote> : ownerList(teachers, "No teacher connection yet.")}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        A class lives inside a school's or a teacher's workspace — open one above and use Join Class in there.
      </p>
    </section>
  );

  // ── Panels: the left navigation opens its content right here ─────────────
  const ownerPanel = (list: typeof schools, title: string, empty: string) => (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h2>
      {owners.isLoading ? <EmptyNote>Loading…</EmptyNote> : ownerList(list, empty)}
    </section>
  );

  const panelView = () => {
    switch (panel) {
      case "classes":
        return <StudentClassesPage />;
      case "assignments":
        return <StudentAllAssignmentsPage />;
      case "adventure":
        return <StudentAllAdventuresPage />;
      case "courses":
        return <StudentAllSkillBuilderPage />;
      case "schools":
        return ownerPanel(schools, "My Schools", "No school connection yet.");
      case "teachers":
        return ownerPanel(teachers, "My Teachers", "No teacher connection yet.");
      case "requests":
        return <RequestsPage />;
      case "account":
        return <MyAccountPage />;
      case "golive":
        return (
          <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Go Live</h2>
            <WorkspaceGoLive />
          </section>
        );
      default:
        return null;
    }
  };

  const openArea = (next: Area) => {
    setArea(next);
    if (panel) navigate("/student");
  };

  return (
    <WorkspaceLayout
      title={panel ? PANEL_TITLE[panel] : "Student Workspace"}
      subtitle="Your learning hub"
      collapsibleNav
      keepNavOpen
      bottomInset={BAR_INSET + tabBar}
      railMode="drawer"
      onRailIconClick={() => openArea("overall")}
    >
      {panel ? (
        panelView()
      ) : (
        <>
          <DashboardHero blurb="Where you belong, and everything you are learning across it." />

      {area === "learning" && (
        <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Learning</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {AREAS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="grid min-h-[104px] grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-border/60 bg-background/40 p-5 transition hover:border-primary/40"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <item.icon className="h-6 w-6" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-semibold">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.blurb}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

          {area === "connections" && connectionsView}

          {area === "courses" && coursesView}

          {area === "overall" && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Overall view</h2>
              {overall}
            </section>
          )}

          {area === "learning" && <PlanSection />}
        </>
      )}

      {/* ── The four destinations: pinned to the screen, like an app bar ──── */}
      <nav
        aria-label="Dashboard areas"
        style={{ bottom: tabBar }}
        className="fixed inset-x-0 z-[70] grid grid-cols-4 gap-2 border-t border-border/60 bg-card/95 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur"
      >
        {NAV.map((item) => {
          const active = !panel && area === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => openArea(item.id)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-medium transition ${
                active
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

export default StudentDashboard;
