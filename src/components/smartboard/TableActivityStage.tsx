// Table Activity Stage — the Smart Table as a FIRST-CLASS Smartboard object.
//
// It is not a dialog, modal, popup or overlay: it is another object on the
// writing surface, occupying its own lesson line in the lesson flow. Its
// measured height is reported upward (onMeasure) so every row underneath is
// pushed down — the table never covers other lesson content.
//
// Two display states:
//   • Collapsed — "▶ <label>" only, one lesson line tall.
//   • Expanded  — "▼ <label>" plus the teacher's original grid, live and
//                 editable (calculator, Σ, expressions). Retained cells
//                 arrive filled and read-only.
//
// The board remains VISUALLY NEUTRAL: no ticks, no crosses, no marking, no
// score. Only the active row/column is highlighted, and that is navigation,
// not feedback. Correctness lives in the hidden validation state the board
// derives and hands to the Reasoning engine.
//
// A toolbar sits underneath the table. It appears on any interaction near the
// table and fades away after ~5s of inactivity.

import { useEffect, useMemo, useRef, useState } from "react";
import { Table2, ChevronDown, ChevronRight, Sigma, Eraser, EyeOff, Maximize2, Minimize2 } from "lucide-react";
import {
  cellKeysForLine,
  editableCellsForLine,
  isRetained,
  lineIdxForCell,
  trackOf,
  expectedCellValue,
  type TableEntries,
  type TableGroup,
} from "@/lib/smartboard/tableActivity";
import { cellKey, parseCellKey } from "@/lib/floating/tableGrid";
import { cellNumber, formatNumber, tryEvaluate } from "@/components/lessonnotes/extensions/visuals/smarttable/evaluator";
import { useAutoHide } from "@/hooks/useAutoHide";
import { StructureStage, canRenderStructure } from "@/components/structures/StructureStage";
import { SolutionObjectView } from "@/components/lessonnotes/SolutionObjectView";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { MathCellEditor } from "@/components/math/MathCellEditor";


interface Props {
  group: TableGroup;
  activeLineIdx: number;
  entries: TableEntries;
  sensorCell: string | null;
  /** Expanded (true) or collapsed (false). */
  open: boolean;
  dark?: boolean;
  editable?: boolean;
  /** Teacher-only object controls. */
  canDelete?: boolean;
  onOpenChange: (open: boolean) => void;
  onActivateLine: (lineIdx: number) => void;
  onSensorCell: (key: string | null) => void;
  onEntry: (key: string, value: string) => void;
  onDelete?: () => void;
  /** Clear every student-entered value; retained content stays. */
  onClear?: () => void;
  /** Object height in px, so the board can push the rows below down. */
  onMeasure?: (height: number) => void;
}

const TableActivityStage = ({
  group,
  activeLineIdx,
  entries,
  sensorCell,
  open,
  dark,
  editable = true,
  canDelete = false,
  onOpenChange,
  onActivateLine,
  onSensorCell,
  onEntry,
  onDelete,
  onClear,
  onMeasure,
}: Props) => {
  const ink = dark ? "rgba(245,245,240,0.94)" : "#1a2230";
  const border = dark ? "rgba(245,245,240,0.38)" : "rgba(26,34,48,0.45)";
  
  const hostRef = useRef<HTMLDivElement | null>(null);

  // Toolbar auto-hide / auto-show — 5s classroom window.
  const { visible: toolbarVisible, ping } = useAutoHide(5000);

  const activeCells = useMemo(
    () => new Set(cellKeysForLine(group, activeLineIdx)),
    [group, activeLineIdx],
  );

  // Report the object's real height so rows below travel down / back up.
  // The callback is held in a ref: parents pass an inline arrow, and using it
  // directly as an effect dep re-subscribes every render → measure → setState
  // → render loop ("Maximum update depth exceeded").
  const measureRef = useRef(onMeasure);
  measureRef.current = onMeasure;
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const report = () => measureRef.current?.(el.getBoundingClientRect().height);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => { ro.disconnect(); measureRef.current?.(0); };
  }, [open]);


  /** The cell currently being typed into, with its live draft. */
  const [edit, setEdit] = useState<{ key: string; draft: string; point: { x: number; y: number } | null } | null>(null);

  // The board's sensor owns which cell is being edited: opening a cell from
  // the board (or Tab/Enter walking to the next one) starts its editor.
  useEffect(() => {
    if (!open || !editable || !sensorCell) { setEdit(null); return; }
    if (isRetained(group, sensorCell)) { setEdit(null); return; }
    setEdit((prev) => (prev && prev.key === sensorCell
      ? prev
      : { key: sensorCell, draft: String(entries[sensorCell] ?? ""), point: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editable, sensorCell, group]);

  /** Sum a row or a column into its first empty editable cell.
   *  Both directions are always offered — the table's own orientation only
   *  decides marking, never which totals a teacher may build. */
  const sumTrack = (dir: "row" | "col") => {
    const pos = parseCellKey(sensorCell ?? "")
      ?? (group.orientation === "row"
        ? { r: activeLineIdx, c: 0 }
        : { r: 0, c: activeLineIdx });

    const cells: string[] = [];
    if (dir === "row") {
      for (let c = 0; c < grid.cols; c++) cells.push(cellKey(pos.r, c));
    } else {
      for (let r = 0; r < grid.rows; r++) cells.push(cellKey(r, pos.c));
    }

    const editableInTrack = cells.filter((k) => !isRetained(group, k));
    if (editableInTrack.length === 0) return;
    // Prefer the first empty editable cell; otherwise refresh the last one so
    // a total can be recalculated after edits.
    const target = editableInTrack.find((k) => !String(entries[k] ?? "").trim())
      ?? editableInTrack[editableInTrack.length - 1];

    let total = 0;
    let any = false;
    for (const k of cells) {
      if (k === target) continue;
      const raw = isRetained(group, k) ? expectedCellValue(group, k) : entries[k] ?? "";
      const n = cellNumber(raw);
      if (n !== null) { total += n; any = true; }
    }
    if (!any) return;
    onEntry(target, formatNumber(total));
    setEdit(null);
    onSensorCell(target);
  };


  const focusCell = (key: string) => {
    onSensorCell(key);
    const line = lineIdxForCell(group, key);
    if (line !== null && line !== activeLineIdx) onActivateLine(line);
  };


  const grid = group.grid;

  // Smart Structure: the static layer belongs to the asset, not to a table.
  const structureId = (grid as any).structureId as string | undefined;
  const structureCells = useMemo(() => {
    const out: string[][] = [];
    for (let r = 0; r < grid.rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < grid.cols; c++) {
        const k = cellKey(r, c);
        row.push(
          isRetained(group, k) ? expectedCellValue(group, k) : String(entries[k] ?? ""),
        );
      }
      out.push(row);
    }
    return out;
  }, [grid.rows, grid.cols, group, entries]);
  const lockedKeys = useMemo(() => {
    const out: string[] = [];
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const k = cellKey(r, c);
        if (isRetained(group, k)) out.push(k);
      }
    }
    return out;
  }, [grid.rows, grid.cols, group]);

  // Editable cells in reading order — the address book the StructureStage
  // uses to turn "caret is in this field" into "activate this line".
  const structureEditableKeys = useMemo(() => {
    const out: string[] = [];
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const k = cellKey(r, c);
        if (!isRetained(group, k)) out.push(k);
      }
    }
    return out;
  }, [grid.rows, grid.cols, group]);


  const toolbarBtn = "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] hover:bg-black/10";

  return (
    <div
      ref={hostRef}
      data-sb-table-object
      data-sb-table-obj-id={group.objId}
      onPointerEnter={ping}
      onPointerMove={ping}
      onPointerDown={ping}
      onFocusCapture={ping}
      style={{ color: ink, width: "100%" }}
    >
      {/* Object title — the lesson line the table occupies. */}
      <button
        onClick={() => { onOpenChange(!open); ping(); }}
        className="inline-flex items-center gap-2 text-left"
        style={{ color: ink }}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Table2 className="h-4 w-4 opacity-70" />
        <span className="text-[15px] font-semibold">{group.label}</span>
      </button>

      {/* NON-TABLE OBJECT — the teacher's diagram / graph / 3D scene / chart,
          rendered by its own node view exactly as it appears in the note. */}
      {open && (grid as any).object && (
        <div className="mt-1.5 overflow-auto" style={{ maxWidth: "100%" }}>
          <SolutionObjectView
            nodeType={(grid as any).object.nodeType}
            attrs={(grid as any).object.attrs ?? {}}
          />
        </div>
      )}

      {open && !(grid as any).object && structureId && canRenderStructure(structureId) && (
        // Smart Structure: the teacher's own layout, preserved exactly.
        // Only the editable cells accept input; the static layer is fixed.
        <div className="mt-1.5 overflow-auto" style={{ maxWidth: "100%" }}>
          <StructureStage
            structureId={structureId}
            structureAttrs={(grid as any).structureAttrs ?? {}}
            cells={structureCells}
            editable={!!editable}
            lockedKeys={lockedKeys}
            editableKeys={structureEditableKeys}
            onCellFocus={focusCell}
            onCellChange={(k, v) => { onEntry(k, v); focusCell(k); }}
          />

        </div>
      )}

      {open && !(grid as any).object && !(structureId && canRenderStructure(structureId)) && (
        <div className="mt-1.5 overflow-auto" style={{ maxWidth: "100%" }}>
          <table className="border-collapse text-[16px]" style={{ color: ink }}>

            {grid.headers?.some((h) => String(h).trim()) && (
              <thead>
                <tr>
                  {grid.headers.map((h, c) => (
                    <th
                      key={`h-${c}`}
                      className="px-3 py-1.5 text-center font-semibold"
                      style={{ border: `1px solid ${border}` }}
                    >
                      {String(h ?? "").trim()
                        ? renderMathInline(String(h), `tas-h-${group.objId}-${c}`)
                        : "\u00A0"}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {Array.from({ length: grid.rows }, (_, r) => (
                <tr key={`r-${r}`}>
                  {Array.from({ length: grid.cols }, (_, c) => {
                    const k = cellKey(r, c);
                    // Smart Structure: structural cells are the teacher's
                    // drawing — always rendered, never editable.
                    const glyph = (grid as any).staticGlyphs?.[k] as string | undefined;
                    const structural = Array.isArray((grid as any).staticCells)
                      && ((grid as any).staticCells as string[]).includes(k);
                    const retained = structural || isRetained(group, k);
                    const inActive = !structural && activeCells.has(k);
                    const isSensor = !structural && sensorCell === k;
                    const value = structural
                      ? (glyph ?? "")
                      : retained ? expectedCellValue(group, k) : entries[k] ?? "";

                    const editing = !!edit && edit.key === k && !retained && editable;

                    return (
                      <td
                        key={k}
                        onClick={(e) => {
                          if (structural) return;
                          if (!editing && !retained && editable) {
                            setEdit({ key: k, draft: String(entries[k] ?? ""), point: { x: e.clientX, y: e.clientY } });
                          }
                          focusCell(k);
                        }}
                        className="p-0 text-center tabular-nums"
                        style={{
                          border: isSensor
                            ? "2px solid hsl(40 85% 55%)"
                            : `1px solid ${border}`,
                          background: inActive
                            ? dark ? "rgba(255,215,120,0.10)" : "rgba(255,215,120,0.22)"
                            : undefined,
                          minWidth: 74,
                        }}
                      >
                        {retained || !editable ? (
                          <span data-sb-cell={k} data-sb-locked="1" className="block px-3 py-1.5 opacity-90">
                            {String(value ?? "").trim()
                              ? renderMathInline(String(value), `tas-c-${group.objId}-${k}`)
                              : "\u00A0"}
                          </span>
                        ) : editing ? (
                          // THE universal math editor inside the cell: `@` asset
                          // picker, `#`/`##` powers and indices, `/` fractions.
                          <span data-sb-cell={k} className="block px-2 py-1">
                            <MathCellEditor
                              value={edit!.draft}
                              ink={ink}
                              entryPoint={edit!.point}
                              onChange={(v) => {
                                setEdit((prev) => (prev && prev.key === k ? { ...prev, draft: v } : prev));
                                onEntry(k, v);
                              }}
                              onCommit={() => {
                                const raw = edit?.key === k ? edit.draft : String(entries[k] ?? "");
                                const solved = tryEvaluate(raw);
                                if (solved !== null) onEntry(k, solved);
                                // THE SENSOR IS TEACHER-OWNED: committing a
                                // cell never walks to another cell. The next
                                // cell is chosen by tapping it.
                                setEdit(null);
                              }}
                            />
                          </span>
                        ) : (
                          <span
                            data-sb-cell={k}
                            className="block px-3 py-1.5 cursor-text"
                          >
                            {String(value ?? "").trim()
                              ? renderMathInline(String(value), `tas-c-${group.objId}-${k}`)
                              : "\u00A0"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Object toolbar — underneath the table. It stays put while the table is
          open and a cell is selected, so Σ is always reachable in a lesson. */}
      <div
        className="mt-1 flex items-center gap-1 transition-opacity duration-300"
        style={{
          opacity: toolbarVisible || (open && !!sensorCell) ? 1 : 0,
          pointerEvents: toolbarVisible || (open && !!sensorCell) ? "auto" : "none",
        }}
      >
        <button
          onClick={() => { onOpenChange(!open); ping(); }}
          className={toolbarBtn}
          style={{ color: ink }}
        >
          {open ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {open ? "Collapse" : "Expand"}
        </button>
        {open && editable && (
          <>
            <button
              onClick={() => { sumTrack("row"); ping(); }}
              className={toolbarBtn}
              style={{ color: ink }}
              title="Add every number in this row into its empty cell"
            >
              <Sigma className="h-3.5 w-3.5" /> Sum Row
            </button>
            <button
              onClick={() => { sumTrack("col"); ping(); }}
              className={toolbarBtn}
              style={{ color: ink }}
              title="Add every number in this column into its empty cell"
            >
              <Sigma className="h-3.5 w-3.5" /> Sum Column
            </button>
          </>
        )}

        {editable && onClear && (
          <button
            onClick={() => { onClear(); ping(); }}
            className={toolbarBtn}
            style={{ color: ink }}
            title="Remove every value students entered — retained cells stay"
          >
            <Eraser className="h-3.5 w-3.5" /> Clear
          </button>
        )}
        {canDelete && onDelete && (
          <button
            onClick={() => { onDelete(); }}
            className={toolbarBtn}
            style={{ color: ink }}
            title="Remove the table from this board view — nothing is deleted"
          >
            <EyeOff className="h-3.5 w-3.5" /> Remove from board
          </button>
        )}
      </div>
    </div>
  );
};

export default TableActivityStage;

/** Exposed for the board: which member line a cell belongs to. */
export const cellTrack = (group: TableGroup, key: string): number | null => {
  const pos = parseCellKey(key);
  if (!pos) return null;
  return group.orientation === "row" ? pos.r : pos.c;
};

export const activeTrackOf = trackOf;
