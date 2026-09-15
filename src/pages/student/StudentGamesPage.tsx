// Student Games — the Games the teacher assigned to this class. Games are
// played in Game Play; nothing here opens Adventure or the Game Board.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { Gamepad2 } from "lucide-react";
import {
  listStudentGameAssignments,
  type StudentGameAssignment,
} from "@/lib/slate/gameAssignments";

const StudentGamesPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const [slateGames, setSlateGames] = useState<StudentGameAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setSlateGames(await listStudentGameAssignments(classId));
    setLoading(false);
  }, [classId]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Gamepad2 className="h-6 w-6" /> Games
        </h1>
        <p className="text-sm text-muted-foreground">Games your teacher has assigned.</p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : slateGames.length === 0 ? (
        <p className="text-sm text-muted-foreground">No games assigned yet.</p>
      ) : (
        <section className="flex flex-col gap-2">
          {slateGames.map((g) => {
            const percent = g.totalMarks > 0
              ? Math.round((g.earnedMarks / g.totalMarks) * 100)
              : 0;
            return (
              <article
                key={g.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-medium">{g.gameName}</h2>
                    <p className="text-xs text-muted-foreground">
                      {[g.topic, g.subtopic].filter(Boolean).join(" · ") || "No topic set"}
                    </p>
                  </div>
                  <Link
                    to={`/game/play/${g.gameId}`}
                    className="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
                  >
                    Play
                  </Link>
                </div>
                <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <div><dt className="inline">Questions: </dt><dd className="inline text-foreground">{g.completedQuestions} / {g.questionCount}</dd></div>
                  <div><dt className="inline">Marks: </dt><dd className="inline text-foreground">{g.earnedMarks} / {g.totalMarks}</dd></div>
                  <div><dt className="inline">Pass mark: </dt><dd className="inline text-foreground">{g.passPercentage}%</dd></div>
                  <div><dt className="inline">Score: </dt><dd className="inline text-foreground">{percent}%</dd></div>
                </dl>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
};

export default StudentGamesPage;
