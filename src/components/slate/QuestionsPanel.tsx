// GAME → QUESTIONS. The Game holds the world and the repeating reward
// pattern; every question here comes from Lesson Notes / Floating Numbers and
// keeps its own mathematics, marks and timing.
//
// Line 0 is the Question Line: read-only, outside the reward pattern.

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import {
  listGameQuestions,
  removeQuestion,
  reorderQuestions,
  type GameQuestion,
} from "@/lib/slate/gameQuestions";
import { mapQuestionLines, patternLengthOf } from "@/lib/slate/pattern";
import { getReward } from "@/lib/slate/rewards";
import { SURFACES } from "@/lib/slate/surfaces";
import {
  MAX_VAULT_CODES,
  TIME_FRACTIONS,
  fractionSeconds,
  lineConfigOf,
  lineSurfacesInSync,
  syncLineSurfaces,
  type PreviewLine,
} from "@/lib/slate/lineSurfaces";
import { questionTimer } from "@/lib/lessonnotes/floatingCompile";
import type { Game, LineSurfaceConfig, TimeFraction } from "@/lib/slate/types";

interface Props {
  game: Game;
  /** Saves the Game-side configuration of the attached exercise's lines. */
  onChange: (settings: Game["settings"]) => void;
  /** Shows this question's real lines on the slate — preview only. */
  onPreview: (lines: PreviewLine[] | null) => void;
  onClose: () => void;
}

const rowClass =
  "rounded border border-amber-200/15 bg-black/30 px-3 py-2 text-[12px] text-amber-100/80";

export function QuestionsPanel({ game, onChange, onPreview, onClose }: Props) {
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setQuestions(await listGameQuestions(game.id));
    setLoading(false);
  }, [game.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* Attaching or re-reading an exercise creates one writing surface per
     Floating Numbers line. Surviving lines keep everything the teacher set. */
  useEffect(() => {
    if (loading) return;
    const lineIds = questions.flatMap((q) => q.lines.map((line) => line.lineId));
    if (lineSurfacesInSync(game.settings.lines, lineIds)) return;
    onChange({ ...game.settings, lines: syncLineSurfaces(game.settings.lines, lineIds) });
  }, [loading, questions, game.settings, onChange]);

  const setLine = (lineId: string, patch: Partial<LineSurfaceConfig>) => {
    const current = lineConfigOf(game, lineId);
    onChange({
      ...game.settings,
      lines: { ...game.settings.lines, [lineId]: { ...current, ...patch } },
    });
  };

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
            No questions yet. Questions are sent here from Lesson Notes: open the lesson note,
            press the 👥 button on the solution, choose Game and pick this Game. Its mathematics,
            marks and timing travel with it — one writing surface per line.
          </p>
        ) : null}

        {questions.map((q, index) => {
          const timer = questionTimer(q.scoring);
          const rows = mapQuestionLines(
            game,
            q.lines.map((line) => line.timerSeconds ?? null),
            q.lines.map((line) => line.lineId),
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
                  onClick={() =>
                    onPreview(
                      q.lines.map((line) => ({
                        equation: line.equation ?? "",
                        lineId: line.lineId,
                      })),
                    )
                  }
                  title="Show these lines on the slate (preview only)"
                  className="shrink-0 text-[10px] uppercase tracking-wider text-amber-200/60 hover:text-amber-100"
                >
                  Preview
                </button>
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
                <ul className="mt-3 space-y-2 border-t border-amber-200/10 pt-2 text-[11px]">
                  {rows.map((row) => {
                    const config = row.lineId ? lineConfigOf(game, row.lineId) : null;
                    return (
                      <li key={row.line} className="space-y-1">
                        <div className="flex items-baseline gap-2 font-mono">
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
                          </span>
                        </div>

                        {row.lineId && config ? (
                          <div className="ml-14 space-y-1">
                            {row.timerSeconds ? (
                              <label className="flex items-center gap-2 text-amber-100/60">
                                <span className="w-24 shrink-0">
                                  Hourglass ({row.timerSeconds}s line)
                                </span>
                                <select
                                  value={config.hourglassReward}
                                  onChange={(e) =>
                                    setLine(row.lineId!, {
                                      hourglassReward: e.target.value as TimeFraction,
                                    })
                                  }
                                  className="rounded border border-amber-200/20 bg-black/40 px-1.5 py-0.5 text-amber-50"
                                >
                                  {TIME_FRACTIONS.map((f) => (
                                    <option key={f.id} value={f.id}>{f.label}</option>
                                  ))}
                                </select>
                                <span className="text-amber-100/40">
                                  +{fractionSeconds(row.timerSeconds, config.hourglassReward)}s
                                </span>
                              </label>
                            ) : (
                              <p className="text-amber-100/35">
                                No line time in Floating Numbers — no Hourglass on this line.
                              </p>
                            )}

                            {/* This line's own writing surface. Empty = the
                                Game's surface, exactly as saved. */}
                            <label className="flex items-center gap-2 text-amber-100/60">
                              <span className="w-24 shrink-0">Writing surface</span>
                              <select
                                value={config.surfaceId ?? ""}
                                onChange={(e) =>
                                  setLine(row.lineId!, { surfaceId: e.target.value || null })
                                }
                                className="min-w-0 flex-1 rounded border border-amber-200/20 bg-black/40 px-1.5 py-0.5 text-amber-50"
                              >
                                <option value="">Game surface</option>
                                {SURFACES.map((s) => (
                                  <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                              </select>
                            </label>

                            {/* Vault Codes: the mathematics this line's Vaults
                                recognise. Only what the teacher writes exists. */}
                            <div className="space-y-1">
                              <p className="text-amber-200/50">
                                Vault codes ({config.vaultCodes.length}/{MAX_VAULT_CODES})
                              </p>
                              {config.vaultCodes.map((code, codeIndex) => (
                                <div key={codeIndex} className="flex items-center gap-2">
                                  <input
                                    value={code.expression}
                                    onChange={(e) =>
                                      setLine(row.lineId!, {
                                        vaultCodes: config.vaultCodes.map((item, i) =>
                                          i === codeIndex
                                            ? { ...item, expression: e.target.value }
                                            : item,
                                        ),
                                      })
                                    }
                                    placeholder="e.g. x + 7"
                                    className="min-w-0 flex-1 rounded border border-amber-200/20 bg-black/40 px-1.5 py-0.5 font-mono text-amber-50"
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    value={code.reward}
                                    onChange={(e) =>
                                      setLine(row.lineId!, {
                                        vaultCodes: config.vaultCodes.map((item, i) =>
                                          i === codeIndex
                                            ? { ...item, reward: Number(e.target.value) }
                                            : item,
                                        ),
                                      })
                                    }
                                    title="What this Vault pays"
                                    className="w-14 rounded border border-amber-200/20 bg-black/40 px-1.5 py-0.5 text-amber-50"
                                  />
                                  <button
                                    onClick={() =>
                                      setLine(row.lineId!, {
                                        vaultCodes: config.vaultCodes.filter(
                                          (_, i) => i !== codeIndex,
                                        ),
                                      })
                                    }
                                    title="Remove this Vault code"
                                    className="shrink-0 text-red-200/50 hover:text-red-200"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                              {config.vaultCodes.length < MAX_VAULT_CODES ? (
                                <button
                                  onClick={() =>
                                    setLine(row.lineId!, {
                                      vaultCodes: [
                                        ...config.vaultCodes,
                                        { expression: "", reward: 1 },
                                      ],
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-200/60 hover:text-amber-100"
                                >
                                  <Plus className="h-3 w-3" /> Vault code
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}

        <p className="pt-2 text-[10px] leading-relaxed text-amber-100/35">
          Questions arrive from Lesson Notes — they are never written here. Timing is part of the
          question: set the question time and any single-line time in Floating Numbers. A line with
          its own time automatically becomes a Timer Reward here.
        </p>
      </div>
    </aside>
  );
}

export default QuestionsPanel;
