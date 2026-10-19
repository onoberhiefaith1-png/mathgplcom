// Mini Smartboard between an MCQ question and its options. It only exists when
// a teacher has linked a lesson-note solution (with Floating Numbers) to the
// question; lines are marked on the device just like the Smartboard.
// A page bar on its right edge scrolls the WHOLE page, so the question above
// and the options/Next below stay reachable while the board takes the touch.
import { useMemo } from "react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import PresentationView from "@/components/smartboard/PresentationView";
import { compileOfflineBoard } from "@/lib/offline/academiaPack";
import type { McqSolution } from "@/lib/academia/mcq/core";

const pageBy = (dir: 1 | -1) => window.scrollBy({ top: dir * Math.round(window.innerHeight * 0.6), behavior: "smooth" });

export default function McqSolutionBoard({ solution, keyId, onNext }: { solution: McqSolution; keyId: string; onNext?: () => void }) {
  const board = useMemo(() => compileOfflineBoard({
    activityId: `mcq-${keyId}`,
    subsectionId: solution.subsectionId || `mcq-${keyId}`,
    notebookId: solution.notebookId,
    title: "Solution",
    lines: solution.lines as never,
    questionText: solution.questionText ?? null,
    objects: (solution.objects as never) ?? null,
  }), [solution, keyId]);
  if (!board) return <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">This solution has no lines to solve yet.</p>;
  const btn = "flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow hover:bg-accent";
  return (
    <div className="flex items-stretch gap-2">
      <div className="relative h-[min(50vh,420px)] min-h-[300px] flex-1 resize-y overflow-hidden rounded-2xl border border-border bg-card">
        <PresentationView
          key={keyId}
          role="student"
          source={board.boardSource}
          notebookId={board.notebookId}
          assessmentId={board.assessmentId}
          boardStudentId={`mcq:${keyId}`}
          boardQuestionId={board.boardQuestionId}
          workspace="assignment"
          testMode
          localMarking
        />
      </div>
      <div className="flex flex-col items-center justify-center gap-2" aria-label="Page scroll">
        <button type="button" aria-label="Scroll page up" className={btn} onClick={() => pageBy(-1)}><ChevronUp className="h-5 w-5" /></button>
        <button type="button" aria-label="Scroll page down" className={btn} onClick={() => pageBy(1)}><ChevronDown className="h-5 w-5" /></button>
        {onNext && <button type="button" aria-label="Next question" className={`${btn} bg-primary text-primary-foreground`} onClick={onNext}><ChevronRight className="h-5 w-5" /></button>}
      </div>
    </div>
  );
}
