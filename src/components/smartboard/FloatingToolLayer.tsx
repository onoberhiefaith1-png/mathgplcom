// FloatingToolLayer — the shared shell for every Smartboard tool workspace
// (Geometry 2D/3D, Tables, Graph, Calculator, Conversion).
//
// It is a floating panel that sits ABOVE the board: draggable by its grip,
// resizable from its 8 boundary handles, collapsible, deletable. It never
// touches the board's writing surface — the board's own text/touch layer is
// untouched; this panel simply floats over it and blends with the board's
// palette so writing underneath stays readable.

import { useRef, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Check, Move, Pencil, Trash2, X } from "lucide-react";

export interface FloatingToolPalette {
  chromeBg: string;
  chromeFg: string;
  chromeBorder: string;
  hoverBg: string;
  dark: boolean;
}

interface Props {
  title: string;
  icon?: ReactNode;
  x: number;
  y: number;
  width: number;
  height: number;
  active?: boolean;
  collapsed?: boolean;
  /** Editing is teacher-only; students see a static layer. */
  editable: boolean;
  palette: FloatingToolPalette;
  /** Extra chrome buttons rendered before the standard controls. */
  actions?: ReactNode;
  minWidth?: number;
  minHeight?: number;
  /** Solid body — used by objects that need their own white paper (graphs). */
  solidBody?: boolean;
  /**
   * Transparent shell — the panel itself paints nothing, so the board (its
   * colour, handwriting and formulas) shows straight through. Used by the 2D
   * geometry layer, which is a drawing overlay, not a window.
   */
  transparentShell?: boolean;
  onGeometry: (patch: { x?: number; y?: number; width?: number; height?: number }) => void;
  onActivate?: () => void;
  onToggleCollapse?: () => void;
  onComplete?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
  children: ReactNode;
}

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const HANDLES: { h: Handle; style: React.CSSProperties }[] = [
  { h: "n", style: { top: -3, left: 12, right: 12, height: 6, cursor: "ns-resize" } },
  { h: "s", style: { bottom: -3, left: 12, right: 12, height: 6, cursor: "ns-resize" } },
  { h: "w", style: { left: -3, top: 12, bottom: 12, width: 6, cursor: "ew-resize" } },
  { h: "e", style: { right: -3, top: 12, bottom: 12, width: 6, cursor: "ew-resize" } },
  { h: "nw", style: { top: -4, left: -4, width: 10, height: 10, cursor: "nwse-resize" } },
  { h: "ne", style: { top: -4, right: -4, width: 10, height: 10, cursor: "nesw-resize" } },
  { h: "sw", style: { bottom: -4, left: -4, width: 10, height: 10, cursor: "nesw-resize" } },
  { h: "se", style: { bottom: -4, right: -4, width: 10, height: 10, cursor: "nwse-resize" } },
];

export const FloatingToolLayer = ({
  title, icon, x, y, width, height, active, collapsed, editable, palette, actions,
  minWidth = 260, minHeight = 160, solidBody, transparentShell,
  onGeometry, onActivate, onToggleCollapse, onComplete, onEdit, onDelete, onClose,
  children,
}: Props) => {
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const resize = useRef<{
    h: Handle; px: number; py: number; x: number; y: number; w: number; ht: number;
  } | null>(null);

  const startDrag = (e: React.PointerEvent) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    drag.current = { px: e.clientX, py: e.clientY, x, y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onActivate?.();
  };
  const moveDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    onGeometry({
      x: Math.max(0, d.x + (e.clientX - d.px)),
      y: Math.max(0, d.y + (e.clientY - d.py)),
    });
  };
  const endDrag = () => { drag.current = null; };

  const startResize = (e: React.PointerEvent, h: Handle) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    resize.current = { h, px: e.clientX, py: e.clientY, x, y, w: width, ht: height };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onActivate?.();
  };
  const moveResize = (e: React.PointerEvent) => {
    const r = resize.current;
    if (!r) return;
    const dx = e.clientX - r.px;
    const dy = e.clientY - r.py;
    let nx = r.x, ny = r.y, nw = r.w, nh = r.ht;
    if (r.h.includes("e")) nw = Math.max(minWidth, r.w + dx);
    if (r.h.includes("s")) nh = Math.max(minHeight, r.ht + dy);
    if (r.h.includes("w")) {
      nw = Math.max(minWidth, r.w - dx);
      nx = Math.max(0, r.x + (r.w - nw));
    }
    if (r.h.includes("n")) {
      nh = Math.max(minHeight, r.ht - dy);
      ny = Math.max(0, r.y + (r.ht - nh));
    }
    onGeometry({ x: nx, y: ny, width: nw, height: nh });
  };
  const endResize = () => { resize.current = null; };

  const btn = "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-black/10";

  return (
    <div
      className={`absolute rounded-xl border ${transparentShell ? "" : "shadow-lg backdrop-blur-[2px]"}`}
      data-sb-chrome
      style={{
        left: x,
        top: y,
        width,
        height: collapsed ? undefined : height,
        pointerEvents: "auto",
        background: transparentShell
          ? "transparent"
          : palette.dark ? "rgba(20,24,22,0.72)" : "rgba(255,255,255,0.78)",
        color: palette.chromeFg,
        borderColor: active ? "rgba(16,185,129,0.9)" : palette.chromeBorder,
        overflow: "visible",
      }}
      onPointerDown={(e) => { e.stopPropagation(); onActivate?.(); }}
    >
      {/* Chrome */}
      <div
        className="flex items-center gap-1 rounded-t-xl border-b px-1.5 py-1"
        style={{ background: palette.chromeBg, borderColor: palette.chromeBorder }}
      >
        {editable && (
          <button
            type="button"
            title={`Move ${title}`}
            aria-label={`Move ${title}`}
            className={btn}
            style={{ cursor: "grab", touchAction: "none" }}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <Move className="h-3 w-3" />
          </button>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] font-medium opacity-80">
          {icon} {title}
        </span>
        <span className="flex-1" />
        {actions}
        {onToggleCollapse && (
          <button
            type="button"
            className={btn}
            title={collapsed ? "Expand" : "Collapse"}
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
          >
            {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
        )}
        {editable && onComplete && (
          <button
            type="button"
            className={btn}
            title="Complete — keep this on the board"
            onClick={(e) => { e.stopPropagation(); onComplete(); }}
          >
            <Check className="h-3 w-3" /> Complete
          </button>
        )}
        {editable && onEdit && (
          <button
            type="button"
            className={btn}
            title={`Edit ${title}`}
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
        {editable && onDelete && (
          <button
            type="button"
            className={`${btn} hover:text-red-500`}
            title={`Delete ${title}`}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
        {onClose && (
          <button
            type="button"
            className={btn}
            title="Close"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Body — a themed surface. Marking it `dark` on a dark board flips every
          design token inside, so the reused Lesson Note tools stay readable in
          both palettes without touching their own markup. */}
      {!collapsed && (
        <div
          className={`relative h-[calc(100%-28px)] w-full overflow-auto rounded-b-xl ${palette.dark ? "dark" : ""} ${solidBody ? "bg-background text-foreground" : ""}`}
          style={transparentShell ? { background: "transparent" } : undefined}
        >
          {children}
        </div>
      )}


      {/* Resize handles — 8 boundaries */}
      {editable && !collapsed && HANDLES.map(({ h, style }) => (
        <div
          key={h}
          role="presentation"
          className="absolute"
          style={{ ...style, touchAction: "none", zIndex: 3 }}
          onPointerDown={(e) => startResize(e, h)}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
        />
      ))}
    </div>
  );
};

export default FloatingToolLayer;
