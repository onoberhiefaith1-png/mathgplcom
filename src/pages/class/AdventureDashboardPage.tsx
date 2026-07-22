// Phase 13 — Adventure Dashboard (teacher). Per-bar progress + per-student
// aggregate for a class + game combo. Reuses `useAdventureSync` so it stays
// in-lockstep with the live scoreboard without touching existing pages.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getGame } from "@/lib/games/games";
import { loadClassGameBoards, type GameBoard } from "@/lib/games/gameQuestions";
import { useAdventureSync } from "@/hooks/useAdventureSync";
import { AssessmentStatusPanel } from "@/components/dashboards/AssessmentStatusPanel";
import type { GameRow } from "@/lib/games/types";

const AdventureDashboardPage = () => {
  const { classId, gameId } = useParams<{ classId: string; gameId: string }>();
  const [game, setGame] = useState<GameRow | null>(null);
  const [boards, setBoards] = useState<GameBoard[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!gameId || !classId) return;
    let cancelled = false;
    (async () => {
      const [g, b] = await Promise.all([getGame(gameId), loadClassGameBoards(gameId, classId)]);
      if (cancelled) return;
      setGame(g);
      setBoards(b);
    })();
    return () => { cancelled = true; };
  }, [gameId, classId]);

  const { barSummaries, rows, achievedTotal, requiredTotal, studentCount } = useAdventureSync({
    classId, gameId, game, boards, currentUserId: userId, onGameUpdated: setGame,
  });

  if (!game) return <div className="p-8 text-sm text-muted-foreground">Loading dashboard…</div>;

  const overallPct = requiredTotal > 0 ? Math.round((achievedTotal / requiredTotal) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{game.title}</h1>
          <p className="text-sm text-muted-foreground">
            {studentCount} student{studentCount === 1 ? "" : "s"} • {achievedTotal} / {requiredTotal} marks ({overallPct}%)
          </p>
        </div>
        <Link
          to={`/teaching-hub/classes/${classId}/games/${gameId}/live`}
          className="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Open live game
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        {barSummaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No progress bars configured for this game.</p>
        ) : (
          barSummaries.map((b) => {
            const pct = b.required > 0 ? Math.min(100, (b.achieved / b.required) * 100) : 0;
            return (
              <div key={b.id} className="rounded-md border border-border bg-card p-3">
                <div className="flex items-baseline justify-between">
                  <div className="font-medium">{b.label}</div>
                  <div className="text-xs text-muted-foreground">{b.achieved} / {b.required}</div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  goal {b.goalPct}% • {b.segments} segments • {b.perSlot} marks/slot
                </div>
              </div>
            );
          })
        )}
      </section>

      <AssessmentStatusPanel rows={rows} onViewStudent={() => {}} />
    </div>
  );
};

export default AdventureDashboardPage;
