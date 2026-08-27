// Shared Assessment/Assignment status panel used by both the Assignment
// Dashboard (per lesson note) and the Adventure Dashboard's right rail.
// Renders three clickable status buckets — In Progress / Completed / Inactive
// — and expands the selected bucket into a per-student table with a
// "View Student Work" action.

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Circle, CircleDashed, Radio, Eye, Timer } from "lucide-react";



export type StudentProgressRow = {
  studentId: string;
  displayName: string;
  progressPct: number; // 0..100
  score: number;
  totalMarks: number;
  status: "inactive" | "in_progress" | "completed";
  online: boolean;
};

/** One question of the assignment card, with each student's best time (ms). */
export type QuestionEntry = {
  assessmentId: string;
  questionId: string;
  label: string;
  bestByStudent?: Record<string, number>;
};

type Bucket = "in_progress" | "completed" | "inactive";

const fmtMs = (ms: number) => {
  const s = Math.round(ms / 100) / 10;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s - m * 60)}s`;
};

export function AssessmentStatusPanel({
  rows,
  onViewStudent,
  onJoinLive,
  questions,
  onViewQuestion,
}: {
  rows: StudentProgressRow[];
  onViewStudent: (studentId: string) => void;
  /** Open the viewer following the student's board in real time. */
  onJoinLive?: (studentId: string) => void;
  /** Questions of this assignment card, for per-question saved work. */
  questions?: QuestionEntry[];
  /** Open one question's saved work for this student. */
  onViewQuestion?: (studentId: string, assessmentId: string, questionId: string) => void;
}) {
  const [active, setActive] = useState<Bucket>("in_progress");
  const [expanded, setExpanded] = useState<string | null>(null);

  const buckets = useMemo(() => {
    const inProgress = rows.filter((r) => r.status === "in_progress");
    const completed = rows.filter((r) => r.status === "completed");
    const inactive = rows.filter((r) => r.status === "inactive");
    return { in_progress: inProgress, completed, inactive };
  }, [rows]);

  const visible = buckets[active];
  const canExpand = !!(questions && questions.length > 0 && onViewQuestion);


  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <BucketCard
          label="In Progress"
          count={buckets.in_progress.length}
          color="hsl(45 90% 55%)"
          icon={<Circle className="h-3.5 w-3.5" />}
          active={active === "in_progress"}
          onClick={() => setActive("in_progress")}
        />
        <BucketCard
          label="Completed"
          count={buckets.completed.length}
          color="hsl(142 70% 45%)"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          active={active === "completed"}
          onClick={() => setActive("completed")}
        />
        <BucketCard
          label="Inactive"
          count={buckets.inactive.length}
          color="hsl(215 15% 55%)"
          icon={<CircleDashed className="h-3.5 w-3.5" />}
          active={active === "inactive"}
          onClick={() => setActive("inactive")}
        />

      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        {visible.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No students in this bucket.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Student</th>
                <th className="px-3 py-2 font-medium">Progress</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <>
                <tr key={r.studentId} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      {canExpand && (
                        <button
                          type="button"
                          onClick={() => setExpanded((v) => (v === r.studentId ? null : r.studentId))}
                          className="rounded p-0.5 hover:bg-accent"
                          title="Per-question work"
                        >
                          {expanded === r.studentId
                            ? <ChevronDown className="h-3.5 w-3.5" />
                            : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      <span
                        className={`h-2 w-2 rounded-full ${r.online ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                        title={r.online ? "On the board" : "Offline"}
                      />
                      {r.displayName}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{Math.round(r.progressPct)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.score} / {r.totalMarks}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onViewStudent(r.studentId)}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                      >
                        View Student Work
                      </button>
                      {onJoinLive && (
                        <button
                          type="button"
                          onClick={() => onJoinLive(r.studentId)}
                          disabled={!r.online}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs enabled:hover:bg-accent disabled:opacity-40"
                          title={r.online ? "Follow this student's board live" : "Student is not on the board"}
                        >
                          <Radio className="h-3 w-3" /> Join Live
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {canExpand && expanded === r.studentId && (
                  <tr key={`${r.studentId}-questions`} className="border-t border-border bg-muted/20">
                    <td colSpan={4} className="px-3 py-2">
                      <div className="space-y-1">
                        {questions!.map((q) => {
                          const best = q.bestByStudent?.[r.studentId];
                          return (
                            <div
                              key={`${q.assessmentId}-${q.questionId}`}
                              className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5"
                            >
                              <div className="text-xs font-medium">{q.label}</div>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
                                  <Timer className="h-3 w-3" />
                                  {best != null ? `Best ${fmtMs(best)}` : "No best time"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onViewQuestion!(r.studentId, q.assessmentId, q.questionId)}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-accent"
                                >
                                  <Eye className="h-3 w-3" /> View Student Work
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
                </>
              ))}

            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function BucketCard({
  label, count, color, icon, active, onClick,
}: {
  label: string; count: number; color: string; icon: React.ReactNode;
  active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        active ? "border-primary bg-primary/5" : "border-border bg-card/40 hover:border-primary/40"
      }`}
    >
      <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
        {icon} {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{count}</div>
    </button>
  );
}
