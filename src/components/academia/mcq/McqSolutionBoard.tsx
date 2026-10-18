// Mini Smartboard between an MCQ question and its options. It only exists when
// a teacher has linked a lesson-note solution (with Floating Numbers) to the
// question; lines are marked on the device just like the Smartboard.
import { useMemo } from "react";
import PresentationView from "@/components/smartboard/PresentationView";
import { compileOfflineBoard } from "@/lib/offline/academiaPack";
import type { McqSolution } from "@/lib/academia/mcq/core";

export default function McqSolutionBoard({ solution, keyId }: { solution: McqSolution; keyId: string }) {
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
  return (
    <div className="relative h-[65vh] min-h-[380px] resize-y overflow-hidden rounded-2xl border border-border bg-card">
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
  );
}
