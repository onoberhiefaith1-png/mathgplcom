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
}

const STROKE = "#1f1f24";
const ACCENT_ADD = "#10b981";
const ACCENT_CHG = "#f59e0b";
const ACCENT_DEL = "#ef4444";
const LABEL_FONT = "'Times New Roman', Georgia, serif";

export function GeometryDiagram({ scene, diff, large, className }: Props) {
  const pad = 24;
  const W = (scene.bounds.width ?? 360) + pad * 2;
  const H = (scene.bounds.height ?? 240) + pad * 2;
  const displayW = large ? Math.min(W * 1.4, 720) : Math.min(W, 520);

  const colourOf = (id: string): string => {
    if (!diff) return STROKE;
    if (diff.added.has(id)) return ACCENT_ADD;
    if (diff.changed.has(id)) return ACCENT_CHG;
    if (diff.removed.has(id)) return ACCENT_DEL;
    return STROKE;
  };

  const elements = useMemo(() => {
    const out: React.ReactNode[] = [];
    // Two passes: shapes first (so labels sit on top), then points + labels.
    for (const o of scene.objects) {
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
      height={(displayW / W) * H}
      className={className}
      style={{ background: "white", borderRadius: 6 }}
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
      return (
        <g key={p.id}>
          <circle cx={x} cy={y} r={2.4} fill={stroke} />
          {p.label && (
            <text
              x={x + labelDx}
              y={y + labelDy}
              fontFamily={LABEL_FONT}
              fontStyle="italic"
              fontSize={14}
              fill={stroke}
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
      // Perpendicular unit
      const nx = -dy / len, ny = dx / len;
      const marks: React.ReactNode[] = [];
      if (o.marks === "tick" || o.marks === "double" || o.marks === "triple") {
        const count = o.marks === "tick" ? 1 : o.marks === "double" ? 2 : 3;
        const spacing = 4;
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * spacing;
          const cx = mx + (dx / len) * offset;
          const cy = my + (dy / len) * offset;
          marks.push(
            <line
              key={`m${i}`}
              x1={cx + nx * 5} y1={cy + ny * 5}
              x2={cx - nx * 5} y2={cy - ny * 5}
              stroke={stroke} strokeWidth={sw}
            />,
          );
        }
      }
      if (o.marks === "right") {
        // Small square at point A
        const s = 9;
        const ux = dx / len, uy = dy / len;
        const p1x = x1 + ux * s, p1y = y1 + uy * s;
        const p2x = p1x + nx * s, p2y = p1y + ny * s;
        const p3x = x1 + nx * s, p3y = y1 + ny * s;
        marks.push(
          <polyline
            key="rt"
            points={`${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`}
            fill="none" stroke={stroke} strokeWidth={sw}
          />,
        );
      }
      return (
        <g key={o.id}>
          <line
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={stroke} strokeWidth={sw}
            strokeDasharray={o.dashed ? "4 3" : undefined}
            strokeLinecap="round"
          />
          {marks}
          {o.label && (
            <text
              x={mx + nx * 14} y={my + ny * 14}
              fontFamily={LABEL_FONT} fontSize={13}
              fill={stroke} textAnchor="middle"
            >
              {o.label}
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
      const large = Math.abs(o.to - o.from) > 180 ? 1 : 0;
      const sweep = o.to > o.from ? 0 : 1;
      return (
        <path
          key={o.id}
          d={`M ${x1} ${y1} A ${o.r} ${o.r} 0 ${large} ${sweep} ${x2} ${y2}`}
          fill="none" stroke={stroke} strokeWidth={sw}
          strokeDasharray={o.dashed ? "4 3" : undefined}
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
      const large = Math.abs(diff) > Math.PI ? 1 : 0;
      const sweep = diff > 0 ? 0 : 1;
      const labelAngle = a1 + diff / 2;
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
