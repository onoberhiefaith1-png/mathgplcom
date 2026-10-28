// Student-facing live view of a class game. Renders the same live canvas as
// the teacher and, when a question board is selected, emits the 10s heartbeat
// so the teacher's "In progress" bucket updates. Phase 3.
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { getGame } from "@/lib/games/games";
import { loadClassGameBoards, type GameBoard } from "@/lib/games/gameQuestions";
import { useAdventureSync } from "@/hooks/useAdventureSync";
import { useAdventureHeartbeat } from "@/hooks/useAdventureHeartbeat";
import GameCanvas from "@/components/gamebuilder/GameCanvas";
import TimeBarControls from "@/components/games/TimeBarControls";
import type { GameRow } from "@/lib/games/types";

const StudentGameLivePage = () => {
  const { classId, gameId } = useParams<{ classId: string; gameId: string }>();
  const [params] = useSearchParams();
  const activeAssessmentId = params.get("assessmentId");
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

  const { elements, achievedTotal, requiredTotal } = useAdventureSync({
    classId,
    gameId,
    game,
    boards,
    currentUserId: userId,
    onGameUpdated: setGame,
  });

  useAdventureHeartbeat({
    enabled: Boolean(activeAssessmentId),
    classId,
    gameId,
    assessmentId: activeAssessmentId,
    questionId: null,
    studentId: userId,
  });

  const buttons = useMemo(
    () => boards.map((b) => ({ id: b.assessmentId, title: b.title })),
    [boards],
  );

  if (!game) {
    return <div className="p-8 text-sm text-muted-foreground">Loading game…</div>;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{game.title}</h1>
        <p className="text-sm text-muted-foreground">Class total: {achievedTotal} / {requiredTotal} marks</p>
      </header>
      <GameCanvas elements={elements} selectedId={null} editable={false} />
      {gameId && elements.filter((el) => el.progress).length > 0 && (
        <section className="grid gap-2 sm:grid-cols-2">
          {elements
            .filter((el) => el.progress)
            .map((el) => (
              <TimeBarControls
                key={el.id}
                gameId={gameId}
                progressElementId={el.id}
                label={el.label ?? "Progress bar"}
              />
            ))}
        </section>
      )}
      {buttons.length > 0 && (
        <section className="flex flex-wrap gap-2">
          {buttons.map((b) => (
            <Link
              key={b.id}
              to={`/student/assessment/${b.id}`}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
            >
              {b.title}
            </Link>
          ))}
        </section>
      )}
    </div>
  );
};

export default StudentGameLivePage;
