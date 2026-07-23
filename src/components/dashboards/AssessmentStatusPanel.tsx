// Shared Assessment/Assignment status panel used by both the Assignment
// Dashboard (per lesson note) and the Adventure Dashboard's right rail.
// Renders three clickable status buckets — In Progress / Completed / Inactive
// — and expands the selected bucket into a per-student table with a
// "View Student Work" action.

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, CircleDashed } from "lucide-react";



export type StudentProgressRow = {
  studentId: string;
  displayName: string;
  progressPct: number; // 0..100
  score: number;
  totalMarks: number;
  status: "inactive" | "in_progress" | "completed";
  online: boolean;
};

type Bucket = "in_progress" | "completed" | "inactive";

export function AssessmentStatusPanel({
  rows,
  onViewStudent,
}: {
  rows: StudentProgressRow[];
  onViewStudent: (studentId: string) => void;
}) {
  const [active, setActive] = useState<Bucket>("in_progress");

  const buckets = useMemo(() => {
    const inProgress = rows.filter((r) => r.status === "in_progress");
    const completed = rows.filter((r) => r.status === "completed");
    const inactive = rows.filter((r) => r.status === "inactive");
    return { in_progress: inProgress, completed, inactive };
  }, [rows]);

  const visible = buckets[active];

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
                <tr key={r.studentId} className="border-t border-border">
                  <td className="px-3 py-2">{r.displayName}</td>
                  <td className="px-3 py-2 tabular-nums">{Math.round(r.progressPct)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.score} / {r.totalMarks}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onViewStudent(r.studentId)}
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                    >
                      View Student Work
                    </button>
                  </td>
                </tr>
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
