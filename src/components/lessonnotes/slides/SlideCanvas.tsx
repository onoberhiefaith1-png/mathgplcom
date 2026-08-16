// The Slide canvas — a clean blank page holding free elements (screenshots,
// images, videos). Elements are dragged to move and resized from the corner.
import { useCallback, useRef, useState } from "react";
import { Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { SlideMedia } from "./SlideMedia";
import type { SlideItem } from "@/lib/lessonnotes/slides";
import { cn } from "@/lib/utils";

interface Props {
  items: SlideItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<SlideItem>) => void;
  onDelete: (id: string) => void;
}

export function SlideCanvas({ items, selectedId, onSelect, onChange, onDelete }: Props) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const mode = useRef<"move" | "resize" | null>(null);
  const origin = useRef<{ px: number; py: number; item: SlideItem } | null>(null);
  const [live, setLive] = useState<Record<string, Partial<SlideItem>>>({});

  const rectOf = (item: SlideItem) => ({ ...item, ...(live[item.id] ?? {}) }) as SlideItem;

  const begin = useCallback(
    (e: React.PointerEvent, item: SlideItem, kind: "move" | "resize") => {
      e.stopPropagation();
      onSelect(item.id);
      const board = boardRef.current;
      if (!board) return;
      const b = board.getBoundingClientRect();
      mode.current = kind;
      origin.current = {
        px: (e.clientX - b.left) / b.width,
        py: (e.clientY - b.top) / b.height,
        item: rectOf(item),
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [onSelect, live], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const move = (e: React.PointerEvent) => {
    const board = boardRef.current;
    if (!mode.current || !origin.current || !board) return;
    const b = board.getBoundingClientRect();
    const px = (e.clientX - b.left) / b.width;
    const py = (e.clientY - b.top) / b.height;
    const { item } = origin.current;
    const dx = px - origin.current.px;
    const dy = py - origin.current.py;
    if (mode.current === "move") {
      setLive((s) => ({
        ...s,
        [item.id]: {
          x: Math.max(0, Math.min(1 - item.w, item.x + dx)),
          y: Math.max(0, Math.min(1 - item.h, item.y + dy)),
        },
      }));
    } else {
      setLive((s) => ({
        ...s,
        [item.id]: {
          w: Math.max(0.03, Math.min(1 - item.x, item.w + dx)),
          h: Math.max(0.03, Math.min(1 - item.y, item.h + dy)),
        },
      }));
    }
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
    <div
      ref={boardRef}
      className="relative h-full w-full overflow-hidden rounded-lg bg-white shadow-inner"
      onPointerMove={move}
      onPointerUp={end}
      onPointerDown={() => onSelect(null)}
    >
      {items.length === 0 && (
        <p className="absolute inset-0 grid place-items-center text-sm text-slate-400">
          Empty slide — import an image or video, or take a screenshot of the note.
        </p>
      )}
      {items.map((raw) => {
        const item = rectOf(raw);
        const active = selectedId === item.id;
        return (
          <div
            key={item.id}
            className={cn(
              "absolute",
              active ? "outline outline-2 outline-primary" : "outline-none",
            )}
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
            <SlideMedia item={item} muted />
            {active && (
              <>
                <div
                  className="absolute -bottom-1.5 -right-1.5 h-4 w-4 rounded-sm border-2 border-white bg-primary"
                  style={{ cursor: "nwse-resize", touchAction: "none" }}
                  onPointerDown={(e) => begin(e, raw, "resize")}
                />
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
  );
}
