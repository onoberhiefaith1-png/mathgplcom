import { useQuery } from "@tanstack/react-query";
import { Building2, ClipboardList, Compass, GraduationCap, Radio, UserPlus, Users } from "lucide-react";

import { Link } from "@/lib/router-compat";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import DashboardHero from "@/components/workspace/DashboardHero";
import { EmptyNote, RailCard, StatCard } from "@/components/workspace/DashboardParts";
import { useMyAdventures, useMyAssignments, useMyProgress, useMySkillBuilders } from "@/lib/student/useLearning";
import { connectedOwners } from "@/lib/student/workspaceAccess";
import PlanSection from "@/components/plans/PlanSection";
import CreditsSection from "@/components/plans/CreditsSection";

/** The learning layer: everything the student has activated, across workspaces. */
const AREAS: { to: string; label: string; blurb: string; icon: typeof Users }[] = [
  { to: "/student/classes", label: "My Classes", blurb: "Open a class to see only its content.", icon: Users },
  { to: "/student/assignments", label: "Assignments", blurb: "Work from every class you belong to.", icon: ClipboardList },
  { to: "/student/adventures", label: "Adventure", blurb: "Play the Adventures your teachers prepared.", icon: Compass },
  { to: "/student/skill-builder", label: "Skill Builder", blurb: "Practice pathways across your classes.", icon: GraduationCap },
];

/**
 * The student's front door, in two layers.
 *
 * CONNECTIONS says where the student belongs: their schools and teachers, each
 * one entered through its own building. LEARNING is the aggregation of every
 * workspace they have actually entered — classes, assignments, adventures and
 * Skill Builder together, tagged with the class they came from.
 */
const StudentDashboard = () => {
  const { data: progress, isLoading } = useMyProgress();
  const { data: assignments } = useMyAssignments();
  const { data: adventures } = useMyAdventures();
  const { data: skills } = useMySkillBuilders();
  const owners = useQuery({ queryKey: ["student-connected-owners"], queryFn: connectedOwners, staleTime: 30_000 });

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
    </>
  );

  return (
    <WorkspaceLayout title="Student Dashboard" subtitle="Your learning hub" rail={rail}>
      <DashboardHero blurb="Where you belong, and everything you are learning across it." />

      {/* ── Connections: the identity layer ─────────────────────────────── */}
      <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Connections</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Open a school or a teacher to step inside their workspace. Their classes and work join your learning below
          once you are in.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Building2 className="h-4 w-4" /> My Schools
            </h3>
            {owners.isLoading ? <EmptyNote>Loading…</EmptyNote> : ownerList(schools, "No school connection yet.")}
          </div>
          <div>
            <h3 className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <GraduationCap className="h-4 w-4" /> My Teachers
            </h3>
            {owners.isLoading ? <EmptyNote>Loading…</EmptyNote> : ownerList(teachers, "No teacher connection yet.")}
          </div>
        </div>
      </section>

      {/* ── Learning: only what has been activated ──────────────────────── */}
      {waiting.length > 0 && (
        <section className="rounded-2xl border border-amber-300/50 bg-amber-500/10 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Waiting to be opened</h2>
          <ul className="mt-3 space-y-2">
            {waiting.map((owner) => (
              <li key={owner.ownerId}>
                <Link
                  to={pathFor(owner)}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-amber-300/40 bg-background/50 p-3 text-sm transition hover:border-amber-300"
                >
                  <span className="truncate">Open {owner.name} to activate their learning</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-amber-200">Enter</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Overall progress" value={progress?.overall ?? 0} suffix="%" icon={GraduationCap} loading={isLoading} />
        <StatCard label="Classes" value={classes.length} icon={Users} loading={isLoading} to="/student/classes" />
        <StatCard label="Assignments" value={assignments?.length ?? 0} icon={ClipboardList} to="/student/assignments" />
        <StatCard label="Adventures" value={adventures?.length ?? 0} icon={Compass} to="/student/adventures" />
      </div>

      <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Learning</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {AREAS.map((area) => (
            <Link
              key={area.to}
              to={area.to}
              className="grid min-h-[96px] grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-border/60 bg-background/40 p-5 transition hover:border-primary/40"
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

        <div className="mt-3 grid grid-cols-1 gap-3 rounded-2xl border border-border/60 bg-background/40 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Join a class</h3>
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
        </div>
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
      <PlanSection />
      <CreditsSection />
    </WorkspaceLayout>
  );
};

export default StudentDashboard;
