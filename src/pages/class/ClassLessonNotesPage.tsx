import { useCallback, useEffect, useMemo, useState } from "react";
import { classRoot } from "@/lib/product/workspaceRoutes";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import {
  ArrowLeft, Plus, EyeOff, Eye, Trash2, Check, Compass, Settings2, ChevronRight, Folder, FolderPlus, X,
  Pencil, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import NotebookCover, { NotebookCoverData } from "@/components/lessonnotes/NotebookCover";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import { checkoutForEditing, copyIntoClassStorage } from "@/lib/lessonnotes/notebookCopy";
import {
  assignAdventureNote,
  listAdventureNotes,
  unassignAdventureNote,
} from "@/lib/adventures/classAdventures";
import {
  ContentNode, HierarchyLevel, LEVEL_LABEL, LEVEL_ORDER,
  createNode, deleteNode, getClassLevels, listNodes, setClassLevels, setNoteNode, toggleLevel,
} from "@/lib/classes/contentHierarchy";

type Notebook = NotebookCoverData & { id: string; subtopic: string };
type Attached = {
  id: string;
  notebook_id: string;
  node_id: string | null;
  visibility: "teacher_only" | "student_access_enabled";
  notebook: Notebook | null;
};

const NOTEBOOK_FIELDS =
  "id, title, teacher, class_name, session, subject, subtopic, color_index, cover_config";

const ClassLessonNotesPage = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [className, setClassName] = useState("");
  const [attached, setAttached] = useState<Attached[]>([]);
  const [available, setAvailable] = useState<Notebook[]>([]);
  const [picker, setPicker] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adventures, setAdventures] = useState<Map<string, string>>(new Map());

  // Organisation hierarchy
  const [levels, setLevels] = useState<HierarchyLevel[]>([]);
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  /** Selected node id per enabled level, in order. Length = depth navigated. */
  const [path, setPath] = useState<ContentNode[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

  const load = useCallback(async () => {
    if (!classId) return;
    const { data: cls } = await supabase.from("classes").select("name").eq("id", classId).single();
    if (cls) setClassName(cls.name);

    setLevels(await getClassLevels(classId));
    setNodes(await listNodes(classId));

    const { data: links } = await supabase
      .from("class_lesson_notes")
      .select("id, notebook_id, visibility, node_id")
      .eq("class_id", classId)
      .order("added_at", { ascending: false });
    const ids = (links ?? []).map((l) => l.notebook_id);
    const notebooks = ids.length
      ? (await supabase.from("notebooks").select(NOTEBOOK_FIELDS).in("id", ids)).data ?? []
      : [];
    setAttached(
      (links ?? []).map((l) => ({
        id: l.id,
        notebook_id: l.notebook_id,
        node_id: (l as { node_id?: string | null }).node_id ?? null,
        visibility: l.visibility as Attached["visibility"],
        notebook: (notebooks.find((n) => n.id === l.notebook_id) as Notebook | undefined) ?? null,
      })),
    );

    const advRows = await listAdventureNotes(classId);
    const map = new Map<string, string>();
    for (const row of advRows) {
      if (row.section_id === null) map.set(row.notebook_id, row.id);
    }
    setAdventures(map);
  }, [classId]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=${classRoot()}/${classId}/lesson-notes`);
        return;
      }
      const redirect = await ensureClassOwner(classId!, userData.user.id);
      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }
      await load();
    })();
  }, [classId, navigate, load]);

  // Keep the navigated path valid whenever levels/nodes change.
  useEffect(() => {
    setPath((p) => p.filter((n, i) => levels[i] === n.level && nodes.some((x) => x.id === n.id)));
  }, [levels, nodes]);

  /** Which level (if any) the user is currently browsing; null = lesson notes. */
  const currentLevel: HierarchyLevel | null = levels[path.length] ?? null;
  const currentParentId = path.length ? path[path.length - 1].id : null;
  const currentNodeId = path.length === levels.length && levels.length > 0 ? currentParentId : null;

  const folderItems = useMemo(
    () =>
      currentLevel
        ? nodes.filter((n) => n.level === currentLevel && n.parent_id === currentParentId)
        : [],
    [nodes, currentLevel, currentParentId],
  );

  const visibleNotes = useMemo(() => {
    if (levels.length === 0) return attached;
    return attached.filter((a) => a.node_id === currentNodeId);
  }, [attached, levels, currentNodeId]);

  const unsortedCount = useMemo(
    () => (levels.length === 0 ? 0 : attached.filter((a) => a.node_id === null).length),
    [attached, levels],
  );

  const openPicker = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { data: nbs } = await supabase
      .from("notebooks")
      .select(NOTEBOOK_FIELDS)
      .eq("owner_id", userData.user!.id)
      .eq("storage_scope", "workspace")
      .order("updated_at", { ascending: false });
    setAvailable((nbs ?? []) as Notebook[]);
    setSelected(new Set());
    setPicker(true);
  };

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  /**
   * Assigning a working note to a class stores an independent *duplicate*.
   * Deleting the working copy in Lesson Notes can never touch class storage.
   */
  const addToClass = async () => {
    if (selected.size === 0) return;
    setAttaching(true);
    try {
      const rows: { class_id: string; notebook_id: string; node_id: string | null }[] = [];
      for (const sourceId of selected) {
        const storedId = await copyIntoClassStorage(sourceId);
        rows.push({ class_id: classId!, notebook_id: storedId, node_id: currentNodeId });
      }
      const { error } = await supabase.from("class_lesson_notes").insert(rows as never);
      if (error) throw error;
      toast({
        title: `Stored ${rows.length} note${rows.length > 1 ? "s" : ""} in this class`,
        description: "A copy now lives permanently in the class.",
      });
      setPicker(false);
      load();
    } catch (e) {
      toast({ title: "Could not store", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setAttaching(false);
    }
  };

  /** Editing never happens inside storage: bring a working copy back to Lesson Notes. */
  const editInWorkspace = async (row: Attached) => {
    setBusyRow(row.id);
    try {
      const workingId = await checkoutForEditing(row.notebook_id, row.id);
      toast({ title: "Copied into Lesson Notes", description: "Save there to replace the class copy." });
      navigate(`/lesson-notes/${workingId}`);
    } catch (e) {
      toast({ title: "Could not open for editing", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusyRow(null);
    }
  };

  const toggleVisibility = async (row: Attached) => {
    const next = row.visibility === "teacher_only" ? "student_access_enabled" : "teacher_only";
    await supabase.from("class_lesson_notes").update({ visibility: next }).eq("id", row.id);
    load();
  };

  const detach = async (row: Attached) => {
    if (!window.confirm("Remove this stored note from the class? The stored copy is deleted.")) return;
    await supabase.from("class_lesson_notes").delete().eq("id", row.id);
    await supabase.from("notebooks").delete().eq("id", row.notebook_id);
    load();
  };

  const toggleAdventure = async (row: Attached) => {
    if (!classId) return;
    const existing = adventures.get(row.notebook_id);
    if (existing) {
      await unassignAdventureNote(existing);
      toast({ title: "Adventure removed" });
    } else {
      await assignAdventureNote({ classId, notebookId: row.notebook_id, sectionId: null });
      toast({ title: "Assigned as Adventure" });
    }
    load();
  };

  const onToggleLevel = async (level: HierarchyLevel, on: boolean) => {
    if (!classId) return;
    const next = toggleLevel(levels, level, on);
    try {
      await setClassLevels(classId, next);
      setLevels(next);
      setPath([]);
    } catch (e) {
      toast({ title: "Could not save settings", description: (e as Error).message, variant: "destructive" });
    }
  };

  const addFolder = async () => {
    if (!classId || !currentLevel || !newName.trim()) return;
    setCreating(true);
    try {
      await createNode({ classId, parentId: currentParentId, level: currentLevel, name: newName.trim() });
      setNewName("");
      setNodes(await listNodes(classId));
    } catch (e) {
      toast({ title: "Could not create", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const removeFolder = async (node: ContentNode) => {
    try {
      await deleteNode(node.id);
      setNodes(await listNodes(classId!));
      load();
    } catch (e) {
      toast({ title: "Could not delete", description: (e as Error).message, variant: "destructive" });
    }
  };

  const moveHere = async (row: Attached) => {
    await setNoteNode(row.id, currentNodeId);
    load();
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to={`${classRoot()}/${classId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Class
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Lesson Notes · {className}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
          >
            <Settings2 className="h-4 w-4" /> Settings
          </button>
          {!currentLevel && (
            <button onClick={openPicker} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90">
              <Plus className="h-4 w-4" /> Add To Class
            </button>
          )}
        </div>
      </header>

      {/* Breadcrumb — only rendered for enabled levels */}
      {levels.length > 0 && (
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-6 pb-2 text-sm">
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

      <main className="mx-auto max-w-7xl px-6 py-8">
        {currentLevel ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addFolder()}
                placeholder={`New ${LEVEL_LABEL[currentLevel]} name`}
                className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              />
              <button
                onClick={addFolder}
                disabled={!newName.trim() || creating}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
              >
                <FolderPlus className="h-4 w-4" /> Create {LEVEL_LABEL[currentLevel]}
              </button>
            </div>

            {folderItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                No {LEVEL_LABEL[currentLevel]} yet. Create one above to continue.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {folderItems.map((n) => (
                  <div key={n.id} className="group relative rounded-xl border border-border bg-card/50 p-4 transition hover:border-primary/50">
                    <button onClick={() => setPath([...path, n])} className="block w-full text-left">
                      <Folder className="mb-2 h-6 w-6 text-primary" />
                      <div className="truncate text-sm font-semibold">{n.name}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{LEVEL_LABEL[n.level]}</div>
                    </button>
                    <button
                      onClick={() => removeFolder(n)}
                      aria-label="Delete"
                      className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : visibleNotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No lesson notes here yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {visibleNotes.map((row) => {
              if (!row.notebook) return null;
              const enabled = row.visibility === "student_access_enabled";
              const isAdventure = adventures.has(row.notebook_id);
              return (
                <div key={row.id} className="relative">
                  <NotebookCover notebook={row.notebook} />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 rounded-b-md bg-black/60 px-2 py-1.5 backdrop-blur-sm">
                    <button
                      onClick={() => toggleVisibility(row)}
                      className={`inline-flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium ${
                        enabled ? "bg-green-500/80 text-white" : "bg-white/10 text-white/80"
                      }`}
                    >
                      {enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {enabled ? "Visible" : "Teacher Only"}
                    </button>
                    <button
                      onClick={() => toggleAdventure(row)}
                      className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium ${
                        isAdventure ? "bg-primary text-primary-foreground" : "bg-white/10 text-white/80"
                      }`}
                      aria-label={isAdventure ? "Unassign Adventure" : "Assign as Adventure"}
                    >
                      <Compass className="h-3 w-3" />
                      {isAdventure ? "Adventure" : "Assign"}
                    </button>
                    <button
                      onClick={() => editInWorkspace(row)}
                      disabled={busyRow === row.id}
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[10px] font-medium text-white/80 hover:bg-white/20"
                      aria-label="Edit in Lesson Notes"
                    >
                      {busyRow === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
                      Edit
                    </button>
                    <button
                      onClick={() => detach(row)}
                      className="rounded-md bg-white/10 p-1 text-white/80 hover:bg-destructive/80"
                      aria-label="Remove from class"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Unsorted bucket — notes attached before the hierarchy was enabled */}
        {!currentLevel && currentNodeId && unsortedCount > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Unsorted notes ({unsortedCount})
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {attached.filter((a) => a.node_id === null && a.notebook).map((row) => (
                <div key={row.id} className="relative">
                  <NotebookCover notebook={row.notebook!} />
                  <div className="absolute inset-x-0 bottom-0 rounded-b-md bg-black/60 px-2 py-1.5 backdrop-blur-sm">
                    <button
                      onClick={() => moveHere(row)}
                      className="w-full rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground"
                    >
                      Move here
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur" onClick={() => setSettingsOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <div className="text-base font-semibold">Organise lesson notes</div>
              <button onClick={() => setSettingsOpen(false)} aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Turn on the levels you want above Lesson Notes. Enabling a level automatically enables the ones beneath it.
            </p>
            <div className="space-y-2">
              {LEVEL_ORDER.map((lvl) => {
                const on = levels.includes(lvl);
                return (
                  <label key={lvl} className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span>{LEVEL_LABEL[lvl]}</span>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => onToggleLevel(lvl, e.target.checked)}
                      className="h-4 w-4 accent-current"
                    />
                  </label>
                );
              })}
              <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                <span>Lesson Notes</span>
                <span className="text-[11px]">Always on</span>
              </div>
            </div>
            {unsortedCount > 0 && levels.length > 0 && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                {unsortedCount} note{unsortedCount === 1 ? "" : "s"} are not filed yet. They appear under “Unsorted notes” at the deepest level and can be moved in.
              </p>
            )}
          </div>
        </div>
      )}

      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur" onClick={() => setPicker(false)}>
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-border px-5 py-4">
              <div className="text-base font-semibold">Select lesson notes</div>
              <div className="text-xs text-muted-foreground">
                {path.length > 0
                  ? `They will be filed under ${path.map((p) => p.name).join(" › ")}.`
                  : "Tap notebooks to select. They won't open — just tap to add."}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {available.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No more notes available to attach.</div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {available.map((n) => {
                    const isSel = selected.has(n.id);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => toggle(n.id)}
                        className={`group relative block w-full rounded-md transition ${isSel ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}`}
                      >
                        <NotebookCover notebook={n} />
                        {isSel && (
                          <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                            <Check className="h-4 w-4" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => setPicker(false)} className="rounded-md border border-border px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={addToClass} disabled={selected.size === 0 || attaching} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
                {attaching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Store In Class{selected.size > 0 ? ` (${selected.size})` : ""}
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassLessonNotesPage;
