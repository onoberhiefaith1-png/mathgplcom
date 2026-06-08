// WritingSurface — provides the CSS variable + SVG filter context for the
// Smartboard "digital handwriting" engine. Wraps board content and applies
// the active writing profile, ink color, and surface-aware filter.

import { CSSProperties, ReactNode } from "react";
import { WritingProfile } from "@/lib/smartboard/writingProfiles";
import { BASE_FONT_PX } from "@/lib/smartboard/grid";

interface Props {
  profile: WritingProfile;
  inkColor: string;
  surface: "whiteboard" | "blackboard";
  /** Live writing zoom — multiplies the base font size for ALL board content. */
  zoom?: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Stable global SVG <defs> for chalk / marker edge filters. Mounted once. */
export const WritingFilterDefs = () => (
  <svg
    aria-hidden
    style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
  >
    <defs>
      <filter id="sb-chalk" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
        <feDisplacementMap in="SourceGraphic" scale="0.9" />
      </filter>
      <filter id="sb-marker" x="-2%" y="-2%" width="104%" height="104%">
        <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="7" />
        <feDisplacementMap in="SourceGraphic" scale="0.25" />
      </filter>
      <filter id="sb-chalk-strong" x="-6%" y="-6%" width="112%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="11" />
        <feDisplacementMap in="SourceGraphic" scale="1.6" />
        <feGaussianBlur stdDeviation="0.18" />
      </filter>
    </defs>
  </svg>
);

const pickFilter = (surface: "whiteboard" | "blackboard", edgeSoftness: number) => {
  if (surface === "blackboard") {
    return edgeSoftness > 0.4 ? "url(#sb-chalk-strong)" : "url(#sb-chalk)";
  }
  return edgeSoftness > 0.2 ? "url(#sb-marker)" : "none";
};

export const WritingSurface = ({
  profile, inkColor, surface, zoom = 1, children, className, style,
}: Props) => {
  const filter = pickFilter(surface, profile.edgeSoftness);
  const textShadow =
    surface === "whiteboard"
      ? "0 0.4px 0.4px rgba(0,0,0,0.06)"
      : `0 0 ${1 + profile.edgeSoftness * 2}px ${inkColor}33`;

  const fontSizePx = BASE_FONT_PX * zoom;

  const cssVars = {
    "--ink-font": profile.fontStack,
    "--ink-spacing": profile.letterSpacing,
    "--ink-line": String(profile.lineHeight),
    "--ink-weight": String(profile.weight),
    "--ink-opacity": String(profile.inkOpacity),
    "--ink-color": inkColor,
    "--ink-jitter": String(profile.strokeJitter),
    "--ink-reveal-ms": `${profile.revealSpeed}ms`,
  } as CSSProperties;

  return (
    <div
      className={className}
      style={{
        ...cssVars,
        ...style,
        fontFamily: "var(--ink-font)",
        letterSpacing: "var(--ink-spacing)",
        lineHeight: "var(--ink-line)",
        fontWeight: profile.weight as any,
        fontSize: `${fontSizePx}px`,
        color: inkColor,
        opacity: profile.inkOpacity,
        textShadow,
        filter,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {children}
    </div>
  );
};

export default WritingSurface;

