// FreeWriteLayer — one absolute-positioned math-tree per line.
// Empty lines render only when they are the active line (so the caret has
// somewhere to live). Non-active lines render with a fake cursor whose path
// never matches a real one, so no carets show.

import { useEffect, useRef } from "react";
import { entryPosition, type Grid } from "@/lib/smartboard/grid";
import type { Cursor, Row } from "@/lib/smartboard/mathTree";
import { MathTreeRender } from "./MathTreeRender";

export type FreeLineMap = Record<number, Row>;

interface Props {
  lines: FreeLineMap;
  offsets?: Record<number, number>;
  grid: Grid;
  activeLine: number | null;
  cursor: Cursor;
  caretColor: string;
  onCursorChange: (line: number, c: Cursor) => void;
  onMeasure?: (line: number, width: number, height: number) => void;
}

const INACTIVE_CURSOR: Cursor = { path: [-1], index: 0 };

export const FreeWriteLayer = ({
  lines, offsets, grid, activeLine, cursor, caretColor, onCursorChange, onMeasure,
}: Props) => {
  const set = new Set<number>();
  if (activeLine != null && Number.isFinite(activeLine)) set.add(activeLine);
  for (const k of Object.keys(lines)) {
    const n = Number(k);
    if ((lines[n]?.length ?? 0) > 0) set.add(n);
  }
  const ordered = [...set].sort((a, b) => a - b);
  return (
    <>
      {ordered.map((line) => (
        <LineRender
          key={line}
          line={line}
          row={lines[line] ?? []}
          xOffset={offsets?.[line] ?? 0}
          grid={grid}
          cursor={line === activeLine ? cursor : INACTIVE_CURSOR}
          caretColor={caretColor}
          onCursorChange={(c) => onCursorChange(line, c)}
          onMeasure={onMeasure}
        />
      ))}
    </>
  );
};

const LineRender = ({
  line, row, xOffset, grid, cursor, caretColor, onCursorChange, onMeasure,
}: {
  line: number;
  row: Row;
  xOffset: number;
  grid: Grid;
  cursor: Cursor;
  caretColor: string;
  onCursorChange: (c: Cursor) => void;
  onMeasure?: (line: number, w: number, h: number) => void;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const { top, left } = entryPosition({ line, x: xOffset }, grid);

  useEffect(() => {
    if (!ref.current || !onMeasure) return;
    const measure = () => {
      const r = ref.current?.getBoundingClientRect();
      onMeasure(line, r?.width ?? 0, r?.height ?? 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [line, row, onMeasure]);

  return (
    <div
      ref={ref}
      data-erase-line={line}
      style={{
        position: "absolute",
        top,
        left,
        // Scale lesson text + math with the Text Size slider. Internal
        // math sub-structure is em-relative inside MathTreeRender, so
        // every part of the equation (numerator, fraction bar, 2a,
        // exponents, radicals) grows together as a rigid unit.
        fontSize: `${grid.FONT_PX}px`,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "baseline",
        whiteSpace: "pre",
      }}
    >
      <MathTreeRender
        root={row}
        cursor={cursor}
        onCursorChange={onCursorChange}
        caretColor={caretColor}
      />
    </div>
  );
};

export default FreeWriteLayer;
