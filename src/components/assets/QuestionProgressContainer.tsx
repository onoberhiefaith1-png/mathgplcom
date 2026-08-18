import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import blueFrame from "@/assets/qpc/frame-blue.png.asset.json";
import greenFrame from "@/assets/qpc/frame-green.png.asset.json";
import purpleFrame from "@/assets/qpc/frame-purple.png.asset.json";
import orangeFrame from "@/assets/qpc/frame-orange.png.asset.json";
import goldFrame from "@/assets/qpc/frame-gold.png.asset.json";
import chambers from "@/assets/qpc/chambers.json";

/**
 * Question Progress Container — fantasy stone-and-crystal vessel. The outer
 * frame (stone, crystal apex, side rocks) is an externally provided painted
 * asset. The glass chamber and animated magical liquid are rendered as SVG
 * inside the cut-out hole so progress (current ÷ max) drives the fill level
 * continuously.
 */

export type CrystalTheme = "blue" | "green" | "purple" | "orange" | "gold";

interface ThemeTokens {
  primary: string;
  light: string;
  deep: string;
  glow: string;
  counter: string;
  frame: string;
}

const THEMES: Record<CrystalTheme, ThemeTokens> = {
  blue:   { primary: "#3fb6ff", light: "#d5f1ff", deep: "#0a3a78", glow: "#5ec8ff", counter: "#f5faff", frame: blueFrame.url },
  green:  { primary: "#43e36b", light: "#d6ffe1", deep: "#0f5524", glow: "#5cff86", counter: "#f5fff7", frame: greenFrame.url },
  purple: { primary: "#a460ff", light: "#ecd9ff", deep: "#3a107a", glow: "#c08bff", counter: "#fff3c0", frame: purpleFrame.url },
  orange: { primary: "#ff8a1f", light: "#ffe1bd", deep: "#6e2c05", glow: "#ffaa55", counter: "#fff1d0", frame: orangeFrame.url },
  gold:   { primary: "#ffc83a", light: "#fff4c2", deep: "#6e4500", glow: "#ffd96a", counter: "#fff8d6", frame: goldFrame.url },
};

interface Props {
  current: number;
  max: number;
  theme?: CrystalTheme;
  /** Pixel width, or "fill" to track the parent's width. */
  width?: number | "fill";
  hideProgressText?: boolean;
  className?: string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const QuestionProgressContainer = ({
  current,
  max,
  theme = "blue",
  width = 220,
  hideProgressText = false,
  className,
}: Props) => {
  const t = THEMES[theme];
  const ch = (chambers as Record<string, { x1: number; y1: number; x2: number; y2: number; w: number; h: number }>)[theme];
  const pct = max > 0 ? clamp01(current / max) : 0;
  const id = useMemo(() => Math.random().toString(36).slice(2, 9), []);

  // "fill" mode: the vessel tracks its container's width so it can live inside
  // a resizable canvas element without changing any of its internal geometry.
  const hostRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(0);
  const fluid = width === "fill";
  useLayoutEffect(() => {
    if (!fluid) return;
    const el = hostRef.current;
    if (!el) return;
    const read = () => setMeasured(el.getBoundingClientRect().width);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fluid]);
  const boxWidth = fluid ? measured || 220 : (width as number);


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

  const VB_W = ch.w;
  const VB_H = ch.h;
  const CH_X = ch.x1 * VB_W;
  const CH_Y = ch.y1 * VB_H;
  const CH_W = (ch.x2 - ch.x1) * VB_W;
  const CH_H = (ch.y2 - ch.y1) * VB_H;

  const surfaceY = CH_Y + CH_H * (1 - pct);
  const liquidH = CH_H * pct;

  const wave = useMemo(() => {
    const amp = pct > 0.02 && pct < 0.98 ? CH_W * 0.022 : 0;
    const segments = 16;
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
  }, [tNow, surfaceY, pct, CH_X, CH_Y, CH_W, CH_H]);

  const height = (width * VB_H) / VB_W;

  const bubbles = useMemo(() => {
    const seed = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = (n: number) => {
      const x = Math.sin(seed * 13.37 + n * 7.91) * 10000;
      return x - Math.floor(x);
    };
    return Array.from({ length: 6 }, (_, i) => ({
      x: CH_X + CH_W * 0.1 + rand(i) * CH_W * 0.8,
      r: CH_W * 0.008 + rand(i + 9) * CH_W * 0.014,
      speed: CH_H * 0.04 + rand(i + 17) * CH_H * 0.06,
      offset: rand(i + 23) * CH_H,
    }));
  }, [id, CH_X, CH_Y, CH_W, CH_H]);

  const chXPct = ch.x1 * 100;
  const chWPct = (ch.x2 - ch.x1) * 100;
  const topPlateW = chWPct * 1.15;
  const topPlateLeft = chXPct + chWPct / 2 - topPlateW / 2;
  const topPlateTopPct = (ch.y1 - 0.16) * 100;
  const topPlateHPct = 0.13 * 100;
  const botPlateW = chWPct * 1.1;
  const botPlateLeft = chXPct + chWPct / 2 - botPlateW / 2;
  const botPlateTopPct = (ch.y2 + 0.02) * 100;
  const botPlateHPct = 0.1 * 100;

  const engravedStyle: React.CSSProperties = {
    fontFamily: "'Cinzel', 'Trajan Pro', Georgia, serif",
    fontWeight: 900,
    color: "#ffffff",
    textShadow:
      "0 0 2px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.7), 0 0 10px rgba(0,0,0,0.5)",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    lineHeight: 1,
    userSelect: "none",
    whiteSpace: "nowrap",
    WebkitTextStroke: "1px rgba(0,0,0,0.55)",
  };

  return (
    <div
      className={className}
      style={{ width, height, position: "relative", display: "inline-block", lineHeight: 0 }}
      role="img"
      aria-label={`Question ${questionNumber}, progress ${current} of ${max}`}
    >
      <img
        src={t.frame}
        alt=""
        draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", userSelect: "none" }}
      />

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <defs>
          <linearGradient id={`liq-${id}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={t.deep} />
            <stop offset="55%" stopColor={t.primary} />
            <stop offset="100%" stopColor={t.light} />
          </linearGradient>
          <linearGradient id={`glass-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.light} stopOpacity="0.18" />
            <stop offset="100%" stopColor={t.deep} stopOpacity="0.22" />
          </linearGradient>
          <radialGradient id={`chamberGlow-${id}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={t.glow} stopOpacity="0.45" />
            <stop offset="70%" stopColor={t.glow} stopOpacity="0.12" />
            <stop offset="100%" stopColor={t.glow} stopOpacity="0" />
          </radialGradient>
          <filter id={`soft-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={CH_W * 0.012} />
          </filter>
          <clipPath id={`chamber-${id}`}>
            <rect x={CH_X} y={CH_Y} width={CH_W} height={CH_H} rx={CH_W * 0.06} />
          </clipPath>
        </defs>

        <rect x={CH_X} y={CH_Y} width={CH_W} height={CH_H} rx={CH_W * 0.06} fill={`url(#glass-${id})`} />

        <ellipse
          cx={CH_X + CH_W / 2}
          cy={CH_Y + CH_H / 2}
          rx={CH_W * 0.55}
          ry={CH_H * 0.55}
          fill={`url(#chamberGlow-${id})`}
          opacity={0.6 + 0.15 * Math.sin(tNow * 2)}
        />

        <g clipPath={`url(#chamber-${id})`}>
          <rect
            x={CH_X}
            y={surfaceY}
            width={CH_W}
            height={Math.max(0, liquidH)}
            fill={`url(#liq-${id})`}
            style={{ transition: "y 600ms cubic-bezier(0.4, 0, 0.2, 1), height 600ms cubic-bezier(0.4, 0, 0.2, 1)" }}
          />

          {pct > 0.02 && (
            <ellipse
              cx={CH_X + CH_W / 2}
              cy={surfaceY + CH_W * 0.02}
              rx={CH_W * 0.45}
              ry={CH_W * 0.04}
              fill={t.light}
              opacity="0.6"
              filter={`url(#soft-${id})`}
              style={{ transition: "cy 600ms cubic-bezier(0.4, 0, 0.2, 1)" }}
            />
          )}

          {pct > 0 && <path d={wave} fill={`url(#liq-${id})`} opacity={0.95} />}

          {pct > 0.01 && pct < 0.99 && (
            <line
              x1={CH_X + CH_W * 0.04}
              x2={CH_X + CH_W * 0.96}
              y1={surfaceY}
              y2={surfaceY}
              stroke="#ffffff"
              strokeWidth={CH_W * 0.012}
              opacity="0.85"
              style={{ transition: "y1 600ms cubic-bezier(0.4, 0, 0.2, 1), y2 600ms cubic-bezier(0.4, 0, 0.2, 1)" }}
            />
          )}

          {pct > 0.05 &&
            bubbles.map((b, i) => {
              const travel = liquidH + 10;
              const y = CH_Y + CH_H - ((tNow * b.speed + b.offset) % travel);
              if (y < surfaceY + 2) return null;
              return <circle key={i} cx={b.x} cy={y} r={b.r} fill="#ffffff" opacity="0.55" />;
            })}

          {pct > 0.1 &&
            Array.from({ length: 3 }).map((_, i) => (
              <ellipse
                key={i}
                cx={CH_X + CH_W * 0.18 + i * CH_W * 0.28 + Math.sin(tNow * 1.5 + i) * CH_W * 0.025}
                cy={surfaceY + CH_H * 0.05 + i * CH_H * 0.06}
                rx={CH_W * 0.06}
                ry={CH_H * 0.005}
                fill={t.light}
                opacity="0.35"
              />
            ))}
        </g>

        <rect x={CH_X + CH_W * 0.06} y={CH_Y + CH_H * 0.04} width={CH_W * 0.04} height={CH_H * 0.55} rx={CH_W * 0.012} fill="#ffffff" opacity="0.22" />
        <rect x={CH_X + CH_W * 0.88} y={CH_Y + CH_H * 0.1} width={CH_W * 0.02} height={CH_H * 0.5} rx={CH_W * 0.008} fill="#ffffff" opacity="0.12" />
        <ellipse cx={CH_X + CH_W / 2} cy={CH_Y + CH_H * 0.03} rx={CH_W * 0.4} ry={CH_H * 0.012} fill="#ffffff" opacity="0.18" />

        <rect
          x={CH_X}
          y={CH_Y}
          width={CH_W}
          height={CH_H}
          rx={CH_W * 0.06}
          fill="none"
          stroke={t.primary}
          strokeOpacity="0.55"
          strokeWidth={CH_W * 0.012}
        />
      </svg>

      <div
        style={{
          position: "absolute",
          left: `${topPlateLeft}%`,
          top: `${topPlateTopPct}%`,
          width: `${topPlateW}%`,
          height: `${topPlateHPct}%`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          ...engravedStyle,
        }}
      >
        <span style={{ fontSize: `${width * 0.11}px` }}>Q{questionNumber}</span>
      </div>

      {!hideProgressText && (
        <div
          style={{
            position: "absolute",
            left: `${botPlateLeft}%`,
            top: `${botPlateTopPct}%`,
            width: `${botPlateW}%`,
            height: `${botPlateHPct}%`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            ...engravedStyle,
          }}
        >
          <span style={{ fontSize: `${width * 0.085}px` }}>{current}/{max}</span>
        </div>
      )}
    </div>
  );
};

export default QuestionProgressContainer;
