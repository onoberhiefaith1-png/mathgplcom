// Floating Number Display — the catalogue of selectable presentation styles.
// Presentation ONLY: no style changes chip extraction, the conveyor, line
// navigation or any mathematical behaviour.

export type FloatingDisplayStyleId =
  | "original"
  | "split-triangle"
  | "full-width-bars"
  | "cube"
  | "rounded-vertical"
  | "accent-bars"
  | "minimal-outline"
  | "diamond"
  | "glass"
  | "neon";

export interface FloatingDisplayStyle {
  id: FloatingDisplayStyleId;
  name: string;
  description: string;
}

export const DEFAULT_FLOATING_STYLE: FloatingDisplayStyleId = "original";

export const FLOATING_DISPLAY_STYLES: FloatingDisplayStyle[] = [
  { id: "original", name: "Original", description: "The classic MathGPL strip — exactly as it has always worked." },
  { id: "split-triangle", name: "Split Triangle Vertical", description: "Up/down triangles split around the line badge beside the bar." },
  { id: "full-width-bars", name: "Top & Bottom Full Width", description: "Full-width up and down bars above and below the number rectangle." },
  { id: "cube", name: "3D Cube", description: "Raised cube — top and bottom faces navigate lines, side face shows the line." },
  { id: "rounded-vertical", name: "Rounded Vertical Control", description: "One tall rounded pill holding up, the line circle and down." },
  { id: "accent-bars", name: "Top/Bottom Bars + Side Label", description: "Coloured accent bars with the line label as a separate side chip." },
  { id: "minimal-outline", name: "Minimal Outline", description: "Clean outlined shell with large outline triangle controls." },
  { id: "diamond", name: "Diamond Indicator", description: "Diamond line indicator with big triangles above and below." },
  { id: "glass", name: "Glass", description: "Soft translucent glass controls that float over the board." },
  { id: "neon", name: "Neon Accent", description: "High-visibility dark bar with bright triangles for classroom distance." },
];

const IDS = new Set(FLOATING_DISPLAY_STYLES.map((s) => s.id));

/** An unknown or missing stored id always falls back to the original design. */
export const sanitizeFloatingStyle = (value: unknown): FloatingDisplayStyleId =>
  typeof value === "string" && IDS.has(value as FloatingDisplayStyleId)
    ? (value as FloatingDisplayStyleId)
    : DEFAULT_FLOATING_STYLE;

export const floatingStyleName = (id: FloatingDisplayStyleId): string =>
  FLOATING_DISPLAY_STYLES.find((s) => s.id === id)?.name ?? "Original";
