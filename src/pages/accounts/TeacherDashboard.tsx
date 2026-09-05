import { useState } from "react";
import {
  Activity as ActivityIcon,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardList,
  Compass,
  GraduationCap,
  Lock,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

import { Link } from "@/lib/router-compat";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import { ActivityList, EmptyNote, StatCard } from "@/components/workspace/DashboardParts";

import DashboardHero from "@/components/workspace/DashboardHero";
import { useTeacherStats } from "@/lib/workspace/useWorkspaceStats";
import { useUpcomingSessions } from "@/lib/workspace/useUpcomingSessions";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { useConnections, useConnectionCounts } from "@/lib/connections/useConnections";
import WorkspaceInvitations from "@/components/accounts/WorkspaceInvitations";
import { useUpgradeGuard } from "@/lib/entitlements/useUpgradeGuard";
import type { FeatureKey } from "@/lib/entitlements/features";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/catalogues";

const QUICK: { to: string; labelKey: TranslationKey; icon: typeof BookOpen; feature?: FeatureKey }[] = [
  { to: "/lesson-notes", labelKey: "nav_lesson_notes", icon: BookOpen, feature: "create_lesson_notes" },
  { to: "/smartboard", labelKey: "nav_smartboard", icon: Sparkles, feature: "smartboard" },
  { to: "/teaching-hub/classes", labelKey: "nav_classes", icon: Users, feature: "classes" },
  { to: "/adventure", labelKey: "nav_adventure", icon: Compass, feature: "adventure" },
  { to: "/course-builder", labelKey: "nav_skill_builder", icon: GraduationCap, feature: "skill_builder" },
];

/** The four permanent workspace areas, exactly as the Student bar works. */
type Area = "quick" | "schedule" | "activity" | "school";

/** Height reserved for the viewport-fixed bottom bar. */
const BAR_INSET = 92;

const NAV: { id: Area; label: string; icon: typeof BookOpen }[] = [
  { id: "quick", label: "Quick Action", icon: Zap },
  { id: "schedule", label: "Schedule", icon: CalendarClock },
  { id: "activity", label: "Activity", icon: ActivityIcon },
  { id: "school", label: "My School", icon: Building2 },
];

const TILE =
  "flex min-h-[92px] flex-col justify-between rounded-2xl border border-ws-border/70 bg-ws-canvas/40 p-4 text-left transition hover:border-ws-gold/50";

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * The teacher's own workspace, in one clean read: what the numbers say, what is
 * next, what they can start now, what just happened, and who they teach.
 * Plan, Pricing, Refer & Earn and MathGPL Live live in the navigation only.
 */
const TeacherDashboard = () => {
  const t = useT();
  const { data, isLoading } = useTeacherStats();
  const { guard, allowed, dialog: upgradeDialog } = useUpgradeGuard();
  const { workspaces, activeOrgId, switchTo } = useWorkspace();
  const schedule = useUpcomingSessions();
  const { counts } = useConnectionCounts();
  const { data: accepted } = useConnections("accepted");
  const schools = workspaces.filter((w) => w.kind === "school" && !w.isOwner);
  const students = (accepted ?? []).filter((c) => c.counterpartRole === "student");
  const [area, setArea] = useState<Area>("quick");

  return (
    <WorkspaceLayout
      title={t("nav_teaching_hub")}
      subtitle={t("hub_your_workspace")}
      collapsibleNav
      bottomInset={BAR_INSET}
    >
      <DashboardHero />

      {/* 1 · Overview */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-ws-gold/80">Overview</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={t("hub_schools_connected")} value={data?.schools ?? 0} icon={Building2} loading={isLoading} to="/requests?view=schools" />
          <StatCard label={t("nav_students")} value={data?.students ?? 0} icon={Users} loading={isLoading} to="/teaching-hub/students" />
          <StatCard label={t("nav_classes")} value={data?.classes ?? 0} icon={GraduationCap} loading={isLoading} to="/teaching-hub/classes" />
          <StatCard label={t("nav_assignments")} value={data?.assignments ?? 0} icon={ClipboardList} loading={isLoading} to="/teaching-hub/classes" />
        </div>
      </section>

      {/* 2 · Schedule */}
      {area === "schedule" && (
      <section className="rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h2 className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-ws-gold/80">
            {t("hub_upcoming_schedule")}
          </h2>
          <Link to="/live" className="shrink-0 text-xs text-ws-gold hover:underline">
            MathGPL Live
          </Link>
        </div>
        {schedule.isLoading ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (schedule.data ?? []).length === 0 ? (
          <EmptyNote>{t("hub_nothing_scheduled")}</EmptyNote>
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
      )}

      {/* 3 · Quick action */}
      {area === "quick" && (
      <section className="rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ws-gold/80">Quick action</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK.map((item) =>
            !item.feature || allowed(item.feature) ? (
              <Link key={item.to} to={item.to} className={TILE}>
                <item.icon className="h-5 w-5 shrink-0 text-ws-gold" />
                <span className="truncate text-sm font-medium">{t(item.labelKey)}</span>
              </Link>
            ) : (
              <button
                key={item.to}
                type="button"
                onClick={() => guard(item.feature!, () => {})}
                className={`${TILE} text-muted-foreground`}
              >
                <Lock className="h-5 w-5 shrink-0" />
                <span className="truncate text-sm font-medium">{t(item.labelKey)}</span>
              </button>
            ),
          )}
        </div>
        {upgradeDialog}
      </section>
      )}

      {/* 4 · Activity */}
      {area === "activity" && (
      <section className="rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-ws-gold/80">Recent activities</h2>
        <ActivityList items={data?.activity ?? []} empty={t("hub_no_lesson_notes")} />
      </section>
      )}

      {/* 5 · My School */}
      {area === "school" && (
      <section className="rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-ws-gold/80">School &amp; students</h2>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-ws-border/60 bg-ws-canvas/40 p-4">
            <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <h3 className="truncate text-sm font-semibold">My school</h3>
              <Link to="/requests?view=schools" className="shrink-0 text-xs text-ws-gold hover:underline">
                Manage
              </Link>
            </div>
            {schools.length === 0 ? (
              <EmptyNote>{t("hub_no_school_yet")}</EmptyNote>
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
                        {school.orgId === activeOrgId ? t("status_active") : t("action_enter")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-ws-border/60 bg-ws-canvas/40 p-4">
            <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <h3 className="truncate text-sm font-semibold">My students</h3>
              <Link to="/teaching-hub/students" className="shrink-0 text-xs text-ws-gold hover:underline">
                View all
              </Link>
            </div>
            {students.length === 0 ? (
              <EmptyNote>{t("hub_no_students_yet")}</EmptyNote>
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
          </div>
        </div>

        <Link
          to="/requests"
          className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-ws-border/60 bg-ws-canvas/40 p-3 transition hover:border-ws-gold/50"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">Manage connections</span>
            <span className="block truncate text-xs text-muted-foreground">
              {counts.pendingIncoming} pending · {counts.schools} schools · {counts.students} students ·{" "}
              {counts.parents} parents
            </span>
          </span>
          <span className="shrink-0 text-xs text-ws-gold">Open</span>
        </Link>

        <div className="mt-4">
          <WorkspaceInvitations />
        </div>
      </section>
      )}

      <nav
        aria-label="Teacher workspace areas"
        style={{ bottom: 0 }}
        className="fixed inset-x-0 z-[70] grid grid-cols-4 gap-2 border-t border-ws-border/60 bg-ws-panel/95 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur"
      >
        {NAV.map((item) => {
          const active = area === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setArea(item.id)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-medium transition ${
                active
                  ? "border-ws-gold/40 bg-ws-gold/15 text-ws-gold"
                  : "border-transparent text-muted-foreground hover:border-ws-border hover:text-foreground"
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

export default TeacherDashboard;
