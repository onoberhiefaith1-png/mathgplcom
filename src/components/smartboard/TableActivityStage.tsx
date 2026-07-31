// Table Activity Stage — the interactive Smart Table on the Smartboard.
//
// Two states:
//   • Card    — one lesson step: a compact card naming the table.
//   • Open    — the table full-size, exactly as the teacher built it.
//               Retained cells arrive filled and read-only; every other cell
//               is empty and editable, with the Smart Table calculator
//               (Enter solves arithmetic) and Σ summation.
//
// The stage never owns state: the active member line, the sensor cell and the
// student entries all live on the board, so Floating Numbers, Present and
// Assessment stay in lock-step with the table.

import { useEffect, useMemo, useRef } from "react";
import { Table2, ChevronDown, Sigma, Check } from "lucide-react";
import {
  cellKeysForLine,
  editableCellsForLine,
  isCellCorrect,
  isLineComplete,
  isRetained,
  lineIdxForCell,
  trackLabel,
  trackOf,
  expectedCellValue,
  type TableEntries,
  type TableGroup,
} from "@/lib/smartboard/tableActivity";
import { cellKey, parseCellKey } from "@/lib/floating/tableGrid";
import { cellNumber, formatNumber, tryEvaluate } from "@/components/lessonnotes/extensions/visuals/smarttable/evaluator";

interface Props {
  group: TableGroup;
  activeLineIdx: number;
  entries: TableEntries;
  sensorCell: string | null;
  open: boolean;
  dark?: boolean;
  editable?: boolean;
  onOpenChange: (open: boolean) => void;
  onActivateLine: (lineIdx: number) => void;
  onSensorCell: (key: string | null) => void;
  onEntry: (key: string, value: string) => void;
}

const TableActivityStage = ({
  group,
  activeLineIdx,
  entries,
  sensorCell,
  open,
  dark,
  editable = true,
  onOpenChange,
  onActivateLine,
  onSensorCell,
  onEntry,
}: Props) => {
  const ink = dark ? "rgba(245,245,240,0.94)" : "#1a2230";
  const border = dark ? "rgba(245,245,240,0.38)" : "rgba(26,34,48,0.45)";
  const surface = dark ? "rgba(20,24,32,0.92)" : "rgba(255,253,247,0.97)";
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const activeCells = useMemo(
    () => new Set(cellKeysForLine(group, activeLineIdx)),
    [group, activeLineIdx],
  );

  const done = useMemo(
    () => group.memberLineIdxs.filter((i) => isLineComplete(group, entries, i)).length,
    [group, entries],
  );

  // Keep the caret where the board's sensor is.
  useEffect(() => {
    if (!open || !sensorCell) return;
    const el = inputRefs.current[sensorCell];
    if (el && document.activeElement !== el) el.focus();
  }, [open, sensorCell]);

  if (!open) {
    return (
      <button
        onClick={() => onOpenChange(true)}
        className="absolute z-30 rounded-xl px-5 py-4 text-left"
        style={{
          left: "50%",
          top: 120,
          transform: "translateX(-50%)",
          minWidth: 320,
          background: surface,
          border: `1px solid ${border}`,
          color: ink,
          boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
        }}
      >
        <span className="flex items-center gap-2">
          <Table2 className="h-4 w-4" />
          <span className="text-base font-semibold">{group.label}</span>
        </span>
        <span className="mt-1 block text-[12px] opacity-70">
          {group.orientation === "row" ? "Row" : "Column"} activity ·{" "}
          {done}/{group.memberLineIdxs.length} complete — click to open
        </span>
      </button>
    );
  }

  const sumIntoTrack = () => {
    const cells = cellKeysForLine(group, activeLineIdx);
    const target = editableCellsForLine(group, activeLineIdx).find(
      (k) => !String(entries[k] ?? "").trim(),
    );
    if (!target) return;
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
    onSensorCell(target);
  };

  const focusCell = (key: string) => {
    onSensorCell(key);
    const line = lineIdxForCell(group, key);
    if (line !== null && line !== activeLineIdx) onActivateLine(line);
  };

  const moveWithin = (key: string, delta: number) => {
    const cells = editableCellsForLine(group, activeLineIdx);
    const i = cells.indexOf(key);
    const next = cells[i + delta];
    if (next) focusCell(next);
  };

  const grid = group.grid;

  return (
    <div
      className="absolute z-30 rounded-xl overflow-hidden"
      style={{
        left: "50%",
        top: 96,
        transform: "translateX(-50%)",
        maxWidth: "88%",
        background: surface,
        border: `1px solid ${border}`,
        color: ink,
        boxShadow: "0 12px 34px rgba(0,0,0,0.22)",
        backdropFilter: "blur(6px)",
      }}
    >
      <header
        className="flex items-center gap-2 px-4 py-2 border-b"
        style={{ borderColor: border }}
      >
        <Table2 className="h-3.5 w-3.5" />
        <span className="text-[11px] uppercase tracking-[0.25em] flex-1 truncate">
          {group.label}
        </span>
        <span className="text-[11px] tabular-nums opacity-80">
          Expected {trackLabel(group, activeLineIdx)}
          {isLineComplete(group, entries, activeLineIdx) ? " · Complete" : " · Incomplete"}
        </span>
        {editable && (
          <button
            onClick={sumIntoTrack}
            title={`Sum this ${group.orientation}`}
            className="grid place-items-center rounded-md h-7 w-7 hover:bg-black/10"
            style={{ color: ink }}
          >
            <Sigma className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Collapse table"
          className="grid place-items-center rounded-md h-7 w-7 hover:bg-black/10"
          style={{ color: ink }}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="px-4 py-3 overflow-auto" style={{ maxHeight: "58vh" }}>
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
                    {h}
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
                  const retained = isRetained(group, k);
                  const inActive = activeCells.has(k);
                  const isSensor = sensorCell === k;
                  const value = retained ? expectedCellValue(group, k) : entries[k] ?? "";
                  const correct = !retained && isCellCorrect(group, entries, k);
                  return (
                    <td
                      key={k}
                      onClick={() => focusCell(k)}
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
                        <span className="block px-3 py-1.5 opacity-90">
                          {value || "\u00A0"}
                        </span>
                      ) : (
                        <span className="relative flex items-center">
                          <input
                            ref={(el) => { inputRefs.current[k] = el; }}
                            value={value}
                            onFocus={() => focusCell(k)}
                            onChange={(e) => onEntry(k, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const solved = tryEvaluate(value);
                                if (solved !== null) onEntry(k, solved);
                                moveWithin(k, 1);
                              } else if (e.key === "Tab") {
                                e.preventDefault();
                                moveWithin(k, e.shiftKey ? -1 : 1);
                              }
                            }}
                            className="w-full bg-transparent px-3 py-1.5 text-center outline-none"
                            style={{ color: ink, minWidth: 68 }}
                          />
                          {correct && (
                            <Check
                              className="h-3 w-3 absolute right-1"
                              style={{ color: "hsl(150 60% 42%)" }}
                            />
                          )}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] italic opacity-65">
          {group.orientation === "row"
            ? "Fill the highlighted row. Enter solves arithmetic and moves on."
            : "Fill the highlighted column. Enter solves arithmetic and moves on."}
        </p>
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
