// StructurePanel — no background, lives inside the board surface and
// scrolls with the active example. Vertical-only drag, clamped to the
// space below the last written line. Per-beat position memory.
// Shows only the structures tagged to the CURRENT floating-number line,
// with its own ▲/▼ line navigator mirroring FloatingNumberPanel.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { ContainerKind } from "@/lib/smartboard/floatingPlan";
import { SmartboardPlaceholderSlot } from "./SmartboardPlaceholderSlot";

const STRUCTURE_GLYPH: Record<ContainerKind, string> = {
  fraction: "□/□",
  radical: "√□",
  bracket: "( )",
  power: "□²",
  log: "log",
  integral: "∫",
  matrix: "[ ]",
  differential: "d/dx",
  abs: "|□|",
  vector: "→",
  box: "□",
};

interface Props {
  chromeFg: string;
  placeholderColor: string;
  visible: boolean;
  /** Structures tagged to the CURRENT line only. Empty = nothing to insert. */
  requiredStructures?: ContainerKind[];
  consumedStructures?: Set<ContainerKind>;
  onStructureInsert?: (kind: ContainerKind) => void;
  /** Distance from the container's right edge (board pixels). */
  rightPx: number;
  defaultYPx: number;
  topYPx: number;
  bottomYPx: number;
  finalLineBottomPx: number;
  rememberedY: number | null;
  onCommitY: (y: number) => void;
  onPing: () => void;
  beatId?: string;
  /** Same nav as FloatingNumberPanel — keeps the two panels in sync. */
  lineNumber?: number;
  lineCount?: number;
  onPrevLine?: () => void;
  onNextLine?: () => void;
}

export const StructurePanel = ({
  chromeFg, placeholderColor, visible,
  requiredStructures, consumedStructures, onStructureInsert,
  rightPx, defaultYPx, topYPx, bottomYPx, finalLineBottomPx,
  rememberedY, onCommitY, onPing, beatId,
  lineNumber, lineCount, onPrevLine, onNextLine,
}: Props) => {
  const [y, setY] = useState<number>(rememberedY ?? defaultYPx);
  const dragRef = useRef<{ dy: number } | null>(null);

  useEffect(() => { setY(rememberedY ?? defaultYPx); }, [beatId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-anchor to the (viewport-aware) default whenever the panel is freshly
  // shown and the user hasn't dragged it for this beat. Guarantees that tapping
  // the structure (F) icon drops the panel inside the visible writing area —
  // not buried below the last written line / off the bottom of the screen.
  const wasVisibleRef = useRef(false);
  useEffect(() => {
    if (visible && !wasVisibleRef.current && rememberedY == null) {
      setY(defaultYPx);
    }
    wasVisibleRef.current = visible;
  }, [visible, rememberedY, defaultYPx]);

  // Clamp inside the full visible band. We intentionally do NOT force the panel
  // below the last written line — the structures float (transparent) and must
  // stay reachable on-screen even while you're writing the current line.
  useEffect(() => {
    setY((prev) => Math.min(bottomYPx, Math.max(topYPx, prev)));
  }, [topYPx, bottomYPx, finalLineBottomPx]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { dy: e.clientY - y };
    onPing();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const next = e.clientY - dragRef.current.dy;
    setY(Math.min(bottomYPx, Math.max(topYPx, next)));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) onCommitY(y);
    dragRef.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  if (!visible) return null;
  const items = requiredStructures ?? [];

  const slot = (key: string) => (
    <SmartboardPlaceholderSlot
      key={key}
      color={placeholderColor}
      size="compact"
      source="structure-panel"
    />
  );

  const renderGlyph = (kind: ContainerKind) => {
    const text = STRUCTURE_GLYPH[kind] ?? kind;
    if (!text.includes("□")) return text;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
        {text.split("□").flatMap((part, index, parts) => {
          const nodes: ReactNode[] = [];
          if (part) nodes.push(<span key={`t-${index}`}>{part}</span>);
          if (index < parts.length - 1) nodes.push(slot(`s-${index}`));
          return nodes;
        })}
      </span>
    );
  };

  return (
    <div
      data-sb-chrome
      onPointerDown={(e) => { e.stopPropagation(); onPing(); }}
      style={{
        position: "absolute",
        right: rightPx,
        top: y,
        transform: "translate(0, -50%)",
        zIndex: 25,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
      }}
    >
      <div
        className="flex items-center select-none"
        style={{ color: chromeFg, fontSize: 22, gap: 10, fontFamily: "ui-serif, Georgia, serif" }}
      >
        {items.length === 0 ? null : items.map((kind) => {
          const used = !!consumedStructures?.has(kind);
          return (
            <button
              key={`sp-${kind}`}
              onClick={(e) => { e.stopPropagation(); onStructureInsert?.(kind); onPing(); }}
              className="transition-transform hover:scale-110 active:scale-95"
              style={{
                background: "transparent",
                border: 0,
                color: chromeFg,
                padding: 0,
                opacity: used ? 0.45 : 1,
                cursor: "pointer",
              }}
              title={kind}
            >
              {renderGlyph(kind)}
            </button>
          );
        })}
      </div>
      {/* Trailing column: ▲ / drag grip / line badge / ▼ */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          flexShrink: 0,
          color: chromeFg,
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); if (lineNumber && lineNumber > 1) { onPrevLine?.(); onPing(); } }}
          disabled={!lineNumber || lineNumber <= 1}
          title="Previous line"
          aria-label="Previous line"
          style={{
            background: "transparent", border: 0, color: chromeFg,
            padding: 0, opacity: lineNumber && lineNumber > 1 ? 1 : 0.25,
            cursor: lineNumber && lineNumber > 1 ? "pointer" : "default",
            display: "inline-flex", alignItems: "center",
          }}
        >
          <ChevronUp size={16} />
        </button>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          title="Drag vertically"
          style={{
            width: 14, height: 28, borderRadius: 4,
            background: `color-mix(in oklab, ${chromeFg} 35%, transparent)`,
            cursor: "grab", touchAction: "none",
          }}
        />
        {lineNumber != null && lineCount != null && lineCount > 0 && (
          <div
            style={{
              minWidth: 18,
              padding: "0 4px",
              fontSize: 11,
              lineHeight: 1.4,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              textAlign: "center",
              opacity: 0.8,
            }}
            title={`Line ${lineNumber} of ${lineCount}`}
          >
            {lineNumber}
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); if (lineNumber && lineCount && lineNumber < lineCount) { onNextLine?.(); onPing(); } }}
          disabled={!lineNumber || !lineCount || lineNumber >= lineCount}
          title="Next line"
          aria-label="Next line"
          style={{
            background: "transparent", border: 0, color: chromeFg,
            padding: 0,
            opacity: lineNumber && lineCount && lineNumber < lineCount ? 1 : 0.25,
            cursor: lineNumber && lineCount && lineNumber < lineCount ? "pointer" : "default",
            display: "inline-flex", alignItems: "center",
          }}
        >
          <ChevronDown size={16} />
        </button>
      </div>
    </div>
  );
};

export default StructurePanel;
