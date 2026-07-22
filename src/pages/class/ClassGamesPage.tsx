// Phase 12/13 — Class Games page (teacher). Lists games assigned to this
// class with links into the live game view, Adventure Dashboard, and a
// Link-Adventure dialog for quickly jumping between adventures and games.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Gamepad2 } from "lucide-react";
import { listClassGames, unassignGameFromClass, type ClassGameRow } from "@/lib/games/classGames";
import LinkAdventureDialog from "@/components/adventures/LinkAdventureDialog";

const ClassGamesPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const [rows, setRows] = useState<ClassGameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkGameId, setLinkGameId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setRows(await listClassGames(classId));
    setLoading(false);
  }, [classId]);

  useEffect(() => { refresh(); }, [refresh]);

  const onUnassign = async (gameId: string) => {
    if (!classId) return;
    await unassignGameFromClass(gameId, classId);
    refresh();
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Gamepad2 className="h-6 w-6" /> Games
        </h1>
        <p className="text-sm text-muted-foreground">
          Games assigned to this class. Open a game to launch the live session with class progress.
        </p>
      </header>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No games assigned to this class yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((g) => (
            <li key={g.id} className="flex items-center justify-between rounded-md border border-border bg-card p-3">
              <div className="min-w-0 truncate font-medium">{g.title}</div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/teaching-hub/classes/${classId}/games/${g.id}/live`}
                  className="rounded border border-border px-2 py-1 text-sm hover:bg-accent"
                >
                  Live
                </Link>
                <Link
                  to={`/teaching-hub/classes/${classId}/games/${g.id}/dashboard`}
                  className="rounded border border-border px-2 py-1 text-sm hover:bg-accent"
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => setLinkGameId(g.id)}
                  className="rounded border border-border px-2 py-1 text-sm hover:bg-accent"
                >
                  Link Adventure
                </button>
                <button
                  type="button"
                  onClick={() => onUnassign(g.id)}
                  className="rounded border border-border px-2 py-1 text-sm hover:bg-accent"
                >
                  Unassign
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {classId && linkGameId && (
        <LinkAdventureDialog
          open={Boolean(linkGameId)}
          onOpenChange={(open) => { if (!open) setLinkGameId(null); }}
          classId={classId}
          gameId={linkGameId}
        />
      )}
    </div>
  );
};

export default ClassGamesPage;
