// GeometryCanvas — renders the scene + an interaction layer that handles
// pointer events for every tool. Coordinates are in scene logical space
// (top-left = 0,0 inside `bounds`, padded by `pad`).

import { useRef, useState, useMemo } from "react";
import type { GeometryScene, GeoPoint, GeoId } from "@/lib/geometry/scene";
import { pointById } from "@/lib/geometry/scene";
import { GeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import { snap, pickObject, pickHit, type SnapTarget, type Hit } from "@/lib/geometry/editor/snap";
import { sampleCatmullRomBetween } from "@/lib/geometry/editor/snap";

import {
  addPoint, addSegment, addCircleByRadius, addCircleAt, addArcThrough3,
  addCircleThrough3, closePolygon, addAngle, midpointOfSegment, eraseObject,
  movePoint, cycleEqualMarks, markParallel, patchObject, addFloatingLabel,
  addCurve,
} from "@/lib/geometry/editor/sceneOps";
import type { ToolId } from "@/lib/geometry/editor/tools";
import type { UseGeometryEditorReturn } from "./useGeometryEditor";

interface Props {
  editor: UseGeometryEditorReturn;
}

const PAD = 24;

export function GeometryCanvas({ editor }: Props) {
  const { scene, tool, apply, commit, pendingIds, setPendingIds, selectedIds, setSelectedIds, setSelectionKind, toggleSelected, flashIds } = editor;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; snap: SnapTarget } | null>(null);
  const [dragging, setDragging] = useState<{ pointId: GeoId } | null>(null);
  const [labelDrag, setLabelDrag] = useState<{ kind: "pointLabel" | "segmentLabel" | "segmentDistance" | "angleValue"; id: GeoId; startX: number; startY: number; baseDx: number; baseDy: number } | null>(null);
  const [circleDrag, setCircleDrag] = useState<{ cx: number; cy: number; r: number } | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ id: GeoId; field: "label" | "value" | "text"; value: string; x: number; y: number } | null>(null);

  const W = scene.bounds.width + PAD * 2;
  const H = scene.bounds.height + PAD * 2;

  const toLogical = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W - PAD,
      y: ((e.clientY - rect.top) / rect.height) * H - PAD,
    };
  };

  /** Find or create a point at (x,y), preferring an existing point via snap. */
  const ensurePoint = (x: number, y: number): { id: GeoId; scene: GeometryScene } => {
    const s = snap(scene, x, y);
    if (s.pointId) return { id: s.pointId, scene };
    const op = addPoint(scene, s.x, s.y);
    apply(op);
    return { id: op.addedIds[0], scene: op.scene };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toLogical(e);
    if (dragging) {
      const op = movePoint(scene, dragging.pointId, p.x, p.y);
      // Move = don't push every move to history; use commit directly without history push.
      // We'll just rapidly call apply (cheap) — the history grows slightly but it's bounded.
      apply(op);
      return;
    }
    if (labelDrag) {
      const dx = labelDrag.baseDx + (p.x - labelDrag.startX);
      const dy = labelDrag.baseDy + (p.y - labelDrag.startY);
      if (labelDrag.kind === "pointLabel") {
        apply(patchObject(scene, labelDrag.id, { labelOffset: { dx, dy } } as any));
      } else if (labelDrag.kind === "segmentLabel") {
        apply(patchObject(scene, labelDrag.id, { labelOffset: { dx, dy } } as any));
      } else if (labelDrag.kind === "segmentDistance") {
        apply(patchObject(scene, labelDrag.id, { distanceOffset: { dx, dy } } as any));
      } else {
        apply(patchObject(scene, labelDrag.id, { valueOffset: { dx, dy } } as any));
      }
      return;
    }
    if (circleDrag) {
      setCircleDrag({ ...circleDrag, r: Math.hypot(p.x - circleDrag.cx, p.y - circleDrag.cy) });
      return;
    }
    const sn = snap(scene, p.x, p.y);
    setHover({ x: p.x, y: p.y, snap: sn });
  };

  const onPointerUp = (_e: React.PointerEvent) => {
    if (dragging) { setDragging(null); return; }
    if (labelDrag) { setLabelDrag(null); return; }
    if (circleDrag) {
      if (circleDrag.r > 4) {
        apply(addCircleAt(scene, circleDrag.cx, circleDrag.cy, circleDrag.r));
      }
      setCircleDrag(null);
      return;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    try { (svgRef.current as any)?.focus?.({ preventScroll: true }); } catch { /* noop */ }
    const p = toLogical(e);
    const sn = snap(scene, p.x, p.y);
    const hit = pickHit(scene, p.x, p.y);
    const rawId = hit?.id ?? null;
    const hitId = rawId ? rawId.split("#")[0] : null;




    switch (tool) {
      case "select": {
        if (hit) {
          // Plain click toggles the item in the selection set.
          // Clicking a different item adds to selection; clicking the same
          // one again removes it. Empty click clears everything.
          const already = selectedIds.includes(hit.id);
          if (already) {
            const next = selectedIds.filter((id) => id !== hit.id);
            setSelectedIds(next);
            setSelectionKind(next.length ? "segmentBody" : null);
          } else {
            setSelectedIds([...selectedIds, hit.id]);
            setSelectionKind(hit.kind);
          }
          // Prime drag state only when a single item is being manipulated.
          const obj = scene.objects.find((o) => o.id === hit.id);
          if (!already && selectedIds.length === 0) {
            if (hit.kind === "point" && obj?.type === "point") {
              setDragging({ pointId: hit.id });
            } else if (hit.kind === "pointLabel" && obj?.type === "point") {
              setLabelDrag({
                kind: "pointLabel", id: hit.id, startX: p.x, startY: p.y,
                baseDx: obj.labelOffset?.dx ?? 6, baseDy: obj.labelOffset?.dy ?? -6,
              });
            } else if (hit.kind === "segmentLabel" && obj?.type === "segment") {
              setLabelDrag({
                kind: "segmentLabel", id: hit.id, startX: p.x, startY: p.y,
                baseDx: obj.labelOffset?.dx ?? 0, baseDy: obj.labelOffset?.dy ?? 0,
              });
            } else if (hit.kind === "segmentDistance" && obj?.type === "segment") {
              setLabelDrag({
                kind: "segmentDistance", id: hit.id, startX: p.x, startY: p.y,
                baseDx: obj.distanceOffset?.dx ?? 0, baseDy: obj.distanceOffset?.dy ?? 0,
              });
            } else if (hit.kind === "angleValue" && obj?.type === "angle") {
              setLabelDrag({
                kind: "angleValue", id: hit.id, startX: p.x, startY: p.y,
                baseDx: (obj as any).valueOffset?.dx ?? 0, baseDy: (obj as any).valueOffset?.dy ?? 0,
              });
            }
          }
        } else {
          setSelectedIds([]);
          setSelectionKind(null);
        }
        break;
      }
      case "move": {
        // Pick a point (or snap to one) and start dragging it
        const target = scene.objects.find((o) => o.type === "point" && Math.hypot(o.x - p.x, o.y - p.y) <= 10) as GeoPoint | undefined;
        if (target) setDragging({ pointId: target.id });
        break;
      }
      case "point": {
        apply(addPoint(scene, sn.x, sn.y));
        break;
      }
      case "line": {
        const { id, scene: s1 } = ensurePoint(p.x, p.y);
        if (pendingIds.length === 0) {
          setPendingIds([id]);
        } else {
          const prev = pendingIds[pendingIds.length - 1];
          if (prev !== id) {
            // Use the latest scene that already has the new point (s1).
            const op = addSegment(s1, prev, id);
            // apply replaces scene with op.scene
            apply(op);
          }
          setPendingIds([...pendingIds, id]);
        }
        break;
      }
      case "polygon": {
        const { id } = ensurePoint(p.x, p.y);
        setPendingIds([...pendingIds, id]);
        break;
      }
      case "circle": {
        // 3-click circle: pick 3 points the circle should pass through.
        // (Points 1 & 3 lie on the circle; point 2 forces the direction it
        // passes through.) Falls back to drag-from-center when the teacher
        // presses and drags on empty space without snapping.
        const created = ensurePoint(p.x, p.y);
        const next = [...pendingIds, created.id];
        if (next.length === 3) {
          apply(addCircleThrough3(created.scene, next[0], next[1], next[2]));
          setPendingIds([]);
        } else {
          setPendingIds(next);
        }
        break;
      }
      case "compass": {
        if (pendingIds.length === 0) {
          const { id } = ensurePoint(p.x, p.y);
          setPendingIds([id]);
        } else {
          const { id, scene: s1 } = ensurePoint(p.x, p.y);
          const op = addCircleByRadius(s1, pendingIds[0], id);
          apply(op);
          setPendingIds([]);
        }
        break;
      }
      case "arc": {
        const { id, scene: s1 } = ensurePoint(p.x, p.y);
        const next = [...pendingIds, id];
        if (next.length === 3) {
          const a = pointById(s1, next[0]);
          const m = pointById(s1, next[1]);
          const b = pointById(s1, next[2]);
          if (a && m && b) apply(addArcThrough3(s1, a, m, b));
          setPendingIds([]);
        } else {
          setPendingIds(next);
        }
        break;
      }
      case "curve": {
        // Continuous smooth curve — like Line but every anchor bends the
        // spline. Each click adds an anchor; double-click / Enter commits
        // the curve; Escape cancels.
        const { id } = ensurePoint(p.x, p.y);
        const next = pendingIds[pendingIds.length - 1] === id
          ? pendingIds
          : [...pendingIds, id];
        setPendingIds(next);
        break;
      }

      case "angle": {
        // Click arm1 point → vertex point → arm2 point
        const { id, scene: s1 } = ensurePoint(p.x, p.y);
        const next = [...pendingIds, id];
        if (next.length === 3) {
          apply(addAngle(s1, next[1], next[0], next[2]));
          setPendingIds([]);
        } else {
          setPendingIds(next);
        }
        break;
      }
      case "midpoint": {
        if (hitId) {
          apply(midpointOfSegment(scene, hitId));
        }
        break;
      }
      case "rightAngle": {
        if (hitId) {
          const obj = scene.objects.find((o) => o.id === hitId);
          if (obj?.type === "angle") {
            apply(patchObject(scene, hitId, { marker: "right" } as any));
          } else if (obj?.type === "segment") {
            apply(patchObject(scene, hitId, { marks: "right" } as any));
          }
        }
        break;
      }
      case "equalMark": {
        if (!hitId) break;
        const next = pendingIds.includes(hitId) ? pendingIds : [...pendingIds, hitId];
        if (next.length >= 2) {
          apply(cycleEqualMarks(scene, next));
          setPendingIds([]);
        } else {
          setPendingIds(next);
        }
        break;
      }
      case "parallel": {
        if (!hitId) break;
        const next = pendingIds.includes(hitId) ? pendingIds : [...pendingIds, hitId];
        if (next.length >= 2) {
          apply(markParallel(scene, next));
          setPendingIds([]);
        } else {
          setPendingIds(next);
        }
        break;
      }
      case "perpendicular": {
        // Pick first segment, then second; mark right at the shared endpoint by adding a right-angle segment mark.
        if (!hitId) break;
        const next = pendingIds.includes(hitId) ? pendingIds : [...pendingIds, hitId];
        if (next.length >= 2) {
          // Tag both segments as right; the renderer draws a small square.
          let s = scene;
          for (const id of next) {
            const o = s.objects.find((x) => x.id === id);
            if (o?.type === "segment") s = patchObject(s, id, { marks: "right" } as any).scene;
          }
          commit(s);
          setPendingIds([]);
        } else {
          setPendingIds(next);
        }
        break;
      }
      case "erase": {
        if (hitId) apply(eraseObject(scene, hitId));
        break;
      }
      case "label": {
        if (hitId) {
          const o = scene.objects.find((x) => x.id === hitId);
          if (!o) break;
          const field: "label" | "value" | "text" =
            o.type === "angle" ? "value"
            : o.type === "label" ? "text"
            : "label";
          const current = (o as any)[field] ?? "";
          setInlineEdit({ id: hitId, field, value: current, x: p.x, y: p.y });
        } else {
          // Add a floating label
          const text = window.prompt("Label text") ?? "";
          if (text) apply(addFloatingLabel(scene, p.x, p.y, text));
        }
        break;
      }
      case "measure": {
        if (!hitId) break;
        const o = scene.objects.find((x) => x.id === hitId);
        if (!o) break;
        if (o.type === "segment") {
          setInlineEdit({ id: hitId, field: "label", value: o.length ?? "", x: p.x, y: p.y });
        } else if (o.type === "angle") {
          setInlineEdit({ id: hitId, field: "value", value: o.value ?? "", x: p.x, y: p.y });
        }
        break;
      }
      default:
        break;
    }
  };

  // Per-shape glow: segment/curve/arc/circle glow along their body,
  // points glow around the dot. Uses a wide, semi-transparent stroke.
  const halos = useMemo(() => {
    const out: React.ReactNode[] = [];
    const glow = (rawId: GeoId, color: string, opacity = 0.35) => {
      const [baseId, subStr] = rawId.split("#");
      const sub = subStr !== undefined ? parseInt(subStr, 10) : -1;
      const o = scene.objects.find((x) => x.id === baseId);
      if (!o) return;
      const id = rawId;

      if (o.type === "point") {
        out.push(
          <circle key={`h-${id}`}
            cx={o.x + PAD} cy={o.y + PAD}
            r={(o.size ?? 2.6) + 5}
            fill={color} opacity={opacity}
          />,
        );
      } else if (o.type === "segment") {
        const a = pointById(scene, o.a); const b = pointById(scene, o.b);
        if (!a || !b) return;
        out.push(
          <line key={`h-${id}`}
            x1={a.x + PAD} y1={a.y + PAD} x2={b.x + PAD} y2={b.y + PAD}
            stroke={color} strokeWidth={10} strokeLinecap="round" opacity={opacity}
          />,
        );
      } else if (o.type === "circle") {
        const c = pointById(scene, o.center); if (!c) return;
        out.push(
          <circle key={`h-${id}`} cx={c.x + PAD} cy={c.y + PAD} r={o.r}
            fill="none" stroke={color} strokeWidth={10} opacity={opacity} />,
        );
      } else if (o.type === "arc") {
        const c = pointById(scene, o.center); if (!c) return;
        const a1 = (o.from * Math.PI) / 180, a2 = (o.to * Math.PI) / 180;
        const x1 = c.x + PAD + Math.cos(a1) * o.r, y1 = c.y + PAD - Math.sin(a1) * o.r;
        const x2 = c.x + PAD + Math.cos(a2) * o.r, y2 = c.y + PAD - Math.sin(a2) * o.r;
        let delta = o.to - o.from; while (delta <= 0) delta += 360;
        const large = delta > 180 ? 1 : 0;
        out.push(
          <path key={`h-${id}`}
            d={`M ${x1} ${y1} A ${o.r} ${o.r} 0 ${large} 0 ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth={10} opacity={opacity} strokeLinecap="round" />,
        );
      } else if (o.type === "curve") {
        let d = "";
        if (o.a && o.mid && o.b) {
          const pts = [o.a, o.mid, o.b].map((id) => pointById(scene, id)).filter(Boolean) as GeoPoint[];
          if (pts.length < 3) return;
          const [pa, pm, pb] = pts;
          const cx = 2 * pm.x - (pa.x + pb.x) / 2;
          const cy = 2 * pm.y - (pa.y + pb.y) / 2;
          d = `M ${pa.x + PAD} ${pa.y + PAD} Q ${cx + PAD} ${cy + PAD} ${pb.x + PAD} ${pb.y + PAD}`;
        } else {
          const pts = (o.points ?? []).map((id) => pointById(scene, id)).filter(Boolean) as GeoPoint[];
          if (pts.length < 2) return;
          d = catmullRomPreview(pts.map((p) => ({ x: p.x + PAD, y: p.y + PAD })));
        }
        out.push(<path key={`h-${id}`} d={d} fill="none" stroke={color} strokeWidth={10} opacity={opacity} strokeLinecap="round" />);

      } else if (o.type === "angle") {
        const v = pointById(scene, o.vertex); if (!v) return;
        out.push(<circle key={`h-${id}`} cx={v.x + PAD} cy={v.y + PAD} r={24} fill="none" stroke={color} strokeWidth={4} opacity={opacity} />);
      }
    };
    const seen = new Set<string>();
    const once = (id: GeoId, color: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      glow(id, color);
    };
    selectedIds.forEach((id) => once(id, "#2563eb"));
    pendingIds.forEach((id) => once(id, "#10b981"));
    flashIds.forEach((id) => once(id, "#f59e0b"));
    return out;
  }, [scene, selectedIds, pendingIds, flashIds]);

  // In-progress previews
  const previews: React.ReactNode[] = [];
  if (hover && (tool === "line" || tool === "polygon") && pendingIds.length > 0) {
    const last = pointById(scene, pendingIds[pendingIds.length - 1]);
    if (last) previews.push(
      <line key="pv" x1={last.x + PAD} y1={last.y + PAD} x2={hover.snap.x + PAD} y2={hover.snap.y + PAD} stroke="#10b981" strokeWidth={1.2} strokeDasharray="4 3" />,
    );
  }
  if (tool === "curve" && pendingIds.length > 0) {
    const anchors = pendingIds
      .map((id) => pointById(scene, id))
      .filter(Boolean) as GeoPoint[];
    const pts = anchors.map((p) => ({ x: p.x + PAD, y: p.y + PAD }));
    if (hover) pts.push({ x: hover.snap.x + PAD, y: hover.snap.y + PAD });
    if (pts.length >= 2) {
      previews.push(
        <path key="cv-pv" d={catmullRomPreview(pts)} fill="none"
          stroke="#10b981" strokeWidth={1.4} strokeDasharray="4 3" strokeLinecap="round" />,
      );
    }
    // Show anchors as small dots for feedback
    anchors.forEach((a, i) => previews.push(
      <circle key={`cv-a${i}`} cx={a.x + PAD} cy={a.y + PAD} r={2.4} fill="#10b981" />,
    ));
  }
  if (circleDrag) {
    previews.push(
      <circle key="cd" cx={circleDrag.cx + PAD} cy={circleDrag.cy + PAD} r={circleDrag.r} fill="none" stroke="#10b981" strokeWidth={1.2} strokeDasharray="4 3" />,
    );
  }

  return (
    <div data-geometry-live-canvas="true" className="relative" style={{ width: W, height: H, overflow: "visible" }}>
      <div className="absolute inset-0">
        <GeometryDiagram scene={scene} explicitWidth={W} explicitHeight={H} />
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="absolute inset-0 select-none"
        style={{ touchAction: "none", cursor: cursorFor(tool) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={() => {
          // Double-click finishes an in-progress multi-point tool.
          if (tool === "polygon" && pendingIds.length >= 3) {
            apply(closePolygon(scene, pendingIds));
            setPendingIds([]);
          } else if (tool === "curve" && pendingIds.length >= 2) {
            apply(addCurve(scene, pendingIds));
            setPendingIds([]);
          } else if (tool === "line") {
            setPendingIds([]);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && tool === "polygon" && pendingIds.length >= 3) {
            apply(closePolygon(scene, pendingIds));
            setPendingIds([]);
          } else if (e.key === "Enter" && tool === "curve" && pendingIds.length >= 2) {
            apply(addCurve(scene, pendingIds));
            setPendingIds([]);
          } else if (e.key === "Escape") {
            setPendingIds([]);
          }
        }}
        tabIndex={0}

      >
        {/* Snap hint */}
        {hover && tool !== "select" && tool !== "move" && tool !== "erase" && (
          <circle
            cx={hover.snap.x + PAD}
            cy={hover.snap.y + PAD}
            r={hover.snap.pointId ? 6 : 3}
            fill="none"
            stroke="#2563eb"
            strokeWidth={1}
            opacity={0.7}
          />
        )}
        {previews}
        {halos}
      </svg>

      {inlineEdit && (
        <input
          autoFocus
          value={inlineEdit.value}
          onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
          onBlur={() => {
            apply(patchObject(scene, inlineEdit.id, { [inlineEdit.field]: inlineEdit.value } as any));
            setInlineEdit(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            else if (e.key === "Escape") setInlineEdit(null);
          }}
          className="absolute text-xs px-1.5 py-1 rounded border border-primary bg-white shadow"
          style={{ left: inlineEdit.x + PAD, top: inlineEdit.y + PAD, minWidth: 80 }}
        />
      )}
    </div>
  );
}

function cursorFor(t: ToolId): string {
  if (t === "select") return "default";
  if (t === "move") return "grab";
  if (t === "erase") return "not-allowed";
  return "crosshair";
}

function catmullRomPreview(p: { x: number; y: number }[]): string {
  if (p.length < 2) return "";
  if (p.length === 2) return `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y}`;
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
