// Phase 9 — Class Adventures page (teacher). Lists active Adventures (lesson
// notes assigned to this class) with quick unassign. Additive: does not
// touch existing pages.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { listAdventureNotes, unassignAdventureNote, type ClassAdventureNoteRow } from "@/lib/adventures/classAdventures";

const ClassAdventuresPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const [rows, setRows] = useState<ClassAdventureNoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    const data = await listAdventureNotes(classId);
    setRows(data);
    setLoading(false);
  }, [classId]);

  useEffect(() => { refresh(); }, [refresh]);

  const onUnassign = async (id: string) => {
    await unassignAdventureNote(id);
    refresh();
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Adventures</h1>
        <p className="text-sm text-muted-foreground">
          Lesson notes assigned to this class. Unassigning preserves student progress.
        </p>
      </header>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Adventures assigned yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-md border border-border bg-card p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {r.notebook?.title ?? "Untitled note"}
                  {r.section?.title ? <span className="text-muted-foreground"> · {r.section.title}</span> : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.notebook?.subject ?? ""} {r.notebook?.subtopic ? `· ${r.notebook.subtopic}` : ""}
                  {r.due_at ? ` · due ${new Date(r.due_at).toLocaleString()}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.notebook?.id && (
                  <Link
                    to={`/teaching-hub/classes/${classId}/assignments/${r.notebook.id}/dashboard`}
                    className="rounded border border-border px-2 py-1 text-sm hover:bg-accent"
                  >
                    Dashboard
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => onUnassign(r.id)}
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

export default ClassAdventuresPage;
