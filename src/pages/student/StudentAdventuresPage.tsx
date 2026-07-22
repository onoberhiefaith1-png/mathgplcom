// Phase 9 — Student Adventures page. Lists lesson notes currently assigned to
// this class as Adventures with a link to open each. Additive only.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { listAdventureNotes, type ClassAdventureNoteRow } from "@/lib/adventures/classAdventures";

const StudentAdventuresPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const [rows, setRows] = useState<ClassAdventureNoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    (async () => {
      const data = await listAdventureNotes(classId);
      if (!cancelled) { setRows(data); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [classId]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Adventures</h1>
        <p className="text-sm text-muted-foreground">Assigned lesson notes for your class.</p>
      </header>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Adventures yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-md border border-border bg-card p-3">
              <Link
                to={`/student/class/${classId}/assignment/${r.notebook_id}`}
                className="block"
              >
                <div className="font-medium">
                  {r.notebook?.title ?? "Untitled note"}
                  {r.section?.title ? <span className="text-muted-foreground"> · {r.section.title}</span> : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.notebook?.subject ?? ""} {r.notebook?.subtopic ? `· ${r.notebook.subtopic}` : ""}
                  {r.due_at ? ` · due ${new Date(r.due_at).toLocaleString()}` : ""}
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
