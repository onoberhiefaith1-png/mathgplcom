// Student — Adventures of one class.
//
// An Adventure is the teacher's reusable experience; the questions live on its
// progress bars. Students only ever open it to play.
import { useEffect, useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { listStudentAdventures, type StudentAdventure } from "@/lib/adventures/classAdventureLinks";
import { sectionCardStyle } from "@/lib/theme/sectionThemes";

const StudentAdventuresPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const [rows, setRows] = useState<StudentAdventure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    (async () => {
      const data = await listStudentAdventures(classId);
      if (!cancelled) { setRows(data); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [classId]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Adventures</h1>
        <p className="text-sm text-muted-foreground">Adventures your teacher shared with this class.</p>
      </header>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Adventures yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-section-ink/15 p-4 text-section-ink"
              style={sectionCardStyle("adventure")}
            >
              <Link to={`/student/class/${classId}/game/${r.gameId}`} className="block">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-section-ink/70">
                  {r.subtopic ? `${r.subtopic} · ` : ""}
                  {r.questionCount} question{r.questionCount === 1 ? "" : "s"} across {r.barCount} progress bar
                  {r.barCount === 1 ? "" : "s"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default StudentAdventuresPage;
