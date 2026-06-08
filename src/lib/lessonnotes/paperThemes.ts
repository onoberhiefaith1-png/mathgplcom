// Visual-only paper styles for the Word-like Lesson Notes editor.
// Each theme is a CSS background applied to the page frame. The 32px row
// rhythm matches the editor's line-height so ruled lines align with text.

export type PaperStyle = "plain" | "ruled" | "math" | "grid" | "dotted";
export type PaperSize = "a4" | "letter" | "legal";

export const PAPER_SIZES: Record<PaperSize, { label: string; widthMm: number; heightMm: number }> = {
  a4:     { label: "A4",     widthMm: 210, heightMm: 297 },
  letter: { label: "Letter", widthMm: 216, heightMm: 279 },
  legal:  { label: "Legal",  widthMm: 216, heightMm: 356 },
};

export const PAPER_LABELS: Record<PaperStyle, string> = {
  plain:  "Plain white",
  ruled:  "Ruled notebook",
  math:   "Mathematics notebook",
  grid:   "Grid paper",
  dotted: "Dotted paper",
};

const RULE = "hsl(220 60% 60% / 0.35)";
const RULE_FAINT = "hsl(220 40% 55% / 0.18)";

/** Returns a style object for the inner writing area background.
 *  All rule pitches are 28px to match `.lesson-doc { line-height: 28px }`. */
export function paperBackground(style: PaperStyle): React.CSSProperties {
  switch (style) {
    case "ruled":
      return {
        backgroundImage: `linear-gradient(to bottom, transparent 27px, ${RULE} 27px, ${RULE} 28px, transparent 28px)`,
        backgroundSize: "100% 28px",
        backgroundPosition: "0 0",
      };
    case "math":
      // Triple-line system per 28px row: upper barrier (faint), baseline (strong), lower barrier (faint).
      return {
        backgroundImage: [
          `linear-gradient(to bottom, transparent 6px,  ${RULE_FAINT} 6px,  ${RULE_FAINT} 7px,  transparent 7px)`,
          `linear-gradient(to bottom, transparent 20px, ${RULE} 20px, ${RULE} 21px, transparent 21px)`,
          `linear-gradient(to bottom, transparent 27px, ${RULE_FAINT} 27px, ${RULE_FAINT} 28px, transparent 28px)`,
        ].join(", "),
        backgroundSize: "100% 28px",
      };
    case "grid":
      return {
        backgroundImage: `
          linear-gradient(to right, ${RULE_FAINT} 1px, transparent 1px),
          linear-gradient(to bottom, ${RULE_FAINT} 1px, transparent 1px)`,
        backgroundSize: "14px 14px",
      };
    case "dotted":
      return {
        backgroundImage: `radial-gradient(${RULE_FAINT} 1px, transparent 1px)`,
        backgroundSize: "14px 14px",
      };
    case "plain":
    default:
      return {};
  }
}
