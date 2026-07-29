// Emoji Library dock panel for the lesson-note editor.
// Docks on the right (~30% of the editor width) so the note stays visible and
// editable. Content is 100% teacher-managed — nothing is generated.

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown, ChevronUp, Check, Pencil, Plus, Trash2, X,
} from "lucide-react";
import { useEmojiLibrary, splitEmojis } from "@/hooks/useEmojiLibrary";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Inserts plain text at the note's current cursor position. */
  onInsert: (text: string) => void;
}

export function EmojiPanel({ open, onClose, onInsert }: Props) {
  const {
    categories, loading,
    createCategory, renameCategory, saveContent, deleteCategory, moveCategory,
  } = useEmojiLibrary(open);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState(false);
  const [draft, setDraft] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const active = useMemo(
    () => categories.find((c) => c.id === activeId) ?? null,
    [categories, activeId],
  );

  useEffect(() => {
    if (!activeId && categories.length) setActiveId(categories[0].id);
    if (activeId && !categories.some((c) => c.id === activeId)) {
      setActiveId(categories[0]?.id ?? null);
    }
  }, [categories, activeId]);

  useEffect(() => {
    setEditingContent(false);
  }, [activeId]);

  if (!open) return null;

  const tiles = active ? splitEmojis(active.content) : [];

  return (
    <aside
      className="shrink-0 border-l border-border bg-background flex flex-col min-h-0 h-full self-stretch overscroll-contain"
      style={{ width: "clamp(280px, 30%, 420px)" }}
      onWheel={(e) => e.stopPropagation()}
      aria-label="Emoji library"
    >
      <div className="h-11 px-3 flex items-center justify-between border-b border-border">
        <div className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
          😊 Emoji Library
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-muted/60 text-foreground/70"
          aria-label="Close emoji library"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Sessions (categories) */}
      <div className="border-b border-border p-2 space-y-1 max-h-52 overflow-y-auto overscroll-contain">
        {loading && <p className="text-xs text-muted-foreground px-1">Loading…</p>}
        {!loading && categories.length === 0 && (
          <p className="text-xs text-muted-foreground px-1 py-2">
            No sessions yet. Create one, then paste your emojis into it.
          </p>
        )}
        {categories.map((c, idx) => (
          <div
            key={c.id}
            className={cn(
              "group flex items-center gap-1 rounded px-2 py-1 text-sm",
              c.id === activeId ? "bg-primary/15 text-foreground" : "hover:bg-muted/60",
            )}
          >
            {renamingId === c.id ? (
              <>
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void renameCategory(c.id, renameDraft.trim() || c.name);
                      setRenamingId(null);
                    }
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="flex-1 min-w-0 rounded border border-border bg-muted px-1.5 py-0.5 text-sm"
                />
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted"
                  aria-label="Save name"
                  onClick={() => {
                    void renameCategory(c.id, renameDraft.trim() || c.name);
                    setRenamingId(null);
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className="flex-1 min-w-0 truncate text-left"
                  title={c.name}
                >
                  {c.name}
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  disabled={idx === 0}
                  onClick={() => void moveCategory(c.id, -1)}
                  aria-label="Move up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  disabled={idx === categories.length - 1}
                  onClick={() => void moveCategory(c.id, 1)}
                  aria-label="Move down"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted"
                  onClick={() => { setRenamingId(c.id); setRenameDraft(c.name); }}
                  aria-label="Rename session"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-destructive/10 text-destructive"
                  onClick={() => { if (confirm(`Delete "${c.name}"?`)) void deleteCategory(c.id); }}
                  aria-label="Delete session"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={async () => {
            const created = await createCategory("New session");
            if (created) {
              setActiveId(created.id);
              setRenamingId(created.id);
              setRenameDraft(created.name);
            }
          }}
          className="mt-1 w-full inline-flex items-center justify-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted/60"
        >
          <Plus className="h-3.5 w-3.5" /> New session
        </button>
      </div>

      {/* Emoji grid / content editor */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2">
        {!active && (
          <p className="text-xs text-muted-foreground">Select or create a session.</p>
        )}

        {active && editingContent && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Paste Unicode emojis here, separated by spaces.
            </p>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={10}
              className="w-full rounded border border-border bg-muted p-2 text-lg leading-relaxed text-foreground"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { void saveContent(active.id, draft); setEditingContent(false); }}
                className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingContent(false)}
                className="rounded border border-border px-3 py-1 text-xs hover:bg-muted/60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {active && !editingContent && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {tiles.length} emoji{tiles.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => { setDraft(active.content); setEditingContent(true); }}
                className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-muted/60"
              >
                Edit content
              </button>
            </div>
            {tiles.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                This session is empty. Use “Edit content” to paste your emojis.
              </p>
            ) : (
              <div className="grid grid-cols-6 gap-1">
                {tiles.map((e, i) => (
                  <button
                    key={`${e}-${i}`}
                    type="button"
                    title={e}
                    onClick={() => onInsert(e)}
                    className="h-9 rounded text-xl leading-none hover:bg-muted/70 active:scale-95 transition"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export default EmojiPanel;
