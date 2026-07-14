// Long Division — column-aligned digit-cell grid.
//
// Every digit of the quotient, dividend, and each working row lives in an
// invisible fixed-width column. All rows share the same column template so
// digits snap into perfect vertical alignment without any manual spacing.
// The divisor and the ")" bracket sit in fixed side gutters outside the grid
// so they never disturb column alignment.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Plus, Minus } from "lucide-react";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import { useHoverIdleVisibility } from "@/hooks/useHoverIdleVisibility";
import {
  PanelGroup, PanelRow, PanelNumber, PanelToggle,
} from "@/components/lessonnotes/panel/panelPrimitives";
import { AssetBottomToolbar } from "@/components/lessonnotes/panel/AssetBottomToolbar";

interface Attrs {
  divisor: string;
  dividendDigits: string[];
  quotientDigits: string[];
  workingRows: string[][];
  showWorking: boolean;
  autoMinus: boolean;
  autoLine: boolean;
  lineThickness: number;
  rowHeight: number;
}

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
}

const MIN_COLS = 3;
const COL_W = "1.15ch"; // invisible column width

function toDigitArray(s: string): string[] {
  return String(s ?? "").split("");
}

function normalize(a: Record<string, unknown>): Attrs {
  // Migrate legacy string fields → digit arrays.
  let dividendDigits: string[] = Array.isArray(a.dividendDigits)
    ? (a.dividendDigits as string[]).map((x) => String(x ?? ""))
    : typeof a.dividend === "string"
      ? toDigitArray(a.dividend)
      : [];
  if (dividendDigits.length < MIN_COLS) {
    dividendDigits = Array(MIN_COLS).fill("");
  }
  const nCols = dividendDigits.length;

  let quotientDigits: string[] = Array.isArray(a.quotientDigits)
    ? (a.quotientDigits as string[]).map((x) => String(x ?? ""))
    : typeof a.quotient === "string"
      ? toDigitArray(a.quotient)
      : [];
  // Right-align legacy quotient to the dividend width.
  if (quotientDigits.length < nCols) {
    quotientDigits = Array(nCols - quotientDigits.length).fill("").concat(quotientDigits);
  } else if (quotientDigits.length > nCols) {
    quotientDigits = quotientDigits.slice(-nCols);
  }

  let workingRows: string[][];
  if (Array.isArray(a.workingRows)) {
    workingRows = (a.workingRows as unknown[]).map((row) => {
      let arr: string[];
      if (Array.isArray(row)) arr = (row as string[]).map((x) => String(x ?? ""));
      else if (typeof row === "string") arr = toDigitArray(row);
      else arr = [];
      // Right-align legacy string rows to the grid.
      if (arr.length < nCols) arr = Array(nCols - arr.length).fill("").concat(arr);
      else if (arr.length > nCols) arr = arr.slice(-nCols);
      return arr;
    });
  } else {
    workingRows = [];
  }

  return {
    divisor: typeof a.divisor === "string" ? a.divisor : "",
    dividendDigits,
    quotientDigits,
    workingRows,
    showWorking: a.showWorking === undefined ? true : Boolean(a.showWorking),
    autoMinus: a.autoMinus === undefined ? true : Boolean(a.autoMinus),
    autoLine: a.autoLine === undefined ? true : Boolean(a.autoLine),
    lineThickness: Number(a.lineThickness) || 3,
    rowHeight: Number(a.rowHeight) || 36,
  };
}

// Row identifiers for focus navigation.
type RowKey = "quotient" | "dividend" | `work-${number}`;

function focusCell(root: HTMLElement | null, row: RowKey, col: number) {
  if (!root) return;
  const el = root.querySelector<HTMLInputElement>(
    `input[data-ld-row="${row}"][data-ld-col="${col}"]`
  );
  if (el) {
    el.focus();
    el.select();
  }
}

interface DigitCellProps {
  value: string;
  row: RowKey;
  col: number;
  nCols: number;
  rootRef: React.RefObject<HTMLDivElement>;
  onWrite: (col: number, digit: string) => void;
  onClear: (col: number) => void;
  onAppendCol?: () => void; // dividend only, when typing past last col
  onTrimTail?: () => void;  // dividend only, when backspacing empty tail
}

function DigitCell({
  value, row, col, nCols, rootRef, onWrite, onClear, onAppendCol, onTrimTail,
}: DigitCellProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = e.key;
    if (key === "ArrowLeft") {
      e.preventDefault();
      if (col > 0) focusCell(rootRef.current, row, col - 1);
      return;
    }
    if (key === "ArrowRight") {
      e.preventDefault();
      if (col < nCols - 1) focusCell(rootRef.current, row, col + 1);
      else if (row === "dividend" && onAppendCol) {
        onAppendCol();
        setTimeout(() => focusCell(rootRef.current, row, col + 1), 0);
      }
      return;
    }
    if (key === " ") {
      e.preventDefault();
      // Space advances one column without writing.
      if (col < nCols - 1) focusCell(rootRef.current, row, col + 1);
      else if (row === "dividend" && onAppendCol) {
        onAppendCol();
        setTimeout(() => focusCell(rootRef.current, row, col + 1), 0);
      }
      return;
    }
    if (key === "Backspace") {
      e.preventDefault();
      if (value !== "") {
        onClear(col);
      } else if (col > 0) {
        focusCell(rootRef.current, row, col - 1);
      } else if (row === "dividend" && col === nCols - 1 && onTrimTail) {
        onTrimTail();
      }
      return;
    }
    // Single-character write: letters, digits, and math punctuation.
    if (key.length === 1 && /^[\p{L}\p{N}.,\-+*/=]$/u.test(key)) {
      e.preventDefault();
      onWrite(col, key);
      // Advance right; on the dividend, growing the grid is allowed.
      if (col < nCols - 1) {
        focusCell(rootRef.current, row, col + 1);
      } else if (row === "dividend" && onAppendCol) {
        onAppendCol();
        setTimeout(() => focusCell(rootRef.current, row, col + 1), 0);
      }
      return;
    }
  };

  return (
    <input
      type="text"
      inputMode="text"
      value={value}
      onChange={() => { /* controlled via keydown */ }}
      onKeyDown={handleKeyDown}
      data-ld-row={row}
      data-ld-col={col}
      style={{
        width: COL_W,
        padding: 0,
        margin: 0,
        border: "none",
        outline: "none",
        background: "transparent",
        textAlign: "center",
        fontFamily: "inherit",
        fontSize: "inherit",
        color: "inherit",
        caretColor: "#0f172a",
      }}
    />
  );
}

export function LongDivision({ attrs, onChange, selected }: Props) {
  const m = useMemo(() => normalize(attrs), [attrs]);
  const nCols = m.dividendDigits.length;
  const rootRef = useRef<HTMLDivElement>(null);

  const patch = useCallback((p: Partial<Attrs>) => onChange({ ...p }), [onChange]);

  // Persist migrated shape once (guarded to avoid render loops).
  const migratedRef = useRef(false);
  useEffect(() => {
    if (migratedRef.current) return;
    const legacyDividend = typeof attrs.dividend === "string";
    const legacyQuotient = typeof attrs.quotient === "string";
    const legacyRows = Array.isArray(attrs.workingRows) &&
      (attrs.workingRows as unknown[]).some((r) => typeof r === "string");
    const noNew = attrs.dividendDigits === undefined &&
                  attrs.quotientDigits === undefined;
    if (legacyDividend || legacyQuotient || legacyRows || noNew) {
      migratedRef.current = true;
      onChange({
        dividendDigits: m.dividendDigits,
        quotientDigits: m.quotientDigits,
        workingRows: m.workingRows,
        // Clear legacy fields.
        dividend: undefined,
        quotient: undefined,
      });
    } else {
      migratedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Mutators -----
  const writeDividend = (col: number, d: string) => {
    const next = [...m.dividendDigits];
    next[col] = d;
    patch({ dividendDigits: next });
  };
  const clearDividend = (col: number) => {
    const next = [...m.dividendDigits];
    next[col] = "";
    patch({ dividendDigits: next });
  };
  const appendCol = () => {
    patch({
      dividendDigits: [...m.dividendDigits, ""],
      quotientDigits: [...m.quotientDigits, ""],
      workingRows: m.workingRows.map((r) => [...r, ""]),
    });
  };
  const trimTail = () => {
    if (nCols <= MIN_COLS) return;
    // Only trim if the trailing column is empty across every row.
    const lastEmpty =
      (m.dividendDigits[nCols - 1] ?? "") === "" &&
      (m.quotientDigits[nCols - 1] ?? "") === "" &&
      m.workingRows.every((r) => (r[nCols - 1] ?? "") === "");
    if (!lastEmpty) return;
    patch({
      dividendDigits: m.dividendDigits.slice(0, -1),
      quotientDigits: m.quotientDigits.slice(0, -1),
      workingRows: m.workingRows.map((r) => r.slice(0, -1)),
    });
  };

  const writeQuotient = (col: number, d: string) => {
    const next = [...m.quotientDigits];
    while (next.length < nCols) next.push("");
    next[col] = d;
    patch({ quotientDigits: next });
  };
  const clearQuotient = (col: number) => {
    const next = [...m.quotientDigits];
    while (next.length < nCols) next.push("");
    next[col] = "";
    patch({ quotientDigits: next });
  };

  const writeRow = (i: number, col: number, d: string) => {
    const rows = m.workingRows.map((r) => [...r]);
    while (rows[i].length < nCols) rows[i].push("");
    rows[i][col] = d;
    patch({ workingRows: rows });
  };
  const clearRow = (i: number, col: number) => {
    const rows = m.workingRows.map((r) => [...r]);
    while (rows[i].length < nCols) rows[i].push("");
    rows[i][col] = "";
    patch({ workingRows: rows });
  };

  const addStep = () =>
    patch({
      workingRows: [
        ...m.workingRows,
        Array(nCols).fill(""),
        Array(nCols).fill(""),
      ],
    });
  const delStep = () =>
    m.workingRows.length > 0 &&
    patch({ workingRows: m.workingRows.slice(0, Math.max(0, m.workingRows.length - 2)) });

  // ----- Right-hand panel editor -----
  const editor = useMemo(() => (
    <div>
      <PanelGroup label="Behaviour">
        <PanelRow label="Auto minus (every 2 rows)"><PanelToggle value={m.autoMinus} onChange={(v) => patch({ autoMinus: v })} /></PanelRow>
        <PanelRow label="Auto horizontal line"><PanelToggle value={m.autoLine} onChange={(v) => patch({ autoLine: v })} /></PanelRow>
        <PanelRow label="Show working"><PanelToggle value={m.showWorking} onChange={(v) => patch({ showWorking: v })} /></PanelRow>
      </PanelGroup>
      <PanelGroup label="Divisor">
        <PanelRow label="Divisor">
          <input
            type="text"
            value={m.divisor}
            onChange={(e) => patch({ divisor: e.target.value })}
            style={{
              width: "6ch", padding: "2px 4px",
              border: "1px solid hsl(var(--border))", borderRadius: 4,
              background: "transparent", fontFamily: "inherit",
            }}
          />
        </PanelRow>
      </PanelGroup>
      <PanelGroup label="Sizing">
        <PanelRow label="Line thickness"><PanelNumber value={m.lineThickness} min={1} max={6} onChange={(v) => patch({ lineThickness: v })} /></PanelRow>
        <PanelRow label="Row height"><PanelNumber value={m.rowHeight} min={20} max={60} onChange={(v) => patch({ rowHeight: v })} /></PanelRow>
      </PanelGroup>
    </div>
  ), [m.autoMinus, m.autoLine, m.showWorking, m.divisor, m.lineThickness, m.rowHeight, patch]);
  useRegisterAssetEditor(!!selected, "longDivision", "Long division", editor);

  const { visible: toolbarVisible, bind } = useHoverIdleVisibility({ idleMs: 10000, forceVisible: !!selected });

  // ----- Layout -----
  // Shared grid template: [minus gutter] [divisor] [hook] [nCols cells].
  // The hook column holds an SVG curve that flows into the vinculum, so the
  // whole long-division sign reads as ONE continuous symbol (like a radical).
  const HOOK_W = 12;
  const gridTemplate = `1.5ch auto ${HOOK_W}px repeat(${nCols}, ${COL_W})`;

  return (
    <div
      ref={rootRef}
      className="not-prose inline-block font-mono"
      style={{ color: "#0f172a", fontSize: 22, lineHeight: 1.15 }}
      onPointerEnter={bind.onPointerEnter}
      onPointerMove={bind.onPointerMove}
      onPointerLeave={bind.onPointerLeave}
      onPointerDown={bind.onPointerDown}
      onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {/* Quotient row */}
      <div className="grid" style={{ gridTemplateColumns: gridTemplate, alignItems: "end" }}>
        <div /> {/* minus gutter */}
        <div /> {/* divisor gutter */}
        <div /> {/* hook gutter */}
        {m.quotientDigits.slice(0, nCols).map((d, c) => (
          <DigitCell
            key={c}
            value={d ?? ""}
            row="quotient"
            col={c}
            nCols={nCols}
            rootRef={rootRef}
            onWrite={writeQuotient}
            onClear={clearQuotient}
          />
        ))}
        {/* pad quotientDigits array if shorter than nCols */}
        {Array.from({ length: Math.max(0, nCols - m.quotientDigits.length) }).map((_, i) => {
          const c = m.quotientDigits.length + i;
          return (
            <DigitCell
              key={`qpad-${c}`}
              value=""
              row="quotient"
              col={c}
              nCols={nCols}
              rootRef={rootRef}
              onWrite={writeQuotient}
              onClear={clearQuotient}
            />
          );
        })}
      </div>

      {/* Bracket row: divisor input, ")", then dividend cells under one continuous vinculum */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: gridTemplate,
          alignItems: "center",
        }}
      >
        <div /> {/* minus gutter */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, paddingRight: 0, letterSpacing: "-0.02em" }}>
          <input
            type="text"
            value={m.divisor}
            placeholder=" "
            onChange={(e) => patch({ divisor: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                const el = e.currentTarget;
                if (el.selectionStart === el.value.length) {
                  e.preventDefault();
                  focusCell(rootRef.current, "dividend", 0);
                }
              }
            }}
            style={{
              width: `${Math.max(1, m.divisor?.length || 1)}ch`,
              padding: 0,
              margin: 0,
              marginRight: "-0.05ch",
              border: "none",
              outline: "none",
              background: "transparent",
              textAlign: "right",
              fontFamily: "inherit",
              fontSize: "inherit",
              color: "inherit",
              caretColor: "#0f172a",
            }}
          />
          <span style={{ fontWeight: 700, fontSize: "1.1em", marginLeft: "-0.05ch" }}>)</span>
        </div>
        {/* One continuous vinculum spanning ALL dividend cells */}
        <div
          style={{
            gridColumn: `3 / span ${nCols}`,
            display: "grid",
            gridTemplateColumns: `repeat(${nCols}, ${COL_W})`,
            borderTop: `${m.lineThickness}px solid #0f172a`,
            paddingTop: 2,
          }}
        >
          {m.dividendDigits.map((d, c) => (
            <DigitCell
              key={c}
              value={d ?? ""}
              row="dividend"
              col={c}
              nCols={nCols}
              rootRef={rootRef}
              onWrite={writeDividend}
              onClear={clearDividend}
              onAppendCol={appendCol}
              onTrimTail={trimTail}
            />
          ))}
        </div>
      </div>

      {/* Working rows */}
      {m.showWorking && m.workingRows.map((row, i) => {
        const showMinus = m.autoMinus && i % 2 === 0;
        const showLine = m.autoLine && i % 2 === 1;
        return (
          <div
            key={i}
            className="grid"
            style={{
              gridTemplateColumns: gridTemplate,
              alignItems: "center",
              minHeight: m.rowHeight,
            }}
          >
            <div style={{ textAlign: "right", fontWeight: 700, paddingRight: "0.25ch" }}>
              {showMinus ? "−" : ""}
            </div>
            <div /> {/* divisor gutter */}
            {Array.from({ length: nCols }).map((_, c) => (
              <div
                key={c}
                style={{
                  borderTop: showLine ? `${m.lineThickness}px solid #0f172a` : undefined,
                  paddingTop: showLine ? 2 : 0,
                }}
              >
                <DigitCell
                  value={row[c] ?? ""}
                  row={`work-${i}` as RowKey}
                  col={c}
                  nCols={nCols}
                  rootRef={rootRef}
                  onWrite={(col, d) => writeRow(i, col, d)}
                  onClear={(col) => clearRow(i, col)}
                />
              </div>
            ))}
          </div>
        );
      })}

      <AssetBottomToolbar
        visible={toolbarVisible}
        bind={bind}
        actions={[
          { label: "Working step", icon: <Plus className="h-3 w-3" />, onClick: addStep },
          { label: "Working step", icon: <Minus className="h-3 w-3" />, onClick: delStep, disabled: m.workingRows.length === 0, tone: "danger" },
        ]}
      />
    </div>
  );
}

export default LongDivision;
