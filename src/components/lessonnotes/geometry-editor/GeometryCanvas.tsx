// GeometryCanvas — renders the scene + an interaction layer that handles
// pointer events for every tool. Coordinates are in scene logical space
// (top-left = 0,0 inside `bounds`, padded by `pad`).

import { useRef, useState, useMemo } from "react";
import type { GeometryScene, GeoPoint, GeoId } from "@/lib/geometry/scene";
import { pointById } from "@/lib/geometry/scene";
import { GeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import { snap, pickObject, type SnapTarget } from "@/lib/geometry/editor/snap";
import {
  addPoint, addSegment, addCircleByRadius, addCircleAt, addArcThrough3,
  addCircleThrough3, closePolygon, addAngle, midpointOfSegment, eraseObject,
  movePoint, cycleEqualMarks, markParallel, patchObject, addFloatingLabel,
} from "@/lib/geometry/editor/sceneOps";
import type { ToolId } from "@/lib/geometry/editor/tools";
import type { UseGeometryEditorReturn } from "./useGeometryEditor";

interface Props {
  editor: UseGeometryEditorReturn;
}

const PAD = 24;

export function GeometryCanvas({ editor }: Props) {
  const { scene, tool, apply, commit, pendingIds, setPendingIds, selectedIds, setSelectedIds, toggleSelected, flashIds } = editor;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; snap: SnapTarget } | null>(null);
  const [dragging, setDragging] = useState<{ pointId: GeoId } | null>(null);
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
    if (circleDrag) {
      setCircleDrag({ ...circleDrag, r: Math.hypot(p.x - circleDrag.cx, p.y - circleDrag.cy) });
      return;
    }
    const sn = snap(scene, p.x, p.y);
    setHover({ x: p.x, y: p.y, snap: sn });
  };

  const onPointerUp = (_e: React.PointerEvent) => {
    if (dragging) {
      setDragging(null);
      return;
    }
    if (circleDrag) {
      if (circleDrag.r > 4) {
        apply(addCircleAt(scene, circleDrag.cx, circleDrag.cy, circleDrag.r));
      }
      setCircleDrag(null);
      return;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Make sure the SVG owns keyboard focus so Enter/Esc work for polygon
    // close + cancel without the teacher having to click extra.
    try { (svgRef.current as any)?.focus?.({ preventScroll: true }); } catch { /* noop */ }
    const p = toLogical(e);
    const sn = snap(scene, p.x, p.y);
    const hitId = pickObject(scene, p.x, p.y);



    switch (tool) {
      case "select": {
        if (hitId) {
          if (e.shiftKey) toggleSelected(hitId);
          else setSelectedIds([hitId]);
        } else setSelectedIds([]);
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
          // Mark as dashed (construction)
          if (op.addedIds[0]) {
            const dashedOp = patchObject(op.scene, op.addedIds[0], { dashed: true } as any);
            apply(dashedOp);
          } else {
            apply(op);
          }
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

  // Selection / pending halo overlay
  const halos = useMemo(() => {
    const out: React.ReactNode[] = [];
    const haloFor = (id: GeoId, color: string, r = 12) => {
      const o = scene.objects.find((x) => x.id === id);
      if (!o) return;
      let cx: number | null = null, cy: number | null = null;
      if (o.type === "point") { cx = o.x; cy = o.y; }
      else if (o.type === "segment") {
        const a = pointById(scene, o.a); const b = pointById(scene, o.b);
        if (a && b) { cx = (a.x + b.x) / 2; cy = (a.y + b.y) / 2; }
      } else if (o.type === "circle" || o.type === "arc") {
        const c = pointById(scene, o.center); if (c) { cx = c.x; cy = c.y; }
      } else if (o.type === "angle") {
        const v = pointById(scene, o.vertex); if (v) { cx = v.x; cy = v.y; }
      }
      if (cx == null || cy == null) return;
      out.push(<circle key={`h-${id}`} cx={cx + PAD} cy={cy + PAD} r={r} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="3 3" />);
    };
    selectedIds.forEach((id) => haloFor(id, "#2563eb", 12));
    pendingIds.forEach((id) => haloFor(id, "#10b981", 10));
    flashIds.forEach((id) => haloFor(id, "#f59e0b", 14));
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
  if (circleDrag) {
    previews.push(
      <circle key="cd" cx={circleDrag.cx + PAD} cy={circleDrag.cy + PAD} r={circleDrag.r} fill="none" stroke="#10b981" strokeWidth={1.2} strokeDasharray="4 3" />,
    );
  }

  return (
    <div data-geometry-live-canvas="true" className="relative bg-white" style={{ width: W, height: H }}>
      <div className="absolute inset-0">
        <GeometryDiagram scene={scene} />
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
          // Double-click finishes a polygon or line in progress.
          if (tool === "polygon" && pendingIds.length >= 3) {
            apply(closePolygon(scene, pendingIds));
            setPendingIds([]);
          } else if (tool === "line") {
            setPendingIds([]);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && tool === "polygon" && pendingIds.length >= 3) {
            apply(closePolygon(scene, pendingIds));
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
