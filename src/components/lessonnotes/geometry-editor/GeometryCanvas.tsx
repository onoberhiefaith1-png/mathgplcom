// GeometryCanvas — renders the scene + an interaction layer that handles
// pointer events for every tool. Coordinates are in scene logical space
// (top-left = 0,0 inside `bounds`, padded by `pad`).

import { useRef, useState, useMemo, useEffect } from "react";
import type { GeometryScene, GeoPoint, GeoId } from "@/lib/geometry/scene";
import { pointById } from "@/lib/geometry/scene";
import { GeometryDiagram, computeSceneViewBox } from "@/components/lessonnotes/GeometryDiagram";
import { snap, pickObject, pickHit, pointsOnCircle, pointsOnArc, type SnapTarget, type Hit } from "@/lib/geometry/editor/snap";
import { sampleCatmullRomBetween } from "@/lib/geometry/editor/snap";

import {
  addPoint, addSegment, addCircleByRadius, addCircleAt, addArcThrough3,
  addCircleThrough3, closePolygon, addAngle, midpointOfSegment, eraseObject,
  movePoint, cycleEqualMarks, markParallel, patchObject, addFloatingLabel, eraseStructural,
  addCurve, addRegion, addCurvedRegion,
} from "@/lib/geometry/editor/sceneOps";
import type { ToolId } from "@/lib/geometry/editor/tools";
import { cycleFromSegments } from "@/lib/geometry/editor/regions";
import type { HitKind } from "@/lib/geometry/editor/snap";

import type { UseGeometryEditorReturn } from "./useGeometryEditor";
import { useGeometryMode } from "./GeometryModeContext";

interface Props {
  editor: UseGeometryEditorReturn;
  /** Default ink for the scene (Smartboard passes its writing colour). */
  stroke?: string;
  /**
   * Minimum drawing area in logical units. The transparent Smartboard layer
   * passes its measured workspace so the teacher can draw anywhere on it.
   */
  minViewW?: number;
  minViewH?: number;
  /**
   * Authoring-only halo (Geometry Properties). Purely an overlay — the
   * diagram's own appearance is never changed.
   */
  highlightIds?: GeoId[];
}

const PAD = 24;

export function GeometryCanvas({ editor, stroke, minViewW, minViewH, highlightIds }: Props) {
  const { scene, tool, apply, commit, pendingIds, setPendingIds, selectedIds, setSelectedIds, setSelectionKind, toggleSelected, flashIds } = editor;
  const { annotationDraft, setAnnotationDraft, setTool: setModeTool } = useGeometryMode();

  /**
   * End a temporary tool workflow: clear picks, return to Select and select
   * the object that was just created so its properties own the panel.
   */
  const finishTool = (ids: GeoId[], kind: HitKind | null) => {
    setPendingIds([]);
    setModeTool("select");
    setSelectedIds(ids);
    setSelectionKind(ids.length ? kind : null);
  };

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; snap: SnapTarget } | null>(null);
  const [dragging, setDragging] = useState<{ pointId: GeoId } | null>(null);
  const [labelDrag, setLabelDrag] = useState<{ kind: "pointLabel" | "segmentLabel" | "segmentDistance" | "segmentText" | "angleValue" | "label"; id: GeoId; startX: number; startY: number; baseDx: number; baseDy: number } | null>(null);
  const [circleDrag, setCircleDrag] = useState<{ cx: number; cy: number; r: number } | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ id: GeoId; field: "label" | "value" | "text"; value: string; x: number; y: number } | null>(null);

  // Tracks temporary construction points created during the current
  // Add Angle / Add Area session. Used to auto-remove them when the
  // teacher chose "Without Label" and the annotation is completed or
  // the tool is changed.
  const sessionRef = useRef<{ tool: "addAngle" | "addArea"; keepLabels: boolean; ids: GeoId[] } | null>(null);
  const trackSessionPoint = (t: "addAngle" | "addArea", id: GeoId) => {
    const keepLabels = annotationDraft?.keepLabels ?? true;
    const cur = sessionRef.current;
    if (!cur || cur.tool !== t) {
      sessionRef.current = { tool: t, keepLabels, ids: [id] };
    } else {
      cur.keepLabels = keepLabels;
      if (!cur.ids.includes(id)) cur.ids.push(id);
    }
  };
  const finalizeSession = (postScene: GeometryScene) => {
    const sess = sessionRef.current;
    sessionRef.current = null;
    if (!sess || sess.keepLabels || sess.ids.length === 0) return;
    let s = postScene;
    for (const id of sess.ids) s = eraseObject(s, id).scene;
    commit(s);
  };
  // If the teacher switches to another tool mid-session, clean up
  // temporary points from the previous annotation if it was "Without Label".
  const prevAnnotationToolRef = useRef<string | null>(null);
  useEffect(() => {
    const cur = annotationDraft?.tool ?? null;
    const prev = prevAnnotationToolRef.current;
    if (prev && prev !== cur) {
      const sess = sessionRef.current;
      if (sess && !sess.keepLabels && sess.ids.length) {
        let s = scene;
        for (const id of sess.ids) s = eraseObject(s, id).scene;
        commit(s);
      }
      sessionRef.current = null;
      // Drop any half-finished right-hand Add Area boundary picks so a new
      // tool starts from a clean slate.
      if (prev === "smartArea") setPendingIds([]);
    }

    prevAnnotationToolRef.current = cur;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationDraft?.tool]);

  const vbox = computeSceneViewBox(scene, PAD);
  const { minX, minY } = vbox;
  const W = Math.max(vbox.W, minViewW ?? 0);
  const H = Math.max(vbox.H, minViewH ?? 0);

  const toLogical = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    // The SVG uses preserveAspectRatio="xMidYMid meet" (uniform scale +
    // letterbox centring). Un-project the pointer with the same rule so
    // clicks resolve to the exact logical coordinate under the cursor,
    // regardless of container aspect or how far shapes extend past
    // scene.bounds.
    const scale = Math.min(rect.width / W, rect.height / H) || 1;
    const offsetX = (rect.width - W * scale) / 2;
    const offsetY = (rect.height - H * scale) / 2;
    const vx = (e.clientX - rect.left - offsetX) / scale;
    const vy = (e.clientY - rect.top - offsetY) / scale;
    return { x: vx - PAD + minX, y: vy - PAD + minY };
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
      } else if (labelDrag.kind === "segmentText") {
        apply(patchObject(scene, labelDrag.id, { lineTextOffset: { dx, dy } } as any));
      } else if (labelDrag.kind === "angleValue") {
        apply(patchObject(scene, labelDrag.id, { valueOffset: { dx, dy } } as any));
      } else {
        // Free-floating GeoLabel — write absolute position.
        apply(patchObject(scene, labelDrag.id, { x: labelDrag.baseDx + (p.x - labelDrag.startX), y: labelDrag.baseDy + (p.y - labelDrag.startY) } as any));
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
          // One object at a time: a plain click REPLACES the selection with
          // the object under the pointer, so its properties appear straight
          // away. Shift-click still builds a multi-object selection for
          // constraints (equal marks, isosceles, angle-from-two-lines).
          const additive = e.shiftKey;
          if (additive) {
            const next = selectedIds.includes(hit.id)
              ? selectedIds.filter((id) => id !== hit.id)
              : [...selectedIds, hit.id];
            setSelectedIds(next);
            setSelectionKind(next.length > 1 ? "segmentBody" : next.length ? hit.kind : null);
          } else {
            setSelectedIds([hit.id]);
            setSelectionKind(hit.kind);
          }
          // Prime drag state on the very first click so labels, points and
          // measurement chips stay draggable without a second selection pass.
          const obj = scene.objects.find((o) => o.id === hit.id);
          if (!additive) {
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
            } else if (hit.kind === "segmentText" && obj?.type === "segment") {
              const a = pointById(scene, obj.a); const b = pointById(scene, obj.b);
              let bx = 0, by = 0;
              if (obj.lineTextOffset) { bx = obj.lineTextOffset.dx; by = obj.lineTextOffset.dy; }
              else if (a && b) {
                const dx0 = b.x - a.x, dy0 = b.y - a.y;
                const len = Math.hypot(dx0, dy0) || 1;
                bx = (-dy0 / len) * 28; by = (dx0 / len) * 28;
              }
              setLabelDrag({
                kind: "segmentText", id: hit.id, startX: p.x, startY: p.y,
                baseDx: bx, baseDy: by,
              });
            } else if (hit.kind === "angleValue" && obj?.type === "angle") {
              setLabelDrag({
                kind: "angleValue", id: hit.id, startX: p.x, startY: p.y,
                baseDx: (obj as any).valueOffset?.dx ?? 0, baseDy: (obj as any).valueOffset?.dy ?? 0,
              });
            } else if (hit.kind === "label" && obj?.type === "label") {
              setLabelDrag({
                kind: "label", id: hit.id, startX: p.x, startY: p.y,
                baseDx: obj.x, baseDy: obj.y,
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
        // Structural erase: only the piece under the pointer goes.
        if (rawId) apply(eraseStructural(scene, rawId));
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
      case "addText": {
        // Value-first: teacher types text in toolbar, then clicks to place.
        if (!annotationDraft?.confirmed || !annotationDraft.value.trim()) break;
        const text = annotationDraft.value;
        const op = addFloatingLabel(scene, p.x, p.y, text);
        apply(op);
        // Stay on tool for placing multiple; clear draft so teacher types the next one.
        setPendingIds([]);
        break;
      }
      case "addDistance": {
        // Value-first: value already in draft; click two points to place at midpoint.
        if (!annotationDraft?.confirmed || !annotationDraft.value.trim()) break;
        const value = annotationDraft.value;
        const { id, scene: s1 } = ensurePoint(p.x, p.y);
        if (pendingIds.length === 0) {
          setPendingIds([id]);
        } else {
          const prev = pendingIds[0];
          if (prev === id) break;
          const existing = s1.objects.find(
            (o) => o.type === "segment" &&
              ((o.a === prev && o.b === id) || (o.a === id && o.b === prev)),
          );
          let segId: GeoId | null = existing?.id ?? null;
          let sceneNow = s1;
          if (!segId) {
            const op = addSegment(s1, prev, id);
            apply(op);
            segId = op.addedIds[0];
            sceneNow = op.scene;
          }
          if (segId) {
            const patched = patchObject(sceneNow, segId, { distance: value } as any);
            apply(patched);
          }
          setPendingIds([]);
        }
        break;
      }
      case "addAngle": {
        // Value-first: 3 clicks arm-vertex-arm; value already known.
        if (!annotationDraft?.confirmed || !annotationDraft.value.trim()) break;
        const raw = annotationDraft.value.trim();
        const isRight = /^\s*90\s*°?\s*$/.test(raw);
        const value = isRight ? "90°" : raw;
        const sn2 = snap(scene, p.x, p.y);
        const wasExisting = !!sn2.pointId;
        const { id, scene: s1 } = ensurePoint(p.x, p.y);
        if (!wasExisting) trackSessionPoint("addAngle", id);
        const next = [...pendingIds, id];
        if (next.length === 3) {
          const op = addAngle(s1, next[1], next[0], next[2]);
          apply(op);
          setPendingIds([]);
          const angId = op.addedIds[0];
          let postScene = op.scene;
          if (angId) {
            const patched = patchObject(op.scene, angId, {
              value,
              marker: isRight ? "right" : "arc",
            } as any);
            apply(patched);
            postScene = patched.scene;
          }
          finalizeSession(postScene);
        } else {
          setPendingIds(next);
        }
        break;
      }
      case "smartText": {
        // Value first: the text is already typed in the panel. The next click
        // must land on a LINE — the text is attached to it as its own chip so
        // the line's name and distance value both survive.
        if (!annotationDraft?.value.trim()) break;
        const text = annotationDraft.value.trim();
        const o = hitId ? scene.objects.find((x) => x.id === hitId) : null;
        if (o && o.type === "segment") {
          apply(patchObject(scene, hitId!, { lineText: text } as any));
          finishTool([hitId!], "segmentText");
        } else {
          setAnnotationDraft({
            ...annotationDraft,
            step: "pick",
            notice: "Select a line on the diagram — the text attaches to it.",
          });
        }
        break;
      }
      case "smartAngle": {
        // Value first, then ONE line pick. The vertex is inferred from the
        // existing geometry: the endpoint of the picked line nearest the
        // click that another line also touches. The second arm is the
        // neighbouring line making the smallest (internal) angle there.
        if (!annotationDraft?.value.trim()) break;
        if (!hitId) break;
        const picked = scene.objects.find((x) => x.id === hitId) as any;
        if (!picked || picked.type !== "segment") {
          setAnnotationDraft({
            ...annotationDraft, step: "pick",
            notice: "Select a straight line that meets another line.",
          });
          break;
        }
        const incident = (pid: GeoId) => scene.objects.filter(
          (x): x is typeof picked => x.type === "segment" && x.id !== picked.id
            && ((x as any).a === pid || (x as any).b === pid),
        );
        const cands = [picked.a, picked.b]
          .map((pid: GeoId) => ({ pid, pt: pointById(scene, pid), others: incident(pid) }))
          .filter((c) => c.pt && c.others.length > 0)
          .sort((c1, c2) =>
            Math.hypot(c1.pt!.x - p.x, c1.pt!.y - p.y) - Math.hypot(c2.pt!.x - p.x, c2.pt!.y - p.y));
        const chosen = cands[0];
        if (!chosen) {
          setAnnotationDraft({
            ...annotationDraft, step: "pick",
            notice: "That line doesn't meet another line yet — pick a line at an intersection.",
          });
          break;
        }
        const vertex = chosen.pid;
        const vp = chosen.pt!;
        const armA = picked.a === vertex ? picked.b : picked.a;
        const ap = pointById(scene, armA);
        const baseAng = ap ? Math.atan2(-(ap.y - vp.y), ap.x - vp.x) : 0;
        // Smallest interior turn from the picked arm.
        let best: { id: GeoId; diff: number } | null = null;
        for (const other of chosen.others) {
          const oid = (other as any).a === vertex ? (other as any).b : (other as any).a;
          const op2 = pointById(scene, oid);
          if (!op2) continue;
          const ang = Math.atan2(-(op2.y - vp.y), op2.x - vp.x);
          let d = Math.abs(ang - baseAng);
          while (d > Math.PI) d = Math.abs(d - 2 * Math.PI);
          if (!best || d < best.diff) best = { id: oid, diff: d };
        }
        if (!best) {
          setAnnotationDraft({
            ...annotationDraft, step: "pick",
            notice: "Couldn't work out the second arm — pick a different line.",
          });
          break;
        }
        const raw = annotationDraft.value.trim();
        const isRight = /^\s*90\s*°?\s*$/.test(raw);
        const value = /^-?\d+(\.\d+)?$/.test(raw) ? `${raw}°` : raw;
        const op = addAngle(scene, vertex, armA, best.id, value);
        apply(op);
        const angId = op.addedIds[0];
        setPendingIds([]);
        if (angId) {
          apply(patchObject(op.scene, angId, {
            value, marker: isRight ? "right" : "arc", reflex: false,
          } as any));
          // Add Angle stays armed so the marker can still be adjusted; the
          // new angle is selected so its properties own the panel.
          setSelectedIds([angId]);
          setSelectionKind("angle");
          setAnnotationDraft({ ...annotationDraft, step: "pick", notice: undefined });
        }
        break;
      }
      case "smartArea": {
        // Enclosed region: clicks pick LINES. As soon as the picked lines
        // form a closed cycle the region is created and the tool ends.
        const fillS = annotationDraft?.fillColor ?? "#3b82f6";
        const opacityS = annotationDraft?.fillOpacity ?? 0.25;
        if (!hitId) break;
        const lo = scene.objects.find((x) => x.id === hitId);
        if (!lo || lo.type !== "segment") {
          setAnnotationDraft(annotationDraft ? {
            ...annotationDraft,
            notice: "Click the straight lines that enclose the region.",
          } : annotationDraft);
          break;
        }
        const nextSegs = pendingIds.includes(hitId) ? pendingIds : [...pendingIds, hitId];
        const cycle = cycleFromSegments(scene, nextSegs);
        if (cycle) {
          const op = addRegion(scene, cycle.boundary, { fill: fillS, opacity: opacityS });
          apply(op);
          const rgnId = op.addedIds[0];
          setPendingIds([]);
          finishTool(rgnId ? [rgnId] : [], rgnId ? "polygon" : null);
        } else {
          setPendingIds(nextSegs);
        }
        break;
      }
      case "addArea": {

        // Manual trace: each click adds a boundary point. Straight mode
        // connects them with straight edges; curve mode groups points in
        // overlapping triplets so every three clicks draw a curve
        // through the middle point.
        const curveMode = annotationDraft?.traceMode === "curve";
        const fill = annotationDraft?.fillColor ?? "#3b82f6";
        const opacity = annotationDraft?.fillOpacity ?? 0.25;
        const sn2 = snap(scene, p.x, p.y);
        const wasExisting = !!sn2.pointId;
        const { id } = ensurePoint(p.x, p.y);
        if (!wasExisting) trackSessionPoint("addArea", id);
        const closeOnStart = pendingIds.length >= 3 && id === pendingIds[0];
        if (closeOnStart) {
          let op;
          if (curveMode) {
            op = addCurvedRegion(scene, pendingIds);
            apply(op);
            const rgnId = op.addedIds[0];
            if (rgnId) {
              const patched = patchObject(op.scene, rgnId, { fill, opacity } as any);
              apply(patched);
              finalizeSession(patched.scene);
            } else {
              finalizeSession(op.scene);
            }
          } else {
            op = addRegion(scene, pendingIds, { fill, opacity });
            apply(op);
            finalizeSession(op.scene);
          }
          setPendingIds([]);
        } else if (pendingIds[pendingIds.length - 1] !== id) {
          setPendingIds([...pendingIds, id]);
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
        const onC = pointsOnCircle(scene, o.center, o.r);
        if (sub >= 0 && onC.length >= 2) {
          const angs = onC
            .map((p) => Math.atan2(-(p.y - c.y), p.x - c.x) * 180 / Math.PI)
            .map((a) => ((a % 360) + 360) % 360)
            .sort((a, b) => a - b);
          const from = angs[sub];
          const to = angs[(sub + 1) % angs.length];
          out.push(subArcHalo(id, c.x + PAD, c.y + PAD, o.r, from, to, color, opacity));
        } else {
          out.push(
            <circle key={`h-${id}`} cx={c.x + PAD} cy={c.y + PAD} r={o.r}
              fill="none" stroke={color} strokeWidth={10} opacity={opacity} />,
          );
        }
      } else if (o.type === "arc") {
        const c = pointById(scene, o.center); if (!c) return;
        const onArc = pointsOnArc(scene, o.center, o.r, o.from, o.to);
        if (sub >= 0 && onArc.length >= 1) {
          const along = (v: number) => (((v - o.from) % 360) + 360) % 360;
          const anchors = onArc
            .map((p) => ((Math.atan2(-(p.y - c.y), p.x - c.x) * 180 / Math.PI) % 360 + 360) % 360)
            .sort((a, b) => along(a) - along(b));
          const seq = [o.from, ...anchors, o.to];
          const from = seq[sub] ?? o.from;
          const to = seq[sub + 1] ?? o.to;
          out.push(subArcHalo(id, c.x + PAD, c.y + PAD, o.r, from, to, color, opacity));
        } else {
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
        }
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
          const anchors = (o.points ?? []).map((id) => pointById(scene, id)).filter(Boolean) as GeoPoint[];
          if (anchors.length < 2) return;
          if (sub >= 0 && sub < anchors.length - 1) {
            const seg = sampleCatmullRomBetween(anchors, sub, 20);
            d = seg.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x + PAD} ${p.y + PAD}`).join(" ");
          } else {
            d = catmullRomPreview(anchors.map((p) => ({ x: p.x + PAD, y: p.y + PAD })));
          }
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
    (highlightIds ?? []).forEach((id) => once(id, "#a855f7"));
    return out;
  }, [scene, selectedIds, pendingIds, flashIds, highlightIds]);

  // In-progress previews
  const previews: React.ReactNode[] = [];
  if (hover && (tool === "line" || tool === "polygon") && pendingIds.length > 0) {
    const last = pointById(scene, pendingIds[pendingIds.length - 1]);
    if (last) previews.push(
      <line key="pv" x1={last.x + PAD} y1={last.y + PAD} x2={hover.snap.x + PAD} y2={hover.snap.y + PAD} stroke="#10b981" strokeWidth={1.2} strokeDasharray="4 3" />,
    );
  }
  if (tool === "addArea" && pendingIds.length >= 1) {
    const pts = pendingIds
      .map((id) => pointById(scene, id))
      .filter(Boolean) as GeoPoint[];
    const curveMode = annotationDraft?.traceMode === "curve";
    const previewPts = pts.map((p) => ({ x: p.x + PAD, y: p.y + PAD }));
    if (hover) previewPts.push({ x: hover.snap.x + PAD, y: hover.snap.y + PAD });
    if (previewPts.length >= 2) {
      let d = "";
      if (curveMode) {
        // Overlapping-triplet quadratic curves through the middle point.
        d = `M ${previewPts[0].x} ${previewPts[0].y}`;
        let i = 0;
        while (i + 2 < previewPts.length) {
          const m = previewPts[i + 1], e = previewPts[i + 2];
          const s = previewPts[i];
          const cx = 2 * m.x - (s.x + e.x) / 2;
          const cy = 2 * m.y - (s.y + e.y) / 2;
          d += ` Q ${cx} ${cy} ${e.x} ${e.y}`;
          i += 2;
        }
        // Trailing 1 or 2 uncommitted points → draw as straight preview.
        for (let j = i + 1; j < previewPts.length; j++) {
          d += ` L ${previewPts[j].x} ${previewPts[j].y}`;
        }
      } else {
        d = previewPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
      }
      previews.push(
        <path key="area-pv" d={d} fill="#3b82f6" fillOpacity={0.12} stroke="#3b82f6" strokeWidth={1.2} strokeDasharray="4 3" />,
      );
    }
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

  const annotationHint = annotationHintFor(tool, pendingIds.length);

  return (
    <div data-geometry-live-canvas="true" className="relative" style={{ width: W, height: H, overflow: "visible" }}>
      <div className="absolute inset-0">
        <GeometryDiagram scene={scene} explicitWidth={W} explicitHeight={H} stroke={stroke} minViewW={minViewW} minViewH={minViewH} ghostHidden />
      </div>
      {annotationHint && (
        <div className="absolute left-2 top-2 z-10 px-2 py-1 rounded bg-primary text-primary-foreground text-[11px] shadow-sm pointer-events-none">
          {annotationHint} <span className="opacity-70">· Esc to cancel</span>
        </div>
      )}
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
          } else if (tool === "addArea" && pendingIds.length >= 3) {
            const curveMode = annotationDraft?.traceMode === "curve";
            apply(curveMode ? addCurvedRegion(scene, pendingIds) : addRegion(scene, pendingIds));
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
          } else if (e.key === "Enter" && tool === "addArea" && pendingIds.length >= 3) {
            const curveMode = annotationDraft?.traceMode === "curve";
            apply(curveMode ? addCurvedRegion(scene, pendingIds) : addRegion(scene, pendingIds));
            setPendingIds([]);
          } else if (e.key === "Escape") {
            setPendingIds([]);
          }
        }}
        tabIndex={0}

      >
        {/* Match GeometryDiagram's translate so halos, hover ring and
            previews sit exactly on the rendered shapes. */}
        <g transform={`translate(${-minX}, ${-minY})`}>
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
        </g>
      </svg>

      {inlineEdit && (
        <input
          autoFocus
          value={inlineEdit.value}
          onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
          onBlur={() => {
            const patch: Record<string, unknown> = { [inlineEdit.field]: inlineEdit.value };
            // If an angle value normalises to 90°, swap to the right-angle marker.
            if (inlineEdit.field === "value") {
              const obj = scene.objects.find((o) => o.id === inlineEdit.id);
              if (obj?.type === "angle") {
                const n = parseFloat(inlineEdit.value.replace(/[^0-9.]/g, ""));
                if (Number.isFinite(n) && Math.abs(n - 90) < 0.5) {
                  patch.marker = "right";
                }
              }
            }
            apply(patchObject(scene, inlineEdit.id, patch as any));
            setInlineEdit(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            else if (e.key === "Escape") setInlineEdit(null);
          }}
          className="absolute text-xs px-1.5 py-1 rounded border border-primary bg-white shadow-sm"
          style={{ left: inlineEdit.x + PAD - minX, top: inlineEdit.y + PAD - minY, minWidth: 80 }}
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

function annotationHintFor(t: ToolId, pending: number): string | null {
  switch (t) {
    case "addText":
      return "Add Text — click anywhere to place a label";
    case "addDistance":
      return pending === 0 ? "Add Distance — select the first point" : "Select the second point";
    case "addAngle":
      return pending === 0 ? "Add Angle — select the first arm point"
        : pending === 1 ? "Select the vertex"
        : "Select the second arm point";
    case "addArea":
      return pending < 3
        ? `Add Area — trace the boundary (${pending} pt${pending === 1 ? "" : "s"})`
        : "Click the starting point or double-click to close";
    case "smartText":
      return "Add Text — select the line the text belongs to";
    case "smartAngle":
      return "Add Angle — select a line at the intersection";
    case "smartArea":
      return `Add Area — select the enclosing lines (${pending} picked)`;
    default:
      return null;

  }
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

function subArcHalo(id: string, cx: number, cy: number, r: number, fromDeg: number, toDeg: number, color: string, opacity: number): React.ReactNode {
  const a1 = (fromDeg * Math.PI) / 180;
  const a2 = (toDeg * Math.PI) / 180;
  const x1 = cx + Math.cos(a1) * r, y1 = cy - Math.sin(a1) * r;
  const x2 = cx + Math.cos(a2) * r, y2 = cy - Math.sin(a2) * r;
  let delta = toDeg - fromDeg;
  while (delta <= 0) delta += 360;
  while (delta > 360) delta -= 360;
  const large = delta > 180 ? 1 : 0;
  return (
    <path key={`h-${id}`}
      d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2}`}
      fill="none" stroke={color} strokeWidth={10} opacity={opacity} strokeLinecap="round" />
  );
}

