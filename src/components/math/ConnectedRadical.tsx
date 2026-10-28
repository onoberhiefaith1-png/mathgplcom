// Shared connected + expandable radical primitive.
//
// One visual definition used by every renderer that draws a square root:
//   - Smartboard math-tree (MathTreeRender / SqrtView)
//   - Floating-number equation atoms (EquationAtoms)
//   - Lesson-note markup renderer (mathRender.ts)
//
// Geometry contract (do not break):
//   Outer inline-flex, `alignItems: "stretch"`.
//   Left child  = SVG hook. `preserveAspectRatio="none"`, height = 100% of the
//                 outer box. Path terminates exactly at the SVG's top-right
//                 corner (viewBox width, 0).
//   Right child = overline wrapper. `borderTop: currentColor`, top edge is
//                 flush with the SVG's top edge because both children stretch
//                 to the same height. The wrapper's `flex: 1` lets the
//                 radicand grow horizontally, and `alignItems: "stretch"`
//                 makes the whole radical grow vertically with the radicand
//                 (fraction / nested radical / etc.).
//
// Result: the hook tip and the overline meet pixel-perfect at every zoom
// level, and the shape is a single connected radical that expands with its
// content — no more literal `√` glyph, no more short/broken hook.

import type { CSSProperties, ReactNode } from "react";

/* SVG hook path — starts low on the left (short down-stroke), sweeps up to
 * the top-right corner at (16, 0). preserveAspectRatio="none" is what lets
 * it stretch vertically to any radicand height. */
const HOOK_VIEWBOX = "0 0 16 100";
const HOOK_PATH = "M0 65 L4 65 L8 95 L16 0";

export interface ConnectedRadicalProps {
  children: ReactNode; // radicand
  degree?: ReactNode; // optional index (nth root)
  /** Extra props forwarded to the outer wrapper (data-*, aria-*, onPointerDown, etc). */
  wrapperProps?: React.HTMLAttributes<HTMLSpanElement>;
  /** Optional inline styles merged onto the outer wrapper. */
  wrapperStyle?: CSSProperties;
  /** Optional inline styles merged onto the SVG (for chip selection state). */
  svgStyle?: CSSProperties;
  /** Optional inline styles merged onto the overline wrapper. */
  overlineStyle?: CSSProperties;
  /** onPointerDown/click on the SVG hook only (used by FLOATING atoms to
   *  select the whole radical when the teacher taps the hook). */
  onHookPointerDown?: React.PointerEventHandler<HTMLSpanElement>;
  onHookClick?: React.MouseEventHandler<HTMLSpanElement>;
  onHookMouseEnter?: React.MouseEventHandler<HTMLSpanElement>;
  onHookMouseLeave?: React.MouseEventHandler<HTMLSpanElement>;
  hookTitle?: string;
  hookDataAtomId?: string;
}

export const ConnectedRadical = ({
  children,
  degree,
  wrapperProps,
  wrapperStyle,
  svgStyle,
  overlineStyle,
  onHookPointerDown,
  onHookClick,
  onHookMouseEnter,
  onHookMouseLeave,
  hookTitle,
  hookDataAtomId,
}: ConnectedRadicalProps) => {
  return (
    <span
      {...wrapperProps}
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        // Align the radical to the sibling text baseline so that e.g.
        // "-b ± √(b²-4ac)" sit on ONE row. The flex container's baseline is
        // the SVG hook's bottom edge (= the box bottom), so the radicand —
        // anchored to the box bottom via `flex-end` on the overline wrapper
        // below — sits on the same row as the surrounding characters, and
        // any extra height (superscripts, fractions) grows UPWARD only.
        verticalAlign: "baseline",
        margin: "0 0.08em",
        // Constrain scale — the hook + overline shouldn't dominate a line
        // of characters; when the radicand contains a tall structure the
        // inline-flex `stretch` still lets both sides grow together.
        fontSize: "0.9em",
        lineHeight: 1,
        ...wrapperStyle,
      }}
    >
      {degree !== undefined && degree !== null && (
        <span
          aria-hidden={false}
          style={{
            fontSize: "0.55em",
            display: "inline-flex",
            alignItems: "flex-start",
            transform: "translateY(-0.35em)",
            marginRight: "-0.15em",
            marginLeft: "0.05em",
            minWidth: "0.7em",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {degree}
        </span>
      )}
      <span
        data-atom-id={hookDataAtomId}
        onPointerDown={onHookPointerDown}
        onClick={onHookClick}
        onMouseEnter={onHookMouseEnter}
        onMouseLeave={onHookMouseLeave}
        title={hookTitle}
        style={{
          display: "inline-flex",
          alignSelf: "stretch",
          alignItems: "stretch",
          flex: "0 0 auto",
          cursor: onHookClick ? "pointer" : undefined,
          ...svgStyle,
        }}
      >
        {/*
          The SVG's viewBox is 16×100 (tall & narrow). Without an explicit
          height, the browser derives an intrinsic height from the viewBox
          aspect ratio (~3.1em for 0.5em width), which propagates through
          the flex container and makes the whole radical ~3× taller than
          the row. Setting an explicit `height` attribute pins the SVG's
          intrinsic height to ~1em so a plain radicand (e.g. `b²-4ac`)
          renders at row height, while `alignSelf: stretch` on the outer
          wrapper still lets the SVG grow to match a tall radicand
          (fraction, nested radical, etc.).
        */}
        <svg
          viewBox={HOOK_VIEWBOX}
          preserveAspectRatio="none"
          width="0.5em"
          height="1em"
          style={{
            width: "0.5em",
            height: "100%",
            minHeight: "0.9em",
            display: "block",
            overflow: "visible",
          }}
          aria-hidden
        >
          <path
            d={HOOK_PATH}
            stroke="currentColor"
            strokeWidth={2}
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span
        style={{
          borderTop: "1.4px solid currentColor",
          paddingTop: "1px",
          paddingLeft: "2px",
          paddingRight: "2px",
          display: "inline-flex",
          // Anchor the radicand to the BOTTOM of the radical box. The box
          // bottom is the flex container's baseline (see wrapper comment),
          // so the radicand shares the sibling text row instead of being
          // vertically centered — which hoisted it upward whenever the
          // radicand was taller than one line (e.g. b² superscripts).
          alignItems: "flex-end",
          flex: "1 1 auto",
          minWidth: "0.5em",
          marginLeft: "-1px",
          ...overlineStyle,
        }}
      >
        {children}
      </span>
    </span>
  );
};

export default ConnectedRadical;
