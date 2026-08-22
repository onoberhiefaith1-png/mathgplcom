// Asset Library gallery. A full-screen visual browser over the same asset
// registry the @-command menu uses. Sections stack vertically; each is a
// responsive grid of tiles that insert on click.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { searchAssets, ALL_ASSETS, getEffectiveLabel, getEffectiveShortCode, type AssetDef } from "@/lib/lessonnotes/assets/registry";
import { setOverride, clearOverride, subscribeOverrides, normaliseShortCode } from "@/lib/lessonnotes/assets/overrides";
import { SYMBOLS } from "@/lib/lessonnotes/assets/symbols";
import { STRUCTURES } from "@/lib/lessonnotes/assets/structures";
import { DIAGRAMS } from "@/lib/lessonnotes/assets/diagrams";
import { GRAPHS } from "@/lib/lessonnotes/assets/graphs";
import { TABLES } from "@/lib/lessonnotes/assets/tables";
import { MANIPULATIVES } from "@/lib/lessonnotes/assets/manipulatives";
import { MEASUREMENT } from "@/lib/lessonnotes/assets/measurement";
import { REALWORLD } from "@/lib/lessonnotes/assets/realworld";
import { insertAsset } from "@/lib/lessonnotes/assets/insert";
import { isFavorite, toggleFavorite, listFavorites, subscribeFavorites } from "@/lib/lessonnotes/assets/favorites";
import { listRecent, getLastInserted, subscribeRecents } from "@/lib/lessonnotes/assets/recents";
import { renderVisual } from "./extensions/visuals/visualDispatch";
import { MatrixCreateDialog, type MatrixDialogKind, type MatrixDialogResult } from "./MatrixCreateDialog";
import { Search, MoreVertical, Heart, Library } from "lucide-react";
import ShareMenu from "@/components/community/ShareMenu";
import { toast } from "@/hooks/use-toast";
import {
  customAssetToDef,
  deleteCustomAsset,
  listMyCustomAssets,
  sectionLabel,
  type CustomAssetRow,
} from "@/lib/lessonnotes/assets/customAssets";


interface Props {
  editor: Editor | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** Miniature structure preview using the same CSS as the live editor. */
function StructurePreview({ a }: { a: AssetDef }) {
  if (a.render.kind !== "structure") return null;
  const r = a.render;
  const extra = (r.attrs ?? {}) as Record<string, unknown>;
  const rows = Number(extra.rows ?? 0) || undefined;
  const cols = Number(extra.cols ?? 0) || undefined;
  const style: React.CSSProperties = {};
  if (rows && cols) {
    const cells = `repeat(${cols}, minmax(0.6em, max-content))`;
    style.gridTemplateColumns = r.structure === "matrix" && extra.br ? `max-content ${cells} max-content` : cells;
    style.gridTemplateRows = `repeat(${rows}, auto)`;
  }
  return (
    <span
      className={`math-struct math-struct--${r.structure} math-struct--preview`}
      data-kind={r.structure}
      data-bracket={(extra.br as string) || undefined}
      data-rows={rows || undefined}
      data-cols={cols || undefined}
      style={style}
    >
      {(extra.op as string) && <span className="math-struct__op" aria-hidden>{extra.op as string}</span>}
      {(extra.mark as string) && <span className="math-struct__mark" aria-hidden>{extra.mark as string}</span>}
      {(extra.index as string) && <span className="math-struct__index" aria-hidden>{extra.index as string}</span>}
      <span className="math-struct__slots">
        {Array.from({ length: r.slots }).map((_, i) => (
          <span key={i} className="math-slot" />
        ))}
      </span>
    </span>
  );
}

function VisualPreview({ a }: { a: AssetDef }) {
  if (a.render.kind !== "visual") return null;
  // Arithmetic assets get a larger, higher-contrast preview so they are
  // immediately recognisable in the library.
  const isArithmetic = a.group === "Arithmetic";
  return (
    <span
      className={
        "block w-full flex items-center justify-center overflow-hidden text-foreground " +
        (isArithmetic ? "h-24 [&_*]:!text-foreground" : "h-14")
      }
      style={isArithmetic ? { fontWeight: 500 } : undefined}
    >
      {renderVisual(a.render.visual, a.render.attrs ?? {}, {})}
    </span>
  );
}

function AssetEditPopover({ a }: { a: AssetDef }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(getEffectiveLabel(a));
  const [code, setCode] = useState(getEffectiveShortCode(a));
  const [error, setError] = useState<string | null>(null);

  const onOpen = (v: boolean) => {
    if (v) {
      setLabel(getEffectiveLabel(a));
      setCode(getEffectiveShortCode(a));
      setError(null);
    }
    setOpen(v);
  };

  const save = () => {
    setError(null);
    const trimmedLabel = label.trim();
    if (!trimmedLabel) { setError("Standard Name cannot be empty."); return; }
    const nextCode = normaliseShortCode(code);
    if (!nextCode) { setError("Short Code cannot be empty."); return; }
    const res = setOverride(a, { label: trimmedLabel, shortCode: nextCode }, ALL_ASSETS);
    if (res.ok === false) {
      setError(`This Short Code is already assigned to "${getEffectiveLabel(res.conflictWith)}". Please choose a different Short Code.`);
      return;
    }
    setOpen(false);
  };

  const reset = () => {
    clearOverride(a.id);
    setLabel(a.label);
    setCode(a.shortCode || "");
    setError(null);
  };

  return (
    <Popover open={open} onOpenChange={onOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-1 right-1 p-0.5 rounded opacity-40 hover:opacity-100 hover:bg-foreground/10"
          aria-label="Edit asset name and short code"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-72 space-y-3 bg-white text-black border border-black/20" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-wide text-black/60">Standard Name</label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="bg-white text-black border-black/30 placeholder:text-black/40 focus-visible:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-wide text-black/60">Short Code</label>
          <Input
            value={code}
            onChange={(e) => setCode(normaliseShortCode(e.target.value))}
            placeholder="e.g. FR"
            className="font-mono uppercase bg-white text-black border-black/30 placeholder:text-black/40 focus-visible:ring-primary"
          />
        </div>
        {error && <p className="text-[11px] text-destructive">{error}</p>}
        <div className="flex justify-between gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={reset}>Reset</Button>
          <Button size="sm" onClick={save}>Save</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FavoriteHeart({ id }: { id: string }) {
  useSyncExternalStore(subscribeFavorites, () => localStorage.getItem("lessonnotes.assetFavorites") ?? "", () => "");
  const fav = isFavorite(id);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); toggleFavorite(id); }}
      className={`absolute top-1 left-1 p-0.5 rounded transition ${fav ? "opacity-100" : "opacity-40 hover:opacity-100"} hover:bg-foreground/10`}
      aria-label={fav ? "Remove from favourites" : "Add to favourites"}
      title={fav ? "Remove from favourites" : "Add to favourites"}
    >
      <Heart className={`h-3.5 w-3.5 ${fav ? "fill-red-500 text-red-500" : "text-foreground/60"}`} />
    </button>
  );
}

function Tile({ a, onPick }: { a: AssetDef; onPick: (a: AssetDef) => void }) {
  const isArithmetic = a.group === "Arithmetic" && a.render.kind === "visual";
  const preview =
    a.render.kind === "symbol" ? (
      <span className="text-2xl leading-none">{a.render.char}</span>
    ) : a.render.kind === "structure" ? (
      <StructurePreview a={a} />
    ) : a.render.kind === "visual" ? (
      <VisualPreview a={a} />
    ) : (
      <span className="text-xs text-muted-foreground">·</span>
    );

  const code = getEffectiveShortCode(a);
  const label = getEffectiveLabel(a);

  // The tile carries its own controls (favourite heart, edit popover), so it is
  // an activatable container rather than a <button> — nesting buttons breaks
  // hydration and can leave the dialog unresponsive.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onPick(a)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(a); }
      }}
      title={`@${code || a.id}`}
      className={
        "group relative flex cursor-pointer flex-col items-center justify-between gap-1.5 rounded-lg border border-foreground/10 bg-background hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition p-2 text-center " +
        (isArithmetic ? "h-40" : "h-28")
      }
    >
      <FavoriteHeart id={a.id} />
      <AssetEditPopover a={a} />
      <div className="flex-1 flex items-center justify-center w-full min-h-[2rem] text-foreground overflow-hidden">
        {preview}
      </div>
      <div className="text-[10px] leading-tight text-muted-foreground group-hover:text-foreground line-clamp-2">
        {label}
      </div>
      {code && (
        <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">
          @{code}
        </div>
      )}
    </div>
  );
}


function groupByKey(defs: AssetDef[], fallback = "Other"): Array<[string, AssetDef[]]> {
  const map = new Map<string, AssetDef[]>();
  for (const a of defs) {
    const k = a.group ?? fallback;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(a);
  }
  return Array.from(map.entries());
}

function GroupedSection({
  n,
  title,
  desc,
  defs,
  onPick,
  tight,
}: {
  n: number;
  title: string;
  desc: string;
  defs: AssetDef[];
  onPick: (a: AssetDef) => void;
  tight?: boolean;
}) {
  const groups = useMemo(() => groupByKey(defs), [defs]);
  const gridCols = tight
    ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
    : "grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6";
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Section {n} · {title}</h2>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="space-y-4">
        {groups.map(([group, items]) => (
          <div key={group}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group}</h3>
            <div className={`grid ${gridCols} gap-2`}>
              {items.map((a) => <Tile key={a.id} a={a} onPick={onPick} />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * "My assets" — everything the teacher saved from their own lesson notes.
 * Each one carries the universal ⋯ menu, so it can be shared with MathGPL
 * Community (as a Lesson Note Asset, inside the same section) or deleted.
 */
function MyAssetsSection({
  open,
  onPick,
}: {
  open: boolean;
  onPick: (a: AssetDef) => void;
}) {
  const [rows, setRows] = useState<CustomAssetRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listMyCustomAssets()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const remove = async (row: CustomAssetRow) => {
    if (!window.confirm(`Delete "${row.name}" from your Asset Library?`)) return;
    try {
      await deleteCustomAsset(row.id);
      load();
    } catch (e) {
      toast({ title: "Could not delete", description: String((e as Error)?.message ?? e), variant: "destructive" });
    }
  };

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Library className="h-4 w-4" /> My assets
        </h2>
        <p className="text-xs text-muted-foreground">
          Objects you saved from your lesson notes. Only you can see them — use the ⋯ menu to share one with MathGPL Community.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your assets…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Select any diagram in a lesson note and choose “Add to Asset Library” in the right-hand settings panel.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
          {rows.map((row) => (
            <div key={row.id} className="relative">
              <button
                type="button"
                onClick={() => onPick(customAssetToDef(row))}
                title={`@${row.short_code}`}
                className="h-28 w-full flex flex-col items-center justify-between gap-1.5 rounded-lg border border-foreground/10 bg-background p-2 text-center transition hover:border-primary/60 hover:bg-primary/5"
              >
                <span className="mt-3 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {sectionLabel(row.section)}
                </span>
                <span className="text-[11px] font-medium leading-tight line-clamp-2">{row.name}</span>
                <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">
                  @{row.short_code}
                </span>
              </button>
              <ShareMenu
                className="absolute right-1 top-1"
                kind="lesson_asset"
                sourceId={row.id}
                title={row.name}
                description={`${sectionLabel(row.section)} · saved from a lesson note`}
                hashtags={`#${sectionLabel(row.section).replace(/[^A-Za-z0-9]/g, "")}`}
                payload={{
                  custom_asset_id: row.id,
                  section: row.section,
                  short_code: row.short_code,
                  source: row.source,
                  node: row.payload?.node ?? null,
                }}
                items={[]}
                onDelete={() => remove(row)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type ViewMode = "all" | "favorites" | "recent" | "last";

export function AssetLibraryDialog({ editor, open, onOpenChange }: Props) {
  const [q, setQ] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [libMenuOpen, setLibMenuOpen] = useState(false);
  const searching = q.trim().length > 0;
  const [matrixDialog, setMatrixDialog] = useState<{ kind: MatrixDialogKind; asset: AssetDef } | null>(null);
  // Re-render whenever a user edits an asset name / short code / favourites / recents.
  useSyncExternalStore(subscribeOverrides, () => localStorage.getItem("lessonnotes.assetOverrides") ?? "", () => "");
  useSyncExternalStore(subscribeFavorites, () => localStorage.getItem("lessonnotes.assetFavorites") ?? "", () => "");
  useSyncExternalStore(subscribeRecents, () => localStorage.getItem("lessonnotes.assetRecents") ?? "", () => "");

  const byId = useMemo(() => {
    const m = new Map<string, AssetDef>();
    for (const a of ALL_ASSETS) m.set(a.id, a);
    return m;
  }, []);

  const viewDefs = useMemo<AssetDef[] | null>(() => {
    if (viewMode === "favorites") return listFavorites().map((id) => byId.get(id)).filter(Boolean) as AssetDef[];
    if (viewMode === "recent") return listRecent(10).map((id) => byId.get(id)).filter(Boolean) as AssetDef[];
    if (viewMode === "last") {
      const last = getLastInserted();
      const a = last ? byId.get(last) : undefined;
      return a ? [a] : [];
    }
    return null;
  }, [viewMode, byId]);

  const results = useMemo<AssetDef[]>(
    () => (searching ? searchAssets(q, 200) : []),
    [q, searching],
  );

  const onPick = (a: AssetDef) => {
    if (!editor) return;
    if (a.openDialog) {
      setMatrixDialog({ kind: a.openDialog, asset: a });
      return;
    }
    insertAsset(editor, a);
    onOpenChange(false);
  };

  const onMatrixConfirm = (r: MatrixDialogResult) => {
    if (!editor || !matrixDialog) return;
    const slots = r.rows * r.cols;
    // For identity template, pre-fill cell text via a synthetic asset def.
    const attrs: Record<string, unknown> = { rows: r.rows, cols: r.cols, br: r.br };
    if (typeof r.divider === "number") attrs.divider = r.divider;
    if (r.fns?.length) attrs.fns = r.fns;
    const asset: AssetDef = {
      ...matrixDialog.asset,
      render: { kind: "structure", structure: "matrix", slots, attrs },
    };
    insertAsset(editor, asset);
    // Apply post-insert template if requested (identity fill).
    if (r.template === "identity") {
      // Defer one tick so the node exists in the doc.
      setTimeout(() => {
        import("@/lib/lessonnotes/matrixOps").then(({ applyTemplate }) => {
          applyTemplate(editor, "identity");
        });
      }, 0);
    }
    setMatrixDialog(null);
    onOpenChange(false);
  };


  // Section 4 = tables + data/kinematics charts + coord/numberline
  const section4Defs = useMemo(() => [...TABLES, ...GRAPHS], []);
  // Section 5 = manipulatives + measurement + real-world
  const section5Defs = useMemo(() => [...MANIPULATIVES, ...MEASUREMENT, ...REALWORLD], []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(1200px,95vw)] h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="p-4 border-b flex-row items-center justify-between gap-4 space-y-0">
          <DialogTitle className="text-lg">
            Asset Library
            {viewMode !== "all" && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {viewMode === "favorites" ? "Favourites" : viewMode === "recent" ? "Recent" : "Repeat Last"}
                <button
                  type="button"
                  onClick={() => setViewMode("all")}
                  className="ml-2 text-primary hover:underline"
                >Clear</button>
              </span>
            )}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-80 max-w-full">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search all assets…"
                className="pl-8"
              />
            </div>
            <Popover open={libMenuOpen} onOpenChange={setLibMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="p-2 rounded hover:bg-foreground/10"
                  aria-label="Library options"
                  title="Library options"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-48 p-1 bg-white text-black border border-black/20">
                <button
                  type="button"
                  onClick={() => { setViewMode("favorites"); setLibMenuOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-black/5 text-sm"
                >Favourites</button>
                <button
                  type="button"
                  onClick={() => { setViewMode("recent"); setLibMenuOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-black/5 text-sm"
                >Recent</button>
                <button
                  type="button"
                  onClick={() => { setViewMode("last"); setLibMenuOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-black/5 text-sm"
                >Repeat Last</button>
                <div className="my-1 border-t border-black/10" />
                <button
                  type="button"
                  onClick={() => { setViewMode("all"); setLibMenuOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-black/5 text-sm"
                >All assets</button>
              </PopoverContent>
            </Popover>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-10">
          {viewDefs !== null ? (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {viewMode === "favorites" ? "Favourite assets" : viewMode === "recent" ? "Recently used" : "Last inserted"} · {viewDefs.length}
              </h3>
              {viewDefs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {viewMode === "favorites"
                    ? "Click the heart on any asset to add it here."
                    : viewMode === "recent"
                    ? "Assets you insert will appear here."
                    : "No assets have been inserted yet."}
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-2">
                  {viewDefs.map((a) => <Tile key={a.id} a={a} onPick={onPick} />)}
                </div>
              )}
            </section>
          ) : searching ? (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {results.length} result{results.length === 1 ? "" : "s"} for "{q}"
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-2">
                {results.map((a) => <Tile key={a.id} a={a} onPick={onPick} />)}
              </div>
            </section>
          ) : (
            <>
              <MyAssetsSection open={open} onPick={onPick} />

              {/* Section 1 — Symbols */}
              <GroupedSection
                n={1}
                title="Mathematical Symbols"
                desc="Inline unicode glyphs. Insert as plain text — inherits surrounding font & colour."
                defs={SYMBOLS}
                onPick={onPick}
                tight
              />

              {/* Section 2 — Structures */}
              <GroupedSection
                n={2}
                title="Elastic Math Structures"
                desc="Expandable containers with editable slots. Insert, then click into a slot to type."
                defs={STRUCTURES}
                onPick={onPick}
                tight
              />

              {/* Section 3 — Parametric Vector Diagrams */}
              <GroupedSection
                n={3}
                title="Parametric Vector Diagrams"
                desc="Pure SVG shapes — infinitely scalable, edit-ready. Click to drop into your notes."
                defs={DIAGRAMS}
                onPick={onPick}
              />

              {/* Section 4 — Tabular Grids & Data Charts */}
              <GroupedSection
                n={4}
                title="Tabular Grids & Data Charts"
                desc="Data-driven grids and statistical / kinematics visualisations."
                defs={section4Defs}
                onPick={onPick}
              />

              {/* Section 5 — Interactive Manipulatives */}
              <GroupedSection
                n={5}
                title="Interactive Manipulatives"
                desc="Classroom tools, measurement instruments, and real-world word-problem anchors."
                defs={section5Defs}
                onPick={onPick}
              />
            </>
          )}
        </div>

        <div className="border-t px-4 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>{ALL_ASSETS.length} assets available</span>
          <span>Tip: press <kbd className="px-1 py-0.5 rounded border bg-muted">@</kbd> in the editor for quick insert</span>
        </div>
      </DialogContent>
      <MatrixCreateDialog
        kind={matrixDialog?.kind ?? null}
        onCancel={() => setMatrixDialog(null)}
        onConfirm={onMatrixConfirm}
      />
    </Dialog>

  );
}
