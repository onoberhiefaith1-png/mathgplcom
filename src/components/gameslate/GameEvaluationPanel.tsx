// GAME EVALUATION — the teacher's live, line-by-line Game Inspector.
//
// It renders ONLY what the Game already knows about the CURRENT active line. It
// never writes to the Game, never grades and never selects a line.

import { Brain, X } from "lucide-react";
import { GameClockDisplay } from "@/components/gameslate/GameClockDisplay";
import {
  MATH_STATUS_LABEL,
  REWARD_STAGE_LABEL,
  type InspectEvent,
  type LineReport,
} from "@/lib/game/inspector";

export interface GameResourcesView {
  questionDeadline: number | null;
  lineDeadline: number | null;
  lives: number;
  vaultsOpened: number;
  vaultsTotal: number;
  vaultReward: number;
  completionCount: number;
  currentLine: number;
  completedLines: number;
  totalLines: number;
  earnedMarks: number;
  totalMarks: number;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-0.5">
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-xs">{children}</div>
  </div>
);

export function GameEvaluationPanel({
  open,
  onToggle,
  report,
  resources,
  events,
}: {
  open: boolean;
  onToggle: () => void;
  report: LineReport | null;
  resources: GameResourcesView;
  events: readonly InspectEvent[];
}) {
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-40 flex flex-col items-end gap-2">
      {open && (
        <section
          className="pointer-events-auto flex max-h-[70vh] w-[22rem] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-2xl backdrop-blur"
          aria-label="Game Evaluation"
        >
          <header className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <Brain className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-semibold tracking-wide">
              GAME EVALUATION · {report?.isQuestion ? "QUESTION LINE" : `LINE ${report?.line ?? resources.currentLine}`}
            </h2>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Close Game Evaluation"
              className="ml-auto rounded p-1 hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-2.5">
            <Field label="Expected line">
              <span className="font-mono">{report?.expected || "—"}</span>
            </Field>
            <Field label="Student line">
              <span className="font-mono whitespace-pre-wrap">{report?.student || "—"}</span>
            </Field>
            <Field label="Mathematical evaluation">
              {report ? MATH_STATUS_LABEL[report.status] : "—"}
            </Field>
            <Field label="Score / mark">
              {report?.scoreAwarded ? (
                <span className="text-emerald-600">✓ Awarded {report.lineMarks}</span>
              ) : report?.scoreInconsistent ? (
                <span className="text-amber-600">Equivalent detected / Score pending</span>
              ) : (
                <span className="text-muted-foreground">Pending</span>
              )}
            </Field>
            <Field label="Note">
              {!report?.hasNote
                ? "No note on this line"
                : report.noteUnlocked
                  ? <span className="text-emerald-600">Unlocked — the mark was awarded</span>
                  : <span className="text-muted-foreground">Locked until this line's mark is awarded</span>}
            </Field>

            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Rewards on this line
              </div>
              {!report || report.rewards.length === 0 ? (
                <p className="text-xs text-muted-foreground">No rewards configured on this line.</p>
              ) : (
                <ul className="space-y-1.5">
                  {report.rewards.map((reward) => (
                    <li key={reward.id} className="rounded-lg border border-border/60 px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{reward.label}</span>
                        <span
                          className={`ml-auto text-[10px] ${
                            reward.stage === "waiting"
                              ? "text-muted-foreground"
                              : reward.stage === "expired"
                                ? "text-rose-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {REWARD_STAGE_LABEL[reward.stage]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        CONDITION: {reward.condition}
                      </p>
                      {reward.type === "time-shard" && resources.lineDeadline ? (
                        <p className="text-[11px] tabular-nums">
                          <GameClockDisplay deadline={resources.lineDeadline}>
                            {(label) => <span>Countdown {label}</span>}
                          </GameClockDisplay>
                        </p>
                      ) : null}
                      {reward.detail ? (
                        <p className="text-[11px] text-muted-foreground">{reward.detail}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {report && !report.rewards.some((r) => r.type === "time-shard") ? (
                <p className="text-[11px] text-muted-foreground">Hourglass — none on this line.</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Game resources
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
                <span>
                  Time{" "}
                  <GameClockDisplay deadline={resources.questionDeadline}>
                    {(label) => <span>{label}</span>}
                  </GameClockDisplay>
                </span>
                <span>Life {resources.lives}</span>
                <span>Vault {resources.vaultsOpened}/{resources.vaultsTotal}</span>
                <span>Completion {resources.completionCount}</span>
                <span>Current line {resources.currentLine}</span>
                <span>Lines done {resources.completedLines}/{resources.totalLines}</span>
                <span>Marks {resources.earnedMarks}/{resources.totalMarks}</span>
                <span>Vault reward {resources.vaultReward}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Live activity
              </div>
              {events.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Waiting for the first event…</p>
              ) : (
                <ul className="space-y-0.5 text-[11px]">
                  {events.map((event) => (
                    <li key={event.id} className="text-muted-foreground">
                      {event.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={onToggle}
        aria-label="Game Evaluation"
        aria-expanded={open}
        title="Game Evaluation"
        className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/90 shadow-lg backdrop-blur hover:bg-accent"
      >
        <Brain className="h-5 w-5 text-primary" />
      </button>
    </div>
  );
}
