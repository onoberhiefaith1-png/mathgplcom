// GAME EVALUATION — the teacher's live, line-by-line Game Inspector.
//
// It renders ONLY what the Game already knows about the CURRENT active line. It
// never writes to the Game, never grades and never selects a line.

import { Brain, X } from "lucide-react";
import { PresenterMath } from "@/components/smartboard/PresenterMath";
import { PREDICTIVE_NO_ROUTE_LABEL } from "@/lib/predictive/predictiveLine";
import { GameClockDisplay } from "@/components/gameslate/GameClockDisplay";
import {
  MATH_STATUS_LABEL,
  REWARD_STAGE_SHORT,
  groupRewards,
  type InspectEvent,
  type LineReport,
  type RewardReport,
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

/** One reward, shown as its own Game artwork plus a short live status. */
const RewardChip = ({
  reward,
  countdown,
}: {
  reward: RewardReport;
  countdown: number | null;
}) => {
  const done = reward.stage === "awarded" || reward.stage === "condition_met" || reward.stage === "activated";
  const complete = reward.type === "mark-seal" && done;
  const status = complete
    ? "✓ COMPLETE"
    : reward.type === "mark-seal" && reward.stage === "waiting"
      ? "PENDING"
      : REWARD_STAGE_SHORT[reward.stage];
  const art = reward.openArt && done ? reward.openArt : reward.art;
  return (
    <div className="flex w-14 flex-col items-center gap-0.5" title={`${reward.label} — ${reward.condition}`}>
      <img
        src={art}
        alt={reward.label}
        loading="lazy"
        className={`h-9 w-9 object-contain transition ${done ? "" : "opacity-45 grayscale"}`}
        style={done ? { filter: `drop-shadow(0 0 6px ${reward.glow})` } : undefined}
      />
      {reward.code ? (
        <span className="max-w-full truncate font-mono text-[10px]" title={reward.code}>
          {reward.code}
        </span>
      ) : null}
      {countdown ? (
        <GameClockDisplay deadline={countdown}>
          {(label) => <span className="text-[10px] tabular-nums">{label}</span>}
        </GameClockDisplay>
      ) : null}
      <span
        className={`text-center text-[9px] font-semibold leading-tight ${
          reward.stage === "waiting"
            ? "text-muted-foreground"
            : reward.stage === "expired"
              ? "text-rose-600"
              : "text-emerald-600"
        }`}
      >
        {status}
      </span>
    </div>
  );
};

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
              <PresenterMath ascii={report?.expected} color="currentColor" />
            </Field>
            <Field label="Student line">
              <PresenterMath ascii={report?.student} color="currentColor" />
            </Field>
            <Field label="Predictive line">
              {report?.noRoute ? (
                <span className="text-rose-600">{PREDICTIVE_NO_ROUTE_LABEL}</span>
              ) : report?.structureMissing ? (
                <span className="text-amber-600">Keep going — {report.structureMissing}.</span>
              ) : report?.predictive ? (
                <span>
                  <PresenterMath ascii={report.predictive} color="currentColor" />
                  {report.remaining ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                       (remaining <PresenterMath ascii={report.remaining} color="currentColor" />)
                    </span>
                  ) : null}
                </span>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Mathematical evaluation">
              {report ? MATH_STATUS_LABEL[report.status] : "—"}
            </Field>
            <Field label="Score / mark">
              {report?.scoreAwarded ? (
                <span className="text-emerald-600">✓ Awarded {report.lineMarks}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="Note">
              {!report?.hasNote
                ? "No note on this line"
                : report.noteUnlocked
                  ? <span className="text-emerald-600">Unlocked — the mark was awarded</span>
                  : <span className="text-muted-foreground">Locked until this line's mark is awarded</span>}
            </Field>

            {/* REWARDS — one visual area for the current line. Every reward of
                the same type stands together; the artwork is the information and
                the only text is a short live status (and a Vault's own code). */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Rewards
              </div>
              {!report || report.rewards.length === 0 ? (
                <p className="text-xs text-muted-foreground">No rewards on this line.</p>
              ) : (
                <div className="flex flex-wrap items-start gap-2">
                  {groupRewards(report.rewards).map((group) => (
                    <div
                      key={group.type}
                      className="flex items-start gap-1.5 rounded-lg border border-border/50 bg-muted/20 p-1.5"
                    >
                      {group.items.map((reward) => (
                        <RewardChip
                          key={reward.id}
                          reward={reward}
                          countdown={
                            reward.type === "time-shard" && reward.stage === "activated"
                              ? resources.lineDeadline
                              : null
                          }
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
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
