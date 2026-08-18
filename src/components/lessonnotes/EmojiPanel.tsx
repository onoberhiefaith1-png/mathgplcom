// Emoji Library dock panel for the lesson-note editor.
// Docks on the right (~30% of the editor width) so the note stays visible and
// editable. Content is 100% teacher-managed — nothing is generated. A session
// can hold Unicode emojis, pictures/videos pasted or uploaded from the
// teacher's computer, and items copied from the GPL Asset library.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown, ChevronUp, Check, Clipboard, FolderOpen, Loader2, Pencil, Plus,
  Trash2, Upload, X,
} from "lucide-react";
import { useEmojiLibrary, splitEmojis } from "@/hooks/useEmojiLibrary";
import OfficialEmojiSection from "@/components/gpl/OfficialEmojiSection";
import GplEmojiAssetPicker from "@/components/gpl/GplEmojiAssetPicker";
import { emojiMediaUrl, type EmojiItem } from "@/lib/lessonnotes/emojiItems";
import { copyMediaToClipboard, filesFromTransfer, linkFromTransfer } from "@/lib/clipboard/assetClipboard";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Inserts plain text at the note's current cursor position. */
  onInsert: (text: string) => void;
  /** Inserts a picture or video at the note's current cursor position. */
  onInsertMedia?: (src: string, kind: "image" | "video") => void;
}

/** One picture/video tile — resolves its private URL on mount. */
function MediaTile({
  item,
  onInsert,
  onRemove,
}: {
  item: EmojiItem;
  onInsert: () => void;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let alive = true;
    void emojiMediaUrl(item.storage_path ?? item.external_url ?? "").then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [item.storage_path, item.external_url]);

  return (
    <div className="group relative h-12 overflow-hidden rounded border border-border/60 bg-muted/30">
      <button
        type="button"
        title={item.name || "Insert"}
        onClick={onInsert}
        className="h-full w-full"
      >
        {!url ? (
          <span className="block h-full w-full animate-pulse bg-muted/50" aria-hidden />
        ) : item.kind === "video" ? (
          <video src={url} muted loop autoPlay playsInline className="h-full w-full object-contain" />
        ) : (
          <img src={url} alt={item.name} className="h-full w-full object-contain" draggable={false} />
        )}
      </button>
      <div className="absolute right-0.5 top-0.5 hidden gap-0.5 group-hover:flex">
        <button
          type="button"
          aria-label="Copy"
          className="rounded bg-foreground/70 p-0.5 text-background"
          onClick={async () => {
            if (!url) return;
            const res = await copyMediaToClipboard(url);
            toast({ title: res.message });
          }}
        >
          <Clipboard className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label="Remove"
          className="rounded bg-destructive/80 p-0.5 text-destructive-foreground"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function EmojiPanel({ open, onClose, onInsert, onInsertMedia }: Props) {
  const {
    categories, items, loading, busy,
    createCategory, renameCategory, saveContent, deleteCategory, moveCategory,
    addFiles, addLink, addGplAsset, removeItem,
  } = useEmojiLibrary(open);
  const { toast } = useToast();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState(false);
  const [draft, setDraft] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = useMemo(
    () => categories.find((c) => c.id === activeId) ?? null,
    [categories, activeId],
  );

  const activeItems = useMemo(
    () => items.filter((i) => i.category_id === activeId),
    [items, activeId],
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

  const insertItem = (item: EmojiItem) => {
    if (item.kind === "glyph" && item.glyph) {
      onInsert(item.glyph);
      return;
    }
    const src = item.storage_path ?? item.external_url ?? "";
    if (!src) return;
    if (onInsertMedia) onInsertMedia(src, item.kind === "video" ? "video" : "image");
    else toast({ title: "Pictures can be inserted in the lesson note editor" });
  };

  /** Paste anywhere in the panel adds files/links to the active session. */
  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!active || editingContent) return;
    const files = filesFromTransfer(e.clipboardData);
    if (files.length) {
      e.preventDefault();
      await addFiles(active.id, files);
      toast({ title: `Added ${files.length} item${files.length === 1 ? "" : "s"}` });
      return;
    }
    const link = linkFromTransfer(e.clipboardData);
    if (link) {
      e.preventDefault();
      await addLink(active.id, link);
      toast({ title: "Added from link" });
    }
  };

  return (
    <aside
      className="shrink-0 border-l border-border bg-background flex flex-col min-h-0 h-full self-stretch overscroll-contain"
      style={{ width: "clamp(280px, 30%, 420px)" }}
      onWheel={(e) => e.stopPropagation()}
      onPaste={(e) => void handlePaste(e)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        if (!active) return;
        const files = filesFromTransfer(e.dataTransfer);
        if (!files.length) return;
        e.preventDefault();
        void addFiles(active.id, files);
      }}
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

      {/* Official GPL emoji — one central record, shared with the Smartboard */}
      <OfficialEmojiSection onInsert={onInsert} />

      {/* Sessions (categories) — the teacher's own emojis */}
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

        {active && !editingContent && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-muted/60"
            >
              <Upload className="h-3 w-3" /> Upload from your system
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-muted/60"
            >
              <FolderOpen className="h-3 w-3" /> My GPL assets
            </button>
            <button
              type="button"
              onClick={() => { setDraft(active.content); setEditingContent(true); }}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-muted/60"
            >
              <Pencil className="h-3 w-3" /> Paste emojis
            </button>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (active && files.length) await addFiles(active.id, files);
              }}
            />
          </div>
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
            <span className="block text-[11px] text-muted-foreground">
              {tiles.length + activeItems.length} item
              {tiles.length + activeItems.length === 1 ? "" : "s"} — paste a picture or video
              anywhere in this panel to add it
            </span>

            {tiles.length === 0 && activeItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                This session is empty. Paste emojis, upload a picture or video, or copy one from
                your GPL assets.
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
                {activeItems.map((item) =>
                  item.kind === "glyph" ? (
                    <button
                      key={item.id}
                      type="button"
                      title={item.name || item.glyph || ""}
                      onClick={() => insertItem(item)}
                      className="h-9 rounded text-xl leading-none hover:bg-muted/70 active:scale-95 transition"
                    >
                      {item.glyph}
                    </button>
                  ) : (
                    <div key={item.id} className="col-span-2">
                      <MediaTile
                        item={item}
                        onInsert={() => insertItem(item)}
                        onRemove={() => void removeItem(item.id)}
                      />
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <GplEmojiAssetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(asset) => {
          if (active) void addGplAsset(active.id, asset);
        }}
      />
    </aside>
  );
}

export default EmojiPanel;
