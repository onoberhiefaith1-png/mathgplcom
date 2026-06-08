// Word-style paper page wrapper. Renders a fixed-width paper sheet with
// margins and an optional paper background (ruled / math / grid / dotted).
// Content flows naturally inside; page splitting is automatic at print time.
// For on-screen, a single long sheet is acceptable (TipTap handles wrapping).

import { type ReactNode, type CSSProperties } from "react";
import { paperBackground, PAPER_SIZES, type PaperSize, type PaperStyle } from "@/lib/lessonnotes/paperThemes";

interface Props {
  size: PaperSize;
  style: PaperStyle;
  /** zoom factor, 1 = 100% */
  zoom?: number;
  children: ReactNode;
}

const MM_TO_PX = 96 / 25.4; // CSS px per mm
const MARGIN_MM = 25.4;     // 1 inch

export function PageFrame({ size, style, zoom = 1, children }: Props) {
  const { widthMm, heightMm } = PAPER_SIZES[size];
  const widthPx  = widthMm  * MM_TO_PX;
  const minHeightPx = heightMm * MM_TO_PX;
  const marginPx = MARGIN_MM * MM_TO_PX;

  const sheet: CSSProperties = {
    width: widthPx,
    minHeight: minHeightPx,
    margin: "24px auto",
    background: "hsl(0 0% 100%)",
    boxShadow: "0 4px 24px hsl(220 35% 18% / 0.12), 0 1px 2px hsl(220 35% 18% / 0.08)",
    border: "1px solid hsl(220 15% 88%)",
    borderRadius: 2,
    position: "relative",
    color: "hsl(220 35% 18%)",
  };

  const inner: CSSProperties = {
    paddingTop: marginPx,
    paddingBottom: marginPx,
    paddingLeft: marginPx,
    paddingRight: marginPx,
    minHeight: minHeightPx - 2,
    cursor: "text",
    display: "flex",
    flexDirection: "column",
    ...paperBackground(style),
    // Background should align with text rows: shift so first row sits at top of inner area.
    backgroundPosition: `0 ${marginPx}px`,
  };

  return (
    <div
      style={{
        // CSS zoom keeps layout math simple and matches the existing notebook zoom UX.
        zoom,
      } as CSSProperties}
    >
      <div style={sheet}>
        <div style={inner}>{children}</div>
      </div>
    </div>
  );
}
