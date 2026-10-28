// SmartBoard theme presets with derived auto-contrast.

export type ThemeId = "graphite" | "midnight" | "chalkboard" | "white" | "cream";

export interface Theme {
  id: ThemeId;
  label: string;
  bg: string;
  accent: string;
  glow: number;
  /** Approx luminance hint, 0..1 — used to flip text dark/light automatically. */
  bgLuminance: number;
}

export const THEMES: Record<ThemeId, Theme> = {
  graphite:   { id: "graphite",   label: "Graphite",   bg: "hsl(220 18% 8%)",  accent: "hsl(195 90% 70%)", glow: 1.0, bgLuminance: 0.08 },
  midnight:   { id: "midnight",   label: "Midnight",   bg: "hsl(230 35% 6%)",  accent: "hsl(260 90% 75%)", glow: 1.0, bgLuminance: 0.06 },
  chalkboard: { id: "chalkboard", label: "Chalkboard", bg: "hsl(155 22% 14%)", accent: "hsl(45 90% 75%)",  glow: 0.8, bgLuminance: 0.14 },
  white:      { id: "white",      label: "Whiteboard", bg: "hsl(0 0% 98%)",    accent: "hsl(220 80% 40%)", glow: 0.5, bgLuminance: 0.98 },
  cream:      { id: "cream",      label: "Cream",      bg: "hsl(38 38% 92%)",  accent: "hsl(20 70% 38%)",  glow: 0.6, bgLuminance: 0.90 },
};

/** Derive readable foreground / muted automatically from background luminance. */
const derive = (t: Theme) => {
  const dark = t.bgLuminance < 0.5;
  return {
    fg:    dark ? "hsl(0 0% 96%)"     : "hsl(220 25% 12%)",
    muted: dark ? "hsl(220 10% 60%)"  : "hsl(220 10% 40%)",
  };
};

export const themeStyle = (t: Theme, equationSize: number, glow: number): React.CSSProperties => {
  const { fg, muted } = derive(t);
  return {
    // @ts-expect-error CSS vars
    "--sb-bg": t.bg,
    "--sb-fg": fg,
    "--sb-muted": muted,
    "--sb-accent": t.accent,
    "--sb-yellow": "hsl(46 96% 60%)",
    "--sb-blue": "hsl(200 95% 62%)",
    "--sb-red": "hsl(0 85% 62%)",
    "--sb-eq-size": `${equationSize}px`,
    "--sb-glow": String(glow * t.glow),
  };
};
