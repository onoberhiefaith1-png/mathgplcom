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
//   Space        → exit one level; when already at the top row, blur and
//                  return the caret to the surrounding prose

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
  for (let i = 0; i <= row.length; i++) {
    if (isCursorRow && cursor.index === i) {
      items.push(<Caret key={`c${i}`} depth={depth} />);
    }
    if (i < row.length) {
      const n = row[i];
      items.push(
        <NodeView key={`n${i}`} node={n} path={[...path, i]} cursor={cursor} focused={focused} />,
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
  return <span className="mrow" style={{ whiteSpace: "pre" }}>{items}</span>;
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
  root, onChange, onBlur, focused, onFocus,
}: Props) {
  const [cursor, setCursor] = useState<Cursor>({ path: [], index: root.length });
  const inputRef = useRef<HTMLInputElement | null>(null);

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
      e.preventDefault();
      if (cursor.path.length === 0) {
        // Top row: return to prose.
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
      className={`inline-flex items-baseline align-baseline ${focused ? "outline outline-1 outline-primary/30" : "cursor-text"}`}
      style={{ minHeight: "1.2em" }}
      onMouseDown={(e) => {
        e.preventDefault();
        onFocus();
        // Land at end of top row for now (fine-grained hit testing is a
        // future refinement).
        setCursor({ path: [], index: root.length });
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
