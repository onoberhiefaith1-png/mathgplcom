import { Html } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { MathTreeRender } from "@/components/smartboard/MathTreeRender";
import type { GameMathLine } from "@/lib/slate/structuredMath";
import type { SurfaceDef } from "@/lib/slate/surfaces";
import type { TextBounds, TextSettings } from "@/lib/slate/text3d";
import { PX_PER_UNIT } from "@/lib/slate/layout";
import { cssTextEffects, resolveTextStyle } from "@/lib/slate/textPresets";

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
  const fontSize = Math.max(1, settings.size);
  const textShadow = cssTextEffects(style, fontSize);

  useEffect(() => {
    const element = host.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const measuredWidth = Math.min(width, rect.width / PX_PER_UNIT);
      const measuredHeight = rect.height / PX_PER_UNIT;
      // WritingRegion places every renderer at an alignment origin. Report the
      // DOM body relative to that same origin, rather than always claiming it
      // begins at zero (which made centred/right equations look out of bounds).
      const left = settings.align === "left"
        ? 0
        : settings.align === "right"
          ? -measuredWidth
          : -measuredWidth / 2;
      onMeasure({
        left,
        right: left + measuredWidth,
        top: 0,
        bottom: -measuredHeight,
        width: measuredWidth,
        height: measuredHeight,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [math, note, onMeasure, settings.align, settings.size, settings.lineSpacing, settings.letterSpacing, settings.shadow, settings.shadowStrength, settings.glow, settings.glowIntensity, settings.depth, settings.bevel, settings.preset, settings.colour, settings.baseColour, settings.depthColour, width]);

  if (math.rows.length === 0 && !note) return null;

  const surfacePx = Math.max(24, width * PX_PER_UNIT);

  return (
    <Html
      transform
      position={[0, 0, 0.025]}
      scale={40 / PX_PER_UNIT}
      zIndexRange={[4, 0]}
      pointerEvents="none"
      style={{ pointerEvents: "none" }}
    >
      <div
        ref={host}
        data-game-structured-math
        style={{
          width: Math.round(surfacePx),
          maxWidth: Math.round(surfacePx),
          overflow: "visible",
          // Html's transform wrapper centres its child on the 3D origin.
          // WritingRegion's origin is the surface's top-left, so cancel that
          // centring in CSS: right by half-width, down by half-height.
          transform: "translate(50%, 50%)",
          transformOrigin: "center",
          color: style.face,
          fontSize,
          lineHeight: settings.lineSpacing,
          letterSpacing: `${settings.letterSpacing}em`,
          textAlign: settings.align,
          opacity: Math.max(0, Math.min(1, settings.opacity)),
          textShadow: textShadow || undefined,
          pointerEvents: "none",
        }}
      >
        {math.rows.map((entry) => (
          <div
            key={entry.sourceRow}
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: settings.align === "center" ? "center" : settings.align === "right" ? "flex-end" : "flex-start",
              alignItems: "baseline",
              minHeight: "1em",
              whiteSpace: "normal",
              overflowWrap: "anywhere",
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
