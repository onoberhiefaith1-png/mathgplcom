import { ClipboardList, Compass, GraduationCap, Radio, UserPlus, Users } from "lucide-react";

import { Link } from "@/lib/router-compat";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import DashboardHero from "@/components/workspace/DashboardHero";
import { EmptyNote, RailCard, StatCard } from "@/components/workspace/DashboardParts";
import { useMyAdventures, useMyAssignments, useMyProgress, useMySkillBuilders } from "@/lib/student/useLearning";
import { useWorkspace } from "@/lib/accounts/useWorkspace";

/** The four ways into learning, all reading content teachers already created. */
const AREAS: { to: string; label: string; blurb: string; icon: typeof Users }[] = [
  { to: "/student/classes", label: "My Classes", blurb: "Open a class to see only its content.", icon: Users },
  { to: "/student/assignments", label: "Assignments", blurb: "Work from every class you belong to.", icon: ClipboardList },
  { to: "/student/adventures", label: "Adventure", blurb: "Play the Adventures your teachers prepared.", icon: Compass },
  { to: "/student/skill-builder", label: "Skill Builder", blurb: "Practice pathways across your classes.", icon: GraduationCap },
];

/**
 * The student's front door: one view of their learning across every class, with
 * class-specific content one click away inside each class.
 */
const StudentDashboard = () => {
  const { data: progress, isLoading } = useMyProgress();
  const { data: assignments } = useMyAssignments();
  const { data: adventures } = useMyAdventures();
  const { data: skills } = useMySkillBuilders();
  const { workspaces, activeOrgId, switchTo } = useWorkspace();
  const schools = workspaces.filter((w) => w.kind === "school" && !w.isOwner);
  const classes = progress?.classes ?? [];

  const rail = (
    <>
      <RailCard title="Overall progress">
        <div className="rounded-xl border border-border/50 bg-background/40 p-4 text-center">
          <div className="text-3xl font-semibold">{isLoading ? "—" : `${progress?.overall ?? 0}%`}</div>
          <div className="mt-1 text-xs text-muted-foreground">Across all of your classes</div>
        </div>
      </RailCard>

      <RailCard title="Class progress">
        {classes.length === 0 ? (
          <EmptyNote>Join a class to start tracking your progress.</EmptyNote>
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

      <RailCard title="Go Live" action={{ to: "/account", label: "Open" }}>
        <p className="text-xs text-muted-foreground">
          Be discoverable so a school or a teacher can connect with you, and answer their requests.
        </p>
        <div className="mt-3 grid gap-2">
          <Link
            to="/account"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-background/50 px-4 text-sm transition hover:border-primary/50"
          >
            <Radio className="h-4 w-4" /> Go Live settings
          </Link>
          <Link
            to="/requests"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-background/50 px-4 text-sm transition hover:border-primary/50"
          >
            Requests
          </Link>
        </div>
      </RailCard>

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
    </>
  );

  return (
    <WorkspaceLayout title="Student Dashboard" subtitle="Your learning hub" rail={rail}>
      <DashboardHero blurb="Everything you are learning, across every class you belong to." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Overall progress" value={progress?.overall ?? 0} suffix="%" icon={GraduationCap} loading={isLoading} />
        <StatCard label="Classes" value={classes.length} icon={Users} loading={isLoading} to="/student/classes" />
        <StatCard label="Assignments" value={assignments?.length ?? 0} icon={ClipboardList} to="/student/assignments" />
        <StatCard label="Adventures" value={adventures?.length ?? 0} icon={Compass} to="/student/adventures" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {AREAS.map((area) => (
          <Link
            key={area.to}
            to={area.to}
            className="grid min-h-[96px] grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-5 transition hover:border-primary/40"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
              <area.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold">{area.label}</span>
              <span className="block text-xs text-muted-foreground">{area.blurb}</span>
            </span>
          </Link>
        ))}
      </div>

      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-border/60 bg-card/60 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Join a class</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Have a join code from your teacher? Add the class to your dashboard.
          </p>
        </div>
        <Link
          to="/student/join"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-5 text-sm font-medium text-primary transition hover:bg-primary/20"
        >
          <UserPlus className="h-4 w-4" /> Join Class
        </Link>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Skill Builder</h2>
        {(skills?.length ?? 0) === 0 ? (
          <EmptyNote>No Skill Builder activities in your classes yet.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {(skills ?? []).slice(0, 4).map((skill) => (
              <li key={`${skill.classId}:${skill.courseId}`}>
                <Link
                  to={skill.unlocked ? `/student/class/${skill.classId}/courses/${skill.courseId}` : "/student/skill-builder"}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border/50 bg-background/40 p-3 transition hover:border-primary/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{skill.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{skill.className}</span>
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {skill.unlocked ? "Open" : "Locked"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WorkspaceLayout>
  );
};

export default StudentDashboard;
