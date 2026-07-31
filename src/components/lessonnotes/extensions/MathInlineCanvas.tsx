// Editable inline math canvas: renders a `Row` tree with a real cursor
// inside, so every superscript, subscript, numerator, denominator and
// radical is a free editable region — not a fixed object.
//
// Keyboard (while focused):
//   printable    → insert char at cursor
//   Backspace    → delete previous / pop out of empty container
//   ArrowLeft/Right → walk char-by-char, into/out of sub-rows
//   ArrowUp/Down → hop between sibling sub-rows of a container
//   /            → wrap the multiplicative term to the left as a fraction
//                  numerator; cursor lands in denominator
//   ( [ | {      → open a bracketed workspace; cursor descends inside
//   Space        → insert a real space (spacing is editable)
//   Tab          → exit one level; at the top row, blur and return the
//                  caret to the surrounding prose
//   click        → place the caret exactly where clicked, at any depth

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Row,
  type Node,
  type Cursor,
  mkChar,
  mkFrac,
  mkSqrt,
  mkBracket,
  getRowAt,
  setRowAt,
  subRowsOf,
  insertChar,
  insertNode,
  insertNodeWrapping,
  backspace as treeBackspace,
  moveLeft,
  moveRight,
  extractWrapTargetLeftOf,
} from "@/lib/smartboard/mathTree";

interface Props {
  root: Row;
  onChange: (root: Row) => void;
  onBlur: () => void;
  focused: boolean;
  onFocus: () => void;
  /** Viewport point of the click that opened the editor, so the caret can
   *  land exactly where the teacher clicked on the rendered form. */
  entryPoint?: { x: number; y: number } | null;
}


const pathsEqual = (a: number[], b: number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** Depth = number of nested sub-rows we are inside. Root row = 0. */
const depthOf = (path: number[]) => path.length / 2;

const Caret = ({ depth }: { depth: number }) => {
  // Shrink caret font-size (and thus height) as depth increases.
  const scale = Math.max(0.55, 1 - depth * 0.18);
  return (
    <span
      aria-hidden
      className="inline-block align-baseline animate-pulse"
      style={{
        width: 1.5,
        height: `${scale}em`,
        background: "currentColor",
        marginLeft: -0.5,
        marginRight: -0.5,
        transform: "translateY(0.1em)",
      }}
    />
  );
};

function RowView({
  row, path, cursor, focused,
}: { row: Row; path: number[]; cursor: Cursor; focused: boolean }) {
  const isCursorRow = focused && pathsEqual(path, cursor.path);
  const depth = depthOf(path);
  const items: React.ReactNode[] = [];
  const pathKey = JSON.stringify(path);
  for (let i = 0; i <= row.length; i++) {
    if (isCursorRow && cursor.index === i) {
      items.push(<Caret key={`c${i}`} depth={depth} />);
    }
    if (i < row.length) {
      const n = row[i];
      items.push(
        <span key={`n${i}`} data-mpath={pathKey} data-mindex={i}>
          <NodeView node={n} path={[...path, i]} cursor={cursor} focused={focused} />
        </span>,
      );
    }
  }
  if (row.length === 0 && !isCursorRow) {
    // Empty non-active sub-row: show a small placeholder box so the teacher
    // sees where they can click.
    items.push(
      <span
        key="empty"
        aria-hidden
        data-math-empty-slot="true"
        data-mpath={pathKey}
        data-mindex={0}
        className="inline-block"
        style={{
          width: "0.6em",
          height: "0.8em",
          border: "1px dashed rgba(0,0,0,0.3)",
          verticalAlign: "middle",
        }}
      />,
    );
  }
  return (
    <span className="mrow" data-mrow={pathKey} style={{ whiteSpace: "pre" }}>
      {items}
    </span>
  );
}

/** Map a viewport point to a caret position inside the tree. Returns null
 *  when the point is not over any glyph (caller falls back to row end). */
function hitTestCursor(x: number, y: number, container: HTMLElement | null): Cursor | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el || (container && !container.contains(el))) return null;
  const glyph = el.closest("[data-mpath]") as HTMLElement | null;
  if (glyph && (!container || container.contains(glyph))) {
    try {
      const path = JSON.parse(glyph.dataset.mpath as string) as number[];
      const idx = Number(glyph.dataset.mindex ?? 0);
      const r = glyph.getBoundingClientRect();
      const isEmptySlot = glyph.dataset.mathEmptySlot === "true";
      return { path, index: isEmptySlot ? 0 : x > r.left + r.width / 2 ? idx + 1 : idx };
    } catch { /* fall through */ }
  }
  const rowEl = el.closest("[data-mrow]") as HTMLElement | null;
  if (rowEl) {
    try {
      const path = JSON.parse(rowEl.dataset.mrow as string) as number[];
      return { path, index: Number.MAX_SAFE_INTEGER };
    } catch { /* noop */ }
  }
  return null;
}


function NodeView({
  node, path, cursor, focused,
}: { node: Node; path: number[]; cursor: Cursor; focused: boolean }) {
  if (node.kind === "char") {
    const ch = node.ch === " " ? "\u00a0" : node.ch;
    return <span>{ch}</span>;
  }
  if (node.kind === "frac") {
    const [num, den] = subRowsOf(node);
    return (
      <span
        className="mfrac"
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          verticalAlign: "middle",
          margin: "0 2px",
          lineHeight: 1.05,
          textAlign: "center",
        }}
      >
        <span style={{ padding: "0 4px" }}>
          <RowView row={num} path={[...path, 0]} cursor={cursor} focused={focused} />
        </span>
        <span style={{ borderTop: "1.5px solid currentColor", alignSelf: "stretch" }} />
        <span style={{ padding: "0 4px" }}>
          <RowView row={den} path={[...path, 1]} cursor={cursor} focused={focused} />
        </span>
      </span>
    );
  }
  if (node.kind === "sqrt") {
    const rows = subRowsOf(node);
    return (
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        {rows.length === 2 && (
          <span style={{ fontSize: "0.6em", transform: "translateY(-0.4em)" }}>
            <RowView row={rows[1]} path={[...path, 1]} cursor={cursor} focused={focused} />
          </span>
        )}
        <span style={{ fontSize: "1.2em" }}>√</span>
        <span style={{ borderTop: "1.5px solid currentColor", paddingLeft: 2, paddingRight: 2 }}>
          <RowView row={rows[0]} path={[...path, 0]} cursor={cursor} focused={focused} />
        </span>
      </span>
    );
  }
  if (node.kind === "subsup") {
    const [base, sub, sup] = subRowsOf(node);
    const subPath = [...path, 1];
    const supPath = [...path, 2];
    const subHasInk = sub.length > 0;
    const supHasInk = sup.length > 0;
    const showSub = subHasInk || (focused && pathsEqual(cursor.path, subPath));
    const showSup = supHasInk || (focused && pathsEqual(cursor.path, supPath));

    if (showSup && !showSub) {
      return (
        <span style={{ display: "inline-flex", alignItems: "baseline" }}>
          <RowView row={base} path={[...path, 0]} cursor={cursor} focused={focused} />
          <span
            style={{
              display: "inline-block",
              fontSize: "0.7em",
              lineHeight: 1,
              marginLeft: 1,
              transform: "translateY(-0.42em)",
              transformOrigin: "left bottom",
            }}
          >
            <RowView row={sup} path={supPath} cursor={cursor} focused={focused} />
          </span>
        </span>
      );
    }

    if (showSub && !showSup) {
      return (
        <span style={{ display: "inline-flex", alignItems: "baseline" }}>
          <RowView row={base} path={[...path, 0]} cursor={cursor} focused={focused} />
          <span
            style={{
              display: "inline-block",
              fontSize: "0.7em",
              lineHeight: 1,
              marginLeft: 1,
              transform: "translateY(0.28em)",
              transformOrigin: "left top",
            }}
          >
            <RowView row={sub} path={subPath} cursor={cursor} focused={focused} />
          </span>
        </span>
      );
    }

    if (!showSub && !showSup) {
      return <RowView row={base} path={[...path, 0]} cursor={cursor} focused={focused} />;
    }

    return (
      <span style={{ display: "inline-flex", alignItems: "baseline" }}>
        <RowView row={base} path={[...path, 0]} cursor={cursor} focused={focused} />
        <span style={{ display: "inline-flex", flexDirection: "column", fontSize: "0.7em", lineHeight: 1, marginLeft: 1 }}>
          <span style={{ minHeight: "0.6em" }}>
            <RowView row={sup} path={supPath} cursor={cursor} focused={focused} />
          </span>
          <span style={{ minHeight: "0.6em" }}>
            <RowView row={sub} path={subPath} cursor={cursor} focused={focused} />
          </span>
        </span>
      </span>
    );
  }
  if (node.kind === "power") {
    const [base, exp] = subRowsOf(node);
    return (
      <span style={{ display: "inline-flex", alignItems: "baseline" }}>
        <RowView row={base} path={[...path, 0]} cursor={cursor} focused={focused} />
        <sup style={{ fontSize: "0.7em" }}>
          <RowView row={exp} path={[...path, 1]} cursor={cursor} focused={focused} />
        </sup>
      </span>
    );
  }
  if (node.kind === "sup") {
    return (
      <sup style={{ fontSize: "0.7em" }}>
        <RowView row={subRowsOf(node)[0]} path={[...path, 0]} cursor={cursor} focused={focused} />
      </sup>
    );
  }
  if (node.kind === "sub") {
    return (
      <sub style={{ fontSize: "0.7em" }}>
        <RowView row={subRowsOf(node)[0]} path={[...path, 0]} cursor={cursor} focused={focused} />
      </sub>
    );
  }
  if (node.kind === "bracket") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        <span>{node.left}</span>
        <RowView row={subRowsOf(node)[0]} path={[...path, 0]} cursor={cursor} focused={focused} />
        <span>{node.right}</span>
      </span>
    );
  }
  if (node.kind === "bigop") {
    const [body, lower, upper] = subRowsOf(node);
    const GLYPH: Record<string, string> = {
      sum: "\u2211", prod: "\u220f", int: "\u222b", oint: "\u222e", lim: "lim",
    };
    const hasLower = lower.length > 0 || (focused && pathsEqual(cursor.path, [...path, 1]));
    const hasUpper = upper.length > 0 || (focused && pathsEqual(cursor.path, [...path, 2]));
    return (
      <span style={{ display: "inline-flex", alignItems: "center", margin: "0 2px" }}>
        <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
          {hasUpper && (
            <span style={{ fontSize: "0.6em" }}>
              <RowView row={upper} path={[...path, 2]} cursor={cursor} focused={focused} />
            </span>
          )}
          <span style={{ fontSize: node.op === "lim" ? "1em" : "1.5em" }}>{GLYPH[node.op] ?? "\u2211"}</span>
          {hasLower && (
            <span style={{ fontSize: "0.6em" }}>
              <RowView row={lower} path={[...path, 1]} cursor={cursor} focused={focused} />
            </span>
          )}
        </span>
        {(body.length > 0 || (focused && pathsEqual(cursor.path, [...path, 0]))) && (
          <span style={{ marginLeft: 2 }}>
            <RowView row={body} path={[...path, 0]} cursor={cursor} focused={focused} />
          </span>
        )}
      </span>
    );
  }
  if (node.kind === "accent") {
    return (
      <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
        <span aria-hidden style={{ fontSize: "0.7em", height: "0.45em", lineHeight: 0.6 }}>
          {node.symbol === "\u203e" ? "\u203e" : node.symbol}
        </span>
        <RowView row={subRowsOf(node)[0]} path={[...path, 0]} cursor={cursor} focused={focused} />
      </span>
    );
  }
  if (node.kind === "binom") {
    const [top, bot] = subRowsOf(node);
    return (
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        <span style={{ fontSize: "1.6em" }}>(</span>
        <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", lineHeight: 1.05 }}>
          <RowView row={top} path={[...path, 0]} cursor={cursor} focused={focused} />
          <RowView row={bot} path={[...path, 1]} cursor={cursor} focused={focused} />
        </span>
        <span style={{ fontSize: "1.6em" }}>)</span>
      </span>
    );
  }
  if (node.kind === "matrix") {
    const cells = subRowsOf(node);
    return (
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        <span style={{ fontSize: `${Math.max(1.4, node.nRows)}em` }}>{node.left}</span>
        <span style={{ display: "inline-grid", gridTemplateColumns: `repeat(${node.nCols}, auto)`, gap: "2px 10px", textAlign: "center" }}>
          {cells.map((r, i) => (
            <span key={i}>
              <RowView row={r} path={[...path, i]} cursor={cursor} focused={focused} />
            </span>
          ))}
        </span>
        <span style={{ fontSize: `${Math.max(1.4, node.nRows)}em` }}>{node.right}</span>
      </span>
    );
  }
  if (node.kind === "box") {
    return (
      <span style={{ display: "inline-block", border: "1px solid currentColor", padding: "0 3px" }}>
        <RowView row={subRowsOf(node)[0]} path={[...path, 0]} cursor={cursor} focused={focused} />
      </span>
    );
  }
  // Unknown container: render children flatly.
  return (
    <span>
      {subRowsOf(node).map((r, i) => (
        <RowView key={i} row={r} path={[...path, i]} cursor={cursor} focused={focused} />
      ))}
    </span>
  );
}

/** Move up/down between sibling sub-rows of the same container. */
function moveVertical(root: Row, cursor: Cursor, dir: -1 | 1): Cursor {
  if (cursor.path.length < 2) return cursor;
  const parentPath = cursor.path.slice(0, -2);
  const nodeIdx = cursor.path[cursor.path.length - 2];
  const subIdx = cursor.path[cursor.path.length - 1];
  const parentRow = getRowAt(root, parentPath);
  const node = parentRow[nodeIdx];
  if (!node || node.kind === "char") return cursor;
  const subs = subRowsOf(node);
  // For subsup rendering, sup is visually above sub, but subRowsOf order is
  // [base, sub, sup]. Provide a display order for vertical navigation.
  let order: number[];
  if (node.kind === "subsup") order = [2, 0, 1]; // sup, base, sub
  else if (node.kind === "frac") order = [0, 1]; // num, den
  else if (node.kind === "power") order = [1, 0]; // exp, base
  else order = subs.map((_, i) => i);
  const pos = order.indexOf(subIdx);
  const nextPos = pos + dir;
  if (pos < 0 || nextPos < 0 || nextPos >= order.length) return cursor;
  const target = order[nextPos];
  return { path: [...parentPath, nodeIdx, target], index: 0 };
}

export function MathInlineCanvas({
  root, onChange, onBlur, focused, onFocus, entryPoint,
}: Props) {
  const [cursor, setCursor] = useState<Cursor>({ path: [], index: root.length });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hostRef = useRef<HTMLSpanElement | null>(null);

  /** Clamp a raw hit-test cursor to a valid index inside its row. */
  const clamp = useCallback((c: Cursor): Cursor => {
    try {
      const row = getRowAt(root, c.path);
      return { path: c.path, index: Math.max(0, Math.min(c.index, row.length)) };
    } catch {
      return { path: [], index: root.length };
    }
  }, [root]);

  // Place the caret where the teacher first clicked (the click that opened
  // the editor happened on the read-only render, so we replay its point).
  useEffect(() => {
    if (!focused || !entryPoint) return;
    const id = requestAnimationFrame(() => {
      const hit = hitTestCursor(entryPoint.x, entryPoint.y, hostRef.current);
      if (hit) setCursor(clamp(hit));
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, entryPoint?.x, entryPoint?.y]);


  // Keep cursor valid on external tree changes.
  useEffect(() => {
    const row = getRowAt(root, cursor.path);
    if (cursor.index > row.length) {
      setCursor({ path: cursor.path, index: row.length });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root]);

  useEffect(() => {
    if (focused) {
      inputRef.current?.focus();
    }
  }, [focused]);

  const apply = useCallback((next: { root: Row; cursor: Cursor }) => {
    onChange(next.root);
    setCursor(next.cursor);
  }, [onChange]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      // Let browser handle
      return;
    }
    const k = e.key;
    if (k === "ArrowLeft") { e.preventDefault(); setCursor(moveLeft(root, cursor)); return; }
    if (k === "ArrowRight") { e.preventDefault(); setCursor(moveRight(root, cursor)); return; }
    if (k === "ArrowUp") { e.preventDefault(); setCursor(moveVertical(root, cursor, -1)); return; }
    if (k === "ArrowDown") { e.preventDefault(); setCursor(moveVertical(root, cursor, 1)); return; }
    if (k === "Backspace") { e.preventDefault(); apply(treeBackspace(root, cursor)); return; }
    if (k === "Enter" || k === "Escape") { e.preventDefault(); onBlur(); return; }
    if (k === " ") {
      // Space is a real space: teachers adjust spacing inside the
      // expression. Use Tab to pop out a level, Escape/Enter to leave.
      e.preventDefault();
      apply(insertChar(root, cursor, " "));
      return;
    }
    if (k === "Tab") {
      e.preventDefault();
      if (cursor.path.length === 0) {
        onBlur();
      } else {
        // Pop out one level: land after the container node we were inside.
        const parentPath = cursor.path.slice(0, -2);
        const nodeIdx = cursor.path[cursor.path.length - 2];
        setCursor({ path: parentPath, index: nodeIdx + 1 });
      }
      return;
    }

    if (k === "/") {
      e.preventDefault();
      const row = getRowAt(root, cursor.path);
      const { start, end } = extractWrapTargetLeftOf(row, cursor.index);
      apply(insertNodeWrapping(root, cursor, mkFrac(), start, end, 0));
      return;
    }
    if (k === "(" || k === "[" || k === "{" || k === "|") {
      e.preventDefault();
      const map: Record<string, [string, string]> = {
        "(": ["(", ")"], "[": ["[", "]"], "{": ["{", "}"], "|": ["|", "|"],
      };
      const [l, r] = map[k];
      apply(insertNode(root, cursor, mkBracket(l as never, r as never)));
      return;
    }
    if (k.length === 1) {
      e.preventDefault();
      apply(insertChar(root, cursor, k));
      return;
    }
  };

  const rowNode = useMemo(
    () => <RowView row={root} path={[]} cursor={cursor} focused={focused} />,
    [root, cursor, focused],
  );

  return (
    <span
      ref={hostRef}
      className={`math-inline-display math-inline-editing inline-flex items-baseline align-baseline ${focused ? "outline outline-1 outline-primary/30 rounded-sm" : "cursor-text"}`}
      style={{ minHeight: "1.2em", lineHeight: "var(--math-line-height)" }}
      onMouseDown={(e) => {
        e.preventDefault();
        onFocus();
        // Caret lands exactly where the teacher clicked — including inside
        // numerators, exponents, radicands and Σ limits.
        const hit = hitTestCursor(e.clientX, e.clientY, hostRef.current);
        setCursor(hit ? clamp(hit) : { path: [], index: root.length });
        setTimeout(() => inputRef.current?.focus(), 0);
      }}
    >

      {rowNode}
      <input
        ref={inputRef}
        value=""
        onChange={() => {}}
        onKeyDown={handleKey}
        onBlur={onBlur}
        aria-label="Math editor"
        className="sr-only"
      />
    </span>
  );
}
