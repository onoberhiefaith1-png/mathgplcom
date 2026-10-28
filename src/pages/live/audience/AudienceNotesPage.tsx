import { useEffect, useState } from "react";
import { useParams } from "@/lib/router-compat";
import { BookOpen } from "lucide-react";

import AudienceShell from "./AudienceShell";
import { useAudienceAccess } from "@/lib/live/useAudienceAccess";
import { supabase } from "@/integrations/supabase/client";
import { NoteReader } from "@/components/lessonnotes/NoteReader";

type AudienceNote = { id: string; title: string | null; document_json: unknown };

/** Notes the teacher shared with this session, read-only. */
const AudienceNotesPage = () => {
  const { sessionId } = useParams();
  const access = useAudienceAccess(sessionId);
  const classId = access.session?.class_id ?? null;
  const [notes, setNotes] = useState<AudienceNote[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!classId || access.decision !== "enter") return;
    (async () => {
      const { data } = await supabase
        .from("class_lesson_notes")
        .select("notebook_id, notebooks(id, title, document_json)")
        .eq("class_id", classId)
        .eq("visibility", "student_access_enabled");
      const rows = (data ?? []) as unknown as { notebooks: AudienceNote | null }[];
      setNotes(rows.map((r) => r.notebooks).filter((n): n is AudienceNote => Boolean(n)));
    })();
  }, [classId, access.decision]);

  const open = notes.find((n) => n.id === openId) ?? null;

  return (
    <AudienceShell access={access} title="Session" backTo={`/live/s/${sessionId}`}>
      <h1 className="text-xl font-semibold sm:text-2xl">Notes</h1>

      {open ? (
        <div className="mt-4 space-y-4">
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="min-h-[44px] rounded-xl border border-border px-4 text-sm hover:bg-accent"
          >
            All notes
          </button>
          <article className="rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h2 className="mb-3 text-lg font-semibold">{open.title ?? "Note"}</h2>
            <NoteReader documentJson={open.document_json} />
          </article>
        </div>
      ) : notes.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">The teacher has not shared any notes yet.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {notes.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => setOpenId(note.id)}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-border bg-card/40 p-4 text-left transition hover:border-primary/40"
              >
                <BookOpen className="h-5 w-5 shrink-0 text-primary" />
                <span className="truncate text-sm font-semibold">{note.title ?? "Untitled note"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AudienceShell>
  );
};

export default AudienceNotesPage;
