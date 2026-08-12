import { useState } from "react";
import { Building2, ChevronDown, ChevronRight, GraduationCap, Loader2 } from "lucide-react";

import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { EmptyNote } from "@/components/workspace/DashboardParts";
import { useChildBreakdown } from "@/lib/family/useFamily";
import type { ChildOverview } from "@/lib/family/family";

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/** A ring that reads as one figure: the child's overall progress. */
const ProgressRing = ({ value }: { value: number }) => {
  const pct = clamp(value);
  return (
    <div
      className="grid h-20 w-20 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(hsl(var(--ws-gold)) ${pct * 3.6}deg, hsl(var(--ws-border)) 0deg)`,
      }}
      role="img"
      aria-label={`Overall progress ${pct}%`}
    >
      <span className="grid h-16 w-16 place-items-center rounded-full bg-ws-panel text-sm font-semibold text-foreground">
        {pct}%
      </span>
    </div>
  );
};

const MetricBar = ({ label, value }: { label: string; value: number }) => (
  <div className="min-w-0">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 font-semibold text-foreground">{clamp(value)}%</span>
    </div>
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ws-border/70">
      <div
        className="h-full rounded-full bg-gradient-to-r from-ws-violet to-ws-gold"
        style={{ width: `${clamp(value)}%` }}
      />
    </div>
  </div>
);

/**
 * One child on the Parent Console.
 *
 * The parent sees the child's overall progress across every school, the three
 * learning strands underneath it, and can open the per-school and per-teacher
 * split. Everything here is a reading, never an edit.
 */
const ChildProgressCard = ({ child }: { child: ChildOverview }) => {
  const [open, setOpen] = useState(false);
  const breakdown = useChildBreakdown(open ? child.childUserId : null);
  const rows = breakdown.data ?? [];

  return (
    <li className="rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{child.displayName}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            Student{child.username ? ` · @${child.username}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
          Active
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
        <ProgressRing value={child.progress} />
        <div className="min-w-0 space-y-2">
          <MetricBar label="Assignments" value={child.assignments} />
          <MetricBar label="Adventures" value={child.adventures} />
          <MetricBar label="Skill Builder" value={child.skillBuilder} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[repeat(2,minmax(0,1fr))_auto] items-end gap-3 border-t border-ws-border/60 pt-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Schools</p>
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Building2 className="h-3.5 w-3.5 text-ws-gold" /> {child.schools}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Teachers</p>
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <GraduationCap className="h-3.5 w-3.5 text-ws-violet" /> {child.teachers}
          </p>
        </div>
        <Button asChild className="min-h-[44px] shrink-0">
          <Link to={`/family/children/${child.childUserId}`}>View details</Link>
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 inline-flex min-h-[44px] items-center gap-2 text-xs font-medium text-ws-gold hover:underline"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Progress per school and teacher
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {breakdown.isLoading && (
            <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </p>
          )}
          {!breakdown.isLoading && rows.length === 0 && (
            <EmptyNote>No classes yet, so there is nothing to break down.</EmptyNote>
          )}
          {rows.map((row) => (
            <div
              key={`${row.kind}-${row.name}`}
              className="rounded-xl border border-ws-border/60 bg-ws-canvas/40 p-3"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
                <span className="inline-flex min-w-0 items-center gap-2 font-medium text-foreground">
                  {row.kind === "school" ? (
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-ws-gold" />
                  ) : (
                    <GraduationCap className="h-3.5 w-3.5 shrink-0 text-ws-violet" />
                  )}
                  <span className="truncate">{row.name}</span>
                </span>
                <span className="shrink-0 font-semibold text-foreground">{clamp(row.progress)}%</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {row.classes} {row.classes === 1 ? "class" : "classes"}
              </p>
            </div>
          ))}
        </div>
      )}
    </li>
  );
};

export default ChildProgressCard;
