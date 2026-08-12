import { useState } from "react";

import DashboardShell from "@/components/accounts/DashboardShell";
import ConnectByCodeDialog from "@/components/connections/ConnectByCodeDialog";
import ConnectChildDialog from "@/components/family/ConnectChildDialog";
import { GoLiveToggle } from "@/components/connections/GoLiveToggle";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import { useChildBreakdown, useChildren } from "@/lib/family/useFamily";
import { useConnectionCounts } from "@/lib/connections/useConnections";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Loader2,
  Users,
  BarChart3,
} from "lucide-react";

/** One figure with its label — the header row of the Parent Portal. */
const Stat = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
      <Icon className="h-3.5 w-3.5" /> {label}
    </p>
    <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
  </div>
);

const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);

/**
 * One child. The parent sees the child's overall progress across every school,
 * and can open the breakdown per school and per teacher.
 */
const ChildCard = ({
  childUserId,
  displayName,
  username,
  schools,
  teachers,
  classes,
  progress,
}: {
  childUserId: string;
  displayName: string;
  username: string | null;
  schools: number;
  teachers: number;
  classes: number;
  progress: number;
}) => {
  const [open, setOpen] = useState(false);
  const breakdown = useChildBreakdown(open ? childUserId : null);
  const rows = breakdown.data ?? [];

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-slate-900">{displayName}</p>
          <p className="mt-0.5 text-sm text-slate-600">
            {username ? `@${username} · ` : ""}
            {schools} {schools === 1 ? "school" : "schools"} · {teachers}{" "}
            {teachers === 1 ? "teacher" : "teachers"} · {classes} {classes === 1 ? "class" : "classes"}
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-[44px]">
          <Link to={`/family/children/${childUserId}`}>View details</Link>
        </Button>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm text-slate-700">
          <span>Overall progress</span>
          <span className="font-semibold text-slate-900">{progress}%</span>
        </div>
        <div className="mt-2">
          <ProgressBar value={progress} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Progress per school and teacher
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {breakdown.isLoading && (
            <p className="inline-flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          )}
          {!breakdown.isLoading && rows.length === 0 && (
            <p className="text-sm text-slate-600">No classes yet, so there is nothing to break down.</p>
          )}
          {rows.map((row) => (
            <div
              key={`${row.kind}-${row.name}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                  {row.kind === "school" ? (
                    <Building2 className="h-3.5 w-3.5" />
                  ) : (
                    <GraduationCap className="h-3.5 w-3.5" />
                  )}
                  {row.name}
                </span>
                <span className="font-semibold text-slate-900">{row.progress}%</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {row.classes} {row.classes === 1 ? "class" : "classes"}
              </p>
              <div className="mt-2">
                <ProgressBar value={row.progress} />
              </div>
            </div>
          ))}
        </div>
      )}
    </li>
  );
};

/**
 * The Parent Portal.
 *
 * A parent is a guardian and an observer, never the student. Each child keeps
 * their own student account; the parent follows it, and can introduce a school
 * or a teacher — which the school or teacher accepts and the child confirms.
 */
const FamilyDashboard = () => {
  const { children, loading } = useChildren();
  const { counts } = useConnectionCounts();

  const average =
    children.length === 0
      ? 0
      : Math.round(children.reduce((sum, c) => sum + c.progress, 0) / children.length);

  return (
    <DashboardShell
      title="Parent Portal"
      subtitle="Follow your children's learning. Their accounts remain their own — you can look, never edit."
      actions={
        <>
          <ConnectByCodeDialog
            trigger={
              <Button type="button" variant="outline" className="min-h-[44px]">
                <Users className="mr-2 h-4 w-4" /> Connect to my child
              </Button>
            }
          />
          <ConnectChildDialog />
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={Users} label="Children" value={children.length} />
        <Stat icon={Building2} label="Schools" value={counts.schools} />
        <Stat icon={GraduationCap} label="Teachers" value={counts.teachers} />
        <Stat icon={BarChart3} label="Average progress" value={`${average}%`} />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dash-surface">My children</h2>
        {loading ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-dash-surface/70">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your family…
          </p>
        ) : children.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="font-semibold text-slate-900">No children linked yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Ask your child for their MathGPL ID or Share Code, then use “Connect to my child”. Your child
              accepts the request from their own account.
            </p>
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {children.map((child) => (
              <ChildCard key={child.childUserId} {...child} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Connections</h2>
          <p className="mt-1 text-sm text-slate-600">
            Schools and teachers connected to your family. A request you send for a child needs the school or
            teacher to accept, and then your child to confirm.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to="/requests?view=children">My children</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to="/requests?view=schools">Schools</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to="/requests?view=teachers">Teachers</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to="/requests">Requests</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <GoLiveToggle blurb="Going live lets schools and teachers find your parent account in the Community. Your children's work is never exposed." />
        </div>
      </section>
    </DashboardShell>
  );
};

export default FamilyDashboard;
