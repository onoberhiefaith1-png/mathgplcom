// GAME → QUESTIONS. The Game holds the world and the repeating reward
// pattern; every question here comes from Lesson Notes / Floating Numbers and
// keeps its own mathematics, marks and timing.
//
// Line 0 is the Question Line: read-only, outside the reward pattern.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import {
  assignQuestion,
  listGameQuestions,
  listPickableQuestions,
  removeQuestion,
  reorderQuestions,
  type GameQuestion,
  type PickableQuestion,
} from "@/lib/slate/gameQuestions";
import { mapQuestionLines, patternLengthOf } from "@/lib/slate/pattern";
import { getReward } from "@/lib/slate/rewards";
import { questionTimer } from "@/lib/lessonnotes/floatingCompile";
import type { Game } from "@/lib/slate/types";

interface Props {
  game: Game;
  onClose: () => void;
}

const rowClass =
  "rounded border border-amber-200/15 bg-black/30 px-3 py-2 text-[12px] text-amber-100/80";

export function QuestionsPanel({ game, onClose }: Props) {
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [picker, setPicker] = useState<PickableQuestion[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setQuestions(await listGameQuestions(game.id));
    setLoading(false);
  }, [game.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const move = async (index: number, delta: number) => {
    const next = [...questions];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setQuestions(next);
    await reorderQuestions(next.map((q) => q.id));
  };

  const patternLength = patternLengthOf(game);

  return (
    <aside className="flex h-full flex-col border-l border-amber-200/10 bg-[#100c07]">
      <header className="flex items-center justify-between border-b border-amber-200/10 px-4 py-3">
        <div>
          <h2 className="text-xs uppercase tracking-[0.24em] text-amber-200/70">Questions</h2>
          <p className="mt-1 text-[11px] text-amber-100/40">
            {patternLength}-Line reward pattern, repeating
          </p>
        </div>
        <button onClick={onClose} className="text-amber-100/50 hover:text-amber-100">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? <p className="text-[12px] text-amber-100/40">Loading…</p> : null}

        {!loading && questions.length === 0 ? (
          <p className="text-[12px] leading-relaxed text-amber-100/50">
            No questions yet. Add a question you already prepared in Lesson Notes — its
            mathematics, marks and timing travel with it.
          </p>
        ) : null}

        {questions.map((q, index) => {
          const timer = questionTimer(q.scoring);
          const rows = mapQuestionLines(
            game,
            q.lines.map((line) => line.timerSeconds ?? null),
          );
          return (
            <div key={q.id} className={rowClass}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-amber-200/60">
                  Q{index + 1}
                </span>
                <button
                  onClick={() => setOpenId(openId === q.id ? null : q.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-amber-50">
                    {q.questionText || "Question"}
                  </span>
                  <span className="block text-[10px] uppercase tracking-wider text-amber-100/40">
                    {q.lines.length} lines · {q.totalMarks} {q.scoring.label} ·{" "}
                    {timer ? `${timer}s` : "no timer"}
                  </span>
                </button>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button onClick={() => move(index, -1)} className="text-amber-100/40 hover:text-amber-100">
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button onClick={() => move(index, 1)} className="text-amber-100/40 hover:text-amber-100">
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
                <button
                  onClick={async () => {
                    await removeQuestion(q.id);
                    refresh();
                  }}
                  className="shrink-0 text-red-200/50 hover:text-red-200"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {openId === q.id ? (
                <ul className="mt-3 space-y-1 border-t border-amber-200/10 pt-2 font-mono text-[11px]">
                  {rows.map((row) => (
                    <li key={row.line} className="flex items-baseline gap-2">
                      <span className="w-14 shrink-0 text-amber-200/50">
                        {row.isQuestion ? "Line 0" : `Line ${row.line}`}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-amber-100/70">
                        {row.isQuestion
                          ? `${q.questionText || "Question"} (read-only)`
                          : q.lines[row.line - 1]?.equation ?? ""}
                      </span>
                      <span className="shrink-0 text-amber-100/50">
                        {row.rewards.length === 0
                          ? "—"
                          : row.rewards.map((r) => getReward(r.type).label).join(", ")}
                        {row.timerSeconds ? ` + Timer Reward ${row.timerSeconds}s` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}

        {picker ? (
          <div className="rounded border border-amber-200/20 bg-black/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-amber-200/60">
                Choose a question
              </span>
              <button onClick={() => setPicker(null)} className="text-amber-100/40">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {picker.length === 0 ? (
              <p className="mt-2 text-[11px] text-amber-100/50">
                No prepared questions found. Create Floating Numbers for a question in Lesson
                Notes first.
              </p>
            ) : (
              <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                {picker.map((p) => (
                  <li key={p.subsectionId}>
                    <button
                      onClick={async () => {
                        const ok = await assignQuestion(game.id, p.notebookId, p.subsectionId);
                        toast[ok ? "success" : "error"](
                          ok ? "Question added to this game." : "That question is already added.",
                        );
                        setPicker(null);
                        refresh();
                      }}
                      className="w-full rounded px-2 py-1.5 text-left text-[11px] text-amber-100/70 hover:bg-amber-200/10"
                    >
                      <span className="block truncate">{p.notebookTitle}</span>
                      <span className="block text-[10px] uppercase tracking-wider text-amber-100/40">
                        {p.label} · {p.lineCount} lines
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <button
            onClick={async () => setPicker(await listPickableQuestions())}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-amber-300/50 bg-amber-300/10 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-amber-100 hover:bg-amber-300/20"
          >
            <Plus className="h-3.5 w-3.5" /> Add question
          </button>
        )}

        <p className="pt-2 text-[10px] leading-relaxed text-amber-100/35">
          Timing is part of the question: set the question time and any single-line time in
          Floating Numbers. A line with its own time automatically becomes a Timer Reward here.
        </p>
      </div>
    </aside>
  );
}

export default QuestionsPanel;
