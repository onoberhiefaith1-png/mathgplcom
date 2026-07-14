// Renders per-component appearance overrides (colour, thickness, dash,
// visibility) on top of the base shape SVG produced by the adapter. The
// base SVG stays untouched; this overlay simply repaints components whose
// appearance has been customised.

import type { Nodes } from "../geometry";
import { dist, formatLen, mid, angleAt } from "../geometry";
import type { Component } from "./componentModel";
import { useLabelScale, pickFontPx, PAD_PX } from "../labelScale";

interface Props {
  components: Component[];
  nodes: Nodes | null;
  showLineLabels?: boolean;
}

function labelStyleFor(c: Component, autoColor = "currentColor") {
  const s = c.content?.labelStyle ?? {};
  return {
    fontPx: pickFontPx(s.sizePx),
    weight: s.weight ?? "normal",
    color: s.color ?? autoColor,
    position: s.position,
    offsetPx: typeof s.offsetPx === "number" ? s.offsetPx : undefined,
  };
}


// Interpret content.value:
//   undefined → auto (measured value)
//   ""        → hidden (teacher explicitly cleared it)
//   any other → literal text
function labelFor(raw: unknown, auto: string): string | null {
  if (raw === undefined || raw === null) return auto;
  const s = String(raw);
  if (s.trim() === "") return null;
  return s;
}

const DASH_MAP: Record<string, string | undefined> = {
  solid: undefined, dashed: "6 4", dotted: "1 3",
};

export function ComponentOverlay({ components, nodes, showLineLabels = true }: Props) {
  const { unitsPerPixel } = useLabelScale();
  if (!nodes) return null;
  // Collect placed label AABBs (in SVG units) for simple label-vs-label
  // collision avoidance. Each renderer nudges its label along its normal
  // when a collision is detected.
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const collides = (x: number, y: number, w: number, h: number) =>
    placed.some(r => Math.abs(r.x - x) < (r.w + w) / 2 && Math.abs(r.y - y) < (r.h + h) / 2);

  // Dedupe angles: only render one arc/label per corner triple (a,v,c).
  // Signature normalises (a,c) order so ∠avc and ∠cva collapse.
  const seenAngleCorners = new Set<string>();

  return (
    <g style={{ pointerEvents: "none" }}>
      {components.map(c => {
        const vis = c.behaviour?.visible !== false;
        if (c.kind === "line" && c.nodes?.length === 2) {
          const a = nodes[c.nodes[0]]; const b = nodes[c.nodes[1]];
          if (!a || !b) return null;
          const ap = c.appearance ?? {};
          const unit = c.content?.unit ?? "";
          const showLabel = c.content?.showLabel !== false;
          const showLength = c.content?.showLength !== false;
          const labelStr = typeof c.content?.label === "string" ? c.content!.label!.trim() : "";
          const lengthAuto = formatLen(dist(a, b)) + (unit ? ` ${unit}` : "");
          // Legacy: content.value overrides length text.
          const rawValue = c.content?.value;
          const lengthStr =
            rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== ""
              ? String(rawValue)
              : lengthAuto;
          const parts: string[] = [];
          if (showLabel && labelStr !== "") parts.push(labelStr);
          if (showLength) parts.push(lengthStr);
          const centre = mid(a, b);
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const length = Math.hypot(dx, dy) || 1;
          const centroidPts: { x: number; y: number }[] = [];
          for (const other of components) {
            if (other.kind === "line" && other.nodes?.length === 2) {
              const oa = nodes[other.nodes[0]]; const ob = nodes[other.nodes[1]];
              if (oa && ob) { centroidPts.push(oa); centroidPts.push(ob); }
            }
          }
          const cx = centroidPts.length ? centroidPts.reduce((s, p) => s + p.x, 0) / centroidPts.length : centre.x;
          const cy = centroidPts.length ? centroidPts.reduce((s, p) => s + p.y, 0) / centroidPts.length : centre.y;
          const nx = -dy / length; const ny = dx / length;
          const outward = ((centre.x - cx) * nx + (centre.y - cy) * ny) >= 0 ? 1 : -1;
          const thickness = ap.thickness ?? 2;
          const style = labelStyleFor(c);
          const fontSvg = style.fontPx * unitsPerPixel;
          const strokeSvg = 2 * unitsPerPixel;
          // Perpendicular offset from the line. Auto keeps a fixed on-screen
          // gap (PAD_PX + line thickness) so labels never sit on the line.
          const autoOffsetSvg = ((style.offsetPx ?? (PAD_PX + fontSvg / unitsPerPixel * 0.6)) * unitsPerPixel)
            + thickness * unitsPerPixel;
          // Position override maps to a signed direction along ±normal.
          let sideSign = outward;
          if (style.position === "above") sideSign = ny > 0 ? -1 : 1;
          else if (style.position === "below") sideSign = ny > 0 ? 1 : -1;
          else if (style.position === "left") sideSign = nx > 0 ? -1 : 1;
          else if (style.position === "right") sideSign = nx > 0 ? 1 : -1;
          let label = { x: centre.x + nx * autoOffsetSvg * sideSign, y: centre.y + ny * autoOffsetSvg * sideSign };
          // Estimate label bbox and nudge if it collides with another label.
          const lineText = parts.join(" ");
          const bboxW = Math.max(1, lineText.length) * fontSvg * 0.55;
          const bboxH = fontSvg * 1.1 * Math.max(1, parts.length);
          if (style.position === undefined) {
            let tries = 0;
            while (collides(label.x, label.y, bboxW, bboxH) && tries < 4) {
              const step = (6 * unitsPerPixel) * (tries + 1);
              label = { x: label.x + nx * step * sideSign, y: label.y + ny * step * sideSign };
              tries++;
            }
          }
          if (parts.length > 0) placed.push({ x: label.x, y: label.y, w: bboxW, h: bboxH });
          return (
            <g key={c.id}>
              {!vis ? (
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="hsl(var(--background))" strokeWidth={4} />
              ) : (
                (ap.color && ap.color !== "currentColor") ||
                (ap.thickness && ap.thickness !== 2) ||
                (ap.dash && ap.dash !== "solid") ? (
                  <>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke="hsl(var(--background))" strokeWidth={(ap.thickness ?? 2) + 2} />
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={ap.color ?? "currentColor"}
                      strokeWidth={ap.thickness ?? 2}
                      strokeDasharray={DASH_MAP[ap.dash ?? "solid"]}
                      opacity={ap.opacity ?? 1} />
                  </>
                ) : null
              )}
              {vis && showLineLabels && parts.length > 0 && (
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontSvg}
                  fontWeight={style.weight}
                  fill={style.color}
                  style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: strokeSvg }}
                >
                  {parts.map((t, i) => (
                    <tspan key={i} x={label.x} dy={i === 0 ? 0 : fontSvg * 1.15}>{t}</tspan>
                  ))}
                </text>
              )}
            </g>
          );
        }

        if (c.kind === "angle" && c.nodes?.length === 3) {
          const A = nodes[c.nodes[0]]; const V = nodes[c.nodes[1]]; const C = nodes[c.nodes[2]];
          if (!A || !V || !C || !vis) return null;
          const cornerKey = `${c.nodes[1]}|${[c.nodes[0], c.nodes[2]].sort().join(",")}`;
          if (seenAngleCorners.has(cornerKey)) return null;
          seenAngleCorners.add(cornerKey);
          const ap = c.appearance ?? {};
          const a1 = Math.atan2(A.y - V.y, A.x - V.x);
          const a2 = Math.atan2(C.y - V.y, C.x - V.x);
          // Signed sweep, pick the smaller (interior) direction.
          let delta = a2 - a1;
          while (delta > Math.PI) delta -= 2 * Math.PI;
          while (delta < -Math.PI) delta += 2 * Math.PI;
          const deg = Math.abs(angleAt(A, V, C));
          const isRight = Math.abs(deg - 90) < 1.5;
          // Arc radius stays in SVG units (geometry-scaled). Keep as-is.
          const r = 14;
          const bisector = a1 + delta / 2;
          const style = labelStyleFor(c);
          const fontSvg = style.fontPx * unitsPerPixel;
          const strokeSvg = 2 * unitsPerPixel;
          // Label sits inside the arc by default; flip outside when the
          // sweep is too narrow to fit the number legibly.
          const raw = c.content?.label ?? c.content?.value;
          const auto = `${Math.round(deg)}°`;
          const shown = labelFor(raw, auto);
          const shownStr = shown ?? "";
          const bboxW = Math.max(1, shownStr.length) * fontSvg * 0.55;
          const chordApprox = 2 * r * Math.sin(Math.abs(delta) / 2);
          const forceOutside = style.position === "outside" || (style.position !== "inside" && chordApprox < bboxW * 1.1);
          const labelRadius = forceOutside ? r + fontSvg + (style.offsetPx ?? PAD_PX) * unitsPerPixel
                                           : r - fontSvg * 0.6;
          let labelPos = { x: V.x + Math.cos(bisector) * labelRadius, y: V.y + Math.sin(bisector) * labelRadius };
          // Nudge outward if colliding with another label.
          if (style.position === undefined) {
            let tries = 0;
            while (collides(labelPos.x, labelPos.y, bboxW, fontSvg * 1.1) && tries < 3) {
              const step = (6 * unitsPerPixel) * (tries + 1);
              labelPos = { x: labelPos.x + Math.cos(bisector) * step, y: labelPos.y + Math.sin(bisector) * step };
              tries++;
            }
          }
          if (shown != null) placed.push({ x: labelPos.x, y: labelPos.y, w: bboxW, h: fontSvg * 1.1 });
          const color = ap.color && ap.color !== "currentColor" ? ap.color : style.color;
          if (isRight) {
            // right-angle square
            const s = 9;
            const u1 = { x: Math.cos(a1), y: Math.sin(a1) };
            const u2 = { x: Math.cos(a2), y: Math.sin(a2) };
            const p1 = { x: V.x + u1.x * s, y: V.y + u1.y * s };
            const p2 = { x: V.x + u2.x * s, y: V.y + u2.y * s };
            const p3 = { x: V.x + (u1.x + u2.x) * s, y: V.y + (u1.y + u2.y) * s };
            return (
              <g key={c.id}>
                <polyline points={`${p1.x},${p1.y} ${p3.x},${p3.y} ${p2.x},${p2.y}`}
                  fill="none" stroke={color} strokeWidth={ap.thickness ?? 1.3} />
                {shown != null && shown !== auto && (
                  <text x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="middle"
                    fontSize={fontSvg} fontWeight={style.weight} fill={style.color}
                    style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: strokeSvg }}>
                    {shown}
                  </text>
                )}
              </g>
            );
          }
          const start = { x: V.x + Math.cos(a1) * r, y: V.y + Math.sin(a1) * r };
          const end = { x: V.x + Math.cos(a1 + delta) * r, y: V.y + Math.sin(a1 + delta) * r };
          const sweepFlag = delta > 0 ? 1 : 0;
          const largeArc = Math.abs(delta) > Math.PI ? 1 : 0;
          return (
            <g key={c.id}>
              <path d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${end.x} ${end.y}`}
                fill="none" stroke={color} strokeWidth={ap.thickness ?? 1.3}
                strokeDasharray={DASH_MAP[ap.dash ?? "solid"]} opacity={ap.opacity ?? 1} />
              {shown != null && (
                <text x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="middle"
                  fontSize={fontSvg} fontWeight={style.weight} fill={style.color}
                  style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: strokeSvg }}>
                  {shown}
                </text>
              )}
            </g>
          );
        }

        if (c.kind === "vertex" && c.nodes?.[0]) {
          const p = nodes[c.nodes[0]]; if (!p) return null;
          if (!vis) return null;
          const ap = c.appearance ?? {};
          if (!ap.color || ap.color === "currentColor") return null;
          return (
            <circle key={c.id} cx={p.x} cy={p.y} r={2.4} fill={ap.color} />
          );
        }
        if (c.kind === "circle" && c.nodes?.length === 2) {
          const cen = nodes[c.nodes[0]]; const r = nodes[c.nodes[1]];
          if (!cen || !r || !vis) return null;
          const ap = c.appearance ?? {};
          const radius = Math.hypot(r.x - cen.x, r.y - cen.y);
          return (
            <circle key={c.id} cx={cen.x} cy={cen.y} r={radius}
              fill="none"
              stroke={ap.color ?? "currentColor"}
              strokeWidth={ap.thickness ?? 1.5}
              strokeDasharray={DASH_MAP[ap.dash ?? "solid"]}
              opacity={ap.opacity ?? 1} />
          );
        }
        if (c.kind === "arc" && c.nodes?.length === 3) {
          const a = nodes[c.nodes[0]]; const m = nodes[c.nodes[1]]; const b = nodes[c.nodes[2]];
          if (!a || !m || !b || !vis) return null;
          const ap = c.appearance ?? {};
          // Circle through 3 points.
          const d = 2 * (a.x * (m.y - b.y) + m.x * (b.y - a.y) + b.x * (a.y - m.y));
          if (Math.abs(d) < 1e-6) {
            return <polyline key={c.id} points={`${a.x},${a.y} ${m.x},${m.y} ${b.x},${b.y}`}
              fill="none" stroke={ap.color ?? "currentColor"} strokeWidth={ap.thickness ?? 1.5}
              strokeDasharray={DASH_MAP[ap.dash ?? "solid"]} opacity={ap.opacity ?? 1} />;
          }
          const ux = ((a.x ** 2 + a.y ** 2) * (m.y - b.y) + (m.x ** 2 + m.y ** 2) * (b.y - a.y) + (b.x ** 2 + b.y ** 2) * (a.y - m.y)) / d;
          const uy = ((a.x ** 2 + a.y ** 2) * (b.x - m.x) + (m.x ** 2 + m.y ** 2) * (a.x - b.x) + (b.x ** 2 + b.y ** 2) * (m.x - a.x)) / d;
          const R = Math.hypot(a.x - ux, a.y - uy);
          const angA = Math.atan2(a.y - uy, a.x - ux);
          const angB = Math.atan2(b.y - uy, b.x - ux);
          const angM = Math.atan2(m.y - uy, m.x - ux);
          // Determine sweep so path passes through m.
          const norm = (x: number) => (x + 2 * Math.PI) % (2 * Math.PI);
          const arcContains = (start: number, end: number, sweep: 1 | 0) => {
            const s = norm(start); const e = norm(end); const p = norm(angM);
            if (sweep === 1) {
              return s < e ? p >= s && p <= e : p >= s || p <= e;
            }
            return s > e ? p <= s && p >= e : p <= s || p >= e;
          };
          let sweep: 1 | 0 = 1;
          if (!arcContains(angA, angB, sweep)) sweep = 0;
          const delta = Math.abs(angB - angA);
          const largeArc = delta > Math.PI ? 1 : 0;
          const path = `M ${a.x} ${a.y} A ${R} ${R} 0 ${largeArc} ${sweep} ${b.x} ${b.y}`;
          return (
            <path key={c.id} d={path} fill="none"
              stroke={ap.color ?? "currentColor"} strokeWidth={ap.thickness ?? 1.5}
              strokeDasharray={DASH_MAP[ap.dash ?? "solid"]} opacity={ap.opacity ?? 1} />
          );
        }
        return null;
      })}
    </g>
  );
}
