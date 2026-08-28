// The student's solving-screen header.
//
// One slim professional row: where the student came from, what they are
// solving, how far through the card they are, the marks earned so far and the
// layout switcher. Nothing floats over the work surface.

import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft } from "lucide-react";

const StudentBoardHeader = ({
  backTo,
  backLabel = "Back",
  title,
  subtitle,
  questionIndex,
  questionTotal,
  earned,
  totalMarks,
  actions,
}: {
  backTo: string;
  backLabel?: string;
  title: string;
  subtitle?: string | null;
  questionIndex?: number | null;
  questionTotal?: number | null;
  earned?: number | null;
  totalMarks?: number | null;
  actions?: ReactNode;
}) => {
  const hasMarks = typeof totalMarks === "number" && totalMarks > 0;
  const hasEarned = hasMarks && typeof earned === "number";
  const pct = hasEarned ? Math.min(100, Math.round(((earned ?? 0) / (totalMarks as number)) * 100)) : 0;


  return (
    <header className="shrink-0 border-b border-border/60 bg-card/60 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 sm:px-5">
        <Link
          to={backTo}
          className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{backLabel}</span>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{title}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {subtitle && <span className="truncate">{subtitle}</span>}
            {typeof questionIndex === "number" && typeof questionTotal === "number" && questionTotal > 0 && (
              <span className="tabular-nums">
                Question {questionIndex} of {questionTotal}
              </span>
            )}
            {hasMarks && (
              <span className="tabular-nums">
                {hasEarned ? `${Math.round(earned as number)}/${totalMarks} marks` : `${totalMarks} marks`}
              </span>
            )}
          </div>
        </div>

        {actions}
      </div>

      {hasEarned && (

        <div
          className="h-1 w-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Marks earned"
        >
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      )}
    </header>
  );
};

export default StudentBoardHeader;
