// BoardDiagramLayer — renders the Smartboard's diagrams (2D geometry and
// 3D/TVD) as draggable page content. Rendering is delegated to the existing
// engines: GeometryDiagram for 2D scenes, Scene3DCanvas for 3D scenes.

import { useRef, useState } from "react";
import { Boxes, Pencil, Trash2, Move } from "lucide-react";
import { GeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import { Scene3DCanvas } from "@/components/lessonnotes/geometry3d/Scene3DCanvas";
import type { BoardDiagram } from "@/lib/smartboard/boardDiagrams";

interface Props {
  diagrams: BoardDiagram[];
  /** Move / resize commit — one entry in the shared board history. */
  onChange: (next: BoardDiagram[]) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  activeId: string | null;
  onActivate: (id: string) => void;
  editable: boolean;
}

export const BoardDiagramLayer = ({
  diagrams, onChange, onEdit, onDelete, activeId, onActivate, editable,
}: Props) => {
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const startDrag = (e: React.PointerEvent, d: BoardDiagram) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    const host = (e.currentTarget as HTMLElement).closest("[data-sb-diagram-layer]") as HTMLElement | null;
    const rect = host?.getBoundingClientRect();
    dragRef.current = {
      id: d.id,
      dx: e.clientX - (rect?.left ?? 0) - d.x,
      dy: e.clientY - (rect?.top ?? 0) - d.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onActivate(d.id);
  };

  const onMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const host = (e.currentTarget as HTMLElement).closest("[data-sb-diagram-layer]") as HTMLElement | null;
    const rect = host?.getBoundingClientRect();
    const x = Math.max(0, e.clientX - (rect?.left ?? 0) - drag.dx);
    const y = Math.max(0, e.clientY - (rect?.top ?? 0) - drag.dy);
    onChange(diagrams.map((d) => (d.id === drag.id ? { ...d, x, y } : d)));
  };

  const endDrag = () => { dragRef.current = null; };

  if (diagrams.length === 0) return null;

  return (
    <div
      data-sb-diagram-layer=""
      className="absolute inset-0"
      style={{ pointerEvents: "none", zIndex: 26 }}
    >
      {diagrams.map((d) => (
        <div
          key={d.id}
          data-sb-chrome
          className="absolute rounded-lg border shadow-sm"
          style={{
            left: d.x,
            top: d.y,
            width: d.width,
            height: d.height,
            pointerEvents: "auto",
            background: "#ffffff",
            borderColor: activeId === d.id ? "rgba(16,185,129,0.9)" : "rgba(0,0,0,0.15)",
            overflow: "hidden",
          }}
          onPointerDown={(e) => { e.stopPropagation(); onActivate(d.id); }}
        >
          <DiagramBody diagram={d} />

          {editable && (
            <div
              className="absolute right-1 top-1 flex items-center gap-0.5 rounded-md border border-black/10 bg-white/95 px-1 py-0.5 shadow"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                title="Move diagram"
                aria-label="Move diagram"
                className="inline-flex items-center rounded px-1 py-0.5 text-[11px] text-black/70 hover:bg-black/5"
                style={{ cursor: "grab", touchAction: "none" }}
                onPointerDown={(e) => startDrag(e, d)}
                onPointerMove={onMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <Move className="h-3 w-3" />
              </button>
              <button
                type="button"
                title={d.kind === "3d" ? "Edit in 3D / TVD workspace" : "Edit diagram"}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-black/70 hover:bg-black/5"
                onClick={(e) => { e.stopPropagation(); onEdit(d.id); }}
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              <button
                type="button"
                title="Delete diagram"
                className="inline-flex items-center rounded px-1 py-0.5 text-[11px] text-black/60 hover:bg-black/5 hover:text-red-600"
                onClick={(e) => { e.stopPropagation(); onDelete(d.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

function DiagramBody({ diagram }: { diagram: BoardDiagram }) {
  const [live3d, setLive3d] = useState(false);

  if (diagram.kind === "2d") {
    return (
      <div className="grid h-full w-full place-items-center p-2">
        <GeometryDiagram
          scene={diagram.scene}
          explicitWidth={diagram.width - 16}
          explicitHeight={diagram.height - 16}
        />
      </div>
    );
  }

  if (live3d) {
    return <Scene3DCanvas scene={diagram.scene} frameloop="always" className="h-full w-full" />;
  }

  return (
    <button
      type="button"
      onClick={() => setLive3d(true)}
      className="flex h-full w-full flex-col items-center justify-center gap-2 text-black/60 transition hover:text-black"
      aria-label="Activate 3D scene"
    >
      <Boxes className="h-7 w-7" />
      <span className="text-xs font-medium">
        {diagram.scene.objects.length} object{diagram.scene.objects.length === 1 ? "" : "s"} · tap to explore in 3D
      </span>
    </button>
  );
}

export default BoardDiagramLayer;
