import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { ArrowLeft, ChevronRight, Folder, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ContentNode, HierarchyLevel, LEVEL_LABEL, getClassLevels, listNodes,
} from "@/lib/classes/contentHierarchy";

type Note = { id: string; notebook_id: string; node_id: string | null; title: string };

/** Read-only mirror of the teacher's chosen organisation hierarchy. */
const StudentLessonNotesPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState("");
  const [levels, setLevels] = useState<HierarchyLevel[]>([]);
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [path, setPath] = useState<ContentNode[]>([]);

  const load = useCallback(async () => {
    if (!classId) return;
    const { data: cls } = await supabase.from("classes").select("name").eq("id", classId).maybeSingle();
    setClassName(cls?.name ?? "");
    setLevels(await getClassLevels(classId));
    setNodes(await listNodes(classId));
    const { data: rows } = await supabase
      .from("class_lesson_notes")
      .select("id, notebook_id, node_id, notebooks:notebook_id(title)")
      .eq("class_id", classId)
      .eq("visibility", "student_access_enabled");
    setNotes(
      ((rows ?? []) as unknown as { id: string; notebook_id: string; node_id: string | null; notebooks: { title: string | null } | null }[])
        .map((r) => ({ id: r.id, notebook_id: r.notebook_id, node_id: r.node_id, title: r.notebooks?.title ?? "Untitled" })),
    );
    setLoading(false);
  }, [classId]);

  useEffect(() => { void load(); }, [load]);

  const currentLevel: HierarchyLevel | null = levels[path.length] ?? null;
  const currentParentId = path.length ? path[path.length - 1].id : null;
  const currentNodeId = levels.length > 0 && path.length === levels.length ? currentParentId : null;

  const folderItems = useMemo(
    () => (currentLevel ? nodes.filter((n) => n.level === currentLevel && n.parent_id === currentParentId) : []),
    [nodes, currentLevel, currentParentId],
  );

  const visibleNotes = useMemo(
    () => (levels.length === 0 ? notes : notes.filter((n) => n.node_id === currentNodeId)),
    [notes, levels, currentNodeId],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading notes…
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to={`/student/class/${classId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Class
        </Link>
        <h1 className="truncate text-lg font-semibold tracking-wide">Lesson Notes · {className}</h1>
        <div className="w-20" />
      </header>

      {levels.length > 0 && (
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-6 pb-2 text-sm">
          {levels.map((lvl, i) => {
            const node = path[i];
            const isCurrent = path.length === i;
            return (
              <span key={lvl} className="inline-flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <button
                  onClick={() => setPath(path.slice(0, i))}
                  className={`rounded px-1.5 py-0.5 ${isCurrent ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {node ? node.name : LEVEL_LABEL[lvl]}
                </button>
              </span>
            );
          })}
          <span className="inline-flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className={path.length === levels.length ? "font-semibold" : "text-muted-foreground"}>Lesson Notes</span>
          </span>
        </nav>
      )}

      <main className="mx-auto max-w-5xl px-6 py-6">
        {currentLevel ? (
          folderItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              Nothing here yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {folderItems.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setPath([...path, n])}
                  className="rounded-xl border border-border bg-card/50 p-4 text-left transition hover:border-primary/50"
                >
                  <Folder className="mb-2 h-6 w-6 text-primary" />
                  <div className="truncate text-sm font-semibold">{n.name}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{LEVEL_LABEL[n.level]}</div>
                </button>
              ))}
            </div>
          )
        ) : visibleNotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No lesson notes here yet.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visibleNotes.map((n) => (
              <li key={n.id}>
                <Link
                  to={`/lesson-notes/${n.notebook_id}`}
                  className="block rounded-xl border border-border bg-background/40 p-3 transition hover:border-primary/40"
                >
                  <div className="truncate text-sm font-semibold">{n.title}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">Read-only</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

export default StudentLessonNotesPage;
