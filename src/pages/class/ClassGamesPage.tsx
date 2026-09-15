// Class Games (teacher). A Class only ASSIGNS a Game — it never plays it and
// never opens Adventure. Building happens on the Game Board, playing happens
// in Game Play.
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Gamepad2 } from "lucide-react";
import { useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { unassignGame, summariseGame } from "@/lib/slate/gameAssignments";
import { ensureGameBoards } from "@/lib/slate/gameBoard";

interface Row {
  assignmentId: string;
  gameId: string;
  name: string;
  passPercentage: number;
  questionCount: number;
  totalMarks: number;
}

const ClassGamesPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);

  const refresh = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    const { data } = await supabase
      .from("slate_game_assignments")
      .select("id, game_id, pass_percentage, title, slate_games(name)")
      .eq("class_id", classId)
      .is("unassigned_at", null);

    const list = (data ?? []) as unknown as {
      id: string;
      game_id: string;
      pass_percentage: number;
      title: string | null;
      slate_games: { name: string } | null;
    }[];

    const built = await Promise.all(
      list.map(async (row) => {
        const summary = await summariseGame(row.game_id);
        return {
          assignmentId: row.id,
          gameId: row.game_id,
          name: row.slate_games?.name ?? row.title ?? "Game",
          passPercentage: Number(row.pass_percentage ?? 70),
          questionCount: summary.questionCount,
          totalMarks: summary.totalMarks,
        };
      }),
    );
    setRows(built);
    setLoading(false);
  }, [classId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Prepares each assigned Game's questions for the students' boards, using the
  // same compiler an Assignment uses. Safe to repeat: it refreshes in place.
  const prepare = useCallback(async () => {
    if (!classId || rows.length === 0) return;
    setPreparing(true);
    for (const row of rows) {
      try {
        await ensureGameBoards({ gameId: row.gameId, classId });
      } catch {
        /* a Game with no compiled questions is simply skipped */
      }
    }
    setPreparing(false);
  }, [classId, rows]);

  useEffect(() => { void prepare(); }, [prepare]);

  const onUnassign = async (assignmentId: string) => {
    await unassignGame(assignmentId);
    refresh();
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Gamepad2 className="h-6 w-6" /> Games
        </h1>
        <p className="text-sm text-muted-foreground">
          Games assigned to this class. Students play them in Game Play; you build them on the Game Board.
          {preparing ? " Preparing questions…" : ""}
        </p>
      </header>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Games assigned to this class yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((g) => (
            <li key={g.assignmentId} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{g.name}</div>
                <p className="text-xs text-muted-foreground">
                  {g.questionCount} question{g.questionCount === 1 ? "" : "s"} · {g.totalMarks} marks · pass {g.passPercentage}%
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/game/play/${g.gameId}`}
                  className="rounded border border-border px-2 py-1 text-sm hover:bg-accent"
                >
                  Play
                </Link>
                <Link
                  to={`/game/slate/${g.gameId}`}
                  className="rounded border border-border px-2 py-1 text-sm hover:bg-accent"
                >
                  Game Board
                </Link>
                <button
                  type="button"
                  onClick={() => onUnassign(g.assignmentId)}
                  className="rounded border border-border px-2 py-1 text-sm hover:bg-accent"
                >
                  Unassign
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ClassGamesPage;
