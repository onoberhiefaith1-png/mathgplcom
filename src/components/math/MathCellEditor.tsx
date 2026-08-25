// MathCellEditor — THE cell editor for every table in the workspace.
//
// It is the universal math editor (`MathInlineCanvas`) bound to one table
// cell, so every mathematical shortcut works inside tables exactly as it does
// on a lesson-note line:
//   • `@`  → Asset Library picker at the caret
//   • `#`  → superscript (exponent), `##` → subscript
//   • `/`  → smart fraction
// plus roots, smart brackets and infinite nesting.
//
// Storage stays the shared LaTeX-lite string, so the read-only renderer
// (`renderMathInline`) draws the committed cell identically everywhere.

import { useState } from "react";
import { MathInlineCanvas } from "@/components/lessonnotes/extensions/MathInlineCanvas";
import { latexToTree, treeToLatex } from "@/lib/smartboard/mathTreeLatex";
import type { Row as MathRow } from "@/lib/smartboard/mathTree";
import { normalizeMathSource } from "@/lib/notebook/mathNormalize";
import type { AssetDef } from "@/lib/lessonnotes/assets/types";

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Editing finished (blur / Enter / caret walked out of the expression). */
  onCommit: () => void;
  entryPoint?: { x: number; y: number } | null;
  /** Whole-page asset chosen through `@` — cannot live inside a cell. */
  onObjectAsset?: (asset: AssetDef) => void;
  ink?: string;
  className?: string;
}

export function MathCellEditor({
  value, onChange, onCommit, entryPoint, onObjectAsset, ink = "#0f172a", className,
}: Props) {
  const [root, setRoot] = useState<MathRow>(() => {
    try { return latexToTree(normalizeMathSource(value)); } catch { return [] as MathRow; }
  });

  const commit = (next: MathRow) => {
    setRoot(next);
    try { onChange(normalizeMathSource(treeToLatex(next))); } catch { /* keep last good value */ }
  };

  return (
    <span
      className={className ?? "inline-block min-w-[3rem] px-1 py-0.5 align-baseline"}
      style={{ color: ink }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <MathInlineCanvas
        root={root}
        onChange={commit}
        onBlur={onCommit}
        focused
        onFocus={() => { /* already focused */ }}
        entryPoint={entryPoint ?? null}
        onExitLeft={onCommit}
        onExitRight={onCommit}
        onInsertObjectAsset={(a) => { onCommit(); onObjectAsset?.(a); }}
      />
    </span>
  );
}

export default MathCellEditor;
