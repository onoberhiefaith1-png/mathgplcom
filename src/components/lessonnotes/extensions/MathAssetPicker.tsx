// The `@` Asset Library picker for the universal math editor.
//
// It reads the SAME registry the prose @-menu and the Asset Library dialog
// read (search, favourites, recents, repeat-last), so `@` means exactly one
// thing everywhere mathematics can be typed: Smart Table cells, lesson-note
// lines, geometry labels, smartboard boards.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  searchAssets,
  ALL_ASSETS,
  getEffectiveLabel,
  getEffectiveShortCode,
  type AssetDef,
} from "@/lib/lessonnotes/assets/registry";
import { listFavorites } from "@/lib/lessonnotes/assets/favorites";
import { listRecent, getLastInserted } from "@/lib/lessonnotes/assets/recents";
import { isMathInsertable } from "@/lib/lessonnotes/assets/mathInsert";
import {
  MatrixCreateDialog,
  type MatrixDialogKind,
  type MatrixDialogResult,
} from "../MatrixCreateDialog";

interface Props {
  /** Viewport point to anchor the panel at (the caret). */
  point: { x: number; y: number } | null;
  onPick: (a: AssetDef, matrix?: MatrixDialogResult) => void;
  onClose: () => void;
}

const byId = (id: string | null) => (id ? ALL_ASSETS.find((a) => a.id === id) ?? null : null);

export function MathAssetPicker({ point, onPick, onClose }: Props) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [matrix, setMatrix] = useState<{ kind: MatrixDialogKind; asset: AssetDef } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setIdx(0); }, [q]);

  const results = useMemo<AssetDef[]>(() => {
    const query = q.trim();
    if (/^fav(ou?rite)?s?$/i.test(query)) {
      return listFavorites().map(byId).filter(Boolean) as AssetDef[];
    }
    if (/^recent$/i.test(query)) {
      return listRecent(10).map(byId).filter(Boolean) as AssetDef[];
    }
    if (query === "@") {
      const last = byId(getLastInserted());
      return last ? [last] : [];
    }
    if (!query) {
      const favs = listFavorites().map(byId).filter(Boolean) as AssetDef[];
      const rec = listRecent(10).map(byId).filter(Boolean) as AssetDef[];
      const seen = new Set<string>();
      const merged = [...favs, ...rec].filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
      return merged.length ? merged : searchAssets("", 30);
    }
    return searchAssets(query, 40);
  }, [q]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-i="${idx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  const choose = (a: AssetDef) => {
    if (a.openDialog) { setMatrix({ kind: a.openDialog, asset: a }); return; }
    onPick(a);
  };

  const style: React.CSSProperties = point
    ? { position: "fixed", left: Math.min(point.x, window.innerWidth - 300), top: Math.min(point.y + 18, window.innerHeight - 300), zIndex: 90 }
    : { position: "fixed", left: 24, top: 120, zIndex: 90 };

  return (
    <>
      <div
        style={style}
        className="w-[280px] overflow-hidden rounded-lg border border-foreground/20 bg-background shadow-xl"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 border-b border-foreground/10 px-2 py-1.5">
          <span className="text-xs font-bold text-primary">@</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the Asset Library…"
            className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-foreground/40"
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); return; }
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); return; }
              if (e.key === "Enter") {
                e.preventDefault();
                const a = results[idx];
                if (a) choose(a);
              }
            }}
          />
        </div>
        <div ref={listRef} className="max-h-64 overflow-y-auto py-1">
          {results.length === 0 && (
            <p className="px-2.5 py-2 text-[11px] text-foreground/50">No matching asset.</p>
          )}
          {results.map((a, i) => {
            const mathOk = isMathInsertable(a);
            return (
              <button
                key={a.id}
                type="button"
                data-i={i}
                onMouseEnter={() => setIdx(i)}
                onClick={() => choose(a)}
                className={
                  "flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[11px] " +
                  (i === idx ? "bg-primary/10 text-foreground" : "text-foreground/80 hover:bg-foreground/5")
                }
              >
                <span className="truncate">{getEffectiveLabel(a)}</span>
                <span className="shrink-0 font-mono text-[10px] text-foreground/45">
                  {mathOk ? getEffectiveShortCode(a) : "object"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {matrix && (
        <MatrixCreateDialog
          kind={matrix.kind}
          onCancel={() => setMatrix(null)}
          onConfirm={(r) => { const a = matrix.asset; setMatrix(null); onPick(a, r); }}
        />
      )}
    </>
  );
}

export default MathAssetPicker;
