import type { ReactNode } from "react";
import { SLIDE_PAGE, type SlideItem } from "@/lib/lessonnotes/slides";

interface Props {
  items: SlideItem[];
  renderItem: (item: SlideItem) => ReactNode;
  className?: string;
  onPointerDown?: () => void;
  style?: React.CSSProperties;
}

/** One geometry contract for editor, Preview, embedded lessons and Smartboard. */
export function SlideStage({ items, renderItem, className = "", onPointerDown, style }: Props) {
  return (
    <div
      data-canvas-stage="true"
      className={`relative aspect-video w-full overflow-hidden bg-white ${className}`}
      style={{ width: SLIDE_PAGE.w, height: SLIDE_PAGE.h, maxWidth: "none", ...style }}
      onPointerDown={onPointerDown}
    >
      {items.map((item) => {
        // A picture the teacher enlarged to reach every edge is drawn as
        // exactly covering the frame, so no screen can reintroduce gaps.
        const cover = item.kind !== "content" && coversFrame(item);
        return (
          <div
            key={item.id}
            className="absolute overflow-visible"
            style={cover
              ? { left: 0, top: 0, width: "100%", height: "100%", zIndex: item.z + 1 }
              : {
                  left: `${item.x * 100}%`,
                  top: `${item.y * 100}%`,
                  width: `${item.w * 100}%`,
                  height: `${item.h * 100}%`,
                  zIndex: item.z + 1,
                }}
          >
            {cover ? renderItem({ ...item, zoom: 1, cover: true } as SlideItem) : renderItem(item)}
          </div>
        );
      })}
    </div>
  );
}
/** True when the zoomed picture reaches (within 0.5%) all four frame edges. */
export function coversFrame(item: SlideItem): boolean {
  const z = Number(item.zoom) || 1;
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
  const hw = (item.w * z) / 2, hh = (item.h * z) / 2;
  const t = 0.005;
  return cx - hw <= t && cy - hh <= t && cx + hw >= 1 - t && cy + hh >= 1 - t;
}
