// GeometryDiagram — pure SVG renderer for a GeometryScene. Built from
// mathematical objects (points, segments, circles, arcs, angles, labels)
// so the diagram is always editable — never a raster image, never ASCII.

import { useMemo } from "react";
import type {
  GeometryScene,
  GeoObject,
  GeoPoint,
  SceneDiff,
} from "@/lib/geometry/scene";
import { pointById } from "@/lib/geometry/scene";

interface Props {
  scene: GeometryScene;
  /** Optional diff — IDs in these sets get a highlight in the preview. */
  diff?: SceneDiff;
  /** When true, render at 1.4x for the right-hand AI preview panel. */
  large?: boolean;
  className?: string;
  /** Force a specific display size (used by the framed NodeView). */
  explicitWidth?: number;
  explicitHeight?: number;
}

const STROKE = "#1f1f24";
const ACCENT_ADD = "#10b981";
const ACCENT_CHG = "#f59e0b";
const ACCENT_DEL = "#ef4444";
const LABEL_FONT = "'Times New Roman', Georgia, serif";

function renderParallelChevrons(
  out: React.ReactNode[],
  mx: number, my: number,
  dx: number, dy: number, len: number,
  nx: number, ny: number,
  count: number, color: string, sw: number,
) {
  const ux = dx / len, uy = dy / len;
  const spacing = 4;
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * spacing;
    const cx = mx + ux * offset;
    const cy = my + uy * offset;
    out.push(
      <polyline
        key={`pa${i}`}
        points={`${cx - ux * 4 - nx * 3},${cy - uy * 4 - ny * 3} ${cx + ux * 4},${cy + uy * 4} ${cx - ux * 4 + nx * 3},${cy - uy * 4 + ny * 3}`}
        fill="none" stroke={color} strokeWidth={sw}
      />,
    );
  }
}

export function GeometryDiagram({ scene, diff, large, className, explicitWidth, explicitHeight }: Props) {
  const pad = 24;
  const W = (scene.bounds.width ?? 360) + pad * 2;
  const H = (scene.bounds.height ?? 240) + pad * 2;
  const displayW = explicitWidth ?? (large ? Math.min(W * 1.4, 720) : Math.min(W, 520));
  const displayH = explicitHeight ?? (displayW / W) * H;

  const colourOf = (id: string): string => {
    if (!diff) return STROKE;
    if (diff.added.has(id)) return ACCENT_ADD;
    if (diff.changed.has(id)) return ACCENT_CHG;
    if (diff.removed.has(id)) return ACCENT_DEL;
    return STROKE;
  };

  const elements = useMemo(() => {
    const out: React.ReactNode[] = [];
    // Regions first (they paint the interior fill behind all ink).
    for (const o of scene.objects) {
      if (o.type !== "region") continue;
      const node = renderObject(o, scene, colourOf(o.id), pad);
      if (node) out.push(node);
    }
    // Everything else on top so lines/labels remain crisp.
    for (const o of scene.objects) {
      if (o.type === "region") continue;
      const c = colourOf(o.id);
      const node = renderObject(o, scene, c, pad);
      if (node) out.push(node);
    }
    return out;
  }, [scene, diff]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={displayW}
      height={displayH}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ background: "transparent" }}
    >
      <g>{elements}</g>
    </svg>
  );
}

function renderObject(
  o: GeoObject,
  scene: GeometryScene,
  stroke: string,
  pad: number,
): React.ReactNode {
  const sw = 1.4;
  switch (o.type) {
    case "point": {
      const p = o as GeoPoint;
      if (p.hidden) return null;
      const x = p.x + pad;
      const y = p.y + pad;
      const labelDx = p.labelOffset?.dx ?? 6;
      const labelDy = p.labelOffset?.dy ?? -6;
      const color = p.color ?? stroke;
      const r = p.size ?? 2.6;
      return (
        <g key={p.id}>
          <circle cx={x} cy={y} r={r} fill={color} />
          {p.label && (
            <text
              x={x + labelDx}
              y={y + labelDy}
              fontFamily={LABEL_FONT}
              fontStyle="italic"
              fontSize={p.labelFontSize ?? 14}
              fill={color}
            >
              {p.label}
            </text>
          )}
        </g>
      );
    }
    case "segment": {
      const a = pointById(scene, o.a);
      const b = pointById(scene, o.b);
      if (!a || !b) return null;
      const x1 = a.x + pad, y1 = a.y + pad, x2 = b.x + pad, y2 = b.y + pad;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const color = (o as any).color ?? stroke;
      const dashArr =
        o.dashed === true ? "4 3"
          : o.dashed === "dotted" ? "1 3"
          : undefined;
      const marks: React.ReactNode[] = [];
      // Equality ticks (perpendicular strokes)
      const eqCount = o.marks === "tick" ? 1
        : o.marks === "double" ? 2
        : o.marks === "triple" ? 3
        : o.marks === "quadruple" ? 4 : 0;
      if (eqCount > 0) {
        const spacing = 4;
        for (let i = 0; i < eqCount; i++) {
          const offset = (i - (eqCount - 1) / 2) * spacing;
          const cx = mx + (dx / len) * offset;
          const cy = my + (dy / len) * offset;
          marks.push(
            <line key={`m${i}`}
              x1={cx + nx * 5} y1={cy + ny * 5}
              x2={cx - nx * 5} y2={cy - ny * 5}
              stroke={color} strokeWidth={sw}
            />,
          );
        }
      }
      if (o.marks === "right") {
        const s = 9;
        const ux = dx / len, uy = dy / len;
        const p1x = x1 + ux * s, p1y = y1 + uy * s;
        const p2x = p1x + nx * s, p2y = p1y + ny * s;
        const p3x = x1 + nx * s, p3y = y1 + ny * s;
        marks.push(
          <polyline key="rt"
            points={`${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`}
            fill="none" stroke={color} strokeWidth={sw}
          />,
        );
      }
      // Legacy parallel marks via `marks`
      if (o.marks === "parallel" || o.marks === "double-parallel" || o.marks === "triple-parallel") {
        const count = o.marks === "parallel" ? 1 : o.marks === "double-parallel" ? 2 : 3;
        renderParallelChevrons(marks, mx, my, dx, dy, len, nx, ny, count, color, sw);
      }
      // New independent parallel-marks
      const parGroup = (o as any).parallelMarks as number | undefined;
      if (parGroup && parGroup > 0) {
        renderParallelChevrons(marks, mx, my, dx, dy, len, nx, ny, parGroup, color, sw);
      }
      // Arrows
      const arrow = (o as any).arrow as "none" | "start" | "end" | "both" | undefined;
      const arrowNodes: React.ReactNode[] = [];
      if (arrow && arrow !== "none") {
        const ux = dx / len, uy = dy / len;
        const size = 8;
        if (arrow === "end" || arrow === "both") {
          arrowNodes.push(
            <polyline key="ah-e"
              points={`${x2 - ux * size + nx * size * 0.55},${y2 - uy * size + ny * size * 0.55} ${x2},${y2} ${x2 - ux * size - nx * size * 0.55},${y2 - uy * size - ny * size * 0.55}`}
              fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round"
            />,
          );
        }
        if (arrow === "start" || arrow === "both") {
          arrowNodes.push(
            <polyline key="ah-s"
              points={`${x1 + ux * size + nx * size * 0.55},${y1 + uy * size + ny * size * 0.55} ${x1},${y1} ${x1 + ux * size - nx * size * 0.55},${y1 + uy * size - ny * size * 0.55}`}
              fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round"
            />,
          );
        }
      }
      // Label position
      const lblOff = (o as any).labelOffset as { dx: number; dy: number } | undefined;
      const lblX = lblOff ? mx + lblOff.dx : mx + nx * 14;
      const lblY = lblOff ? my + lblOff.dy : my + ny * 14;
      // Distance (preferred) or legacy length
      const distText = (o as any).distance ?? o.length;
      const distOff = (o as any).distanceOffset as { dx: number; dy: number } | undefined;
      const distX = distOff ? mx + distOff.dx : mx - nx * 14;
      const distY = distOff ? my + distOff.dy : my - ny * 14;
      return (
        <g key={o.id}>
          <line
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color} strokeWidth={sw}
            strokeDasharray={dashArr}
            strokeLinecap="round"
          />
          {arrowNodes}
          {marks}
          {o.label && (
            <text x={lblX} y={lblY}
              fontFamily={LABEL_FONT} fontSize={13}
              fill={color} textAnchor="middle"
            >
              {o.label}
            </text>
          )}
          {distText && (
            <text x={distX} y={distY}
              fontFamily={LABEL_FONT} fontSize={12}
              fill={color} textAnchor="middle"
            >
              {distText}
            </text>
          )}
        </g>
      );
    }
    case "line":
    case "ray": {
      const a = pointById(scene, o.a);
      const b = pointById(scene, o.b);
      if (!a || !b) return null;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const big = 2000;
      const x1 = a.x + pad - (o.type === "line" ? ux * big : 0);
      const y1 = a.y + pad - (o.type === "line" ? uy * big : 0);
      const x2 = b.x + pad + ux * big;
      const y2 = b.y + pad + uy * big;
      return (
        <line
          key={o.id}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={stroke} strokeWidth={sw}
          strokeDasharray={o.dashed ? "4 3" : undefined}
        />
      );
    }
    case "circle": {
      const c = pointById(scene, o.center);
      if (!c) return null;
      return (
        <g key={o.id}>
          <circle
            cx={c.x + pad} cy={c.y + pad} r={o.r}
            fill="none" stroke={stroke} strokeWidth={sw}
            strokeDasharray={o.dashed ? "4 3" : undefined}
          />
          {o.label && (
            <text
              x={c.x + pad + o.r + 4} y={c.y + pad - o.r - 4}
              fontFamily={LABEL_FONT} fontSize={13} fill={stroke}
            >
              {o.label}
            </text>
          )}
        </g>
      );
    }
    case "arc": {
      const c = pointById(scene, o.center);
      if (!c) return null;
      const cx = c.x + pad, cy = c.y + pad;
      const a1 = (o.from * Math.PI) / 180;
      const a2 = (o.to * Math.PI) / 180;
      const x1 = cx + Math.cos(a1) * o.r;
      const y1 = cy - Math.sin(a1) * o.r;
      const x2 = cx + Math.cos(a2) * o.r;
      const y2 = cy - Math.sin(a2) * o.r;
      // Draw the CCW-in-math sweep from `from` to `to`. In SVG's y-down
      // coordinate system, CCW-math corresponds to sweep-flag=0.
      let delta = o.to - o.from;
      while (delta <= 0) delta += 360;
      while (delta > 360) delta -= 360;
      const large = delta > 180 ? 1 : 0;
      const sweep = 0;
      return (
        <path
          key={o.id}
          d={`M ${x1} ${y1} A ${o.r} ${o.r} 0 ${large} ${sweep} ${x2} ${y2}`}
          fill="none" stroke={stroke} strokeWidth={sw}
          strokeDasharray={o.dashed ? "4 3" : undefined}
        />
      );
    }
    case "curve": {
      const pts = o.points
        .map((id) => pointById(scene, id))
        .filter((p): p is GeoPoint => !!p);
      if (pts.length < 2) return null;
      const d = catmullRomPath(pts.map((p) => ({ x: p.x + pad, y: p.y + pad })));
      return (
        <path
          key={o.id}
          d={d}
          fill="none" stroke={stroke} strokeWidth={sw}
          strokeDasharray={o.dashed ? "4 3" : undefined}
          strokeLinecap="round"
        />
      );
    }
    case "angle": {
      const v = pointById(scene, o.vertex);
      const a = pointById(scene, o.a);
      const b = pointById(scene, o.b);
      if (!v || !a || !b) return null;
      const cx = v.x + pad, cy = v.y + pad;
      const a1 = Math.atan2(-(a.y - v.y), a.x - v.x);
      const a2 = Math.atan2(-(b.y - v.y), b.x - v.x);
      const r = 18;
      if (o.marker === "right") {
        const u1x = Math.cos(a1), u1y = -Math.sin(a1);
        const u2x = Math.cos(a2), u2y = -Math.sin(a2);
        const s = 12;
        return (
          <polyline
            key={o.id}
            points={`${cx + u1x * s},${cy + u1y * s} ${cx + (u1x + u2x) * s},${cy + (u1y + u2y) * s} ${cx + u2x * s},${cy + u2y * s}`}
            fill="none" stroke={stroke} strokeWidth={sw}
          />
        );
      }
      const x1 = cx + Math.cos(a1) * r, y1 = cy - Math.sin(a1) * r;
      const x2 = cx + Math.cos(a2) * r, y2 = cy - Math.sin(a2) * r;
      let diff = a2 - a1;
      while (diff <= -Math.PI) diff += 2 * Math.PI;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      let large = Math.abs(diff) > Math.PI ? 1 : 0;
      let sweep = diff > 0 ? 0 : 1;
      // Reflex flips to the opposite side of the vertex.
      if ((o as any).reflex) {
        large = 1 - large;
        sweep = 1 - sweep;
      }
      const labelAngle = (o as any).reflex ? a1 + diff / 2 + Math.PI : a1 + diff / 2;
      const lx = cx + Math.cos(labelAngle) * (r + 12);
      const ly = cy - Math.sin(labelAngle) * (r + 12);
      return (
        <g key={o.id}>
          <path
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`}
            fill="none" stroke={stroke} strokeWidth={sw}
          />
          {o.marker === "double" && (
            <path
              d={`M ${cx + Math.cos(a1) * (r - 4)} ${cy - Math.sin(a1) * (r - 4)} A ${r - 4} ${r - 4} 0 ${large} ${sweep} ${cx + Math.cos(a2) * (r - 4)} ${cy - Math.sin(a2) * (r - 4)}`}
              fill="none" stroke={stroke} strokeWidth={sw}
            />
          )}
          {o.value && (
            <text
              x={lx} y={ly}
              fontFamily={LABEL_FONT} fontSize={12}
              fill={stroke} textAnchor="middle" dominantBaseline="middle"
            >
              {o.value}
            </text>
          )}
        </g>
      );
    }
    case "polygon": {
      const pts = o.points
        .map((id) => pointById(scene, id))
        .filter((p): p is GeoPoint => !!p)
        .map((p) => `${p.x + pad},${p.y + pad}`)
        .join(" ");
      if (!pts) return null;
      return (
        <polygon
          key={o.id}
          points={pts}
          fill={o.fill ?? "none"}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      );
    }
    case "label": {
      return (
        <text
          key={o.id}
          x={o.x + pad} y={o.y + pad}
          fontFamily={LABEL_FONT} fontSize={13}
          fill={stroke} textAnchor="middle"
        >
          {o.text}
        </text>
      );
    }
  }
  return null;
}

/** Catmull-Rom -> cubic Bezier smooth path through the given points. */
function catmullRomPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  const p = pts;
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}
