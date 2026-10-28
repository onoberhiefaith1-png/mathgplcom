import type { CSSProperties } from "react";
import type { NavSpec } from "./types";

export type TriDir = "up" | "down" | "left" | "right";

const POINTS: Record<TriDir, string> = {
  up: "50,14 88,80 12,80",
  down: "50,86 12,20 88,20",
  left: "14,50 80,12 80,88",
  right: "86,50 20,12 20,88",
};

export interface TriProps {
  dir: TriDir;
  spec: NavSpec;
  /** Fill colour of the triangle. */
  color: string;
  /** Outline-only rendering (Minimal Outline design). */
  outline?: boolean;
  /** Glyph size in px. The touch target is always at least 56x56. */
  size?: number;
  /** Optional shell around the triangle. */
  shell?: CSSProperties;
  /** Stretch the touch target to fill its container. */
  block?: boolean;
}

/** A real, filled triangular navigation button with a Smartboard-sized touch
 *  target. Never a small "<" glyph. */
export const Tri = ({ dir, spec, color, outline, size = 26, shell, block }: TriProps) => (
  <button
    onClick={(e) => { e.stopPropagation(); if (spec.enabled) spec.onTap(); }}
    disabled={!spec.enabled}
    title={spec.label}
    aria-label={spec.label}
    style={{
      background: "transparent",
      border: 0,
      padding: 0,
      minWidth: block ? undefined : 56,
      minHeight: 56,
      width: block ? "100%" : undefined,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: spec.enabled ? 1 : 0.28,
      cursor: spec.enabled ? "pointer" : "default",
      touchAction: "manipulation",
      transition: "opacity 160ms ease, transform 120ms ease",
      ...shell,
    }}
  >
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <polygon
        points={POINTS[dir]}
        fill={outline ? "none" : color}
        stroke={color}
        strokeWidth={outline ? 10 : 6}
        strokeLinejoin="round"
      />
    </svg>
  </button>
);

export type BadgeShape = "plain" | "circle" | "pill" | "square" | "diamond" | "face";

export interface LineBadgeProps {
  text: string | null;
  title?: string;
  shape: BadgeShape;
  color: string;
  background?: string;
  border?: string;
}

/** The L1 / L2 / T7 line indicator. Always legible from classroom distance. */
export const LineBadge = ({ text, title, shape, color, background, border }: LineBadgeProps) => {
  if (text == null) return null;
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
    fontFamily: "ui-sans-serif, system-ui",
    color,
    background,
    border,
    whiteSpace: "nowrap",
  };
  const shapes: Record<BadgeShape, CSSProperties> = {
    plain: { padding: "2px 6px" },
    circle: { width: 34, height: 34, borderRadius: 999 },
    pill: { minWidth: 40, height: 28, borderRadius: 999, padding: "0 10px" },
    square: { width: 32, height: 32, borderRadius: 8 },
    diamond: { width: 34, height: 34, borderRadius: 6, transform: "rotate(45deg)" },
    face: { minWidth: 34, height: 40, borderRadius: 4, padding: "0 6px" },
  };
  const inner = shape === "diamond"
    ? <span style={{ transform: "rotate(-45deg)", display: "inline-block" }}>{text}</span>
    : text;
  return <div title={title} style={{ ...base, ...shapes[shape] }}>{inner}</div>;
};
