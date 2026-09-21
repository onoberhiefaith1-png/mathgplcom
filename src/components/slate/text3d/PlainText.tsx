import { Html } from "@react-three/drei";
import type { SurfaceDef } from "@/lib/slate/surfaces";
import type { TextSettings } from "@/lib/slate/text3d";
import { PX_PER_UNIT } from "@/lib/slate/layout";
import { resolveTextStyle } from "@/lib/slate/textPresets";

interface Props {
  text: string;
  width: number;
  surface: SurfaceDef;
  settings: TextSettings;
}

/**
 * READABILITY GUARANTEE.
 *
 * The 3D renderers can suspend while a font is fetched. A writing surface must
 * never stand empty while it holds mathematics, so this plain layer shows the
 * same text with no font loading, no geometry and no suspense of its own.
 */
export function PlainText({ text, width, surface, settings }: Props) {
  if (!text) return null;
  const style = resolveTextStyle(surface, settings);
  return (
    <Html
      transform
      position={[0, 0, 0.02]}
      scale={40 / PX_PER_UNIT}
      zIndexRange={[3, 0]}
      pointerEvents="none"
      style={{ pointerEvents: "none" }}
    >
      <div
        style={{
          width: Math.round(width * PX_PER_UNIT),
          color: style.face,
          fontSize: Math.min(72, settings.size),
          lineHeight: settings.lineSpacing,
          letterSpacing: `${settings.letterSpacing}em`,
          textAlign: settings.align,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          textShadow: `0 1px 2px ${style.side}`,
        }}
      >
        {text}
      </div>
    </Html>
  );
}
