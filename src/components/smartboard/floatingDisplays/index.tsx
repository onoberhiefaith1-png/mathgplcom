import type { CSSProperties, ReactNode } from "react";
import type { FloatingDisplayStyleId } from "@/lib/smartboard/floatingDisplayStyles";
import type { FloatingFrameProps } from "./types";
import { LineBadge, Tri, type BadgeShape } from "./primitives";

/** Where the up/down line controls live for a given design. */
type Placement = "column" | "sideSplit" | "fullWidth" | "pill" | "diamond" | "cube" | "accent";

interface Theme {
  placement: Placement;
  barBg: string;
  barBorder: string;
  barRadius: number;
  barShadow: string;
  arrowColor: string;
  outlineArrows?: boolean;
  navColor: string;
  badgeShape: BadgeShape;
  badgeBg?: string;
  badgeBorder?: string;
  badgeColor?: string;
  controlBg?: string;
  controlBorder?: string;
  backdrop?: string;
}

const INK = "#374151";

const THEMES: Record<FloatingDisplayStyleId, Theme> = {
  original: {
    placement: "column", barBg: "#ffffff", barBorder: "1px solid #d1d5db", barRadius: 10,
    barShadow: "0 1px 3px rgba(0,0,0,0.12)", arrowColor: INK, navColor: "currentColor", badgeShape: "plain",
  },
  "split-triangle": {
    placement: "sideSplit", barBg: "#ffffff", barBorder: "1px solid #cbd5e1", barRadius: 12,
    barShadow: "0 2px 8px rgba(0,0,0,0.14)", arrowColor: "#1f2937", navColor: "#2563eb",
    badgeShape: "pill", badgeBg: "#e0e7ff", badgeColor: "#1e3a8a", badgeBorder: "1px solid #93c5fd",
    controlBg: "#f8fafc", controlBorder: "1px solid #cbd5e1",
  },
  "full-width-bars": {
    placement: "fullWidth", barBg: "#ffffff", barBorder: "1px solid #cbd5e1", barRadius: 4,
    barShadow: "0 2px 10px rgba(0,0,0,0.16)", arrowColor: "#111827", navColor: "#ffffff",
    badgeShape: "square", badgeBg: "#111827", badgeColor: "#f9fafb",
    controlBg: "#2563eb", controlBorder: "0",
  },
  cube: {
    placement: "cube", barBg: "#f8fafc", barBorder: "1px solid #94a3b8", barRadius: 6,
    barShadow: "6px 6px 0 rgba(15,23,42,0.25)", arrowColor: "#0f172a", navColor: "#f8fafc",
    badgeShape: "face", badgeBg: "#334155", badgeColor: "#f8fafc",
    controlBg: "#475569", controlBorder: "0",
  },
  "rounded-vertical": {
    placement: "pill", barBg: "#ffffff", barBorder: "1px solid #d1d5db", barRadius: 999,
    barShadow: "0 2px 8px rgba(0,0,0,0.14)", arrowColor: "#0f172a", navColor: "#0f172a",
    badgeShape: "circle", badgeBg: "#fde68a", badgeColor: "#78350f", badgeBorder: "1px solid #f59e0b",
    controlBg: "#f1f5f9", controlBorder: "1px solid #cbd5e1",
  },
  "accent-bars": {
    placement: "accent", barBg: "#ffffff", barBorder: "1px solid #e2e8f0", barRadius: 8,
    barShadow: "0 2px 10px rgba(0,0,0,0.14)", arrowColor: "#111827", navColor: "#ffffff",
    badgeShape: "pill", badgeBg: "#059669", badgeColor: "#ecfdf5",
    controlBg: "#059669", controlBorder: "0",
  },
  "minimal-outline": {
    placement: "sideSplit", barBg: "transparent", barBorder: "2px solid currentColor", barRadius: 10,
    barShadow: "none", arrowColor: "currentColor", outlineArrows: true, navColor: "currentColor",
    badgeShape: "square", badgeBorder: "2px solid currentColor", badgeColor: "currentColor",
    controlBg: "transparent", controlBorder: "0",
  },
  diamond: {
    placement: "diamond", barBg: "#ffffff", barBorder: "1px solid #cbd5e1", barRadius: 10,
    barShadow: "0 2px 8px rgba(0,0,0,0.14)", arrowColor: "#111827", navColor: "#7c3aed",
    badgeShape: "diamond", badgeBg: "#ede9fe", badgeColor: "#4c1d95", badgeBorder: "1px solid #c4b5fd",
    controlBg: "transparent", controlBorder: "0",
  },
  glass: {
    placement: "sideSplit", barBg: "rgba(255,255,255,0.55)", barBorder: "1px solid rgba(255,255,255,0.7)",
    barRadius: 16, barShadow: "0 8px 30px rgba(15,23,42,0.25)", arrowColor: "#0f172a", navColor: "#0f172a",
    badgeShape: "pill", badgeBg: "rgba(255,255,255,0.6)", badgeColor: "#0f172a",
    badgeBorder: "1px solid rgba(255,255,255,0.8)",
    controlBg: "rgba(255,255,255,0.45)", controlBorder: "1px solid rgba(255,255,255,0.7)",
    backdrop: "blur(10px)",
  },
  neon: {
    placement: "fullWidth", barBg: "#0b1020", barBorder: "1px solid #22d3ee", barRadius: 10,
    barShadow: "0 0 18px rgba(34,211,238,0.45)", arrowColor: "#22d3ee", navColor: "#0b1020",
    badgeShape: "pill", badgeBg: "#22d3ee", badgeColor: "#04121b",
    controlBg: "#22d3ee", controlBorder: "0",
  },
};

/** Designs that repaint the strip dark need light chip ink. */
const DARK_STRIP: FloatingDisplayStyleId[] = ["neon"];

const Bar = ({ theme, frozen, frozenTitle, chips, left, right, style }: {
  theme: Theme; frozen: boolean; frozenTitle: string; chips: ReactNode;
  left: FloatingFrameProps["left"]; right: FloatingFrameProps["right"]; style?: CSSProperties;
}) => (
  <div
    className="flex items-center"
    title={frozenTitle}
    style={{
      gap: 6,
      padding: "2px 6px",
      borderRadius: theme.barRadius,
      background: theme.barBg,
      border: frozen ? "1px solid #f59e0b" : theme.barBorder,
      boxShadow: theme.barShadow,
      backdropFilter: theme.backdrop,
      WebkitBackdropFilter: theme.backdrop,
      opacity: frozen ? 0.5 : 1,
      filter: frozen ? "grayscale(0.4)" : "none",
      pointerEvents: frozen ? "none" : "auto",
      transition: "opacity 160ms ease, filter 160ms ease",
      ...style,
    }}
  >
    <Tri dir="left" spec={left} color={theme.arrowColor} outline={theme.outlineArrows} />
    {chips}
    <Tri dir="right" spec={right} color={theme.arrowColor} outline={theme.outlineArrows} />
  </div>
);

const navShell = (theme: Theme, extra?: CSSProperties): CSSProperties => ({
  background: theme.controlBg,
  border: theme.controlBorder,
  borderRadius: 10,
  backdropFilter: theme.backdrop,
  WebkitBackdropFilter: theme.backdrop,
  ...extra,
});

/**
 * The single presentation layer for the Floating Number Display.
 * Every design receives the SAME chips, handlers and line indicator — only the
 * arrangement changes. All five controls exist in every layout.
 */
export const FloatingDisplayFrame = ({
  style, chromeFg, frozen, frozenTitle, chips, extras, left, right, up, down, lineText, lineTitle,
}: FloatingFrameProps & { style: FloatingDisplayStyleId }) => {
  const theme = THEMES[style] ?? THEMES.original;
  const badgeColor = theme.badgeColor ?? chromeFg;
  const badge = (
    <LineBadge
      text={lineText}
      title={lineTitle}
      shape={theme.badgeShape}
      color={badgeColor}
      background={theme.badgeBg}
      border={theme.badgeBorder}
    />
  );
  const bar = (extraStyle?: CSSProperties) => (
    <Bar theme={theme} frozen={frozen} frozenTitle={frozenTitle} chips={chips} left={left} right={right} style={extraStyle} />
  );
  const chipsColor = DARK_STRIP.includes(style) ? "#e2f7ff" : undefined;
  const wrap = (node: ReactNode): ReactNode => (
    <div
      className="flex items-center select-none"
      style={{ color: chipsColor ?? chromeFg, fontSize: 22, gap: 8, fontFamily: "ui-serif, Georgia, serif" }}
    >
      {node}
    </div>
  );

  // ── Original — the classic column: ▲ · grip · line · ▼ · notebook, then bar.
  if (theme.placement === "column") {
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0, color: chromeFg }}>
          <Tri dir="up" spec={up} color={theme.arrowColor === INK ? chromeFg : theme.arrowColor} size={20} shell={{ minHeight: 44 }} />
          <div
            title="Floating numbers stay fixed at the bottom-left"
            style={{ width: 14, height: 28, borderRadius: 4, background: `color-mix(in oklab, ${chromeFg} 35%, transparent)` }}
          />
          {badge}
          <Tri dir="down" spec={down} color={theme.arrowColor === INK ? chromeFg : theme.arrowColor} size={20} shell={{ minHeight: 44 }} />
          {extras}
        </div>
        {wrap(bar())}
      </>
    );
  }

  // ── Split Triangle Vertical / Minimal Outline / Glass — ▲ badge ▼ beside bar.
  if (theme.placement === "sideSplit") {
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0, color: chromeFg }}>
          <Tri dir="up" spec={up} color={theme.navColor} outline={theme.outlineArrows} size={28} shell={navShell(theme, { width: 58 })} />
          {badge}
          <Tri dir="down" spec={down} color={theme.navColor} outline={theme.outlineArrows} size={28} shell={navShell(theme, { width: 58 })} />
        </div>
        {wrap(bar())}
        {extras}
      </>
    );
  }

  // ── Top & Bottom Full Width / Neon — filled bars above and below the strip.
  if (theme.placement === "fullWidth") {
    return (
      <>
        <div style={{ flexShrink: 0, color: chromeFg }}>{badge}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4, minWidth: 0 }}>
          <Tri dir="up" spec={up} color={theme.navColor} size={22} block shell={navShell(theme, { minHeight: 56, borderRadius: 6 })} />
          {wrap(bar())}
          <Tri dir="down" spec={down} color={theme.navColor} size={22} block shell={navShell(theme, { minHeight: 56, borderRadius: 6 })} />
        </div>
        {extras}
      </>
    );
  }

  // ── 3D Cube — raised faces: top = up, bottom = down, left face = the line.
  if (theme.placement === "cube") {
    return (
      <>
        <div style={{ display: "flex", alignItems: "stretch", gap: 0, flexShrink: 0, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", padding: "0 6px", background: theme.badgeBg, borderRadius: "8px 0 0 8px" }}>
            {badge}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 0, minWidth: 0 }}>
            <Tri dir="up" spec={up} color={theme.navColor} size={20} block shell={navShell(theme, { minHeight: 56, borderRadius: "0 8px 0 0" })} />
            {wrap(bar({ borderRadius: 0, boxShadow: "none" }))}
            <Tri dir="down" spec={down} color={theme.navColor} size={20} block shell={navShell(theme, { minHeight: 56, borderRadius: "0 0 8px 0" })} />
          </div>
        </div>
        {extras}
      </>
    );
  }

  // ── Rounded Vertical Control — one tall pill: ▲ · line circle · ▼.
  if (theme.placement === "pill") {
    return (
      <>
        <div
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0,
            padding: "6px 4px", borderRadius: 999, background: theme.controlBg, border: theme.controlBorder,
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          }}
        >
          <Tri dir="up" spec={up} color={theme.navColor} size={26} />
          {badge}
          <Tri dir="down" spec={down} color={theme.navColor} size={26} />
        </div>
        {wrap(bar())}
        {extras}
      </>
    );
  }

  // ── Top/Bottom Bars + Side Label — accent bars, line label as a side chip.
  if (theme.placement === "accent") {
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 3, minWidth: 0 }}>
          <Tri dir="up" spec={up} color={theme.navColor} size={20} block shell={navShell(theme, { minHeight: 56, borderRadius: "8px 8px 2px 2px" })} />
          {wrap(bar())}
          <Tri dir="down" spec={down} color={theme.navColor} size={20} block shell={navShell(theme, { minHeight: 56, borderRadius: "2px 2px 8px 8px" })} />
        </div>
        <div style={{ flexShrink: 0 }}>{badge}</div>
        {extras}
      </>
    );
  }

  // ── Diamond Indicator — big triangles around a diamond line badge.
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0, color: chromeFg }}>
        <Tri dir="up" spec={up} color={theme.navColor} size={30} />
        {badge}
        <Tri dir="down" spec={down} color={theme.navColor} size={30} />
      </div>
      {wrap(bar())}
      {extras}
    </>
  );
};

export default FloatingDisplayFrame;
