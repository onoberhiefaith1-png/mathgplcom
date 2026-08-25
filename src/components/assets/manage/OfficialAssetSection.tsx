// The official (database) assets of one sub-session, with the manager controls
// for adding, editing and removing them. Non-managers only see the assets.
//
// For a manager the grid itself is a paste canvas: copy pictures (or a run of
// emojis inside the Emoji session) and press Ctrl/Cmd + V, or drag files in.
// Several items at once become several separate assets — never one merged one.

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, Loader2, MoreVertical, Plus, Smile, Square, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAssetManager } from "@/lib/gpl/useAssetManager";
import GplAssetPreview from "@/components/admin/assets/GplAssetPreview";
import GplAssetCopyButton from "@/components/assets/manage/GplAssetCopyButton";
import { DeleteDialog } from "@/components/admin/assets/GplDialogs";
import AssetFormDialog, { type AssetFormItem } from "./AssetFormDialog";
import EmojiGlyphBulkDialog, { splitGlyphs } from "./EmojiGlyphBulkDialog";
import { filesFromTransfer, linkFromTransfer } from "@/lib/clipboard/assetClipboard";
import { EMOJI_SESSION_SLUG, invalidateOfficialEmoji } from "@/lib/gpl/officialEmoji";
import {
  createAsset, createSubSession, deleteAsset, getSessionBySlug, getSubSessionBySlug, listAssets,
  listSubSessions, listUsage, setUsage, updateAsset, uploadOfficialFile, type GplAsset,
  type GplAssetType, type GplSubSession, type GplSurface,
} from "@/lib/gpl/assetLibrary";

interface Props {
  sessionSlug: string;
  subSlug: string;
  /** Bundled URLs already rendered elsewhere on the page. */
  excludeUrls?: Set<string>;
  heading?: string;
}

/** Emojis are offered on every surface that already reads the official record. */
const EMOJI_SURFACES: GplSurface[] = [
  "emoji_library",
  "lesson_notes",
  "smartboard_board_1",
  "smartboard_board_2",
];

const prettify = (slug: string) =>
  slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || "Folder";

const typeOfFile = (file: File): GplAssetType => {
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "image/gif") return "gif";
  if (file.type === "image/png") return "transparent";
  if (file.type.startsWith("audio/")) return "audio";
  return "image";
};

const mediaTypeOfAsset = (item: AssetFormItem): "image" | "video" => {
  if (item.file?.type.startsWith("video/")) return "video";
  return item.asset_type === "video" ? "video" : "image";
};

const baseName = (file: File) =>
  (file.name.replace(/\.[a-z0-9]+$/i, "").trim() || "Asset").slice(0, 80);

const OfficialAssetSection = ({ sessionSlug, subSlug, excludeUrls, heading }: Props) => {
  const { isManager } = useAssetManager();
  const { toast } = useToast();
  const isEmojiSession = sessionSlug === EMOJI_SESSION_SLUG;

  const [sub, setSub] = useState<GplSubSession | null>(null);
  const [assets, setAssets] = useState<GplAsset[]>([]);
  const [usage, setUsageMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [editing, setEditing] = useState<GplAsset | null>(null);
  const [deleting, setDeleting] = useState<GplAsset | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const session = await getSessionBySlug(sessionSlug);
      const found = session ? await getSubSessionBySlug(session.id, subSlug) : null;
      setSub(found);
      if (!found) {
        setAssets([]);
        return;
      }
      const rows = await listAssets(found.id);
      setAssets(rows);
      setUsageMap(await listUsage(rows.map((r) => r.id)));
    } catch {
      setSub(null);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    setSelecting(false);
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionSlug, subSlug]);

  const afterWrite = async () => {
    if (isEmojiSession) invalidateOfficialEmoji();
    await refresh();
  };

  const visible = useMemo(
    () =>
      assets
        .filter((a) => a.is_active || isManager)
        .filter((a) => !(excludeUrls && a.external_url && excludeUrls.has(a.external_url))),
    [assets, isManager, excludeUrls],
  );

  const nextOrder = () => (assets.length ? Math.max(...assets.map((a) => a.sort_order)) + 1 : 0);

  const saveNew = async (items: AssetFormItem[]) => {
    if (!sub) return;
    let order = nextOrder();
    for (const item of items) {
      const storagePath = item.file
        ? await uploadOfficialFile(item.file, sessionSlug, subSlug)
        : null;
      const created = await createAsset({
        subsession_id: sub.id,
        name: item.name,
        description: item.description || undefined,
        asset_type: item.asset_type,
        glyph: item.glyph || null,
        external_url: item.external_url || null,
        storage_path: storagePath,
        media_type: mediaTypeOfAsset(item),
        sort_order: order,
      });
      order += 1;
      const surfaces = item.surfaces.length
        ? item.surfaces
        : isEmojiSession
          ? EMOJI_SURFACES
          : [];
      if (surfaces.length) await setUsage(created.id, surfaces as GplSurface[]);
    }
    await afterWrite();
    toast({ title: items.length > 1 ? `${items.length} assets added` : "Asset added" });
  };

  /** Files pasted or dropped straight onto the grid. */
  const importFiles = async (files: File[]) => {
    if (!sub || !files.length) return;
    setBusy(`Adding ${files.length} file${files.length === 1 ? "" : "s"}…`);
    try {
      let order = nextOrder();
      for (const [index, file] of files.entries()) {
        const path = await uploadOfficialFile(file, sessionSlug, subSlug);
        const created = await createAsset({
          subsession_id: sub.id,
          name: file.name ? baseName(file) : `${prettify(subSlug)} ${index + 1}`,
          asset_type: typeOfFile(file),
          storage_path: path,
          media_type: file.type.startsWith("video/") ? "video" : "image",
          sort_order: order,
        });
        order += 1;
        if (isEmojiSession) await setUsage(created.id, EMOJI_SURFACES);
      }
      await afterWrite();
      toast({
        title: files.length > 1 ? `${files.length} assets added` : "Asset added",
        description: "Pasted straight into this folder.",
      });
    } catch (error) {
      toast({ title: "Could not add", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const importLink = async (url: string) => {
    if (!sub) return;
    setBusy("Adding link…");
    try {
      const name = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "Asset")
        .replace(/\.[a-z0-9]+$/i, "")
        .slice(0, 80) || "Asset";
      const created = await createAsset({
        subsession_id: sub.id,
        name,
        asset_type: /\.(mp4|webm|mov)$/i.test(url) ? "video" : "image",
        external_url: url,
        sort_order: nextOrder(),
      });
      if (isEmojiSession) await setUsage(created.id, EMOJI_SURFACES);
      await afterWrite();
      toast({ title: "Asset added from link" });
    } catch (error) {
      toast({ title: "Could not add", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const addGlyphs = async (glyphs: string[]) => {
    if (!sub || !glyphs.length) return;
    setBusy(`Adding ${glyphs.length} emoji${glyphs.length === 1 ? "" : "s"}…`);
    try {
      let order = nextOrder();
      for (const glyph of glyphs) {
        const created = await createAsset({
          subsession_id: sub.id,
          name: glyph,
          asset_type: "emoji",
          glyph,
          sort_order: order,
        });
        order += 1;
        await setUsage(created.id, EMOJI_SURFACES);
      }
      await afterWrite();
      toast({
        title: glyphs.length > 1 ? `${glyphs.length} emojis added` : "Emoji added",
        description: "Available now in Lesson Notes and both Smartboard panels.",
      });
    } catch (error) {
      toast({ title: "Could not add", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  /** Registers a bundled-only folder so it becomes editable. */
  const registerFolder = async () => {
    setBusy("Preparing folder…");
    try {
      const session = await getSessionBySlug(sessionSlug);
      if (!session) {
        toast({
          title: "Add the session first",
          description: "Use “Import existing library” or “+ Add Session” on the Assets page.",
          variant: "destructive",
        });
        return;
      }
      const existing = await listSubSessions(session.id);
      const order = existing.length ? Math.max(...existing.map((s) => s.sort_order)) + 1 : 0;
      await createSubSession({
        session_id: session.id,
        name: prettify(subSlug),
        sort_order: order,
      });
      await refresh();
      toast({ title: "Folder ready", description: "You can add assets to it now." });
    } catch (error) {
      toast({ title: "Could not prepare folder", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkDeactivate = async () => {
    setBusy("Deactivating…");
    try {
      for (const id of selected) await updateAsset(id, { is_active: false });
      setSelected(new Set());
      setSelecting(false);
      await afterWrite();
    } finally {
      setBusy(null);
    }
  };

  if (loading && !sub) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!sub) {
    return isManager ? (
      <div className="rounded-xl border border-dashed border-primary/40 bg-background/50 p-5">
        <p className="text-sm text-muted-foreground">
          This folder is not editable yet. Register it once and you can add official assets to it.
        </p>
        <Button className="mt-3 min-h-[44px] gap-2" disabled={!!busy} onClick={() => void registerFolder()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Make this folder editable
        </Button>
      </div>
    ) : null;
  }

  if (!isManager && visible.length === 0) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">
          {heading ?? "Official library"}
        </h2>
        {isManager && (
          <div className="flex flex-wrap items-center gap-2">
            {isEmojiSession && (
              <Button variant="secondary" className="min-h-[44px] gap-2" onClick={() => setEmojiOpen(true)}>
                <Smile className="h-4 w-4" /> Add emojis
              </Button>
            )}
            <Button onClick={() => setAddOpen(true)} className="min-h-[44px] gap-2">
              <Plus className="h-4 w-4" /> Add Asset
            </Button>
            {visible.length > 0 && (
              <Button
                variant="outline"
                className="min-h-[44px] gap-2"
                onClick={() => {
                  setSelecting((s) => !s);
                  setSelected(new Set());
                }}
              >
                {selecting ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                {selecting ? "Done" : "Select"}
              </Button>
            )}
          </div>
        )}
      </div>

      {isManager && selecting && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2">
          <span className="text-sm">{selected.size} selected</span>
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0 || !!busy}
            onClick={() => void bulkDeactivate()}
          >
            Deactivate
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="gap-2"
            disabled={selected.size === 0 || !!busy}
            onClick={() => setBulkDelete(true)}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      )}

      <div
        ref={canvasRef}
        tabIndex={isManager ? 0 : -1}
        onPaste={
          isManager
            ? (e) => {
                const files = filesFromTransfer(e.clipboardData);
                if (files.length) {
                  e.preventDefault();
                  void importFiles(files);
                  return;
                }
                const text = e.clipboardData?.getData("text/plain")?.trim() ?? "";
                const link = linkFromTransfer(e.clipboardData);
                if (link) {
                  e.preventDefault();
                  void importLink(link);
                  return;
                }
                if (isEmojiSession && text) {
                  const glyphs = splitGlyphs(text);
                  if (glyphs.length) {
                    e.preventDefault();
                    void addGlyphs(glyphs);
                  }
                }
              }
            : undefined
        }
        onDragOver={isManager ? (e) => e.preventDefault() : undefined}
        onDrop={
          isManager
            ? (e) => {
                const files = filesFromTransfer(e.dataTransfer);
                if (!files.length) return;
                e.preventDefault();
                void importFiles(files);
              }
            : undefined
        }
        className={
          isManager
            ? "rounded-xl border border-dashed border-primary/30 p-3 outline-none transition focus:border-primary"
            : undefined
        }
      >
        {isManager && (
          <p className="mb-3 text-xs text-muted-foreground">
            {busy ? (
              <span className="inline-flex items-center gap-2 text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {busy}
              </span>
            ) : isEmojiSession ? (
              "Click here and press Ctrl/Cmd + V to paste emojis, pictures or a link — each becomes its own asset."
            ) : (
              "Click here and press Ctrl/Cmd + V to paste pictures, or drag files in — each becomes its own asset."
            )}
          </p>
        )}

        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No official assets in this folder yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((asset) => (
              <figure
                key={asset.id}
                className={`group relative overflow-hidden rounded-xl border bg-background/60 backdrop-blur ${
                  selecting && selected.has(asset.id) ? "border-primary ring-2 ring-primary" : "border-border/40"
                }`}
                onClick={selecting ? () => toggleSelected(asset.id) : undefined}
              >
                <div className="aspect-square w-full overflow-hidden bg-background/30 p-3">
                  <GplAssetPreview asset={asset} />
                </div>
                {!selecting && <GplAssetCopyButton asset={asset} />}

                <figcaption className="px-3 py-2 text-center text-sm font-medium">
                  {asset.name}
                  {!asset.is_active && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      Inactive
                    </span>
                  )}
                  {isManager && (usage[asset.id]?.length ?? 0) > 0 && (
                    <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                      {usage[asset.id]!.length} destination
                      {usage[asset.id]!.length === 1 ? "" : "s"}
                    </span>
                  )}
                </figcaption>

                {isManager && selecting && (
                  <span className="absolute left-2 top-2 rounded-md bg-background/90 p-1 text-primary">
                    {selected.has(asset.id) ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </span>
                )}

                {isManager && !selecting && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for ${asset.name}`}
                        className="absolute right-2 top-2 rounded-full bg-foreground/70 p-1.5 text-background opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(asset)}>
                        Edit name, description &amp; usage
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          void updateAsset(asset.id, { is_active: !asset.is_active }).then(afterWrite);
                        }}
                      >
                        {asset.is_active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(asset)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </figure>
            ))}
          </div>
        )}
      </div>

      <AssetFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Asset"
        onSave={saveNew}
      />

      <EmojiGlyphBulkDialog
        open={emojiOpen}
        onClose={() => setEmojiOpen(false)}
        onSave={addGlyphs}
      />

      <AssetFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Asset"
        initial={
          editing
            ? {
                name: editing.name,
                description: editing.description ?? "",
                asset_type: editing.asset_type,
                glyph: editing.glyph ?? "",
                external_url: editing.external_url ?? "",
                surfaces: (usage[editing.id] ?? []) as AssetFormItem["surfaces"],
              }
            : undefined
        }
        onSave={async (items) => {
          const item = items[0];
          if (!editing || !item) return;
          await updateAsset(editing.id, {
            name: item.name,
            description: item.description || null,
            glyph: item.glyph || null,
            external_url: item.external_url || null,
          });
          await setUsage(editing.id, item.surfaces);
          await afterWrite();
        }}
      />

      <DeleteDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        what={deleting ? `the asset “${deleting.name}”` : "this asset"}
        impact="Deleting removes the file everywhere it is offered. Deactivating hides it while keeping the file."
        onDeactivate={async () => {
          if (deleting) await updateAsset(deleting.id, { is_active: false });
          await afterWrite();
        }}
        onDelete={async () => {
          if (deleting) await deleteAsset(deleting);
          await afterWrite();
        }}
      />

      <DeleteDialog
        open={bulkDelete}
        onClose={() => setBulkDelete(false)}
        what={`${selected.size} selected asset${selected.size === 1 ? "" : "s"}`}
        impact="Deleting removes the files everywhere they are offered. Deactivating hides them while keeping the files."
        onDeactivate={bulkDeactivate}
        onDelete={async () => {
          setBusy("Deleting…");
          try {
            for (const asset of assets.filter((a) => selected.has(a.id))) await deleteAsset(asset);
            setSelected(new Set());
            setSelecting(false);
            await afterWrite();
          } finally {
            setBusy(null);
          }
        }}
      />
    </div>
  );
};

export default OfficialAssetSection;
