// Teacher-facing live view of a class game. Renders the game canvas with
// progress bars fed by live scores/heartbeats via useAdventureSync (Phase 3).
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getGame } from "@/lib/games/games";
import { loadClassGameBoards, type GameBoard } from "@/lib/games/gameQuestions";
import { useAdventureSync } from "@/hooks/useAdventureSync";
import GameCanvas from "@/components/gamebuilder/GameCanvas";
import { AssessmentStatusPanel } from "@/components/dashboards/AssessmentStatusPanel";
import TimeBarControls from "@/components/games/TimeBarControls";
import type { GameRow } from "@/lib/games/types";

const ClassGameLivePage = () => {
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

  const { elements, rows, achievedTotal, requiredTotal, studentCount } = useAdventureSync({
    classId,
    gameId,
    game,
    boards,
    currentUserId: userId,
    onGameUpdated: setGame,
  });

  if (!game) {
    return <div className="p-8 text-sm text-muted-foreground">Loading live game…</div>;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{game.title}</h1>
          <p className="text-sm text-muted-foreground">
            {studentCount} student{studentCount === 1 ? "" : "s"} • {achievedTotal} / {requiredTotal} marks
          </p>
        </div>
      </header>
      <GameCanvas elements={elements} selectedId={null} editable={false} />
      <AssessmentStatusPanel rows={rows} onViewStudent={() => {}} />
    </div>
  );
};

export default ClassGameLivePage;
