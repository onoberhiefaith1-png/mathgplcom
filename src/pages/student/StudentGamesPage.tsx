// Phase 12 — Student Games list. Read-only list of games assigned to the
// student's class; links into the live game view.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Gamepad2 } from "lucide-react";
import { listClassGames, type ClassGameRow } from "@/lib/games/classGames";

const StudentGamesPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const [rows, setRows] = useState<ClassGameRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setRows(await listClassGames(classId));
    setLoading(false);
  }, [classId]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Gamepad2 className="h-6 w-6" /> Games
        </h1>
        <p className="text-sm text-muted-foreground">Games your teacher has assigned.</p>
      </header>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No games assigned yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((g) => (
            <li key={g.id} className="flex items-center justify-between rounded-md border border-border bg-card p-3">
              <div className="min-w-0 truncate font-medium">{g.title}</div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/student/class/${classId}/games/${g.id}/play`}
                  className="rounded border border-border px-2 py-1 text-sm hover:bg-accent"
                >
                  Play
                </Link>
                <Link
                  to={`/student/classes/${classId}/games/${g.id}/live`}
                  className="rounded border border-border px-2 py-1 text-sm hover:bg-accent"
                >
                  Live
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default StudentGamesPage;
