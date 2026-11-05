import { useRef, type RefObject } from "react";
import type { GameTextLabel } from "@/lib/slate/textLabels";
import { textLabelPlacement, textLabelStyle } from "@/lib/slate/textLabels";
import { X } from "lucide-react";

export type LabelEditing = {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
};

/** Labels painted on the game frame. In the editor they can be dragged. */
export function GameTextLabels({
  labels,
  fontFamily,
  editing,
}: {
  labels: GameTextLabel[];
  fontFamily?: string;
  editing?: LabelEditing | null;
}) {
  const frame = useRef<HTMLDivElement>(null);
  if (labels.length === 0) return null;
  return (
    <div ref={frame} className="pointer-events-none absolute inset-0 z-20" data-game-labels>
      {labels.map((label) => (
        <LabelChip
          key={label.id}
          label={label}
          fontFamily={fontFamily}
          frame={frame}
          editing={editing ?? null}
        />
      ))}
    </div>
  );
}

function LabelChip({
  label,
  fontFamily,
  frame,
  editing,
}: {
  label: GameTextLabel;
  fontFamily?: string;
  frame: RefObject<HTMLDivElement | null>;
  editing: LabelEditing | null;
}) {
  const drag = useRef<{ pointer: number; dx: number; dy: number } | null>(null);
  const selected = editing?.selectedId === label.id;
  const place = textLabelPlacement(label);
  const look = textLabelStyle(label);

  const point = (clientX: number, clientY: number) => {
    const bounds = frame.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0 || !drag.current) return null;
    return {
      x: ((clientX - bounds.left - drag.current.dx) / bounds.width) * 100,
      y: ((clientY - bounds.top - drag.current.dy) / bounds.height) * 100,
    };
  };

  return (
    <div
      data-game-label={label.id}
      className={`absolute max-w-[80%] -translate-x-1/2 -translate-y-1/2 whitespace-pre-wrap break-words text-left ${editing ? "pointer-events-auto touch-none" : ""}`}
      style={{
        left: place.left,
        top: place.top,
        fontFamily,
        ...look,
        outline: selected ? "2px solid #8d6a43" : undefined,
        outlineOffset: 4,
        borderRadius: 2,
      }}
      onPointerDown={(event) => {
        if (!editing) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const bounds = frame.current?.getBoundingClientRect();
        if (!bounds) return;
        drag.current = {
          pointer: event.pointerId,
          dx: event.clientX - bounds.left - (label.x / 100) * bounds.width,
          dy: event.clientY - bounds.top - (label.y / 100) * bounds.height,
        };
        editing.onSelect(label.id);
      }}
      onPointerMove={(event) => {
        if (!editing || !drag.current || drag.current.pointer !== event.pointerId) return;
        const next = point(event.clientX, event.clientY);
        if (next) editing.onMove(label.id, next.x, next.y);
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
    >
      {label.text || "Text"}
      {selected && editing ? (
        <button
          type="button"
          aria-label={`Delete text ${label.text || ""}`.trim()}
          className="absolute -right-3 -top-3 grid h-11 w-11 place-items-center rounded-full bg-destructive text-destructive-foreground shadow"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            editing.onRemove(label.id);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
