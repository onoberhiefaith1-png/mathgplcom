// Recursive renderer for the Smartboard math tree.
//
// Each container measures its *own* body height (ResizeObserver → CSS var
// `--body-h`) so the radical/bracket glyphs grow with the contents they
// actually wrap — never with unrelated siblings on the same line. Empty
// rows render as a small dashed slot; non-empty rows render their children
// inline. A widened tap-zone on the right edge of every container places
// the caret *after* the container, so the user can always type "outside".

import {
  CSSProperties, PointerEvent as RPointerEvent,
  useEffect, useRef, useState,
} from "react";
import type { Cursor, Node, Row } from "@/lib/smartboard/mathTree";

interface Common {
  cursor: Cursor;
  onCursorChange: (c: Cursor) => void;
  caretColor: string;
}

const pathEq = (a: number[], b: number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const stopAnd = (e: RPointerEvent, fn: () => void) => {
  e.preventDefault();
  e.stopPropagation();
  fn();
};

/* ─────────── caret ─────────── */

const Caret = ({ color }: { color: string }) => (
  <span
    aria-hidden
    style={{
      display: "inline-block",
      width: 2,
      height: "1em",
      verticalAlign: "baseline",
      background: color,
      borderRadius: 1,
      boxShadow: `0 0 6px ${color}aa`,
      transform: "translateY(0.05em)",
    }}
  />
);

/* ─────────── height-measuring hook ─────────── */

const useMeasuredHeight = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);
  const [h, setH] = useState<number>(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setH(el.getBoundingClientRect().height));
    ro.observe(el);
    setH(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);
  return { ref, height: h };
};

/* ─────────── row ─────────── */

interface RowProps extends Common {
  row: Row;
  path: number[];
  isRoot?: boolean;
}

export const RowView = ({
  row, path, isRoot, cursor, onCursorChange, caretColor,
}: RowProps) => {
  const isActive = pathEq(path, cursor.path);
  const empty = row.length === 0;

  if (empty) {
    if (isRoot) {
      return (
        <span
          onPointerDown={(e) => stopAnd(e, () => onCursorChange({ path, index: 0 }))}
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            minWidth: "0.6em",
            minHeight: "1em",
          }}
        >
          {isActive && <Caret color={caretColor} />}
        </span>
      );
    }
    // Empty sub-rows render a visible dashed placeholder cube so the teacher
    // can see — and tap — exactly where the sensor lands. The cube acts as a
    // sensor magnet; once a character is typed the row is no longer empty and
    // the cube disappears naturally. When the slot is *active* the cube glows
    // to confirm focus.
    return (
      <span
        onPointerDown={(e) => stopAnd(e, () => onCursorChange({ path, index: 0 }))}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: "0.7em",
          minHeight: "0.85em",
          padding: "0 0.05em",
          border: `1px dashed ${caretColor}`,
          borderRadius: 3,
          background: isActive ? `${caretColor}1f` : "transparent",
          opacity: isActive ? 0.95 : 0.5,
          margin: "0 1px",
          boxShadow: isActive ? `0 0 5px ${caretColor}55` : "none",
          cursor: "text",
          verticalAlign: "baseline",
          touchAction: "manipulation",
          transition: "opacity 120ms, background 120ms, box-shadow 120ms",
        } as CSSProperties}
      >
        {isActive && <Caret color={caretColor} />}
      </span>
    );
  }

  // Once *any* node in this row carries content, empty `box` placeholder
  // siblings collapse to a zero-width tap zone (still focusable, but the
  // dashed cube disappears). This matches the classroom rule: as soon as
  // the teacher has filled the numerator, leftover template cubes around
  // it must vanish — the denominator's own empty cube is unaffected
  // because it lives in a different row.
  const isNodeFilled = (n: Node): boolean => {
    if (n.kind === "char") return true;
    const sub = (n as { rows?: Row[] }).rows;
    if (!sub) return true;
    return sub.some((r) => r.length > 0);
  };
  const rowHasContent = row.some((n) => isNodeFilled(n));

  return (
    <span style={{ display: "inline-flex", alignItems: "baseline" }}>
      {row.map((node, i) => {
        const isEmptyBoxSibling =
          node.kind === "box" &&
          rowHasContent &&
          !isNodeFilled(node);
        return (
          <span
            key={i}
            data-erase-path={JSON.stringify([...path, i])}
            style={{ display: "inline-flex", alignItems: "baseline" }}
          >
            {isActive && i === cursor.index && <Caret color={caretColor} />}
            {/* Inter-node tap gap — places cursor BEFORE this node so the
                sensor can land between every pair of items on the active
                line (e.g. between -b and ±). */}
            <span
              onPointerDown={(e) =>
                stopAnd(e, () => onCursorChange({ path, index: i }))
              }
              style={{
                display: "inline-block",
                width: "0.22em",
                alignSelf: "stretch",
                cursor: "text",
              }}
              aria-hidden
            />
            {isEmptyBoxSibling ? (
              // Collapsed invisible placeholder — keeps the path stable
              // but removes the visual dashed cube once the row is filled.
              <span
                onPointerDown={(e) =>
                  stopAnd(e, () => onCursorChange({ path, index: i }))
                }
                style={{ display: "inline-block", width: 0, height: "1em" }}
                aria-hidden
              />
            ) : (
              <NodeView
                node={node}
                parentPath={path}
                idxInRow={i}
                cursor={cursor}
                onCursorChange={onCursorChange}
                caretColor={caretColor}
              />
            )}
          </span>
        );
      })}
      {isActive && cursor.index === row.length && <Caret color={caretColor} />}
      {/* trailing tap area → place cursor at end of this row */}
      <span
        onPointerDown={(e) => stopAnd(e, () => onCursorChange({ path, index: row.length }))}
        style={{
          display: "inline-block",
          width: isRoot ? "1em" : "0.3em",
          minHeight: "1em",
          cursor: "text",
        }}
      />
    </span>
  );
};

/* ─────────── node ─────────── */

interface NodeProps extends Common {
  node: Node;
  parentPath: number[];
  idxInRow: number;
}

/** Tap zone on the right edge of every container → pops cursor *out* of it. */
const RightEscape = ({
  parentPath, idxInRow, onCursorChange,
}: { parentPath: number[]; idxInRow: number; onCursorChange: (c: Cursor) => void }) => (
  <span
    onPointerDown={(e) =>
      stopAnd(e, () => onCursorChange({ path: parentPath, index: idxInRow + 1 }))
    }
    style={{
      display: "inline-block",
      width: "0.35em",
      alignSelf: "stretch",
      cursor: "text",
    }}
    aria-hidden
  />
);

/* ─────────── container subcomponents (own their own hooks) ─────────── */

interface ContainerProps extends Common {
  node: Extract<Node, { rows: Row[] }>;
  parentPath: number[];
  idxInRow: number;
}

const SqrtView = ({
  node, parentPath, idxInRow, cursor, onCursorChange, caretColor,
}: ContainerProps & { node: Extract<Node, { kind: "sqrt" }> }) => {
  const hasIndex = node.rows.length === 2;
  const subPath = (i: number) => [...parentPath, idxInRow, i];
  // The outer flex stretches all children to the same cross-axis height so
  // the diagonal tick (svg) and the horizontal overline (body's border-top)
  // meet seamlessly at the top-right corner — and continue to meet as the
  // radicand grows in real time, identical to how the fraction bar already
  // expands. No measurement is needed: CSS stretch keeps them in sync.
  return (
    <span style={{
      display: "inline-flex", alignItems: "stretch",
      verticalAlign: "middle", margin: "0 0.12em", lineHeight: 1.05,
    }}>
      {hasIndex && (
        <span style={{
          fontSize: "0.55em",
          display: "inline-block",
          transform: "translateY(-0.55em)",
          marginRight: "-0.1em",
          marginLeft: "0.1em",
          minWidth: "0.7em",
          textAlign: "center",
          alignSelf: "flex-start",
        }}>
          <RowView row={node.rows[1] ?? []} path={subPath(1)}
            cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} />
        </span>
      )}
      <svg
        viewBox="0 0 16 100"
        preserveAspectRatio="none"
        style={{
          width: "0.55em", height: "auto", alignSelf: "stretch",
          overflow: "visible", marginLeft: "0.05em", marginRight: 0,
          display: "block",
        }}
        aria-hidden
      >
        {/* Diagonal tick only — its top-right (16,0) meets the body's
            border-top exactly. The overline is the body's border-top so it
            extends in real time as the radicand grows. */}
        <path
          d="M0 65 L4 65 L8 95 L16 0"
          stroke="currentColor" strokeWidth="2" fill="none"
          vectorEffect="non-scaling-stroke" strokeLinejoin="miter" strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          borderTop: "1.4px solid currentColor",
          padding: "2px 5px 0",
          marginLeft: "-1px",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <RowView row={node.rows[0] ?? []} path={subPath(0)}
          cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} />
      </span>
      <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
    </span>
  );
};

const BracketView = ({
  node, parentPath, idxInRow, cursor, onCursorChange, caretColor,
}: ContainerProps & { node: Extract<Node, { kind: "bracket" }> }) => {
  const { ref, height } = useMeasuredHeight<HTMLSpanElement>();
  const bodyH = height > 0 ? `${height}px` : "1em";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", verticalAlign: "middle",
      margin: "0 0.12em", lineHeight: 1.05,
    }}>
      <BracketGlyph kind={node.left} side="L" heightCss={bodyH} />
      <span ref={ref} style={{ padding: "0 3px", display: "inline-flex", alignItems: "center" }}>
        <RowView row={node.rows[0] ?? []} path={[...parentPath, idxInRow, 0]}
          cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} />
      </span>
      <BracketGlyph kind={node.right} side="R" heightCss={bodyH} />
      <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
    </span>
  );
};

const MatrixView = ({
  node, parentPath, idxInRow, cursor, onCursorChange, caretColor,
}: ContainerProps & { node: Extract<Node, { kind: "matrix" }> }) => {
  const { ref, height } = useMeasuredHeight<HTMLSpanElement>();
  const bodyH = height > 0 ? `${height}px` : "1em";
  const cells: JSX.Element[] = [];
  for (let r = 0; r < node.nRows; r++) {
    const rowCells: JSX.Element[] = [];
    for (let c = 0; c < node.nCols; c++) {
      const cellPath = [...parentPath, idxInRow, r * node.nCols + c];
      rowCells.push(
        <span key={c} style={{ padding: "3px 8px", display: "inline-flex", justifyContent: "center" }}>
          <RowView row={node.rows[r * node.nCols + c] ?? []} path={cellPath}
            cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} />
        </span>,
      );
    }
    cells.push(<span key={r} style={{ display: "flex", justifyContent: "space-around" }}>{rowCells}</span>);
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", verticalAlign: "middle",
      margin: "0 0.15em", lineHeight: 1.1,
    }}>
      {node.left && <BracketGlyph kind={node.left} side="L" heightCss={bodyH} />}
      <span ref={ref} style={{ display: "inline-flex", flexDirection: "column", justifyContent: "center" }}>
        {cells}
      </span>
      {node.right && <BracketGlyph kind={node.right} side="R" heightCss={bodyH} />}
      <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
    </span>
  );
};

const BinomView = ({
  node, parentPath, idxInRow, cursor, onCursorChange, caretColor,
}: ContainerProps & { node: Extract<Node, { kind: "binom" }> }) => {
  const { ref, height } = useMeasuredHeight<HTMLSpanElement>();
  const bodyH = height > 0 ? `${height}px` : "1em";
  const subPath = (i: number) => [...parentPath, idxInRow, i];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", verticalAlign: "middle",
      margin: "0 0.12em",
    }}>
      <BracketGlyph kind="(" side="L" heightCss={bodyH} />
      <span ref={ref} style={{
        display: "inline-flex", flexDirection: "column", alignItems: "center",
        padding: "0 4px", lineHeight: 1.1,
      }}>
        <RowView row={node.rows[0] ?? []} path={subPath(0)}
          cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} />
        <RowView row={node.rows[1] ?? []} path={subPath(1)}
          cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} />
      </span>
      <BracketGlyph kind=")" side="R" heightCss={bodyH} />
      <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
    </span>
  );
};

const NodeView = ({
  node, parentPath, idxInRow, cursor, onCursorChange, caretColor,
}: NodeProps) => {
  const subPath = (subIdx: number) => [...parentPath, idxInRow, subIdx];
  const R = (subIdx: number) => (
    <RowView
      row={(node as { rows?: Row[] }).rows?.[subIdx] ?? []}
      path={subPath(subIdx)}
      cursor={cursor}
      onCursorChange={onCursorChange}
      caretColor={caretColor}
    />
  );

  switch (node.kind) {
    case "char":
      return (
        <span
          onPointerDown={(e) => stopAnd(e, () => onCursorChange({ path: parentPath, index: idxInRow }))}
          style={{ whiteSpace: "pre", cursor: "text" }}
        >
          {node.ch}
        </span>
      );

    case "frac":
      return (
        <span style={{
          display: "inline-flex", alignItems: "center",
          verticalAlign: "middle", margin: "0 0.12em", lineHeight: 1.1,
          fontSize: "0.96em",
        }}>
          <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ padding: "0 4px 2px", whiteSpace: "nowrap" }}>{R(0)}</span>
            <span style={{ display: "block", width: "100%", height: 0, borderTop: "1.4px solid currentColor" }} />
            <span style={{ padding: "2px 4px 0", whiteSpace: "nowrap" }}>{R(1)}</span>
          </span>
          <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
        </span>
      );

    case "sqrt":
      return <SqrtView node={node} parentPath={parentPath} idxInRow={idxInRow}
        cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} />;

    case "power":
      return (
        <span style={{ display: "inline-flex", alignItems: "baseline" }}>
          {R(0)}
          <span style={{ fontSize: "0.65em", position: "relative", top: "-0.7em", marginLeft: 1 }}>
            {R(1)}
          </span>
          <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
        </span>
      );

    case "sup":
      return (
        <span style={{
          fontSize: "0.65em", position: "relative", top: "-0.7em",
          display: "inline-block", marginLeft: 1,
        }}>
          {R(0)}
        </span>
      );

    case "sub":
      return (
        <span style={{
          fontSize: "0.65em", position: "relative", top: "0.45em",
          display: "inline-block", marginLeft: 1,
        }}>
          {R(0)}
        </span>
      );

    case "subsup":
      return (
        <span style={{ display: "inline-flex", alignItems: "baseline" }}>
          {R(0)}
          <span style={{
            display: "inline-flex", flexDirection: "column", fontSize: "0.65em",
            marginLeft: 1, lineHeight: 1,
          }}>
            <span style={{ position: "relative", top: "-0.35em" }}>{R(2)}</span>
            <span style={{ position: "relative", top: "0.3em" }}>{R(1)}</span>
          </span>
          <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
        </span>
      );

    case "bracket":
      return <BracketView node={node} parentPath={parentPath} idxInRow={idxInRow}
        cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} />;

    case "bigop": {
      const glyph =
        node.op === "sum" ? "∑"
        : node.op === "prod" ? "∏"
        : node.op === "int" ? "∫"
        : node.op === "oint" ? "∮"
        : "lim";
      const isTextual = node.op === "lim";
      const boundStyle: CSSProperties = {
        display: "inline-flex", justifyContent: "center",
        minWidth: "1em", fontSize: "0.6em", padding: "0 2px", lineHeight: 1,
      };
      return (
        <span style={{
          display: "inline-flex", alignItems: "center", verticalAlign: "middle",
          margin: "0 0.15em",
        }}>
          <span style={{
            display: "inline-flex", flexDirection: "column", alignItems: "center",
            lineHeight: 1,
          }}>
            <span style={boundStyle}>{R(2)}</span>
            <span style={{
              fontSize: isTextual ? "1em" : "1.7em",
              lineHeight: 1,
              fontFamily: '"Cambria Math","STIX Two Math","Times New Roman",serif',
              padding: "0 2px",
            }}>{glyph}</span>
            <span style={boundStyle}>{R(1)}</span>
          </span>
          <span style={{ marginLeft: 5 }}>{R(0)}</span>
          <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
        </span>
      );
    }

    case "matrix":
      return <MatrixView node={node} parentPath={parentPath} idxInRow={idxInRow}
        cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} />;

    case "accent":
      return (
        <span style={{
          display: "inline-flex", flexDirection: "column", alignItems: "center",
          verticalAlign: "baseline", lineHeight: 1, margin: "0 0.05em",
        }}>
          <span style={{
            fontSize: "0.75em", height: "0.5em", marginBottom: "-0.15em", lineHeight: 1,
          }}>{node.symbol}</span>
          <span>{R(0)}</span>
        </span>
      );

    case "binom":
      return <BinomView node={node} parentPath={parentPath} idxInRow={idxInRow}
        cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} />;

    case "box": {
      // Single-cell input. When empty, render the dashed cube as a sensor
      // magnet so the teacher can see where to tap. Once any content is
      // typed inside, the dashed border vanishes — the cube only exists
      // while the slot is unfilled.
      const inner = (node as { rows?: Row[] }).rows?.[0] ?? [];
      const filled = inner.length > 0;
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "flex-start",
            verticalAlign: "top",
            border: filled ? "none" : "1px dashed currentColor",
            borderRadius: 4,
            padding: filled ? 0 : "0 0.18em",
            minWidth: filled ? 0 : "0.9em",
            minHeight: filled ? 0 : "1.05em",
            margin: filled ? 0 : "0 0.08em",
            lineHeight: 1,
            opacity: filled ? 1 : 0.85,
          }}
        >
          {R(0)}
          <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
        </span>
      );
    }

  }

};


/* ─────────── stretching brackets ─────────── */

const BracketGlyph = ({
  kind, side, heightCss,
}: { kind: string; side: "L" | "R"; heightCss: string }) => {
  let d = "";
  let width = "0.4em";
  if (kind === "(" || kind === ")") {
    d = side === "L" ? "M10 0 Q 2 50 10 100" : "M0 0 Q 8 50 0 100";
  } else if (kind === "[" || kind === "]") {
    d = side === "L" ? "M10 2 L 2 2 L 2 98 L 10 98" : "M0 2 L 8 2 L 8 98 L 0 98";
  } else if (kind === "{" || kind === "}") {
    d = side === "L"
      ? "M10 0 Q 4 0 4 25 Q 4 50 0 50 Q 4 50 4 75 Q 4 100 10 100"
      : "M0 0 Q 6 0 6 25 Q 6 50 10 50 Q 6 50 6 75 Q 6 100 0 100";
  } else if (kind === "|") {
    d = "M5 0 L 5 100"; width = "0.22em";
  } else if (kind === "‖") {
    d = "M3 0 L 3 100 M 8 0 L 8 100"; width = "0.32em";
  } else if (kind === "⌊") {
    d = "M2 0 L 2 98 L 10 98"; width = "0.38em";
  } else if (kind === "⌋") {
    d = "M8 0 L 8 98 L 0 98"; width = "0.38em";
  } else if (kind === "⌈") {
    d = "M2 100 L 2 2 L 10 2"; width = "0.38em";
  } else if (kind === "⌉") {
    d = "M0 2 L 8 2 L 8 100"; width = "0.38em";
  } else {
    return null;
  }
  return (
    <svg
      viewBox="0 0 12 100"
      preserveAspectRatio="none"
      style={{ width, height: heightCss, alignSelf: "center" }}
      aria-hidden
    >
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

/* ─────────── public root ─────────── */

interface Props extends Common {
  root: Row;
}

export const MathTreeRender = ({
  root, cursor, onCursorChange, caretColor,
}: Props) => (
  <RowView
    row={root}
    path={[]}
    isRoot
    cursor={cursor}
    onCursorChange={onCursorChange}
    caretColor={caretColor}
  />
);

export default MathTreeRender;
