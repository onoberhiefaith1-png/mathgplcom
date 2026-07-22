// Phase 13 — Student Game Play page. Lists the assessments (question boards)
// wired into a class game so a student can jump into any of them. Complements
// StudentGameLivePage which shows live class totals; this one is a focused
// "pick a question and play" launcher.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getGame } from "@/lib/games/games";
import { loadClassGameBoards, type GameBoard } from "@/lib/games/gameQuestions";
import type { GameRow } from "@/lib/games/types";

const GamePlayPage = () => {
  const { classId, gameId } = useParams<{ classId: string; gameId: string }>();
  const [game, setGame] = useState<GameRow | null>(null);
  const [boards, setBoards] = useState<GameBoard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId || !gameId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [g, b] = await Promise.all([getGame(gameId), loadClassGameBoards(gameId, classId)]);
      if (cancelled) return;
      setGame(g);
      setBoards(b);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [classId, gameId]);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!game) return <div className="p-8 text-sm text-muted-foreground">Game not found.</div>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{game.title}</h1>
        <p className="text-sm text-muted-foreground">Pick a question board to play.</p>
      </header>
      {boards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No question boards linked to this game yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {boards.map((b) => (
            <li key={b.assessmentId} className="flex items-center justify-between rounded-md border border-border bg-card p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{b.title}</div>
                <div className="text-xs text-muted-foreground">{b.totalMarks} marks</div>
              </div>
              <Link
                to={`/student/class/${classId}/assessment/${b.assessmentId}`}
                className="rounded border border-border px-2 py-1 text-sm hover:bg-accent"
              >
                Play
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Link
          to={`/student/classes/${classId}/games/${gameId}/live`}
          className="text-sm text-primary underline"
        >
          View class live totals →
        </Link>
      </div>
    </div>
  );
};

export default GamePlayPage;
