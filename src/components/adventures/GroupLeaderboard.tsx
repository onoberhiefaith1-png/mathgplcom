// Teacher — Group Competition Board on the gameplay dashboard.
//
// Read-only: a live scoreboard of every team's progress against the master
// Progress Bar. Teams are created and edited on the Adventure page.

import { Trophy, Users } from "lucide-react";
import { GROUP_STATUS_LABEL } from "@/lib/adventures/groupCompetition";
import type { GroupStanding } from "@/lib/adventures/groupStandings";

const statusClass = (status: GroupStanding["status"]) =>
  status === "winner"
    ? "border-amber-400/60 bg-amber-400/15 text-amber-600 dark:text-amber-300"
    : status === "completed"
      ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-600 dark:text-emerald-300"
      : status === "eliminated"
        ? "border-border bg-muted/40 text-muted-foreground"
        : "border-primary/40 bg-primary/10 text-primary";

export function GroupLeaderboard({
  standings,
  masterLabel,
  winnerName,
}: {
  standings: GroupStanding[];
  masterLabel?: string | null;
  winnerName?: string | null;
}) {
  const ranked = standings.slice().sort((a, b) => b.fill - a.fill);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Group Competition
        </div>
        {masterLabel && (
          <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
            {masterLabel}
          </span>
        )}
      </div>

      {winnerName && (
        <div className="inline-flex w-full items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-600 dark:text-amber-300">
          <Trophy className="h-4 w-4" /> {winnerName} finished first and takes the reward.
        </div>
      )}

      {ranked.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No teams yet. Create them on the Adventure page under Game Mode.
        </p>
      ) : (
        <ol className="space-y-2">
          {ranked.map((s, i) => (
            <li key={s.group.id} className="rounded-xl border border-border bg-card/40 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 truncate text-sm font-semibold">
                  <span className="mr-1.5 text-muted-foreground tabular-nums">{i + 1}.</span>
                  {s.group.name}
                </div>
                <span className={"rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " + statusClass(s.status)}>
                  {GROUP_STATUS_LABEL[s.status]}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted/50">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.round(s.fill * 100))}%` }}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>{s.students} student{s.students === 1 ? "" : "s"}</span>
                <span className="tabular-nums">
                  <span className="font-semibold text-primary">{s.achieved}</span> / {s.required} marks
                </span>
                <span className="tabular-nums">{Math.round(s.fill * 100)}%</span>
                <span className="tabular-nums">Grand {s.grand}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
