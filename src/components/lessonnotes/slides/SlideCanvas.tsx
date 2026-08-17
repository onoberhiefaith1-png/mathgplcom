// The Slide page — one page of a Canvas, in the lesson note's own pixel space
// (A4 @ 96dpi). The whole page is scaled uniformly to fit its container, so
// captured mathematics keeps its original size and proportions: nothing is ever
// auto-fitted per object. Every object is selectable, draggable and resizable
// from eight handles.
import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, ArrowUp, ArrowDown, Maximize2, MoveHorizontal, RotateCcw } from "lucide-react";
import { SlideMedia } from "./SlideMedia";
import { SlideContentBlock } from "./SlideContentBlock";
import { SLIDE_PAGE, type SlideItem } from "@/lib/lessonnotes/slides";
import { cn } from "@/lib/utils";

interface Props {
  items: SlideItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<SlideItem>) => void;
  onDelete: (id: string) => void;
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
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function SlideCanvas({ items, selectedId, onSelect, onChange, onDelete }: Props) {
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
          x: Math.max(0, Math.min(1 - item.w, item.x + dx)),
          y: Math.max(0, Math.min(1 - item.h, item.y + dy)),
        },
      }));
      return;
    }

    let { x, y, w, h } = item;
    const k = m.kind;
    if (k.includes("e")) w = Math.max(MIN, Math.min(1 - x, item.w + dx));
    if (k.includes("s")) h = Math.max(MIN, Math.min(1 - y, item.h + dy));
    if (k.includes("w")) {
      const right = item.x + item.w;
      x = clamp01(Math.min(right - MIN, item.x + dx));
      w = right - x;
    }
    if (k.includes("n")) {
      const bottom = item.y + item.h;
      y = clamp01(Math.min(bottom - MIN, item.y + dy));
      h = bottom - y;
    }
    // Corner drags keep the aspect ratio unless Shift is held.
    const corner = k.length === 2;
    if (corner && !e.shiftKey && m.ratio > 0) {
      const targetH = w / m.ratio;
      if (targetH + y <= 1) {
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

  return (
    <div ref={shellRef} className="relative h-full w-full overflow-hidden">
      <div
        ref={pageRef}
        className="absolute left-1/2 top-0 bg-white shadow"
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
        {items.length === 0 && (
          <p className="absolute inset-0 grid place-items-center px-10 text-center text-base text-slate-400">
            Blank slide — capture from the note, or import an image or video.
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
                <div onPointerDown={(e) => e.stopPropagation()}>
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
                  <div
                    className="absolute -top-9 left-0 flex items-center gap-1 rounded-full bg-white px-2 py-1 shadow"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <span className="px-1 text-[11px] font-medium text-slate-500">Step</span>
                    <button
                      type="button"
                      title="Reveal earlier"
                      className="rounded p-1 hover:bg-slate-100"
                      onClick={() => onChange(item.id, { step: Math.max(1, item.step - 1) })}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-4 text-center text-[11px] tabular-nums">{item.step}</span>
                    <button
                      type="button"
                      title="Reveal later"
                      className="rounded p-1 hover:bg-slate-100"
                      onClick={() => onChange(item.id, { step: item.step + 1 })}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <span className="mx-1 h-4 w-px bg-slate-200" />
                    <button
                      type="button"
                      title="Fit width"
                      className="rounded p-1 hover:bg-slate-100"
                      onClick={() => onChange(item.id, { x: 0, w: 1 })}
                    >
                      <MoveHorizontal className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Fill slide"
                      className="rounded p-1 hover:bg-slate-100"
                      onClick={() => onChange(item.id, { x: 0, y: 0, w: 1, h: 1 })}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Reset size"
                      className="rounded p-1 hover:bg-slate-100"
                      onClick={() => onChange(item.id, { w: 0.5, h: 0.3 })}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete element"
                      className="rounded p-1 text-destructive hover:bg-destructive/10"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
