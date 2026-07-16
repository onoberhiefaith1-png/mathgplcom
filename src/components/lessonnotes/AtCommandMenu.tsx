// Floating menu that appears next to the caret whenever the AtCommand
// extension reports an active @-query. Text-only rows, ↑/↓ to navigate,
// Enter to insert, → to drill into variants, Esc to dismiss.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  searchAssets,
  resolveByShortCode,
  getEffectiveLabel,
  getEffectiveShortCode,
  type AssetDef,
} from "@/lib/lessonnotes/assets/registry";
import { insertAsset } from "@/lib/lessonnotes/assets/insert";
import type { AtCommandState } from "./extensions/AtCommand";
import { MatrixCreateDialog, type MatrixDialogKind, type MatrixDialogResult } from "./MatrixCreateDialog";

interface Props {
  editor: Editor | null;
  state: AtCommandState;
  onClose: () => void;
}

export function AtCommandMenu({ editor, state, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const [matrixDialog, setMatrixDialog] = useState<{ kind: MatrixDialogKind; asset: AssetDef; range: { from: number; to: number } } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const results = useMemo<AssetDef[]>(
    () => (state.active ? searchAssets(state.query, 40) : []),
    [state.active, state.query],
  );

  useEffect(() => { setIdx(0); }, [state.query, state.active]);

  const pick = (a: AssetDef) => {
    if (!editor) return;
    if (a.openDialog) {
      setMatrixDialog({ kind: a.openDialog, asset: a, range: { from: state.from, to: state.to } });
      return;
    }
    insertAsset(editor, a, state.from, state.to);
    onClose();
  };

  useEffect(() => {
    if (!state.active || !editor) return;
    const dom = editor.view.dom as HTMLElement;
    const onKey = (e: KeyboardEvent) => {
      if (matrixDialog) return; // dialog owns keyboard while open
      if (!results.length) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => (i + 1) % results.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => (i - 1 + results.length) % results.length); }
      else if (e.key === "Enter") {
        e.preventDefault();
        // Short Code fast-path: exact match on typed query inserts immediately.
        const byCode = resolveByShortCode(state.query);
        if (byCode) { pick(byCode); return; }
        const chosen = results[idx];
        if (chosen) pick(chosen);
      } else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    dom.addEventListener("keydown", onKey, true);
    return () => dom.removeEventListener("keydown", onKey, true);
  }, [state, editor, results, idx, onClose, matrixDialog]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  const onMatrixConfirm = (r: MatrixDialogResult) => {
    if (!editor || !matrixDialog) return;
    const attrs: Record<string, unknown> = { rows: r.rows, cols: r.cols, br: r.br };
    if (typeof r.divider === "number") attrs.divider = r.divider;
    const asset: AssetDef = {
      ...matrixDialog.asset,
      render: { kind: "structure", structure: "matrix", slots: r.rows * r.cols, attrs },
    };
    insertAsset(editor, asset, matrixDialog.range.from, matrixDialog.range.to);
    if (r.template === "identity") {
      setTimeout(() => {
        import("@/lib/lessonnotes/matrixOps").then(({ applyTemplate }) => {
          applyTemplate(editor, "identity");
        });
      }, 0);
    }
    setMatrixDialog(null);
    onClose();
  };

  if (matrixDialog) {
    return (
      <MatrixCreateDialog
        kind={matrixDialog.kind}
        onCancel={() => { setMatrixDialog(null); onClose(); }}
        onConfirm={onMatrixConfirm}
      />
    );
  }

  if (!state.active || !state.coords) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(8, state.coords.left),
    top: state.coords.bottom + 6,
    zIndex: 60,
  };

  return (
    <div
      style={style}
      className="w-72 max-h-80 overflow-hidden rounded-lg border border-foreground/15 bg-background/95 backdrop-blur shadow-xl text-sm"
    >
      <div className="px-3 py-2 border-b border-foreground/10 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>@{state.query || <em className="opacity-60">type to search…</em>}</span>
        <span>{results.length} match{results.length === 1 ? "" : "es"}</span>
      </div>
      <div ref={listRef} className="max-h-64 overflow-y-auto py-1">
        {results.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">No matches.</div>
        ) : (
          results.map((a, i) => (
            <button
              key={a.id}
              data-idx={i}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(a);
              }}
              onMouseEnter={() => setIdx(i)}
              className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-3 ${i === idx ? "bg-primary/15 text-foreground" : "text-foreground/80 hover:bg-foreground/5"}`}
            >
              <span className="truncate">{a.label}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                {a.hint ?? a.category}
              </span>
            </button>
          ))
        )}
      </div>
      <div className="px-3 py-1.5 border-t border-foreground/10 text-[10px] text-muted-foreground flex justify-between">
        <span>↑↓ navigate · Enter insert</span>
        <span>Esc close</span>
      </div>
    </div>
  );
}
