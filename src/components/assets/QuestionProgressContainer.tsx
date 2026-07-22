import { useEffect, useMemo, useState } from "react";

/**
 * Question Progress Container — Cyber-Charged Energy Pillar.
 * Replaces the previous painted crystal frame with a modern, high-contrast
 * energy pillar suitable for classroom game HUDs. Themes recolor the fill
 * gradient and glow while keeping the same slate vessel silhouette.
 */

export type CrystalTheme = "blue" | "green" | "purple" | "orange" | "gold";

interface ThemeTokens {
  from: string;   // deep base
  via: string;    // mid
  to: string;     // bright surface
  glow: string;   // rgba glow
  accent: string; // marker + label accent
}

const THEMES: Record<CrystalTheme, ThemeTokens> = {
  blue:   { from: "#1e3a8a", via: "#4f46e5", to: "#22d3ee", glow: "34,211,238",  accent: "#67e8f9" },
  green:  { from: "#065f46", via: "#10b981", to: "#a7f3d0", glow: "16,185,129",  accent: "#6ee7b7" },
  purple: { from: "#4c1d95", via: "#8b5cf6", to: "#e9d5ff", glow: "167,139,250", accent: "#c4b5fd" },
  orange: { from: "#7c2d12", via: "#f97316", to: "#fde68a", glow: "249,115,22",  accent: "#fdba74" },
  gold:   { from: "#78350f", via: "#f59e0b", to: "#fef3c7", glow: "245,158,11",  accent: "#fcd34d" },
};

interface Props {
  questionNumber: number | string;
  current: number;
  max: number;
  theme?: CrystalTheme;
  width?: number;
  hideProgressText?: boolean;
  className?: string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const QuestionProgressContainer = ({
  questionNumber,
  current,
  max,
  theme = "blue",
  width = 220,
  hideProgressText = false,
  className,
}: Props) => {
  const t = THEMES[theme];
  const pct = max > 0 ? clamp01(current / max) : 0;
  const pctText = Math.round(pct * 100);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 900);
    return () => clearInterval(id);
  }, []);

  // Height ~ 2.1x width for a tall pillar with header + footer chips.
  const height = Math.round(width * 2.1);
  const pillarH = Math.round(width * 1.55);
  const chipH = Math.round(width * 0.16);
  const labelH = Math.round(width * 0.18);

  const surfaceOn = pct > 0.01 && pct < 0.99;

  return (
    <div
      className={className}
      style={{
        width,
        height,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: Math.round(width * 0.04),
        fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
        userSelect: "none",
      }}
      role="img"
      aria-label={`Question ${questionNumber}, progress ${current} of ${max}`}
    >
      {/* Top label */}
      <div
        style={{
          height: labelH,
          textAlign: "center",
          lineHeight: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <span
          style={{
            color: t.accent,
            fontSize: width * 0.075,
            fontWeight: 800,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          Question
        </span>
        <span
          style={{
            color: "#ffffff",
            fontFamily: "'Kanit', 'Space Grotesk', sans-serif",
            fontWeight: 800,
            fontSize: width * 0.22,
            textShadow: `0 0 12px rgba(${t.glow},0.55)`,
          }}
        >
          {questionNumber}
        </span>
      </div>

      {/* Pillar vessel */}
      <div
        style={{
          position: "relative",
          width: Math.round(width * 0.62),
          height: pillarH,
          borderRadius: width * 0.11,
          background: "rgba(15,23,42,0.85)",
          border: "2px solid rgba(51,65,85,0.6)",
          boxShadow:
            "inset 0 0 22px rgba(0,0,0,0.85), 0 6px 24px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        {/* Grid pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.12,
            backgroundImage:
              "linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)",
            backgroundSize: `${Math.round(width * 0.09)}px ${Math.round(width * 0.09)}px`,
          }}
        />

        {/* Milestone marker lines (25/50/75) */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <div
            key={frac}
            style={{
              position: "absolute",
              left: 6,
              right: 6,
              bottom: `${frac * 100}%`,
              height: 1,
              background: pct >= frac ? `rgba(${t.glow},0.55)` : "rgba(255,255,255,0.12)",
              boxShadow: pct >= frac ? `0 0 6px rgba(${t.glow},0.7)` : undefined,
            }}
          />
        ))}

        {/* Fill */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: `${pct * 100}%`,
            background: `linear-gradient(to top, ${t.from}, ${t.via} 55%, ${t.to})`,
            boxShadow: `0 0 32px rgba(${t.glow},0.45)`,
            transition: "height 700ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          {/* Surface ripple */}
          {surfaceOn && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: "rgba(255,255,255,0.85)",
                filter: "blur(1px)",
                boxShadow: `0 0 14px rgba(${t.glow},0.9), 0 0 24px #fff`,
              }}
            />
          )}

          {/* Particles */}
          {pct > 0.05 && (
            <>
              {[0, 1, 2].map((i) => {
                const phase = (tick + i) % 3;
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: `${20 + i * 25}%`,
                      bottom: `${10 + phase * 25}%`,
                      width: 4 + i,
                      height: 4 + i,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.55)",
                      transition: "bottom 900ms linear, opacity 900ms linear",
                      opacity: 0.35 + (i * 0.15),
                    }}
                  />
                );
              })}
            </>
          )}
        </div>

        {/* Rim highlight */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: width * 0.11,
            pointerEvents: "none",
            boxShadow: `inset 0 0 0 1px rgba(${t.glow},0.35)`,
          }}
        />
      </div>

      {/* Bottom chip */}
      {!hideProgressText && (
        <div
          style={{
            height: chipH,
            padding: `0 ${Math.round(width * 0.06)}px`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: Math.round(width * 0.03),
            background: "rgba(30,41,59,0.9)",
            border: `1px solid rgba(${t.glow},0.35)`,
            borderRadius: 999,
            color: "#fff",
            fontWeight: 700,
            fontSize: width * 0.08,
            letterSpacing: "0.04em",
            boxShadow: `0 0 12px rgba(${t.glow},0.25)`,
          }}
        >
          <span style={{ color: t.accent, fontVariantNumeric: "tabular-nums" }}>
            {current}/{max}
          </span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{pctText}%</span>
        </div>
      )}
    </div>
  );
};

export default QuestionProgressContainer;
