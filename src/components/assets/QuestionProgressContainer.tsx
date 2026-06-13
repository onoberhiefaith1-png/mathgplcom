import { useEffect, useMemo, useState } from "react";

/**
 * Question Progress Container — a reusable, fantasy crystal-and-stone vessel
 * whose magical liquid level reflects the ratio `current / max`.
 *
 * The liquid is rendered as an SVG <rect> whose height is the calculated
 * percentage of the chamber. A subtle animated wave keeps the surface alive,
 * while a CSS transition smoothly animates rises and falls. The fill is
 * continuous (never stepped, never blocky) and supports any maximum value.
 */

export type CrystalTheme = "blue" | "green" | "purple" | "orange" | "gold";

interface ThemeTokens {
  /** Saturated crystal/liquid hue */
  primary: string;
  /** Brighter top-glow tint */
  light: string;
  /** Deeper liquid base */
  deep: string;
  /** Outer aura glow */
  glow: string;
  /** Counter label text colour for emphasis */
  counter: string;
}

const THEMES: Record<CrystalTheme, ThemeTokens> = {
  blue:   { primary: "#3fb6ff", light: "#a8e8ff", deep: "#1565b8", glow: "#3fb6ff", counter: "#f5f5f5" },
  green:  { primary: "#43e36b", light: "#b6ffc6", deep: "#1a7a32", glow: "#43e36b", counter: "#f5f5f5" },
  purple: { primary: "#a460ff", light: "#dcc1ff", deep: "#5a1bb2", glow: "#a460ff", counter: "#ffd866" },
  orange: { primary: "#ff8a1f", light: "#ffd28a", deep: "#a8460a", glow: "#ff8a1f", counter: "#ffd866" },
  gold:   { primary: "#ffc83a", light: "#ffefa6", deep: "#a87000", glow: "#ffc83a", counter: "#ffd866" },
};

interface Props {
  questionNumber: number | string;
  current: number;
  max: number;
  theme?: CrystalTheme;
  /** Pixel width of the rendered container. Height scales proportionally. */
  width?: number;
  /** Hide the bottom progress text — useful for very small thumbnails. */
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
  const id = useMemo(() => Math.random().toString(36).slice(2, 9), []);

  // Drive the wave with requestAnimationFrame so the surface ripples gently.
  const [tNow, setTNow] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setTNow((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Canvas viewBox (kept stable so geometry is easy to reason about).
  const VB_W = 220;
  const VB_H = 340;

  // Inner chamber rectangle (the liquid lives inside this box).
  const CH_X = 56;
  const CH_Y = 86;
  const CH_W = 108;
  const CH_H = 178;

  // Liquid surface y (top of liquid). Higher pct → lower y.
  const surfaceY = CH_Y + CH_H * (1 - pct);
  const liquidH = CH_H * pct;

  // Animated wave path along the surface.
  const wave = useMemo(() => {
    const amp = pct > 0.02 && pct < 0.98 ? 2.6 : 0;
    const segments = 8;
    const stepX = CH_W / segments;
    const phase = tNow * 1.6;
    let d = `M ${CH_X} ${surfaceY}`;
    for (let i = 1; i <= segments; i += 1) {
      const x = CH_X + i * stepX;
      const y = surfaceY + Math.sin(phase + i * 0.9) * amp;
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    d += ` L ${CH_X + CH_W} ${CH_Y + CH_H} L ${CH_X} ${CH_Y + CH_H} Z`;
    return d;
  }, [tNow, surfaceY, pct]);

  const height = (width * VB_H) / VB_W;
  const aspectRatio = `${VB_W} / ${VB_H}`;

  return (
    <div
      className={className}
      style={{ width, height, display: "inline-block", aspectRatio, lineHeight: 0 }}
      role="img"
      aria-label={`Question ${questionNumber}, progress ${current} of ${max}`}
    >
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="100%">
        <defs>
          {/* Liquid gradient — deep base to bright glowing top */}
          <linearGradient id={`liq-${id}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={t.deep} stopOpacity="1" />
            <stop offset="60%" stopColor={t.primary} stopOpacity="0.95" />
            <stop offset="100%" stopColor={t.light} stopOpacity="0.95" />
          </linearGradient>

          {/* Crystal apex gradient */}
          <linearGradient id={`crystal-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.light} />
            <stop offset="100%" stopColor={t.primary} />
          </linearGradient>

          {/* Stone gradient — cool dark slate */}
          <linearGradient id={`stone-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3a3f48" />
            <stop offset="55%" stopColor="#22262d" />
            <stop offset="100%" stopColor="#13161b" />
          </linearGradient>

          {/* Glass tint — very faint, lets liquid show through */}
          <linearGradient id={`glass-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.light} stopOpacity="0.12" />
            <stop offset="100%" stopColor={t.deep} stopOpacity="0.10" />
          </linearGradient>

          {/* Outer aura glow */}
          <radialGradient id={`aura-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={t.glow} stopOpacity="0.55" />
            <stop offset="60%" stopColor={t.glow} stopOpacity="0.10" />
            <stop offset="100%" stopColor={t.glow} stopOpacity="0" />
          </radialGradient>

          {/* Clip so the liquid never spills outside the chamber */}
          <clipPath id={`chamber-${id}`}>
            <rect x={CH_X} y={CH_Y} width={CH_W} height={CH_H} rx="6" />
          </clipPath>
        </defs>

        {/* Outer magical aura */}
        <ellipse cx={VB_W / 2} cy={VB_H / 2} rx={VB_W / 2} ry={VB_H / 2.1} fill={`url(#aura-${id})`} />

        {/* CRYSTAL APEX */}
        <g>
          <polygon
            points={`${VB_W / 2 - 28},58 ${VB_W / 2},6 ${VB_W / 2 + 28},58 ${VB_W / 2 + 14},66 ${VB_W / 2 - 14},66`}
            fill={`url(#crystal-${id})`}
            stroke={t.deep}
            strokeWidth="1.2"
          />
          <polygon
            points={`${VB_W / 2 - 10},58 ${VB_W / 2},14 ${VB_W / 2 + 10},58`}
            fill={t.light}
            opacity="0.55"
          />
        </g>

        {/* TOP LABEL PLATE */}
        <g>
          <polygon
            points={`${VB_W / 2 - 46},62 ${VB_W / 2 + 46},62 ${VB_W / 2 + 52},78 ${VB_W / 2 + 46},94 ${VB_W / 2 - 46},94 ${VB_W / 2 - 52},78`}
            fill={`url(#stone-${id})`}
            stroke="#0b0d11"
            strokeWidth="1"
          />
          <text
            x={VB_W / 2}
            y={84}
            textAnchor="middle"
            fontFamily="'Cinzel', 'Trajan Pro', Georgia, serif"
            fontWeight={700}
            fontSize={20}
            fill={t.counter}
            style={{ paintOrder: "stroke", stroke: "#0b0d11", strokeWidth: 0.6 }}
          >
            Q{questionNumber}
          </text>
        </g>

        {/* STONE FRAME — left and right pillars + top/bottom rails */}
        <g fill={`url(#stone-${id})`} stroke="#0b0d11" strokeWidth="1">
          {/* Left pillar (cluster of stones) */}
          <polygon points="34,100 56,90 56,260 34,270 28,200" />
          {/* Right pillar */}
          <polygon points="186,100 164,90 164,260 186,270 192,200" />
          {/* Base stone */}
          <polygon points="40,256 180,256 192,290 28,290" />
          {/* Bottom point */}
          <polygon points={`${VB_W / 2 - 12},316 ${VB_W / 2},332 ${VB_W / 2 + 12},316`} />
          {/* Small accent rocks on top corners */}
          <polygon points="40,80 56,72 60,96 44,98" />
          <polygon points="180,80 164,72 160,96 176,98" />
          {/* Bottom corner rocks */}
          <polygon points="34,250 50,244 54,268 38,272" />
          <polygon points="186,250 170,244 166,268 182,272" />
        </g>

        {/* GLASS CHAMBER background tint */}
        <rect x={CH_X} y={CH_Y} width={CH_W} height={CH_H} rx="6" fill={`url(#glass-${id})`} />

        {/* LIQUID — clipped to chamber, animated wave surface */}
        <g clipPath={`url(#chamber-${id})`}>
          {/* Solid block under the wave with transition for smooth rise/fall */}
          <rect
            x={CH_X}
            y={surfaceY}
            width={CH_W}
            height={Math.max(0, liquidH)}
            fill={`url(#liq-${id})`}
            style={{ transition: "y 600ms cubic-bezier(0.4, 0, 0.2, 1), height 600ms cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
          {/* Wave surface highlight */}
          {pct > 0 && (
            <path
              d={wave}
              fill={`url(#liq-${id})`}
              opacity={0.95}
              style={{ transition: "opacity 200ms ease" }}
            />
          )}
          {/* Bright surface line */}
          {pct > 0.01 && pct < 0.99 && (
            <line
              x1={CH_X + 4}
              x2={CH_X + CH_W - 4}
              y1={surfaceY}
              y2={surfaceY}
              stroke={t.light}
              strokeWidth="1.6"
              opacity="0.85"
              style={{ transition: "y1 600ms cubic-bezier(0.4, 0, 0.2, 1), y2 600ms cubic-bezier(0.4, 0, 0.2, 1)" }}
            />
          )}
          {/* Inner bubble sparkles for life */}
          {pct > 0.05 && (
            <>
              <circle cx={CH_X + 22} cy={CH_Y + CH_H - 18 - (tNow * 12) % (liquidH || 1)} r="1.4" fill={t.light} opacity="0.7" />
              <circle cx={CH_X + 70} cy={CH_Y + CH_H - 8 - (tNow * 18) % (liquidH || 1)} r="1.0" fill={t.light} opacity="0.55" />
              <circle cx={CH_X + 92} cy={CH_Y + CH_H - 24 - (tNow * 9) % (liquidH || 1)} r="1.2" fill={t.light} opacity="0.6" />
            </>
          )}
        </g>

        {/* GLASS REFLECTIONS — a vertical shine on the left */}
        <rect x={CH_X + 6} y={CH_Y + 6} width="6" height={CH_H - 12} rx="3" fill="#ffffff" opacity="0.08" />
        <rect x={CH_X + CH_W - 12} y={CH_Y + 18} width="3" height={CH_H - 50} rx="2" fill="#ffffff" opacity="0.05" />

        {/* GLASS FRAME outline */}
        <rect
          x={CH_X}
          y={CH_Y}
          width={CH_W}
          height={CH_H}
          rx="6"
          fill="none"
          stroke={t.primary}
          strokeOpacity="0.35"
          strokeWidth="1.2"
        />

        {/* BOTTOM PROGRESS PLATE */}
        {!hideProgressText && (
          <g>
            <polygon
              points={`${VB_W / 2 - 44},260 ${VB_W / 2 + 44},260 ${VB_W / 2 + 50},278 ${VB_W / 2 + 44},296 ${VB_W / 2 - 44},296 ${VB_W / 2 - 50},278`}
              fill={`url(#stone-${id})`}
              stroke="#0b0d11"
              strokeWidth="1"
            />
            <text
              x={VB_W / 2}
              y={284}
              textAnchor="middle"
              fontFamily="'Cinzel', 'Trajan Pro', Georgia, serif"
              fontWeight={700}
              fontSize={18}
              fill={t.counter}
            >
              {current}/{max}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export default QuestionProgressContainer;
