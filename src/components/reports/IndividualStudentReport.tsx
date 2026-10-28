// INDIVIDUAL STUDENT ASSESSMENT REPORT — the detailed lens (default mode).

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import StudentSummaryCards from "./StudentSummaryCards";
import StudentAssessmentTable from "./StudentAssessmentTable";
import AssessmentDetailCard from "./AssessmentDetailCard";
import StudentProgressGraph from "./StudentProgressGraph";
import TopicBreakdown from "./TopicBreakdown";
import {
  summarise,
  topicBreakdown,
  type StudentAssessmentRow,
} from "@/lib/reports/studentReport";
import type { ClassMember } from "@/lib/reports/progressChart";

type TypeFilter = "all" | "assignment" | "adventure";
type TimeFilter = "all" | "7d" | "30d" | "term";

const TIME_LABEL: Record<TimeFilter, string> = {
  all: "All Time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  term: "Last 90 days",
};

const TYPE_FILTER_LABEL: Record<TypeFilter, string> = {
  all: "All Types",
  assignment: "Assignment",
  adventure: "Adventure",
};

const DAYS: Record<Exclude<TimeFilter, "all">, number> = { "7d": 7, "30d": 30, term: 90 };

const Pill = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--rp-border))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--rp-muted))] transition hover:text-[hsl(var(--rp-fg))]"
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
      {children}
    </DropdownMenuContent>
  </DropdownMenu>
);

const fmtWhen = (iso: string | null) =>
  iso
    ? `${new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
    : "—";

const IndividualStudentReport = ({
  className,
  members,
  selectedStudentId,
  onSelectStudent,
  rows,
}: {
  className: string;
  members: ClassMember[];
  selectedStudentId: string | null;
  onSelectStudent: (id: string) => void;
  rows: StudentAssessmentRow[];
}) => {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const student = members.find((m) => m.user_id === selectedStudentId) ?? null;
  const topics = useMemo(
    () => Array.from(new Set(rows.map((r) => r.topic))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const cutoff =
      timeFilter === "all" ? null : Date.now() - DAYS[timeFilter] * 24 * 60 * 60 * 1000;
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.mode !== typeFilter) return false;
      if (topicFilter !== "all" && r.topic !== topicFilter) return false;
      if (cutoff && (!r.at || new Date(r.at).getTime() < cutoff)) return false;
      return true;
    });
  }, [rows, typeFilter, topicFilter, timeFilter]);

  const summary = useMemo(() => summarise(filtered), [filtered]);
  const breakdown = useMemo(() => topicBreakdown(filtered), [filtered]);
  const detailRow =
    filtered.find((r) => r.assessmentId === selectedRowId) ?? filtered[0] ?? null;
  const recent = useMemo(
    () =>
      [...filtered]
        .filter((r) => r.at)
        .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
        .slice(0, 5),
    [filtered],
  );

  return (
    <div className="rounded-2xl border border-[hsl(var(--rp-border))] bg-[hsl(var(--rp-panel))] p-5">
      <h2 className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--rp-muted))]">
        Individual Student Assessment Report
      </h2>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[hsl(var(--rp-muted))]">Student:</span>
          <Pill label={student ? student.display_name : "Select student"}>
            {members.length === 0 ? (
              <DropdownMenuItem disabled>No students enrolled</DropdownMenuItem>
            ) : (
              members.map((m) => (
                <DropdownMenuItem key={m.user_id} onSelect={() => onSelectStudent(m.user_id)}>
                  {m.display_name}
                </DropdownMenuItem>
              ))
            )}
          </Pill>
        </div>
        <div className="text-sm text-[hsl(var(--rp-muted))]">Class: {className || "—"}</div>
      </div>

      <div className="mt-4">
        <StudentSummaryCards summary={summary} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">
          Assessment activities
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[hsl(var(--rp-muted))]">Filter:</span>
          <Pill label={TYPE_FILTER_LABEL[typeFilter]}>
            {(["all", "assignment", "adventure"] as TypeFilter[]).map((t) => (
              <DropdownMenuItem key={t} onSelect={() => setTypeFilter(t)}>
                {TYPE_FILTER_LABEL[t]}
              </DropdownMenuItem>
            ))}
          </Pill>
          <Pill label={topicFilter === "all" ? "All Topics" : topicFilter}>
            <DropdownMenuItem onSelect={() => setTopicFilter("all")}>All Topics</DropdownMenuItem>
            {topics.map((t) => (
              <DropdownMenuItem key={t} onSelect={() => setTopicFilter(t)}>
                {t}
              </DropdownMenuItem>
            ))}
          </Pill>
          <Pill label={TIME_LABEL[timeFilter]}>
            {(["all", "7d", "30d", "term"] as TimeFilter[]).map((t) => (
              <DropdownMenuItem key={t} onSelect={() => setTimeFilter(t)}>
                {TIME_LABEL[t]}
              </DropdownMenuItem>
            ))}
          </Pill>
        </div>
      </div>

      <div className="mt-3">
        <StudentAssessmentTable rows={filtered} selectedId={detailRow?.assessmentId ?? null} onSelect={setSelectedRowId} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <AssessmentDetailCard row={detailRow} />
        <div className="rounded-xl border border-[hsl(var(--rp-border))] p-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">
            Progress over time
          </h3>
          <StudentProgressGraph rows={filtered} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[hsl(var(--rp-border))] p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">
            Topic performance
          </h3>
          <TopicBreakdown title="By topic" topics={breakdown} />
        </div>
        <div className="rounded-xl border border-[hsl(var(--rp-border))] p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">
            Recent activity
          </h3>
          {recent.length === 0 ? (
            <p className="text-sm text-[hsl(var(--rp-muted))]">No recorded activity yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recent.map((r) => (
                <li key={r.assessmentId} className="flex items-center justify-between gap-3">
                  <span className="text-[hsl(var(--rp-muted))] tabular-nums">{fmtWhen(r.at)}</span>
                  <span className="flex-1 truncate">{r.label}</span>
                  <span className="font-semibold tabular-nums">
                    {r.earned}/{r.available}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-[hsl(var(--rp-muted))]">
        Showing {filtered.length} of {rows.length} recorded assessments.
      </p>
    </div>
  );
};

export default IndividualStudentReport;
