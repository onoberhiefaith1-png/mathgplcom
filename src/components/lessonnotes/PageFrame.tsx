// Word-style paper page wrapper. Renders a fixed-width paper sheet with
// margins and an optional paper background (ruled / math / grid / dotted).
// Content flows naturally inside; page splitting is automatic at print time.
// For on-screen, a single long sheet is acceptable (TipTap handles wrapping).

import { type ReactNode, type CSSProperties, type Ref } from "react";
import { paperBackground, PAPER_SIZES, type PaperSize, type PaperStyle } from "@/lib/lessonnotes/paperThemes";
import { useFitToWidth } from "@/hooks/useFitToWidth";
import { useBreakpoint } from "@/hooks/useBreakpoint";


interface Props {
  size: PaperSize;
  style: PaperStyle;
  /** zoom factor, 1 = 100% */
  zoom?: number;
  /** Extra writing space added below the natural page height (mm). */
  extraMm?: number;
  /** Ref to the sheet element, used to measure content for Note Shrink. */
  sheetRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}

const MM_TO_PX = 96 / 25.4; // CSS px per mm
const MARGIN_MM = 25.4;     // 1 inch

export function PageFrame({ size, style, zoom = 1, extraMm = 0, sheetRef, children }: Props) {
  const { widthMm, heightMm } = PAPER_SIZES[size];
  const widthPx  = widthMm  * MM_TO_PX;
  const extraPx = Math.max(0, extraMm) * MM_TO_PX;
  const minHeightPx = heightMm * MM_TO_PX + extraPx;
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
    // Note Extend is NOT padding: the extra space belongs to the editable
    // interaction layer inside `children` (see the extend spacer in
    // DocumentEditor), so the drawable/clickable canvas grows by exactly the
    // same amount the sheet does.
    paddingBottom: marginPx,
    paddingLeft: marginPx,
    paddingRight: marginPx,
    minHeight: heightMm * MM_TO_PX - 2,


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
      <div ref={sheetRef} style={sheet}>
        <div style={inner}>{children}</div>
      </div>

    </div>
  );
}
