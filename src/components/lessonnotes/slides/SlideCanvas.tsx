// The Slide page — one 16:9 page in the shared Canvas coordinate space.
// The whole page is scaled uniformly to fit its container, so
// imported media keeps its size and proportions: nothing is ever
// auto-fitted per object. Every object is selectable, draggable and resizable
// from eight handles.
import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, ArrowUp, ArrowDown, Copy, Maximize2, MoveHorizontal, RotateCcw, Minus, Plus } from "lucide-react";
import { SlideMedia } from "./SlideMedia";
import { SlideContentBlock } from "./SlideContentBlock";
import { SLIDE_PAGE, type SlideItem } from "@/lib/lessonnotes/slides";
import { cn } from "@/lib/utils";
import { clampSlideMove, clampVisualZoom, VISUAL_ZOOM_MAX, VISUAL_ZOOM_MIN, VISUAL_ZOOM_STEP } from "@/lib/visualTransform";

interface Props {
  items: SlideItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<SlideItem>) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLES: { key: Handle; style: React.CSSProperties; cursor: string }[] = [
  { key: "nw", style: { left: -6, top: -6 }, cursor: "nwse-resize" },
  { key: "n", style: { left: "50%", top: -6, marginLeft: -6 }, cursor: "ns-resize" },
  { key: "ne", style: { right: -6, top: -6 }, cursor: "nesw-resize" },
  { key: "e", style: { right: -6, top: "50%", marginTop: -6 }, cursor: "ew-resize" },
  { key: "se", style: { right: -6, bottom: -6 }, cursor: "nwse-resize" },
  { key: "s", style: { left: "50%", bottom: -6, marginLeft: -6 }, cursor: "ns-resize" },
  { key: "sw", style: { left: -6, bottom: -6 }, cursor: "nesw-resize" },
  { key: "w", style: { left: -6, top: "50%", marginTop: -6 }, cursor: "ew-resize" },
];

const MIN = 0.03;
const MAX_SIZE = 5;

export function SlideCanvas({ items, selectedId, onSelect, onChange, onDelete, onDuplicate }: Props) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const mode = useRef<{ kind: "move" | Handle; ratio: number; shift: boolean } | null>(null);
  const origin = useRef<{ px: number; py: number; item: SlideItem } | null>(null);
  const [live, setLive] = useState<Record<string, Partial<SlideItem>>>({});
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const fit = () => {
      const b = shell.getBoundingClientRect();
      if (!b.width || !b.height) return;
      setScale(Math.min(b.width / SLIDE_PAGE.w, b.height / SLIDE_PAGE.h));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(shell);
    return () => ro.disconnect();
  }, []);

  const rectOf = (item: SlideItem) => ({ ...item, ...(live[item.id] ?? {}) }) as SlideItem;

  const begin = useCallback(
    (e: React.PointerEvent, item: SlideItem, kind: "move" | Handle) => {
      e.stopPropagation();
      onSelect(item.id);
      const page = pageRef.current;
      if (!page) return;
      const b = page.getBoundingClientRect();
      const current = rectOf(item);
      mode.current = { kind, ratio: current.h ? current.w / current.h : 1, shift: e.shiftKey };
      origin.current = {
        px: (e.clientX - b.left) / b.width,
        py: (e.clientY - b.top) / b.height,
        item: current,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [onSelect, live], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const move = (e: React.PointerEvent) => {
    const page = pageRef.current;
    const m = mode.current;
    if (!m || !origin.current || !page) return;
    const b = page.getBoundingClientRect();
    const px = (e.clientX - b.left) / b.width;
    const py = (e.clientY - b.top) / b.height;
    const { item } = origin.current;
    const dx = px - origin.current.px;
    const dy = py - origin.current.py;

    if (m.kind === "move") {
      setLive((s) => ({
        ...s,
        [item.id]: {
          x: clampSlideMove(item.x + dx, item.w),
          y: clampSlideMove(item.y + dy, item.h),
        },
      }));
      return;
    }

    let { x, y, w, h } = item;
    const k = m.kind;
    if (k.includes("e")) w = Math.max(MIN, Math.min(MAX_SIZE, item.w + dx));
    if (k.includes("s")) h = Math.max(MIN, Math.min(MAX_SIZE, item.h + dy));
    if (k.includes("w")) {
      const right = item.x + item.w;
      x = Math.max(right - MAX_SIZE, Math.min(right - MIN, item.x + dx));
      w = right - x;
    }
    if (k.includes("n")) {
      const bottom = item.y + item.h;
      y = Math.max(bottom - MAX_SIZE, Math.min(bottom - MIN, item.y + dy));
      h = bottom - y;
    }
    // Corner drags keep the aspect ratio unless Shift is held.
    const corner = k.length === 2;
    if (corner && !e.shiftKey && m.ratio > 0) {
      const targetH = w / m.ratio;
      if (targetH <= MAX_SIZE) {
        if (k.includes("n")) y = y + h - targetH;
        h = targetH;
      }
    }
    setLive((s) => ({ ...s, [item.id]: { x, y, w, h } }));
  };

  const end = () => {
    const o = origin.current;
    if (o) {
      const patch = live[o.item.id];
      if (patch) onChange(o.item.id, patch);
    }
    mode.current = null;
    origin.current = null;
    setLive({});
  };

  const selectedItem = selectedId ? items.find((item) => item.id === selectedId) ?? null : null;
  const selectedRect = selectedItem ? rectOf(selectedItem) : null;
  const mediaSelected = !!selectedRect && selectedRect.kind !== "content";

  return (
    <div ref={shellRef} className="relative h-full w-full overflow-hidden">
      <div
        ref={pageRef}
        className="absolute left-1/2 top-0 overflow-hidden bg-white shadow"
        style={{
          width: SLIDE_PAGE.w,
          height: SLIDE_PAGE.h,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: "top center",
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerDown={() => onSelect(null)}
      >
        {selectedRect && (
          <div
            className="absolute left-1/2 top-3 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-md border bg-background/95 px-2 py-1 shadow-lg"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="px-1 text-[11px] font-medium text-muted-foreground">Step</span>
            <button type="button" title="Reveal earlier" className="rounded p-1 hover:bg-muted" onClick={() => onChange(selectedRect.id, { step: Math.max(1, selectedRect.step - 1) })}><ArrowUp className="h-3.5 w-3.5" /></button>
            <span className="w-4 text-center text-[11px] tabular-nums">{selectedRect.step}</span>
            <button type="button" title="Reveal later" className="rounded p-1 hover:bg-muted" onClick={() => onChange(selectedRect.id, { step: selectedRect.step + 1 })}><ArrowDown className="h-3.5 w-3.5" /></button>
            {mediaSelected && <span className="mx-1 h-4 w-px bg-border" />}
            {mediaSelected && (
              <>
                <button type="button" title="Zoom image out" disabled={selectedRect.zoom <= VISUAL_ZOOM_MIN} className="rounded p-1 hover:bg-muted disabled:opacity-40" onClick={() => onChange(selectedRect.id, { zoom: clampVisualZoom(selectedRect.zoom - VISUAL_ZOOM_STEP) })}><Minus className="h-3.5 w-3.5" /></button>
                <button type="button" title="Reset image zoom" className="min-w-12 rounded px-1 text-[11px] font-semibold tabular-nums hover:bg-muted" onClick={() => onChange(selectedRect.id, { zoom: 1 })}>{Math.round(clampVisualZoom(selectedRect.zoom) * 100)}%</button>
                <button type="button" title="Zoom image in" disabled={selectedRect.zoom >= VISUAL_ZOOM_MAX} className="rounded p-1 hover:bg-muted disabled:opacity-40" onClick={() => onChange(selectedRect.id, { zoom: clampVisualZoom(selectedRect.zoom + VISUAL_ZOOM_STEP) })}><Plus className="h-3.5 w-3.5" /></button>
              </>
            )}
            <span className="mx-1 h-4 w-px bg-border" />
            <button type="button" title="Fit width" className="rounded p-1 hover:bg-muted" onClick={() => onChange(selectedRect.id, { x: 0, w: 1 })}><MoveHorizontal className="h-3.5 w-3.5" /></button>
            <button type="button" title="Fill slide" className="rounded p-1 hover:bg-muted" onClick={() => onChange(selectedRect.id, { x: 0, y: 0, w: 1, h: 1, zoom: 1 })}><Maximize2 className="h-3.5 w-3.5" /></button>
            <button type="button" title="Reset size" className="rounded p-1 hover:bg-muted" onClick={() => onChange(selectedRect.id, { w: 0.5, h: 0.3, zoom: 1 })}><RotateCcw className="h-3.5 w-3.5" /></button>
            {onDuplicate && <button type="button" title="Duplicate element" className="rounded p-1 hover:bg-muted" onClick={() => onDuplicate(selectedRect.id)}><Copy className="h-3.5 w-3.5" /></button>}
            <button type="button" title="Delete element" className="rounded p-1 text-destructive hover:bg-destructive/10" onClick={() => onDelete(selectedRect.id)}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {items.length === 0 && (
          <p className="absolute inset-0 grid place-items-center px-10 text-center text-base text-slate-400">
            Blank slide — import an image or video to begin.
          </p>
        )}
        {items.map((raw) => {
          const item = rectOf(raw);
          const active = selectedId === item.id;
          return (
            <div
              key={item.id}
              className={cn("absolute", active ? "outline outline-2 outline-primary" : "outline-none")}
              style={{
                left: `${item.x * 100}%`,
                top: `${item.y * 100}%`,
                width: `${item.w * 100}%`,
                height: `${item.h * 100}%`,
                zIndex: item.z + 1,
                touchAction: "none",
                cursor: "move",
              }}
              onPointerDown={(e) => begin(e, raw, "move")}
            >
              {item.kind === "content" ? (
                <div className="h-full w-full overflow-hidden" onPointerDown={(e) => e.stopPropagation()}>
                  <SlideContentBlock
                    nodes={item.content_json}
                    editable
                    onChange={(nodes) => onChange(item.id, { content_json: nodes })}
                  />
                </div>
              ) : (
                <SlideMedia item={item} muted />
              )}
              {active && (
                <>
                  {HANDLES.map((hd) => (
                    <div
                      key={hd.key}
                      className="absolute h-3 w-3 rounded-sm border-2 border-white bg-primary"
                      style={{ ...hd.style, cursor: hd.cursor, touchAction: "none" }}
                      onPointerDown={(e) => begin(e, raw, hd.key)}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
