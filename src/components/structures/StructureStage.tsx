// Smart Structure Stage — renders a highlighted mathematical structure with
// its OWN asset, never as a spreadsheet.
//
//   Static Layer (retained)   — the teacher's drawing: division bracket,
//     horizontal rules, minus signs, ladder divider, "R" labels, headings,
//     spacing, alignment, sizing. Drawn by the original asset component from
//     the teacher's original attributes. Never regenerated, never flattened
//     into rows/columns, never replaced by a table.
//   Interactive Layer (editable) — only the value cells. Floating Numbers
//     write into these, in place, inside the preserved structure.
//
// Values travel as an `r:c` grid purely as an ADDRESS BOOK; they are pushed
// back into the asset's own attribute shape before rendering, so what the
// student sees is byte-for-byte the layout the teacher created.

import { useCallback, useMemo } from "react";
import { LongDivision } from "@/components/lessonnotes/extensions/visuals/arithmetic/LongDivision";
import { DivisionLadder } from "@/components/lessonnotes/extensions/visuals/arithmetic/DivisionLadder";
import { BaseConversion } from "@/components/lessonnotes/extensions/visuals/arithmetic/BaseConversion";
import { PlaceValueChart } from "@/components/lessonnotes/extensions/visuals/arithmetic/PlaceValueChart";
import { attrsWithGrid, structureGridFromObject } from "@/lib/floating/structureGrid";

const ASSETS: Record<string, React.ComponentType<{
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
  board?: boolean;
}>> = {
  longdivision: LongDivision,
  divisionladder: DivisionLadder,
  primefactorisation: DivisionLadder,
  baseconversion: BaseConversion,
  placevaluechart: PlaceValueChart,
};

export const canRenderStructure = (structureId?: string | null): boolean =>
  !!structureId && !!ASSETS[structureId];

interface Props {
  structureId: string;
  /** The teacher's original attributes — the static layer. */
  structureAttrs: Record<string, any>;
  /** Current values as an `r:c` grid (same addressing as the adapter). */
  cells: string[][];
  /** When false the whole structure is display-only. */
  editable?: boolean;
  /** `r:c` keys that must never change (structure + retained values). */
  lockedKeys?: string[];
  /** Fired once per changed editable cell. */
  onCellChange?: (key: string, value: string) => void;
}

export function StructureStage({
  structureId,
  structureAttrs,
  cells,
  editable = false,
  lockedKeys = [],
  onCellChange,
}: Props) {
  const Asset = ASSETS[structureId];

  // Static layer + current values, expressed in the asset's own shape.
  const attrs = useMemo(
    () => attrsWithGrid(structureId, structureAttrs ?? {}, cells ?? []),
    [structureId, structureAttrs, cells],
  );

  const handleChange = useCallback(
    (patch: Record<string, unknown>) => {
      if (!editable || !onCellChange) return;
      const merged = { ...attrs, ...patch };
      const next = structureGridFromObject({
        objId: "stage",
        nodeType: structureId,
        family: "table" as any,
        label: "",
        attrs: merged,
        afterLine: 0,
      });
      if (!next) return;
      const locked = new Set(lockedKeys);
      for (let r = 0; r < next.rows; r++) {
        for (let c = 0; c < next.cols; c++) {
          const key = `${r}:${c}`;
          if (locked.has(key)) continue;
          const before = String(cells?.[r]?.[c] ?? "");
          const after = String(next.cells?.[r]?.[c] ?? "");
          if (before !== after) onCellChange(key, after);
        }
      }
    },
    [attrs, cells, editable, lockedKeys, onCellChange, structureId],
  );

  if (!Asset) return null;

  return (
    <div
      className="not-prose inline-block"
      style={editable ? undefined : { pointerEvents: "none", opacity: 0.98 }}
    >
      <Asset attrs={attrs} onChange={handleChange} board selected={false} />
    </div>
  );
}
