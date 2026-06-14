import { useEffect, useMemo, useState } from "react";

/**
 * Question Progress Container — a reusable, fantasy crystal-and-stone vessel
 * whose magical liquid level reflects the ratio `current / max`.
 *
 * Visual upgrade: layered stone with bevels, faceted crystal apex with inner
 * refractions, runic engraved label plate, glass chamber with caustic glints
 * and rim highlights, animated bubbles and a soft wave surface. The fill is
 * continuous (never stepped) and supports any maximum value.
 */

export type CrystalTheme = "blue" | "green" | "purple" | "orange" | "gold";

interface ThemeTokens {
  primary: string;
  light: string;
  deep: string;
  glow: string;
  counter: string;
  rune: string;
}

const THEMES: Record<CrystalTheme, ThemeTokens> = {
  blue:   { primary: "#3fb6ff", light: "#d5f1ff", deep: "#0a3a78", glow: "#5ec8ff", counter: "#f5faff", rune: "#7fd9ff" },
  green:  { primary: "#43e36b", light: "#d6ffe1", deep: "#0f5524", glow: "#5cff86", counter: "#f5fff7", rune: "#8effae" },
  purple: { primary: "#a460ff", light: "#ecd9ff", deep: "#3a107a", glow: "#c08bff", counter: "#fff3c0", rune: "#d3a9ff" },
  orange: { primary: "#ff8a1f", light: "#ffe1bd", deep: "#6e2c05", glow: "#ffaa55", counter: "#fff1d0", rune: "#ffc187" },
  gold:   { primary: "#ffc83a", light: "#fff4c2", deep: "#6e4500", glow: "#ffd96a", counter: "#fff8d6", rune: "#ffe27a" },
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
  const id = useMemo(() => Math.random().toString(36).slice(2, 9), []);

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

  const VB_W = 240;
  const VB_H = 360;

  // Inner chamber rectangle (the liquid lives inside this box).
  const CH_X = 64;
  const CH_Y = 100;
  const CH_W = 112;
  const CH_H = 184;

  const surfaceY = CH_Y + CH_H * (1 - pct);
  const liquidH = CH_H * pct;

  const wave = useMemo(() => {
    const amp = pct > 0.02 && pct < 0.98 ? 2.8 : 0;
    const segments = 14;
    const stepX = CH_W / segments;
    const phase = tNow * 1.7;
    let d = `M ${CH_X} ${surfaceY}`;
    for (let i = 1; i <= segments; i += 1) {
      const x = CH_X + i * stepX;
      const y = surfaceY + Math.sin(phase + i * 0.7) * amp + Math.sin(phase * 0.6 + i * 1.3) * (amp * 0.4);
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    d += ` L ${CH_X + CH_W} ${CH_Y + CH_H} L ${CH_X} ${CH_Y + CH_H} Z`;
    return d;
  }, [tNow, surfaceY, pct]);

  const height = (width * VB_H) / VB_W;
  const aspectRatio = `${VB_W} / ${VB_H}`;

  // Bubbles — deterministic per id.
  const bubbles = useMemo(() => {
    const seed = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = (n: number) => {
      const x = Math.sin(seed * 13.37 + n * 7.91) * 10000;
      return x - Math.floor(x);
    };
    return Array.from({ length: 6 }, (_, i) => ({
      x: CH_X + 10 + rand(i) * (CH_W - 20),
      r: 0.8 + rand(i + 9) * 1.6,
      speed: 8 + rand(i + 17) * 14,
      offset: rand(i + 23) * 100,
    }));
  }, [id]);

  return (
    <div
      className={className}
      style={{ width, height, display: "inline-block", aspectRatio, lineHeight: 0 }}
      role="img"
      aria-label={`Question ${questionNumber}, progress ${current} of ${max}`}
    >
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="100%">
        <defs>
          {/* Liquid gradient */}
          <linearGradient id={`liq-${id}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={t.deep} />
            <stop offset="55%" stopColor={t.primary} />
            <stop offset="100%" stopColor={t.light} />
          </linearGradient>

          {/* Crystal apex — multi-stop refraction */}
          <linearGradient id={`crystalA-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="30%" stopColor={t.light} />
            <stop offset="100%" stopColor={t.primary} />
          </linearGradient>
          <linearGradient id={`crystalB-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={t.primary} />
            <stop offset="100%" stopColor={t.deep} />
          </linearGradient>

          {/* Stone — layered with bevel feel */}
          <linearGradient id={`stone-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a5260" />
            <stop offset="40%" stopColor="#2c3038" />
            <stop offset="100%" stopColor="#0f1116" />
          </linearGradient>
          <linearGradient id={`stoneHi-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5a6373" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#2c3038" stopOpacity="0" />
            <stop offset="100%" stopColor="#0a0c10" stopOpacity="0.9" />
          </linearGradient>

          {/* Glass tint */}
          <linearGradient id={`glass-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.light} stopOpacity="0.18" />
            <stop offset="100%" stopColor={t.deep} stopOpacity="0.14" />
          </linearGradient>

          {/* Outer aura */}
          <radialGradient id={`aura-${id}`} cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor={t.glow} stopOpacity="0.55" />
            <stop offset="55%" stopColor={t.glow} stopOpacity="0.12" />
            <stop offset="100%" stopColor={t.glow} stopOpacity="0" />
          </radialGradient>

          {/* Crystal halo */}
          <radialGradient id={`halo-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="40%" stopColor={t.light} stopOpacity="0.55" />
            <stop offset="100%" stopColor={t.glow} stopOpacity="0" />
          </radialGradient>

          {/* Soft glow filter */}
          <filter id={`soft-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          <filter id={`bigGlow-${id}`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" />
          </filter>

          {/* Clip the liquid */}
          <clipPath id={`chamber-${id}`}>
            <rect x={CH_X} y={CH_Y} width={CH_W} height={CH_H} rx="8" />
          </clipPath>
        </defs>

        {/* Outer magical aura */}
        <ellipse cx={VB_W / 2} cy={VB_H / 2} rx={VB_W / 2} ry={VB_H / 2.05} fill={`url(#aura-${id})`} />

        {/* Pulsing chamber glow behind glass */}
        <ellipse
          cx={VB_W / 2}
          cy={CH_Y + CH_H / 2}
          rx={CH_W * 0.85}
          ry={CH_H * 0.55}
          fill={t.glow}
          opacity={0.18 + 0.08 * Math.sin(tNow * 2)}
          filter={`url(#bigGlow-${id})`}
        />

        {/* ===== CRYSTAL APEX ===== */}
        <g>
          {/* Halo behind crystal */}
          <circle cx={VB_W / 2} cy={42} r={34} fill={`url(#halo-${id})`} opacity={0.85} />
          {/* Main faceted gem */}
          <polygon
            points={`${VB_W / 2 - 30},66 ${VB_W / 2 - 16},14 ${VB_W / 2},4 ${VB_W / 2 + 16},14 ${VB_W / 2 + 30},66 ${VB_W / 2 + 16},76 ${VB_W / 2 - 16},76`}
            fill={`url(#crystalA-${id})`}
            stroke={t.deep}
            strokeWidth="1.2"
          />
          {/* Right-side darker facet */}
          <polygon
            points={`${VB_W / 2},4 ${VB_W / 2 + 16},14 ${VB_W / 2 + 30},66 ${VB_W / 2 + 16},76 ${VB_W / 2},70`}
            fill={`url(#crystalB-${id})`}
            opacity="0.55"
          />
          {/* Bright vertical highlight */}
          <polygon
            points={`${VB_W / 2 - 7},66 ${VB_W / 2 - 3},12 ${VB_W / 2 + 1},12 ${VB_W / 2 + 4},66`}
            fill="#ffffff"
            opacity="0.7"
          />
          {/* Tiny sparkle */}
          <circle cx={VB_W / 2 - 6} cy={26} r="1.6" fill="#ffffff" opacity={0.6 + 0.4 * Math.sin(tNow * 3)} />
          <circle cx={VB_W / 2 + 9} cy={48} r="1.2" fill="#ffffff" opacity={0.4 + 0.4 * Math.sin(tNow * 2.3 + 1)} />
        </g>

        {/* ===== TOP LABEL PLATE ===== */}
        <g>
          <polygon
            points={`${VB_W / 2 - 52},74 ${VB_W / 2 + 52},74 ${VB_W / 2 + 60},92 ${VB_W / 2 + 52},110 ${VB_W / 2 - 52},110 ${VB_W / 2 - 60},92`}
            fill={`url(#stone-${id})`}
            stroke="#05070a"
            strokeWidth="1.2"
          />
          <polygon
            points={`${VB_W / 2 - 52},74 ${VB_W / 2 + 52},74 ${VB_W / 2 + 60},92 ${VB_W / 2 + 52},110 ${VB_W / 2 - 52},110 ${VB_W / 2 - 60},92`}
            fill={`url(#stoneHi-${id})`}
            opacity="0.55"
          />
          {/* Inner engraved line */}
          <polygon
            points={`${VB_W / 2 - 46},79 ${VB_W / 2 + 46},79 ${VB_W / 2 + 53},92 ${VB_W / 2 + 46},105 ${VB_W / 2 - 46},105 ${VB_W / 2 - 53},92`}
            fill="none"
            stroke={t.rune}
            strokeOpacity="0.45"
            strokeWidth="0.8"
          />
          <text
            x={VB_W / 2}
            y={98}
            textAnchor="middle"
            fontFamily="'Cinzel', 'Trajan Pro', Georgia, serif"
            fontWeight={800}
            fontSize={22}
            fill={t.counter}
            style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 0.8 }}
          >
            Q{questionNumber}
          </text>
        </g>

        {/* ===== STONE FRAME ===== */}
        <g>
          {/* Left pillar — chunky cluster */}
          <polygon points="40,116 64,104 64,272 40,284 30,200" fill={`url(#stone-${id})`} stroke="#05070a" strokeWidth="1" />
          <polygon points="40,116 64,104 64,272 40,284 30,200" fill={`url(#stoneHi-${id})`} opacity="0.45" />
          <polygon points="34,140 46,134 50,162 38,168" fill="#1a1d24" opacity="0.8" />
          <polygon points="32,210 44,204 48,232 36,236" fill="#1a1d24" opacity="0.7" />

          {/* Right pillar */}
          <polygon points="200,116 176,104 176,272 200,284 210,200" fill={`url(#stone-${id})`} stroke="#05070a" strokeWidth="1" />
          <polygon points="200,116 176,104 176,272 200,284 210,200" fill={`url(#stoneHi-${id})`} opacity="0.45" />
          <polygon points="206,140 194,134 190,162 202,168" fill="#1a1d24" opacity="0.8" />
          <polygon points="208,210 196,204 192,232 204,236" fill="#1a1d24" opacity="0.7" />

          {/* Top corner accents */}
          <polygon points="46,92 64,82 70,110 50,114" fill={`url(#stone-${id})`} stroke="#05070a" strokeWidth="0.8" />
          <polygon points="194,92 176,82 170,110 190,114" fill={`url(#stone-${id})`} stroke="#05070a" strokeWidth="0.8" />

          {/* Embedded mini-crystals on pillars */}
          <polygon points={`46,180 50,168 56,180 50,192`} fill={t.primary} opacity="0.85" />
          <polygon points={`46,180 50,168 52,180 50,192`} fill={t.light} opacity="0.6" />
          <polygon points={`194,180 190,168 184,180 190,192`} fill={t.primary} opacity="0.85" />
          <polygon points={`194,180 190,168 188,180 190,192`} fill={t.light} opacity="0.6" />

          {/* Base */}
          <polygon points="44,272 196,272 212,306 28,306" fill={`url(#stone-${id})`} stroke="#05070a" strokeWidth="1" />
          <polygon points="44,272 196,272 212,306 28,306" fill={`url(#stoneHi-${id})`} opacity="0.4" />
          {/* Base crack detail */}
          <path d="M 70 290 L 80 298 L 95 292 L 110 300" stroke="#05070a" strokeWidth="0.6" fill="none" opacity="0.7" />
          <path d="M 140 294 L 155 286 L 170 296" stroke="#05070a" strokeWidth="0.6" fill="none" opacity="0.7" />

          {/* Bottom point */}
          <polygon points={`${VB_W / 2 - 14},332 ${VB_W / 2},352 ${VB_W / 2 + 14},332`} fill={`url(#stone-${id})`} stroke="#05070a" strokeWidth="1" />
        </g>

        {/* ===== GLASS CHAMBER background tint ===== */}
        <rect x={CH_X} y={CH_Y} width={CH_W} height={CH_H} rx="8" fill={`url(#glass-${id})`} />

        {/* ===== LIQUID ===== */}
        <g clipPath={`url(#chamber-${id})`}>
          {/* Body */}
          <rect
            x={CH_X}
            y={surfaceY}
            width={CH_W}
            height={Math.max(0, liquidH)}
            fill={`url(#liq-${id})`}
            style={{ transition: "y 600ms cubic-bezier(0.4, 0, 0.2, 1), height 600ms cubic-bezier(0.4, 0, 0.2, 1)" }}
          />

          {/* Caustic glow behind wave */}
          {pct > 0.02 && (
            <ellipse
              cx={CH_X + CH_W / 2}
              cy={surfaceY + 4}
              rx={CH_W * 0.45}
              ry={6}
              fill={t.light}
              opacity="0.55"
              filter={`url(#soft-${id})`}
              style={{ transition: "cy 600ms cubic-bezier(0.4, 0, 0.2, 1)" }}
            />
          )}

          {/* Wave surface */}
          {pct > 0 && (
            <path d={wave} fill={`url(#liq-${id})`} opacity={0.95} />
          )}

          {/* Bright surface line */}
          {pct > 0.01 && pct < 0.99 && (
            <line
              x1={CH_X + 4}
              x2={CH_X + CH_W - 4}
              y1={surfaceY}
              y2={surfaceY}
              stroke="#ffffff"
              strokeWidth="1.4"
              opacity="0.85"
              style={{ transition: "y1 600ms cubic-bezier(0.4, 0, 0.2, 1), y2 600ms cubic-bezier(0.4, 0, 0.2, 1)" }}
            />
          )}

          {/* Animated rising bubbles */}
          {pct > 0.05 && bubbles.map((b, i) => {
            const travel = liquidH + 10;
            const y = CH_Y + CH_H - ((tNow * b.speed + b.offset) % travel);
            if (y < surfaceY + 2) return null;
            return (
              <circle key={i} cx={b.x} cy={y} r={b.r} fill="#ffffff" opacity="0.55" />
            );
          })}

          {/* Light caustic flecks dancing on liquid */}
          {pct > 0.1 && Array.from({ length: 3 }).map((_, i) => (
            <ellipse
              key={i}
              cx={CH_X + 20 + i * 32 + Math.sin(tNow * 1.5 + i) * 6}
              cy={surfaceY + 14 + i * 18}
              rx={8}
              ry={1.2}
              fill={t.light}
              opacity="0.35"
            />
          ))}
        </g>

        {/* ===== GLASS REFLECTIONS ===== */}
        {/* Left shine */}
        <rect x={CH_X + 6} y={CH_Y + 8} width="7" height={CH_H - 16} rx="3" fill="#ffffff" opacity="0.12" />
        <rect x={CH_X + 8} y={CH_Y + 12} width="2" height={CH_H * 0.55} rx="1" fill="#ffffff" opacity="0.35" />
        {/* Right thin shine */}
        <rect x={CH_X + CH_W - 12} y={CH_Y + 22} width="3" height={CH_H - 60} rx="2" fill="#ffffff" opacity="0.08" />
        {/* Top inner gleam */}
        <ellipse cx={CH_X + CH_W / 2} cy={CH_Y + 8} rx={CH_W * 0.4} ry={5} fill="#ffffff" opacity="0.18" />

        {/* GLASS FRAME outline (rim) */}
        <rect
          x={CH_X}
          y={CH_Y}
          width={CH_W}
          height={CH_H}
          rx="8"
          fill="none"
          stroke={t.primary}
          strokeOpacity="0.55"
          strokeWidth="1.4"
        />
        {/* Inner darker rim */}
        <rect
          x={CH_X + 1.5}
          y={CH_Y + 1.5}
          width={CH_W - 3}
          height={CH_H - 3}
          rx="7"
          fill="none"
          stroke="#000"
          strokeOpacity="0.35"
          strokeWidth="0.8"
        />

        {/* Top rivets on chamber */}
        <circle cx={CH_X + 6} cy={CH_Y + 6} r="2" fill={`url(#stone-${id})`} stroke="#05070a" strokeWidth="0.5" />
        <circle cx={CH_X + CH_W - 6} cy={CH_Y + 6} r="2" fill={`url(#stone-${id})`} stroke="#05070a" strokeWidth="0.5" />
        <circle cx={CH_X + 6} cy={CH_Y + CH_H - 6} r="2" fill={`url(#stone-${id})`} stroke="#05070a" strokeWidth="0.5" />
        <circle cx={CH_X + CH_W - 6} cy={CH_Y + CH_H - 6} r="2" fill={`url(#stone-${id})`} stroke="#05070a" strokeWidth="0.5" />

        {/* ===== BOTTOM PROGRESS PLATE ===== */}
        {!hideProgressText && (
          <g>
            <polygon
              points={`${VB_W / 2 - 50},272 ${VB_W / 2 + 50},272 ${VB_W / 2 + 58},290 ${VB_W / 2 + 50},310 ${VB_W / 2 - 50},310 ${VB_W / 2 - 58},290`}
              fill={`url(#stone-${id})`}
              stroke="#05070a"
              strokeWidth="1.2"
            />
            <polygon
              points={`${VB_W / 2 - 50},272 ${VB_W / 2 + 50},272 ${VB_W / 2 + 58},290 ${VB_W / 2 + 50},310 ${VB_W / 2 - 50},310 ${VB_W / 2 - 58},290`}
              fill={`url(#stoneHi-${id})`}
              opacity="0.5"
            />
            <text
              x={VB_W / 2}
              y={297}
              textAnchor="middle"
              fontFamily="'Cinzel', 'Trajan Pro', Georgia, serif"
              fontWeight={800}
              fontSize={19}
              fill={t.counter}
              style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 0.6 }}
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
