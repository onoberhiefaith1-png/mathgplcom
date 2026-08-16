import type { JSX } from "react";
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
import { EMOJI_STYLE, isEmoji } from "@/lib/text/graphemes";
import type { Cursor, Node, Row } from "@/lib/smartboard/mathTree";
import { SLOT_GLYPH } from "@/lib/smartboard/mathTree";

import { ConnectedRadical } from "@/components/math/ConnectedRadical";
import { PLACEHOLDER_COLOR } from "@/lib/smartboard/placeholderColor";
import { SmartboardPlaceholderSlot } from "./SmartboardPlaceholderSlot";
import { composeNotation, normaliseFns } from "@/lib/lessonnotes/matrixFunctions";

interface Common {
  cursor: Cursor;
  onCursorChange: (c: Cursor) => void;
  caretColor: string;
  placeholderColor?: string;
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
  row, path, isRoot, cursor, onCursorChange, caretColor, placeholderColor,
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

    // Empty sub-slot. Structure ink stays on `currentColor`; placeholders are
    // the exception and always use the dedicated placeholder colour.
    const slotColor = placeholderColor ?? PLACEHOLDER_COLOR;
    return (
      <SmartboardPlaceholderSlot
        color={slotColor}
        active={isActive}
        caretColor={caretColor}
        source="math-tree"
        onPointerDown={(e) => stopAnd(e, () => onCursorChange({ path, index: 0 }))}
      />
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "baseline" }}>
      {row.map((node, i) => {
        return (
          <span
            key={i}
            data-erase-path={JSON.stringify([...path, i])}
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              position: "relative",
            }}
          >
            {isActive && i === cursor.index && <Caret color={caretColor} />}
            {/* Inter-node tap zone — places cursor BEFORE this node.
                Absolutely positioned so it does NOT consume horizontal
                space: chips render tight against each other. A visible
                gap only appears when a real space character is typed. */}
            <span
              onPointerDown={(e) =>
                stopAnd(e, () => onCursorChange({ path, index: i }))
              }
              style={{
                position: "absolute",
                left: "-0.15em",
                top: 0,
                bottom: 0,
                width: "0.3em",
                cursor: "text",
                zIndex: 1,
              }}
              aria-hidden
            />
            <NodeView
              node={node}
              parentPath={path}
              idxInRow={i}
              cursor={cursor}
              onCursorChange={onCursorChange}
              caretColor={caretColor}
              placeholderColor={placeholderColor}
            />
          </span>
        );
      })}
      {isActive && cursor.index === row.length && <Caret color={caretColor} />}
      {/* trailing tap area → place cursor at end of this row. Root keeps a
          visible 1em pad so tapping past the last chip lands the caret at
          end; sub-rows use a zero-layout overlay so nested containers do
          not inflate spacing. */}
      {isRoot ? (
        <span
          onPointerDown={(e) => stopAnd(e, () => onCursorChange({ path, index: row.length }))}
          style={{
            display: "inline-block",
            width: "1em",
            minHeight: "1em",
            cursor: "text",
          }}
        />
      ) : (
        <span
          onPointerDown={(e) => stopAnd(e, () => onCursorChange({ path, index: row.length }))}
          style={{
            display: "inline-block",
            width: 0,
            alignSelf: "stretch",
            position: "relative",
            cursor: "text",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: "-0.15em",
              right: "-0.15em",
              top: 0,
              bottom: 0,
            }}
          />
        </span>
      )}
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
  node, parentPath, idxInRow, cursor, onCursorChange, caretColor, placeholderColor,
}: ContainerProps & { node: Extract<Node, { kind: "sqrt" }> }) => {
  const hasIndex = node.rows.length === 2;
  const subPath = (i: number) => [...parentPath, idxInRow, i];
  // Both children of ConnectedRadical stretch to the same height, so the
  // hook's top-right tip and the overline's left edge always meet — and
  // both grow vertically when the radicand contains a fraction/nested
  // radical (identical to how the fraction bar already expands).
  return (
    <ConnectedRadical
      degree={hasIndex ? (
        <RowView row={node.rows[1] ?? []} path={subPath(1)}
          cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} placeholderColor={placeholderColor} />
      ) : undefined}
    >
      <RowView row={node.rows[0] ?? []} path={subPath(0)}
        cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} placeholderColor={placeholderColor} />
      <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
    </ConnectedRadical>
  );
};

const BracketView = ({
  node, parentPath, idxInRow, cursor, onCursorChange, caretColor, placeholderColor,
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
          cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} placeholderColor={placeholderColor} />
      </span>
      <BracketGlyph kind={node.right} side="R" heightCss={bodyH} />
      <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
    </span>
  );
};

const MatrixView = ({
  node, parentPath, idxInRow, cursor, onCursorChange, caretColor, placeholderColor,
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
            cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} placeholderColor={placeholderColor} />
        </span>,
      );
    }
    cells.push(<span key={r} style={{ display: "flex", justifyContent: "space-around" }}>{rowCells}</span>);
  }
  // Notation only — no calculation ever happens here.
  const nota = composeNotation(normaliseFns(node.fns));
  const powerIdx = node.nRows * node.nCols;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", verticalAlign: "middle",
      margin: "0.22em 0.15em", lineHeight: 1.1,
    }}>
      {nota.norm && <BracketGlyph kind="‖" side="L" heightCss={bodyH} />}
      {nota.prefix && <span style={{ paddingRight: 3 }}>{nota.prefix}</span>}
      {node.left && <BracketGlyph kind={node.left as any} side="L" heightCss={bodyH} />}
      <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "stretch" }}>
        {nota.overline && <span style={{ borderTop: "1.5px solid currentColor", height: 0 }} />}
        <span ref={ref} style={{ display: "inline-flex", flexDirection: "column", justifyContent: "center" }}>
          {cells}
        </span>
      </span>
      {node.right && <BracketGlyph kind={node.right as any} side="R" heightCss={bodyH} />}
      {(nota.sup || nota.power) && (
        <span style={{ display: "inline-flex", alignItems: "flex-start", alignSelf: "flex-start", fontSize: "0.6em" }}>
          {nota.sup}
          {nota.power && (
            <RowView row={node.rows[powerIdx] ?? []} path={[...parentPath, idxInRow, powerIdx]}
              cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} placeholderColor={placeholderColor} />
          )}
        </span>
      )}
      {nota.norm && <BracketGlyph kind="‖" side="R" heightCss={bodyH} />}
      <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
    </span>
  );
};

const BinomView = ({
  node, parentPath, idxInRow, cursor, onCursorChange, caretColor, placeholderColor,
}: ContainerProps & { node: Extract<Node, { kind: "binom" }> }) => {
  const { ref, height } = useMeasuredHeight<HTMLSpanElement>();
  const bodyH = height > 0 ? `${height}px` : "1em";
  const subPath = (i: number) => [...parentPath, idxInRow, i];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", verticalAlign: "middle",
      margin: "0.18em 0.12em",
    }}>
      <BracketGlyph kind="(" side="L" heightCss={bodyH} />
      <span ref={ref} style={{
        display: "inline-flex", flexDirection: "column", alignItems: "center",
        padding: "0 4px", lineHeight: 1.1,
      }}>
        <RowView row={node.rows[0] ?? []} path={subPath(0)}
          cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} placeholderColor={placeholderColor} />
        <RowView row={node.rows[1] ?? []} path={subPath(1)}
          cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} placeholderColor={placeholderColor} />
      </span>
      <BracketGlyph kind=")" side="R" heightCss={bodyH} />
      <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
    </span>
  );
};

const NodeView = ({
  node, parentPath, idxInRow, cursor, onCursorChange, caretColor, placeholderColor,
}: NodeProps) => {
  const subPath = (subIdx: number) => [...parentPath, idxInRow, subIdx];
  const R = (subIdx: number) => (
    <RowView
      row={(node as { rows?: Row[] }).rows?.[subIdx] ?? []}
      path={subPath(subIdx)}
      cursor={cursor}
      onCursorChange={onCursorChange}
      caretColor={caretColor}
      placeholderColor={placeholderColor}
    />
  );

  switch (node.kind) {
    case "char":
      // A literal `□` is NOT ink — it is an empty slot. Render it through the
      // one placeholder authority so it takes the placeholder colour (blends
      // with the board) and disappears the moment the teacher types.
      if (node.ch === SLOT_GLYPH) {
        return (
          <SmartboardPlaceholderSlot
            color={placeholderColor ?? PLACEHOLDER_COLOR}
            active={pathEq(parentPath, cursor.path) && cursor.index === idxInRow}
            caretColor={caretColor}
            source="slot-char"
            onPointerDown={(e) => stopAnd(e, () => onCursorChange({ path: parentPath, index: idxInRow }))}
          />
        );
      }
      // Emoji are IDENTITY tokens: they keep their native colour font and are
      // never repainted with the ink colour. Only the size (inherited) scales
      // with the teacher's text-size control.
      return (
        <span
          onPointerDown={(e) => stopAnd(e, () => onCursorChange({ path: parentPath, index: idxInRow }))}
          style={
            isEmoji(node.ch)
              ? { whiteSpace: "pre", cursor: "text", ...EMOJI_STYLE }
              : { whiteSpace: "pre", cursor: "text" }
          }
        >
          {node.ch}
        </span>
      );


    case "frac":
      return (
        <span style={{
          display: "inline-flex", alignItems: "center",
          verticalAlign: "middle", margin: "0.22em 0.12em", lineHeight: 1.1,
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
        cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} placeholderColor={placeholderColor} />;

    case "power":
      return (
        <span style={{ display: "inline-flex", alignItems: "baseline", lineHeight: 1 }}>
          {R(0)}
          <span style={{
            display: "inline-block",
            fontSize: "0.66em",
            lineHeight: 1,
            verticalAlign: "super",
            transform: "translateY(0.06em)",
            marginLeft: 1,
          }}>
            {R(1)}
          </span>
          <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
        </span>
      );

    case "sup":
      return (
        <span style={{
          display: "inline-block",
          fontSize: "0.66em",
          lineHeight: 1,
          verticalAlign: "super",
          transform: "translateY(0.06em)",
          marginLeft: 1,
        }}>
          {R(0)}
        </span>
      );

    case "sub":
      return (
        <span style={{
          display: "inline-block",
          fontSize: "0.66em",
          lineHeight: 1,
          verticalAlign: "sub",
          transform: "translateY(-0.04em)",
          marginLeft: 1,
        }}>
          {R(0)}
        </span>
      );

    case "subsup":
      {
        const subRow = node.rows[1] ?? [];
        const supRow = node.rows[2] ?? [];
        const subPath = [...parentPath, idxInRow, 1];
        const supPath = [...parentPath, idxInRow, 2];
        const showSub = subRow.length > 0 || pathEq(cursor.path, subPath);
        const showSup = supRow.length > 0 || pathEq(cursor.path, supPath);
        const singleSup = showSup && !showSub;
        const singleSub = showSub && !showSup;
        if (singleSup || singleSub) {
          return (
            <span style={{ display: "inline-flex", alignItems: "baseline", lineHeight: 1 }}>
              {R(0)}
              <span style={{
                display: "inline-block",
                fontSize: "0.66em",
                lineHeight: 1,
                verticalAlign: singleSup ? "super" : "sub",
                transform: singleSup ? "translateY(0.06em)" : "translateY(-0.04em)",
                marginLeft: 1,
              }}>
                {singleSup ? R(2) : R(1)}
              </span>
              <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
            </span>
          );
        }

        if (!showSub && !showSup) {
          return (
            <span style={{ display: "inline-flex", alignItems: "baseline", lineHeight: 1 }}>
              {R(0)}
              <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
            </span>
          );
        }

        return (
          <span style={{ display: "inline-flex", alignItems: "baseline" }}>
            {R(0)}
            <span style={{
              display: "inline-flex", flexDirection: "column", fontSize: "0.66em",
              marginLeft: 1, lineHeight: 0.95,
            }}>
              <span style={{ transform: "translateY(-0.08em)" }}>{R(2)}</span>
              <span style={{ transform: "translateY(0.06em)" }}>{R(1)}</span>
            </span>
            <RightEscape parentPath={parentPath} idxInRow={idxInRow} onCursorChange={onCursorChange} />
          </span>
        );
      }

    case "bracket":
      return <BracketView node={node} parentPath={parentPath} idxInRow={idxInRow}
        cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} placeholderColor={placeholderColor} />;

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
          margin: "0.18em 0.15em",
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
        cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} placeholderColor={placeholderColor} />;

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
        cursor={cursor} onCursorChange={onCursorChange} caretColor={caretColor} placeholderColor={placeholderColor} />;

    case "box": {
      // A box node is only a cursor target. Do not draw a second outer cube:
      // the editable child row already renders the single usable placeholder
      // when empty, and that child placeholder disappears as soon as typing
      // begins. This prevents the old “click first cube → another cube
      // appears inside it” double-placeholder behavior.
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            verticalAlign: "baseline",
            padding: 0,
            minWidth: 0,
            minHeight: 0,
            margin: 0,
            lineHeight: 1,
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
  /** Mirror mode: renders the SAME object with no caret and no interaction.
   *  Used by the Reasoning panel so the Student Line is a mini Smartboard
   *  rather than a second, re-parsed mathematical object. */
  readOnly?: boolean;
}

const INERT_CURSOR = { path: [-1], index: -1 };
const noop = () => {};

export const MathTreeRender = ({
  root, cursor, onCursorChange, caretColor, placeholderColor = PLACEHOLDER_COLOR,
  readOnly = false,
}: Props) => {
  const view = (
    <RowView
      row={root}
      path={[]}
      isRoot
      cursor={readOnly ? INERT_CURSOR : cursor}
      onCursorChange={readOnly ? noop : onCursorChange}
      caretColor={caretColor}
      placeholderColor={placeholderColor}
    />
  );
  return readOnly ? <span style={{ pointerEvents: "none" }}>{view}</span> : view;
};

export default MathTreeRender;

