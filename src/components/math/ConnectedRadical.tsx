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
        verticalAlign: "middle",
        margin: "0.12em 0.12em",
        lineHeight: 1.05,
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
        <svg
          viewBox={HOOK_VIEWBOX}
          preserveAspectRatio="none"
          style={{
            width: "0.5em",
            height: "100%",
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
          paddingLeft: "3px",
          paddingRight: "3px",
          display: "inline-flex",
          alignItems: "center",
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
