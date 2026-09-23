import { Html } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { MathTreeRender } from "@/components/smartboard/MathTreeRender";
import type { GameMathLine } from "@/lib/slate/structuredMath";
import type { SurfaceDef } from "@/lib/slate/surfaces";
import type { TextBounds, TextSettings } from "@/lib/slate/text3d";
import { PX_PER_UNIT } from "@/lib/slate/layout";
import { resolveTextStyle } from "@/lib/slate/textPresets";

interface Props {
  math: GameMathLine;
  note?: string;
  width: number;
  surface: SurfaceDef;
  settings: TextSettings;
  onMeasure: (bounds: TextBounds) => void;
}

const INERT_CURSOR = { path: [-1], index: -1 };
const noop = () => {};

/** Physical Game presentation of the existing Floating Numbers tree. */
export function StructuredMathText({ math, note, width, surface, settings, onMeasure }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const style = resolveTextStyle(surface, settings);

  useEffect(() => {
    const element = host.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const measuredWidth = Math.min(width, rect.width / PX_PER_UNIT);
      const measuredHeight = rect.height / PX_PER_UNIT;
      onMeasure({ left: 0, right: measuredWidth, top: 0, bottom: -measuredHeight, width: measuredWidth, height: measuredHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [math, note, onMeasure, settings.size, width]);

  if (math.rows.length === 0 && !note) return null;

  return (
    <Html transform position={[0, 0, 0.025]} scale={40 / PX_PER_UNIT} zIndexRange={[4, 0]} pointerEvents="none" style={{ pointerEvents: "none" }}>
      <div
        ref={host}
        data-game-structured-math
        style={{
          width: Math.round(surfacePx),
          maxWidth: Math.round(surfacePx),
          overflow: "hidden",
          color: style.face,
          // The teacher's saved size for THIS device, never a fixed cap, and
          // never larger than the surface it has to sit inside.
          fontSize,
          lineHeight: settings.lineSpacing,
          letterSpacing: `${settings.letterSpacing}em`,
          textAlign: settings.align,
          textShadow: `0 1px 2px ${style.side}`,
          pointerEvents: "none",
        }}
      >
        {math.rows.map((entry) => (
          <div
            key={entry.sourceRow}
            style={{
              display: "flex",
              justifyContent: settings.align === "center" ? "center" : settings.align === "right" ? "flex-end" : "flex-start",
              alignItems: "baseline",
              minHeight: "1em",
              whiteSpace: "nowrap",
            }}
          >
            <MathTreeRender
              root={entry.row}
              cursor={entry.cursor ?? INERT_CURSOR}
              onCursorChange={noop}
              caretColor={style.face}
              placeholderColor={style.face}
            />
          </div>
        ))}
        {note ? <div style={{ marginTop: "0.35em", whiteSpace: "pre-wrap" }}>{note}</div> : null}
      </div>
    </Html>
  );
}
