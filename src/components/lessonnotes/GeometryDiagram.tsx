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
import { regionEdgesToPath } from "@/lib/geometry/editor/boundary";

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
  /**
   * Default ink for every object that has no explicit colour. Defaults to the
   * lesson-note dark ink; the Smartboard passes its current writing colour so
   * the diagram reads as if drawn straight onto the board.
   */
  stroke?: string;
  /**
   * Minimum logical view size. The Smartboard's transparent drawing layer
   * passes its measured workspace so the drawing area spans the whole board
   * even when the scene itself is still small.
   */
  minViewW?: number;
  minViewH?: number;
  /**
   * Draw hidden points as faint "ghost" markers instead of omitting them.
   * The live editing canvas turns this on so a teacher can still see, select
   * and un-hide construction points that the clean-up pass hid.
   */
  /** Crop empty notebook canvas and strengthen ink for projection. */
  presentation?: boolean;
  /** Crop empty notebook canvas but keep normal lesson-note ink weight. */
  crop?: boolean;
  /**
   * Review highlighting: object ids drawn in the review accent. Used by the
   * Smartboard's Review Properties panel — never by the editing canvas.
   */
  highlightIds?: string[];
  /**
   * Read-only object picking. When supplied, an invisible hit layer is drawn
   * over the same geometry so clicking reports the object's stable id.
   */
  onPickObject?: (id: string) => void;

}


const STROKE = "#1f1f24";
const ACCENT_ADD = "#10b981";
const ACCENT_CHG = "#f59e0b";
const ACCENT_DEL = "#ef4444";
/** Review Properties highlight — teacher-authored relationship focus. */
const ACCENT_REVIEW = "#2563eb";
const LABEL_FONT = "'Times New Roman', Georgia, serif";
const TEXT_INK_PROPS = {
  fontWeight: 400,
  stroke: "none",
  strokeWidth: 0,
  paintOrder: "normal" as const,
};

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

/**
 * Shared coordinate system for the diagram and its interaction layer.
 * Both must use the same viewBox W/H and translate(-minX,-minY) so that
 * pointer positions map to the exact rendered coordinates.
 */
export function computeSceneViewBox(scene: GeometryScene, pad = 24) {
  const ext = computeSceneExtent(scene);
  const minX = Math.min(0, ext.minX);
  const minY = Math.min(0, ext.minY);
  const maxX = Math.max(scene.bounds.width ?? 360, ext.maxX);
  const maxY = Math.max(scene.bounds.height ?? 240, ext.maxY);
  const W = (maxX - minX) + pad * 2;
  const H = (maxY - minY) + pad * 2;
  return { minX, minY, maxX, maxY, W, H, pad };
}

export function GeometryDiagram({ scene, diff, large, className, explicitWidth, explicitHeight, stroke, minViewW, minViewH, presentation = false, crop = false, highlightIds, onPickObject }: Props) {
  const baseStroke = stroke ?? STROKE;
  const pad = 24;
  const cropped = presentation || crop;
  // Grow the viewBox to fit any object that extends past scene.bounds so
  // nothing gets clipped — the whole lesson note is the drawing paper.
  const vb = computeSceneViewBox(scene, pad);
  const occupied = computeSceneExtent(scene);
  const minX = cropped ? occupied.minX : vb.minX;
  const minY = cropped ? occupied.minY : vb.minY;
  const occupiedW = Math.max(1, occupied.maxX - occupied.minX);
  const occupiedH = Math.max(1, occupied.maxY - occupied.minY);
  const W = cropped ? occupiedW + pad * 2 : Math.max(vb.W, minViewW ?? 0);
  const H = cropped ? occupiedH + pad * 2 : Math.max(vb.H, minViewH ?? 0);
  const displayW = explicitWidth ?? (presentation ? Math.min(Math.max(W * 1.35, 420), 860) : large ? Math.min(W * 1.4, 720) : Math.min(W, 520));
  const displayH = explicitHeight ?? (displayW / W) * H;

  // Examination-textbook ink: the figure must never look heavier than the
  // numbers beside it. The SVG is scaled to fit, which would multiply the
  // stroke, so the weight is divided back out to land at ~1.1px on screen.
  const displayScale = W > 0 ? displayW / W : 1;
  const inkWeight = (presentation ? 2 : 1.1) / (displayScale || 1);

  const highlight = useMemo(
    () => new Set((highlightIds ?? []).filter(Boolean)),
    [highlightIds],
  );

  const colourOf = (id: string): string => {
    if (highlight.has(id)) return ACCENT_REVIEW;
    if (!diff) return baseStroke;
    if (diff.added.has(id)) return ACCENT_ADD;
    if (diff.changed.has(id)) return ACCENT_CHG;
    if (diff.removed.has(id)) return ACCENT_DEL;
    return baseStroke;
  };

  const originPad = pad; // objects rendered with local pad; wrapper <g> translates
  const translateX = cropped ? pad - minX : -minX;
  const translateY = cropped ? pad - minY : -minY;


  const elements = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (const o of scene.objects) {
      if (o.type !== "region") continue;
      const node = renderObject(o, scene, colourOf(o.id), originPad, inkWeight);
      if (node) out.push(node);
    }
    for (const o of scene.objects) {
      if (o.type === "region") continue;
      const c = colourOf(o.id);
      // A hidden point is HIDDEN — never a faint ghost mark. Translucent
      // stand-ins were the source of the leftover slash/line artifacts seen
      // after deleting, moving or hiding an object.
      if (o.type === "point" && (o as GeoPoint).hidden) continue;

      const node = renderObject(o, scene, c, originPad, inkWeight);
      if (node) out.push(node);
    }
    return out;
  }, [scene, diff, originPad, baseStroke, inkWeight, highlight]);

  // Review halo: a soft glow behind every highlighted object so a lit angle or
  // side reads instantly from the back of the classroom.
  const halo = useMemo(() => {
    if (highlight.size === 0) return null;
    const out: React.ReactNode[] = [];
    for (const o of scene.objects) {
      if (!highlight.has(o.id)) continue;
      const node = renderObject(o, scene, ACCENT_REVIEW, originPad, inkWeight * 4.5);
      if (node) out.push(<g key={`halo-${o.id}`} opacity={0.22}>{node}</g>);
    }
    return out;
  }, [scene, highlight, originPad, inkWeight]);

  const hits = useMemo(() => {
    if (!onPickObject) return null;
    return buildHitLayer(scene, originPad, inkWeight, onPickObject);
  }, [scene, originPad, inkWeight, onPickObject]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={displayW}
      height={displayH}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ background: "transparent", overflow: "visible" }}
    >
      <g transform={`translate(${translateX}, ${translateY})`}>
        {halo}
        {elements}
        {hits}
      </g>
    </svg>
  );
}

/**
 * Invisible click targets over the SAME objects the figure already draws, each
 * carrying its stable object id. Read-only surfaces (Smartboard review) use
 * this to pick geometry without a second geometry engine.
 */
function buildHitLayer(
  scene: GeometryScene,
  pad: number,
  ink: number,
  onPick: (id: string) => void,
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const grab = Math.max(6, ink * 6);
  const common = (id: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      onPick(id);
    },
    style: { pointerEvents: "all" as const },
  });

  // Points last (drawn on top) so a vertex wins over the sides through it.
  const ordered = [...scene.objects].sort((a, b) => rank(a.type) - rank(b.type));
  for (const o of ordered) {
    switch (o.type) {
      case "segment":
      case "line":
      case "ray": {
        const a = pointById(scene, (o as GeoSegmentLike).a);
        const b = pointById(scene, (o as GeoSegmentLike).b);
        if (!a || !b) break;
        out.push(
          <line
            key={`hit-${o.id}`}
            x1={a.x + pad} y1={a.y + pad} x2={b.x + pad} y2={b.y + pad}
            stroke="transparent" strokeWidth={grab * 1.6} strokeLinecap="round"
            {...common(o.id)}
          />,
        );
        break;
      }
      case "circle":
      case "arc": {
        const c = pointById(scene, (o as { center: string }).center);
        const r = (o as { r: number }).r;
        if (!c || !(r > 0)) break;
        out.push(
          <circle
            key={`hit-${o.id}`}
            cx={c.x + pad} cy={c.y + pad} r={r}
            fill="none" stroke="transparent" strokeWidth={grab * 1.6}
            {...common(o.id)}
          />,
        );
        break;
      }
      case "angle": {
        const v = pointById(scene, (o as { vertex: string }).vertex);
        if (!v) break;
        const r = ((o as { arcRadius?: number }).arcRadius ?? 18) + grab;
        out.push(
          <circle
            key={`hit-${o.id}`}
            cx={v.x + pad} cy={v.y + pad} r={r}
            fill="transparent" stroke="none"
            {...common(o.id)}
          />,
        );
        break;
      }
      case "region": {
        const reg = o as { boundary: string[]; edges?: never };
        const path = regionEdgesToPath(scene, reg.boundary, reg.edges, pad);

        if (!path) break;
        out.push(
          <path key={`hit-${o.id}`} d={path} fill="transparent" stroke="none" {...common(o.id)} />,
        );
        break;
      }
      case "label": {
        const l = o as { x: number; y: number; fontSize?: number };
        const s = (l.fontSize ?? 13) + grab;
        out.push(
          <rect
            key={`hit-${o.id}`}
            x={l.x + pad - s} y={l.y + pad - s} width={s * 2} height={s * 2}
            fill="transparent" stroke="none"
            {...common(o.id)}
          />,
        );
        break;
      }
      case "point": {
        const p = o as GeoPoint;
        if (p.hidden) break;
        out.push(
          <circle
            key={`hit-${o.id}`}
            cx={p.x + pad} cy={p.y + pad} r={Math.max(grab, (p.size ?? 2.6) + grab)}
            fill="transparent" stroke="none"
            {...common(o.id)}
          />,
        );
        break;
      }
      default:
        break;
    }
  }
  return out;
}

type GeoSegmentLike = { a: string; b: string };

function rank(type: string): number {
  if (type === "region") return 0;
  if (type === "circle" || type === "arc" || type === "curve") return 1;
  if (type === "segment" || type === "line" || type === "ray") return 2;
  if (type === "angle") return 3;
  if (type === "label") return 4;
  return 5; // point
}



function computeSceneExtent(scene: GeometryScene): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const consider = (x: number, y: number) => {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  };
  for (const o of scene.objects) {
    if (o.type === "point") consider(o.x, o.y);
    else if (o.type === "label") consider(o.x, o.y);
    else if (o.type === "circle" || o.type === "arc") {
      const c = pointById(scene, o.center);
      if (c) { consider(c.x - o.r, c.y - o.r); consider(c.x + o.r, c.y + o.r); }
    }
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    return { minX: 0, minY: 0, maxX: scene.bounds.width ?? 360, maxY: scene.bounds.height ?? 240 };
  }
  return { minX, minY, maxX, maxY };
}


function renderObject(
  o: GeoObject,
  scene: GeometryScene,
  stroke: string,
  pad: number,
  ink = 1.1,
): React.ReactNode {
  /** Construction lines. */
  const sw = ink;
  /** Ticks, angle arcs and parallel chevrons sit one step lighter. */
  const swMark = Math.max(0.5, ink * 0.85);
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
              {...TEXT_INK_PROPS}
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
        renderParallelChevrons(marks, mx, my, dx, dy, len, nx, ny, count, color, swMark);
      }
      // New independent parallel-marks
      const parGroup = (o as any).parallelMarks as number | undefined;
      if (parGroup && parGroup > 0) {
        renderParallelChevrons(marks, mx, my, dx, dy, len, nx, ny, parGroup, color, swMark);
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
      // Diagram-attached text (right-hand Add Text tool)
      const lineText = (o as any).lineText as string | undefined;
      const ltOff = (o as any).lineTextOffset as { dx: number; dy: number } | undefined;
      const ltX = ltOff ? mx + ltOff.dx : mx + nx * 28;
      const ltY = ltOff ? my + ltOff.dy : my + ny * 28;
      const lineAngleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      const uprightDeg = (() => {
        const norm = (lineAngleDeg + 360) % 360;
        return norm > 90 && norm < 270 ? lineAngleDeg + 180 : lineAngleDeg;
      })();
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
              {...TEXT_INK_PROPS}
              fontFamily={LABEL_FONT} fontSize={13}
              fill={color} textAnchor="middle"
              transform={
                (o as any).labelRotate
                  ? `rotate(${((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 360) % 360 > 90 &&
                      ((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 360) % 360 < 270
                        ? (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 180
                        : (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
                    } ${lblX} ${lblY})`
                  : undefined
              }
            >
              {o.label}
            </text>
          )}
          {distText && (
            <text x={distX} y={distY}
              {...TEXT_INK_PROPS}
              fontFamily={LABEL_FONT} fontSize={(o as any).distanceFontSize ?? 12}
              fill={(o as any).distanceColor ?? color} textAnchor="middle"
            >
              {distText}
            </text>
          )}
          {lineText && (
            <text x={ltX} y={ltY}
              {...TEXT_INK_PROPS}
              fontFamily={LABEL_FONT} fontSize={(o as any).lineTextFontSize ?? 13}
              fill={(o as any).lineTextColor ?? color} textAnchor="middle"
              transform={`rotate(${uprightDeg} ${ltX} ${ltY})`}
            >
              {lineText}
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
            fill={o.fill ?? "none"} fillOpacity={o.fill ? (o.fillOpacity ?? 0.2) : undefined}
            stroke={stroke} strokeWidth={sw}
            strokeDasharray={o.dashed ? "4 3" : undefined}
          />
          {o.label && (
            <text
              {...TEXT_INK_PROPS}
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
          fill={o.fill ?? "none"} fillOpacity={o.fill ? (o.fillOpacity ?? 0.2) : undefined}
          stroke={stroke} strokeWidth={sw}
          strokeDasharray={o.dashed ? "4 3" : undefined}
        />
      );

    }
    case "curve": {
      let d = "";
      if (o.a && o.mid && o.b) {
        // Legacy 3-point quadratic Bezier: (a, mid, b). Control point is
        // chosen so the curve passes through mid: C = 2*mid - (a + b) / 2.
        const pts = [o.a, o.mid, o.b]
          .map((id) => pointById(scene, id))
          .filter((p): p is GeoPoint => !!p);
        if (pts.length < 3) return null;
        const [pa, pm, pb] = pts;
        const cx = 2 * pm.x - (pa.x + pb.x) / 2;
        const cy = 2 * pm.y - (pa.y + pb.y) / 2;
        d = `M ${pa.x + pad} ${pa.y + pad} Q ${cx + pad} ${cy + pad} ${pb.x + pad} ${pb.y + pad}`;
      } else {
        const pts = (o.points ?? [])
          .map((id) => pointById(scene, id))
          .filter((p): p is GeoPoint => !!p);
        if (pts.length < 2) return null;
        d = catmullRomPath(pts.map((p) => ({ x: p.x + pad, y: p.y + pad })));
      }
      return (
        <path
          key={o.id}
          d={d}
          fill={(o as any).fill ?? "none"}
          fillOpacity={(o as any).fill ? ((o as any).fillOpacity ?? 0.2) : undefined}
          stroke={(o as any).color ?? stroke} strokeWidth={sw}
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
      const r = (o as any).arcRadius ?? 18;
      const markStroke = (o as any).markerColor ?? stroke;
      if (o.marker === "right") {
        const u1x = Math.cos(a1), u1y = -Math.sin(a1);
        const u2x = Math.cos(a2), u2y = -Math.sin(a2);
        const s = Math.max(6, r * 0.66);
        return (
          <polyline
            key={o.id}
            points={`${cx + u1x * s},${cy + u1y * s} ${cx + (u1x + u2x) * s},${cy + (u1y + u2y) * s} ${cx + u2x * s},${cy + u2y * s}`}
            fill="none" stroke={markStroke} strokeWidth={swMark}
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
      const baseLx = cx + Math.cos(labelAngle) * (r + 12);
      const baseLy = cy - Math.sin(labelAngle) * (r + 12);
      const vOff = (o as any).valueOffset as { dx: number; dy: number } | undefined;
      const lx = vOff ? baseLx + vOff.dx : baseLx;
      const ly = vOff ? baseLy + vOff.dy : baseLy;
      return (
        <g key={o.id}>
          <path
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`}
            fill="none" stroke={markStroke} strokeWidth={swMark}
          />
          {o.marker === "double" && (
            <path
              d={`M ${cx + Math.cos(a1) * (r - 4)} ${cy - Math.sin(a1) * (r - 4)} A ${r - 4} ${r - 4} 0 ${large} ${sweep} ${cx + Math.cos(a2) * (r - 4)} ${cy - Math.sin(a2) * (r - 4)}`}
              fill="none" stroke={markStroke} strokeWidth={swMark}
            />
          )}
          {o.value && (
            <text
              {...TEXT_INK_PROPS}
              x={lx} y={ly}
              fontFamily={LABEL_FONT} fontSize={(o as any).valueFontSize ?? 12}
              fill={(o as any).valueColor ?? stroke} textAnchor="middle" dominantBaseline="middle"
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
    case "region": {
      // If per-edge geometry references exist, build an SVG path that
      // follows those edges (arcs/circles/curves as well as straight
      // segments). Fall back to the straight-polygon renderer when no
      // edges are stored (legacy regions).
      if (o.edges && o.edges.length === o.boundary.length) {
        const d = regionEdgesToPath(scene, o.boundary, o.edges, pad);
        if (!d) return null;
        return (
          <path
            key={o.id}
            d={d}
            fill={o.fill ?? "#2563eb"}
            fillOpacity={o.opacity ?? 0.2}
            stroke="none"
            fillRule="evenodd"
          />
        );
      }
      const pts = o.boundary
        .map((id) => pointById(scene, id))
        .filter((p): p is GeoPoint => !!p)
        .map((p) => `${p.x + pad},${p.y + pad}`)
        .join(" ");
      if (!pts) return null;
      return (
        <polygon
          key={o.id}
          points={pts}
          fill={o.fill ?? "#2563eb"}
          fillOpacity={o.opacity ?? 0.2}
          stroke="none"
        />
      );
    }
    case "label": {
      const lx = o.x + pad, ly = o.y + pad;
      const rot = o.rotation ?? 0;
      return (
        <text
          {...TEXT_INK_PROPS}
          key={o.id}
          x={lx} y={ly}
          fontFamily={LABEL_FONT} fontSize={o.fontSize ?? 13}
          fontStyle={o.italic ? "italic" : "normal"}
          fill={o.color ?? stroke} textAnchor="middle"
          transform={rot ? `rotate(${rot} ${lx} ${ly})` : undefined}
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
