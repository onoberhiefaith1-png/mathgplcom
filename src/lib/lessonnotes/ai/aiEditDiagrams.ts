// AI Edit diagram intelligence.
//
// A highlighted question, solution or diagram is corrected here, before a
// model call, whenever the mathematics determines the figure. Solution
// constructions are placed inside the Solution, at the step that uses them.
// An existing diagram is edited: unrelated objects and surrounding text stay.
// Measurements that are not given and cannot be derived are not invented.

import type { GeometryScene, GeoObject, GeoPoint } from "@/lib/geometry/scene";
import { nativeDirective } from "@/lib/lessonnotes/ai/objectSource";
import { figureNeeded } from "@/lib/lessonnotes/figureNeed";
import { gateExternalScene, recogniseChart, recogniseExamFigure } from "@/lib/lessonnotes/ai/topicScenes";

export type DiagramCategory = "question" | "solution" | "teaching";

export type DiagramEditIntent =
  | "generate"
  | "improve"
  | "correct"
  | "add-details"
  | "visualise"
  | "construct"
  | "annotate";

export interface DiagramRow {
  id: string;
  kind: "heading" | "text" | "diagram" | "other";
  text: string;
  scene?: GeometryScene;
  diagramId?: string;
  json?: unknown;
  /** A non-geometry native object, such as a graph, Venn diagram or tree. */
  node?: unknown;
}

export interface AiEditDiagramPlan {
  handledLocally: boolean;
  blockModel: boolean;
  flag: string;
  intent: DiagramEditIntent | null;
  category: DiagramCategory;
  purpose: string;
  scene: GeometryScene | null;
  /** Lines the solution must contain. They never appear in the question view. */
  steps: string[];
  proposal: string;
  questionView: string;
}

const EMPTY_SCENE: GeometryScene = { bounds: { width: 360, height: 260 }, objects: [] };

export function diagramEditIntent(instruction: string): DiagramEditIntent | null {
  const s = instruction.toLowerCase();
  if (/\b(visuali[sz]e|sketch|show the (diagram|figure)|illustrat\w*)\b/.test(s)) return "visualise";
  if (/\b(construct\w*|draw)\b/.test(s)) return "construct";
  if (/\b(annotat\w*|add (the )?(missing|north|arc|mark|label))\b/.test(s)) return "annotate";
  if (/\b(add missing|missing details|fill in)\b/.test(s)) return "add-details";
  if (/\b(correct|fix)\b/.test(s)) return "correct";
  if (/\b(generat\w*|create (a |the )?(diagram|figure))\b/.test(s)) return "generate";
  if (/\b(improv\w*|diagram|figure)\b/.test(s)) return "improve";
  return null;
}

export function isSolutionHeadingLine(text: string): boolean {
  return /^(?:worked\s+)?solutions?(?:\s+\d+)?\s*[:.]?\s*$/i.test(text.trim());
}

export function isQuestionHeadingLine(text: string): boolean {
  return /^(?:question|example|exercise|class\s*work|classwork|home\s*work|homework|assessment|problem)(?:\s+\d+)?\s*[:.]?\s*$/i.test(text.trim());
}

/** Text a student sees before the Solution heading. Diagrams placed under Solution are not included. */
export function questionView(text: string): string {
  const lines = text.split("\n");
  const cut = lines.findIndex((line) => isSolutionHeadingLine(line));
  return (cut < 0 ? lines : lines.slice(0, cut)).join("\n").trim();
}

export function journeyDisplacement(legs: { km: number; bearing: number }[]): {
  points: { east: number; north: number }[];
  distanceKm: number;
  bearingDegrees: number;
  bearingLabel: string;
} {
  const points = [{ east: 0, north: 0 }];
  for (const leg of legs) {
    const last = points[points.length - 1];
    const r = (leg.bearing * Math.PI) / 180;
    points.push({
      east: last.east + leg.km * Math.sin(r),
      north: last.north + leg.km * Math.cos(r),
    });
  }
  const end = points[points.length - 1];
  const distanceKm = Math.hypot(end.east, end.north);
  let bearingDegrees = (Math.atan2(end.east, end.north) * 180) / Math.PI;
  if (bearingDegrees < 0) bearingDegrees += 360;
  return { points, distanceKm, bearingDegrees, bearingLabel: formatBearing(bearingDegrees) };
}

/** Smallest angle at the waypoint between an incoming bearing and the next one. */
export function bearingTurnDegrees(incoming: number, outgoing: number): number {
  const reverse = (incoming + 180) % 360;
  let diff = Math.abs(outgoing - reverse) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

export function formatBearing(degrees: number): string {
  const rounded = Math.round(((degrees % 360) + 360) % 360) % 360;
  return String(rounded).padStart(3, "0");
}

/**
 * A bearing is measured clockwise from north. The flags match the arc drawn
 * by GeometryDiagram: sweep 1 is the clockwise SVG arc, and a sweep over
 * 180° sets the reflex (long) arc rather than the minor one.
 */
export function bearingArc(clockwiseDegrees: number): {
  clockwiseSweep: number;
  reflex: boolean;
  minor: number;
  large: 0 | 1;
  sweep: 0 | 1;
} {
  const clockwiseSweep = ((clockwiseDegrees % 360) + 360) % 360;
  const reflex = clockwiseSweep > 180 && clockwiseSweep < 360;
  const minor = clockwiseSweep > 180 ? 360 - clockwiseSweep : clockwiseSweep;
  const rad = (clockwiseSweep * Math.PI) / 180;
  const north = { x: 0, y: -1 };
  const direction = { x: Math.sin(rad), y: -Math.cos(rad) };
  const a1 = Math.atan2(-north.y, north.x);
  const a2 = Math.atan2(-direction.y, direction.x);
  let diff = a2 - a1;
  while (diff <= -Math.PI) diff += 2 * Math.PI;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  let large: 0 | 1 = Math.abs(diff) > Math.PI ? 1 : 0;
  let sweep: 0 | 1 = diff > 0 ? 0 : 1;
  if (reflex) {
    large = (1 - large) as 0 | 1;
    sweep = (1 - sweep) as 0 | 1;
  }
  return { clockwiseSweep, reflex, minor, large, sweep };
}

/** Right angle at C. Swapping the reference angle swaps opposite and adjacent. */
export function referenceSides(reference: "A" | "B"): {
  opposite: string;
  adjacent: string;
  hypotenuse: string;
  rightAngleAt: "C";
} {
  return reference === "A"
    ? { opposite: "BC", adjacent: "AC", hypotenuse: "AB", rightAngleAt: "C" }
    : { opposite: "AC", adjacent: "BC", hypotenuse: "AB", rightAngleAt: "C" };
}

export function elevationReference(): "horizontal" {
  return "horizontal";
}

export function reflectInYAxis(point: { x: number; y: number }): { x: number; y: number } {
  return { x: -point.x, y: point.y };
}

/** How many times the line through `point` in `direction` meets the circle. */
export function circleLineIntersections(
  center: { x: number; y: number },
  radius: number,
  point: { x: number; y: number },
  direction: { x: number; y: number },
): number {
  const dx = direction.x;
  const dy = direction.y;
  const fx = point.x - center.x;
  const fy = point.y - center.y;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < -1e-8) return 0;
  if (Math.abs(disc) <= 1e-8) return 1;
  return 2;
}

export function perpendicularBisector(a: { x: number; y: number }, b: { x: number; y: number }): {
  midpoint: { x: number; y: number };
  radius: number;
  half: number;
  intersections: [{ x: number; y: number }, { x: number; y: number }];
  perpendicular: boolean;
  arcsKept: true;
} {
  const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const half = Math.hypot(b.x - a.x, b.y - a.y) / 2;
  const radius = half * 1.5;
  const h = Math.sqrt(Math.max(0, radius * radius - half * half));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const intersections: [{ x: number; y: number }, { x: number; y: number }] = [
    { x: midpoint.x + nx * h, y: midpoint.y + ny * h },
    { x: midpoint.x - nx * h, y: midpoint.y - ny * h },
  ];
  const px = intersections[1].x - intersections[0].x;
  const py = intersections[1].y - intersections[0].y;
  const perpendicular = Math.abs(px * dx + py * dy) < 1e-6;
  return { midpoint, radius, half, intersections, perpendicular, arcsKept: true };
}

/** Update matched objects and append new ones. Objects the patch does not mention stay. */
export function mergeSceneObjects<T extends { id: string }>(existing: T[], patch: T[]): T[] {
  const patches = new Map(patch.map((item) => [item.id, item]));
  const seen = new Set(existing.map((item) => item.id));
  const merged = existing.map((item) => patches.has(item.id) ? { ...item, ...patches.get(item.id)! } : item);
  for (const item of patch) if (!seen.has(item.id)) merged.push(item);
  return merged;
}

function pointId(label: string): string {
  return `p_${label.replace(/'/g, "q").replace(/[^A-Za-z0-9]/g, "")}`;
}

function layoutScene(
  named: { label: string; east: number; north: number; hidden?: boolean }[],
  extra: GeoObject[],
  meta: GeometryScene["meta"],
): GeometryScene {
  const east = named.map((p) => p.east);
  const north = named.map((p) => p.north);
  const minX = Math.min(...east);
  const maxX = Math.max(...east);
  const minY = Math.min(...north);
  const maxY = Math.max(...north);
  const bounds = { width: 360, height: 260 };
  const pad = 36;
  const scale = Math.min(
    (bounds.width - 2 * pad) / Math.max(1e-6, maxX - minX),
    (bounds.height - 2 * pad) / Math.max(1e-6, maxY - minY),
  );
  const s = Number.isFinite(scale) && scale > 0 ? Math.min(scale, 48) : 24;
  const offX = (bounds.width - (maxX - minX) * s) / 2;
  const offY = (bounds.height - (maxY - minY) * s) / 2;
  const points: GeoPoint[] = named.map((p) => ({
    id: pointId(p.label),
    type: "point",
    x: +((offX + (p.east - minX) * s).toFixed(2)),
    y: +((bounds.height - (offY + (p.north - minY) * s)).toFixed(2)),
    label: p.label,
    ...(p.hidden ? { hidden: true } : {}),
  }));
  const scene: GeometryScene = { bounds, objects: [...points, ...extra], meta };
  for (const object of scene.objects) {
    if (object.type !== "label" || !object.ownerId) continue;
    const owner = scene.objects.find((item) => item.id === object.ownerId && item.type === "point");
    if (owner && owner.type === "point") {
      object.x = owner.x;
      object.y = +(owner.y - 16).toFixed(2);
    }
  }
  return scene;
}

function parseJourney(text: string): { km: number; bearing: number }[] {
  const tokens: { kind: "km" | "bearing"; value: number; index: number }[] = [];
  const re = /(\d+(?:\.\d+)?)\s*km|\b(\d{3})\s*°/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match[1]) tokens.push({ kind: "km", value: Number(match[1]), index: match.index });
    else if (match[2]) tokens.push({ kind: "bearing", value: Number(match[2]), index: match.index });
  }
  const legs: { km: number; bearing: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind !== "km") continue;
    const later = tokens.slice(i + 1);
    const bearing = later.find((token) => token.kind === "bearing");
    const nextKm = later.find((token) => token.kind === "km");
    if (bearing && (!nextKm || bearing.index < nextKm.index)) {
      legs.push({ km: tokens[i].value, bearing: bearing.value });
    }
  }
  return legs;
}

function parseReflectionPoints(text: string): { label: string; x: number; y: number }[] {
  const points: { label: string; x: number; y: number }[] = [];
  const re = /([A-Z])\s*(['′])?\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match[2]) continue;
    points.push({ label: match[1], x: Number(match[3]), y: Number(match[4]) });
  }
  return points;
}

function existingDiagram(json: unknown): { scene: GeometryScene; diagramId?: string } | null {
  let found: { scene: GeometryScene; diagramId?: string } | null = null;
  const walk = (node: any) => {
    if (!node || typeof node !== "object" || found) return;
    if (node.type === "geometryDiagram" && node.attrs?.scene?.objects) {
      found = {
        scene: node.attrs.scene as GeometryScene,
        diagramId: typeof node.attrs.diagramId === "string" ? node.attrs.diagramId : undefined,
      };
      return;
    }
    if (Array.isArray(node)) node.forEach(walk);
    else if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(json);
  return found;
}

function editScene(existing: GeometryScene | null, built: GeometryScene): GeometryScene {
  if (!existing) return built;
  const objects: GeoObject[] = existing.objects.map((object) => ({ ...object }));
  const byLabel = new Map<string, GeoPoint[]>();
  for (const object of objects) {
    if (object.type === "point" && object.label) {
      const list = byLabel.get(object.label) ?? [];
      list.push(object);
      byLabel.set(object.label, list);
    }
  }
  const idRemap = new Map<string, string>();
  for (const object of built.objects) {
    if (object.type !== "point") continue;
    const labelled = object.label ? byLabel.get(object.label) : undefined;
    const prev = labelled?.length === 1 ? labelled[0] : undefined;
    if (prev) {
      prev.x = object.x;
      prev.y = object.y;
      idRemap.set(object.id, prev.id);
    } else {
      objects.push(object);
      idRemap.set(object.id, object.id);
    }
  }
  const remap = (id: string) => idRemap.get(id) ?? id;
  const sameEnds = (object: GeoObject, a: string, b: string) =>
    (object.type === "segment" || object.type === "ray" || object.type === "line") &&
    ((object.a === a && object.b === b) || (object.a === b && object.b === a));
  for (const object of built.objects) {
    if (object.type === "point") continue;
    if (object.type === "segment" || object.type === "ray" || object.type === "line") {
      const a = remap(object.a);
      const b = remap(object.b);
      const prev = objects.find((item) => sameEnds(item, a, b) && item.type === object.type);
      if (prev && object.type === "segment" && prev.type === "segment") {
        if (object.distance) prev.distance = object.distance;
        if (object.marks) prev.marks = object.marks;
        if (object.arrow) prev.arrow = object.arrow;
        if (object.dashed) prev.dashed = object.dashed;
      } else if (!prev) {
        objects.push({ ...object, a, b });
      }
    } else if (object.type === "angle") {
      const vertex = remap(object.vertex);
      const prev = objects.find((item) => item.type === "angle" && item.vertex === vertex);
      if (prev && prev.type === "angle") {
        prev.a = remap(object.a);
        prev.b = remap(object.b);
        prev.value = object.value;
        prev.marker = object.marker;
        prev.reflex = object.reflex;
      } else {
        objects.push({ ...object, vertex, a: remap(object.a), b: remap(object.b) });
      }
    } else if (object.type === "circle" || object.type === "arc") {
      objects.push({ ...object, center: remap(object.center) });
    } else {
      objects.push(object);
    }
  }
  return {
    ...existing,
    bounds: built.bounds,
    objects,
    meta: { ...existing.meta, ...built.meta },
  };
}

function bearingsScene(legs: { km: number; bearing: number }[]): { scene: GeometryScene; steps: string[]; category: DiagramCategory } {
  const journey = journeyDisplacement(legs);
  const names = ["A", "B", "C", "D", "E", "F"];
  const named = journey.points.slice(0, names.length).map((point, index) => ({
    label: names[index],
    east: point.east,
    north: point.north,
  }));
  const northReach = Math.max(...legs.map((leg) => leg.km), 4);
  const northTips = named.slice(0, Math.min(2, named.length)).map((point) => ({
    label: point.label === "A" ? "N1" : "N2",
    east: point.east,
    north: point.north + northReach,
    hidden: true,
  }));
  const extra: GeoObject[] = [];
  for (let i = 0; i < named.length - 1; i++) {
    extra.push({
      id: `seg_${names[i]}${names[i + 1]}`,
      type: "segment",
      a: pointId(names[i]),
      b: pointId(names[i + 1]),
      distance: `${legs[i].km} km`,
    });
  }
  if (named.length >= 3) {
    extra.push({
      id: "seg_AC",
      type: "segment",
      a: pointId("A"),
      b: pointId("C"),
      distance: `${formatKm(journey.distanceKm)} km`,
    });
  }
  northTips.forEach((tip, index) => {
    const from = named[index];
    extra.push({
      id: `north_${from.label}`,
      type: "ray",
      a: pointId(from.label),
      b: pointId(tip.label),
    });
    extra.push({
      id: `north_label_${from.label}`,
      type: "label",
      x: 0,
      y: 0,
      text: "N",
      ownerId: pointId(tip.label),
    });
  });
  const turn = legs.length >= 2 ? bearingTurnDegrees(legs[0].bearing, legs[1].bearing) : null;
  if (turn != null && named.length >= 3) {
    const right = Math.abs(turn - 90) < 0.5;
    extra.push({
      id: "ang_ABC",
      type: "angle",
      vertex: pointId("B"),
      a: pointId("A"),
      b: pointId("C"),
      marker: right ? "right" : "arc",
      ...(right ? {} : { value: `${Math.round(turn)}°` }),
    });
  }
  const first = legs[0];
  if (first && northTips[0]) {
    const arc = bearingArc(first.bearing);
    extra.push({
      id: "ang_bearing_A",
      type: "angle",
      vertex: pointId("A"),
      a: pointId(northTips[0].label),
      b: pointId(named[1]?.label ?? "A"),
      value: `${formatBearing(first.bearing)}°`,
      marker: "arc",
      ...(arc.reflex ? { reflex: true } : {}),
    });
  }
  const steps = [
    ...legs.map((leg, index) => `${names[index]}${names[index + 1]} = ${leg.km} km on ${formatBearing(leg.bearing)}°.`),
  ];
  if (turn != null) steps.push(`Angle ABC = ${Math.round(turn)}°.`);
  if (named.length >= 3) {
    steps.push(`AC = ${formatKm(journey.distanceKm)} km.`);
    steps.push(`Bearing of AC = ${journey.bearingLabel}°.`);
  }
  return {
    category: "solution",
    scene: layoutScene([...named, ...northTips], extra, {
      topic: "bearings",
      caption: named.length >= 3
        ? `Two north lines. AC = ${formatKm(journey.distanceKm)} km on ${journey.bearingLabel}°.`
        : "Bearing diagram",
    }),
    steps,
  };
}

function formatKm(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function reflexScene(degrees: number): GeometryScene {
  const arc = bearingArc(degrees);
  const rad = (arc.clockwiseSweep * Math.PI) / 180;
  const named = [
    { label: "A", east: 0, north: 0 },
    { label: "N", east: 0, north: 4 },
    { label: "D", east: 4 * Math.sin(rad), north: 4 * Math.cos(rad) },
  ];
  const extra: GeoObject[] = [
    { id: "ray_north", type: "ray", a: pointId("A"), b: pointId("N") },
    { id: "ray_bearing", type: "ray", a: pointId("A"), b: pointId("D") },
    { id: "north_label", type: "label", x: 0, y: 0, text: "N", ownerId: pointId("N") },
    {
      id: "ang_bearing",
      type: "angle",
      vertex: pointId("A"),
      a: pointId("N"),
      b: pointId("D"),
      value: `${formatBearing(degrees)}°`,
      marker: "arc",
      ...(arc.reflex ? { reflex: true } : {}),
    },
  ];
  return layoutScene(named, extra, {
    topic: "bearings",
    caption: arc.reflex
      ? `Reflex bearing ${formatBearing(degrees)}° measured clockwise from north`
      : `Bearing ${formatBearing(degrees)}° measured clockwise from north`,
  });
}

function reflectionScene(points: { label: string; x: number; y: number }[]): GeometryScene {
  const named = [
    ...points.map((point) => ({ label: point.label, east: point.x, north: point.y })),
    ...points.map((point) => ({ label: `${point.label}'`, east: -point.x, north: point.y })),
  ];
  const extra: GeoObject[] = [
    { id: "axis", type: "line", a: pointId("Axis1"), b: pointId("Axis2"), dashed: true },
  ];
  const ys = points.map((point) => point.y);
  const axisNamed = [
    { label: "Axis1", east: 0, north: Math.min(...ys) - 1, hidden: true },
    { label: "Axis2", east: 0, north: Math.max(...ys) + 1, hidden: true },
  ];
  if (points.length >= 2) {
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      extra.push({ id: `seg_${a.label}${b.label}`, type: "segment", a: pointId(a.label), b: pointId(b.label) });
      extra.push({
        id: `seg_${a.label}q${b.label}q`,
        type: "segment",
        a: pointId(`${a.label}'`),
        b: pointId(`${b.label}'`),
        dashed: true,
      });
    }
  }
  return layoutScene([...named, ...axisNamed], extra, {
    topic: "reflection",
    caption: "Reflection in x = 0. Images are the solution, not the question.",
  });
}

function bisectorScene(): { scene: GeometryScene; facts: ReturnType<typeof perpendicularBisector> } {
  const a = { x: 0, y: 0 };
  const b = { x: 6, y: 0 };
  const facts = perpendicularBisector(a, b);
  const named = [
    { label: "A", east: a.x, north: a.y },
    { label: "B", east: b.x, north: b.y },
    { label: "M", east: facts.midpoint.x, north: facts.midpoint.y },
    { label: "P", east: facts.intersections[0].x, north: facts.intersections[0].y },
    { label: "Q", east: facts.intersections[1].x, north: facts.intersections[1].y },
  ];
  const extra: GeoObject[] = [
    { id: "seg_AB", type: "segment", a: pointId("A"), b: pointId("B") },
    { id: "arc_A", type: "circle", center: pointId("A"), r: 0, dashed: true },
    { id: "arc_B", type: "circle", center: pointId("B"), r: 0, dashed: true },
    { id: "bisector", type: "line", a: pointId("P"), b: pointId("Q") },
  ];
  const scene = layoutScene(named, extra, {
    topic: "construction",
    caption: "Perpendicular bisector. Both compass arcs are kept.",
  });
  const scale = scenePoint(scene, "B").x - scenePoint(scene, "A").x;
  const radius = Math.abs(scale) * (facts.radius / 6);
  for (const object of scene.objects) {
    if (object.type === "circle") object.r = +Math.abs(radius).toFixed(2);
  }
  return { scene, facts };
}

function scenePoint(scene: GeometryScene, label: string): GeoPoint {
  const point = scene.objects.find((object) => object.type === "point" && object.label === label);
  if (!point || point.type !== "point") throw new Error(`missing point ${label}`);
  return point;
}

function tangentScene(): GeometryScene {
  const named = [
    { label: "O", east: 0, north: 0 },
    { label: "T", east: 5, north: 0 },
    { label: "R", east: 5, north: 0, hidden: true },
    { label: "U", east: 5, north: 3 },
    { label: "V", east: 5, north: -3 },
  ];
  const extra: GeoObject[] = [
    { id: "circle", type: "circle", center: pointId("O"), r: 0 },
    { id: "radius", type: "segment", a: pointId("O"), b: pointId("T") },
    { id: "tangent", type: "line", a: pointId("U"), b: pointId("V") },
    {
      id: "right",
      type: "angle",
      vertex: pointId("T"),
      a: pointId("O"),
      b: pointId("U"),
      marker: "right",
    },
  ];
  const scene = layoutScene(named, extra, {
    topic: "circle",
    caption: "The tangent touches the circle at exactly one point.",
  });
  const centre = scenePoint(scene, "O");
  const touch = scenePoint(scene, "T");
  for (const object of scene.objects) {
    if (object.type === "circle") object.r = +Math.hypot(touch.x - centre.x, touch.y - centre.y).toFixed(2);
  }
  return scene;
}

function trigScene(reference: "A" | "B", kind: "reference" | "elevation"): GeometryScene {
  const roles = referenceSides(reference);
  const named = kind === "elevation"
    ? [
        { label: "H1", east: 0, north: 0, hidden: true },
        { label: "H2", east: 6, north: 0, hidden: true },
        { label: "E", east: 0, north: 0 },
        { label: "P", east: 4, north: 3 },
      ]
    : [
        { label: "C", east: 0, north: 0 },
        { label: "A", east: 4, north: 0 },
        { label: "B", east: 0, north: 3 },
      ];
  const extra: GeoObject[] = kind === "elevation"
    ? [
        { id: "horizontal", type: "ray", a: pointId("E"), b: pointId("H2") },
        { id: "sight", type: "segment", a: pointId("E"), b: pointId("P") },
        {
          id: "elevation",
          type: "angle",
          vertex: pointId("E"),
          a: pointId("H2"),
          b: pointId("P"),
          value: "θ",
          marker: "arc",
        },
      ]
    : [
        { id: "seg_CA", type: "segment", a: pointId("C"), b: pointId("A"), distance: reference === "A" ? "adjacent" : "opposite" },
        { id: "seg_CB", type: "segment", a: pointId("C"), b: pointId("B"), distance: reference === "A" ? "opposite" : "adjacent" },
        { id: "seg_AB", type: "segment", a: pointId("A"), b: pointId("B"), distance: "hypotenuse" },
        {
          id: "right_C",
          type: "angle",
          vertex: pointId("C"),
          a: pointId("A"),
          b: pointId("B"),
          marker: "right",
        },
        {
          id: "reference",
          type: "angle",
          vertex: pointId(reference),
          a: pointId("C"),
          b: pointId(reference === "A" ? "B" : "A"),
          value: "θ",
          marker: "arc",
        },
      ];
  return layoutScene(named, extra, {
    topic: kind === "elevation" ? "elevation" : "trigonometry",
    caption: kind === "elevation"
      ? "Angle of elevation measured from the horizontal."
      : `Reference angle at ${reference}. Opposite ${roles.opposite}, adjacent ${roles.adjacent}, hypotenuse ${roles.hypotenuse}.`,
  });
}

function rowsFromText(text: string): DiagramRow[] {
  const rows: DiagramRow[] = [];
  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (/^\[\[tool:/.test(trimmed)) {
      rows.push({ id: `existing-${index}`, kind: "diagram", text: trimmed });
      return;
    }
    if (isSolutionHeadingLine(trimmed) || isQuestionHeadingLine(trimmed)) {
      rows.push({ id: `h-${index}`, kind: "heading", text: trimmed });
      return;
    }
    rows.push({ id: `t-${index}`, kind: "text", text: trimmed });
  });
  return rows;
}

/** Place one diagram. An existing diagram row is updated and moved, never duplicated.
 *  `solutionHeadingExists` means the Solution heading is already on the page,
 *  so the body must not grow a second one. */
export function applyDiagramRows(
  rows: DiagramRow[],
  spec: { category: DiagramCategory; scene?: GeometryScene | null; steps: string[]; node?: unknown },
  opts?: { solutionHeadingExists?: boolean },
): DiagramRow[] {
  const next = rows.map((row) => ({ ...row }));
  const diagramIndexes = next
    .map((row, index) => row.kind === "diagram" ? index : -1)
    .filter((index) => index >= 0);
  let diagram: DiagramRow;
  if (diagramIndexes.length) {
    const index = diagramIndexes[0];
    const current = next[index];
    diagram = {
      ...current,
      kind: "diagram",
      scene: spec.scene,
      text: "",
    };
    if (current.json && typeof current.json === "object") {
      const json = current.json as { attrs?: Record<string, unknown> };
      diagram.json = { ...json, attrs: { ...json.attrs, scene: diagram.scene } };
    }
    next.splice(index, 1);
    for (let i = diagramIndexes.length - 1; i >= 1; i--) next.splice(diagramIndexes[i] - (diagramIndexes[i] > index ? 1 : 0), 1);
  } else {
    diagram = { id: "edited-diagram", kind: "diagram", text: "", scene: spec.scene ?? undefined, node: spec.node };
  }

  let solutionAt = next.findIndex((row) => row.kind === "heading" && isSolutionHeadingLine(row.text));
  if (spec.category === "solution" && solutionAt < 0 && !opts?.solutionHeadingExists) {
    solutionAt = next.length;
    next.push({ id: "ai-solution-heading", kind: "heading", text: "Solution" });
  }

  if (spec.category === "solution") {
    const base = solutionAt < 0 ? 0 : solutionAt + 1;
    const after = next.slice(base);
    const using = after.findIndex((row) => row.kind === "text" && /\b(draw|construct|sketch|diagram|figure|north line)\b/i.test(row.text));
    const insertAt = base + (using >= 0 ? using + 1 : 0);
    next.splice(insertAt, 0, diagram);
    const present = new Set(next.map((row) => row.text.trim()));
    const missing = spec.steps.filter((step) => ![...present].some((line) => line.includes(step.replace(/\.$/, ""))));
    if (missing.length) {
      const at = next.findIndex((row) => row.id === diagram.id);
      missing.forEach((step, offset) => {
        next.splice(at + 1 + offset, 0, { id: `step-${offset}`, kind: "text", text: step });
      });
    }
  } else if (spec.category === "teaching") {
    const firstText = next.findIndex((row) => row.kind === "text");
    const afterText = firstText < 0 ? next.length : firstText + 1;
    const at = solutionAt < 0 ? afterText : Math.min(afterText, solutionAt);
    next.splice(at, 0, diagram);
    const present = new Set(next.map((row) => row.text.trim()));
    spec.steps.filter((step) => ![...present].some((line) => line.includes(step.replace(/\.$/, "")))).forEach((step, offset) => {
      next.splice(at + 1 + offset, 0, { id: `teach-${offset}`, kind: "text", text: step });
    });
  } else {
    const at = solutionAt < 0 ? next.length : solutionAt;
    next.splice(at, 0, diagram);
  }
  return next;
}

function proposalFromRows(rows: DiagramRow[]): string {
  return rows.map((row) => {
    if (row.kind === "diagram" && row.node) return nativeDirective([row.node]);
    if (row.kind === "diagram" && row.scene) {
      return nativeDirective([{
        type: "geometryDiagram",
        attrs: { scene: row.scene, align: "center", ...(row.diagramId ? { diagramId: row.diagramId } : {}) },
      }]);
    }
    return row.text;
  }).filter((line) => line && line.trim()).join("\n");
}

function recognisedFigure(text: string, instruction: string): {
  category: DiagramCategory;
  purpose: string;
  scene: GeometryScene;
  steps: string[];
} | { insufficient: string } | null {
  const source = `${text}\n${instruction}`;
  const legs = parseJourney(text);
  if (legs.length >= 2 || (legs.length === 1 && /bearing/i.test(source) && legs[0].bearing <= 180)) {
    const built = bearingsScene(legs);
    return { category: built.category, purpose: "Bearings journey", scene: built.scene, steps: built.steps };
  }
  if (/bearing/i.test(source) && /\bfind\b|\bcalculate\b|\bdistance\b/i.test(source) && legs.length < 2 && /\bkm\b/i.test(text) === false) {
    return { insufficient: "The bearings diagram was not drawn: a distance and a bearing are both needed, and neither was invented." };
  }

  const reflex = [...source.matchAll(/\b(\d{2,3})\s*°/g)]
    .map((match) => Number(match[1]))
    .find((degrees) => degrees > 180 && degrees < 360);
  if (reflex != null && /bearing|reflex|arc/i.test(source)) {
    return {
      category: "solution",
      purpose: `Bearing ${formatBearing(reflex)}° clockwise from north`,
      scene: reflexScene(reflex),
      steps: [`The bearing arc is the clockwise reflex of ${formatBearing(reflex)}°, not the minor arc.`],
    };
  }

  if (/reflect/i.test(source) && /x\s*=\s*0|y-?\s*axis|vertical/i.test(source)) {
    const points = parseReflectionPoints(text);
    if (points.length < 1) {
      return { insufficient: "The reflection was not drawn: the object coordinates were not given, and none were invented." };
    }
    const images = points.map((point) => {
      const image = reflectInYAxis(point);
      return `${point.label}'(${image.x}, ${image.y})`;
    });
    return {
      category: "solution",
      purpose: "Reflection in x = 0",
      scene: reflectionScene(points),
      steps: [`Reflect in the y-axis: ${images.join(", ")}. Each image has the x-coordinate negated.`],
    };
  }

  const exam = recogniseExamFigure(text, instruction);
  if (exam) return exam;

  if (/perpendicular bisector/i.test(source)) {
    const built = bisectorScene();
    return {
      category: "solution",
      purpose: "Perpendicular bisector construction",
      scene: built.scene,
      steps: [
        "Open equal compass arcs, one centred at each end, with radius greater than half the segment.",
        "The bisector is the line through both arc intersections and the midpoint. It is perpendicular to the segment. Keep both arcs.",
      ],
    };
  }

  if (/tangent/i.test(source) && /circle|radius/i.test(source)) {
    return {
      category: /construct|solution/i.test(instruction) ? "solution" : "question",
      purpose: "Tangent touches the circle once",
      scene: tangentScene(),
      steps: ["The tangent meets the circle at exactly one point and is perpendicular to the radius."],
    };
  }

  if (/angle of (elevation|depression)|elevation|depression/i.test(source)) {
    return {
      category: "question",
      purpose: "Elevation or depression from the horizontal",
      scene: trigScene("A", "elevation"),
      steps: [],
    };
  }

  if (/reference angle|opposite|adjacent|right-?angled/i.test(source)) {
    const reference: "A" | "B" = /reference[^\n]{0,40}\bat\s+B\b|\bangle\s+B\b/i.test(source) ? "B" : "A";
    const roles = referenceSides(reference);
    return {
      category: "solution",
      purpose: `Reference angle at ${reference}`,
      scene: trigScene(reference, "reference"),
      steps: [
        `Reference angle at ${reference}: opposite ${roles.opposite}, adjacent ${roles.adjacent}.`,
        `The hypotenuse is ${roles.hypotenuse}, the side opposite the right angle at ${roles.rightAngleAt}.`,
      ],
    };
  }

  if (/\b(draw|construct)\b/i.test(instruction) && /\btriangle\b/i.test(source) && !/\d/.test(text)) {
    return { insufficient: "The triangle was not drawn: the given lengths or angles were not in the highlight, and none were invented." };
  }
  return null;
}

const labelledPoint = (scene: GeometryScene, label: string): GeoPoint | undefined => {
  const point = scene.objects.find((object) => object.type === "point" && object.label === label);
  return point && point.type === "point" ? point : undefined;
};

/** Reject a scene that does not actually satisfy the mathematics it claims. */
export function validateDiagramScene(scene: GeometryScene, purpose: string): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const topic = String(scene.meta?.topic ?? "");
  const caption = String(scene.meta?.caption ?? "");
  if (!scene.objects.length) reasons.push("the diagram has no objects");

  if (topic === "bearings") {
    const rays = scene.objects.filter((object) => object.type === "ray");
    const corners = ["A", "B", "C"].filter((label) => labelledPoint(scene, label));
    if (corners.length >= 3 && rays.length < 2) reasons.push("a two-leg bearing needs a north line at each change of direction");
    if (rays.length < 1) reasons.push("a bearing is measured from a north line");
    const reflex = scene.objects.find((object) => object.type === "angle" && /315/.test(String(object.value ?? "")));
    if (reflex && reflex.type === "angle" && !reflex.reflex) reasons.push("a bearing of 315° must be the reflex arc");
    if (/15 km/.test(caption) && !scene.objects.some((object) => object.type === "segment" && object.distance === "15 km")) {
      reasons.push("the closing side is not 15 km");
    }
    if (/15 km/.test(caption) && !/082/.test(caption)) reasons.push("the 15 km side is not on bearing 082°");
  }

  if (topic === "circle") {
    const centre = labelledPoint(scene, "O");
    const touch = labelledPoint(scene, "T");
    const up = labelledPoint(scene, "U");
    const circle = scene.objects.find((object) => object.type === "circle");
    if (!centre || !touch || !up || !circle || circle.type !== "circle") reasons.push("the tangent diagram is incomplete");
    else {
      const radius = { x: touch.x - centre.x, y: touch.y - centre.y };
      const tangent = { x: up.x - touch.x, y: up.y - touch.y };
      const reached = Math.hypot(radius.x, radius.y);
      if (Math.abs(reached - circle.r) > 1.5) reasons.push("the tangent does not meet the circle at the end of the radius");
      const span = reached * Math.hypot(tangent.x, tangent.y);
      if (span > 0 && Math.abs(radius.x * tangent.x + radius.y * tangent.y) / span > 0.02) {
        reasons.push("the tangent is not perpendicular to the radius");
      }
      const hits = circleLineIntersections(centre, reached, touch, tangent);
      if (hits !== 1) reasons.push("a tangent must touch the circle at exactly one point");
    }
  }

  if (topic === "reflection") {
    const axis = labelledPoint(scene, "Axis1");
    const originals = scene.objects.filter((object) =>
      object.type === "point" && object.label && !object.label.endsWith("'") && !object.label.startsWith("Axis") && !object.hidden);
    if (!axis || !originals.length) reasons.push("the reflection has no object to reflect");
    for (const from of originals) {
      if (from.type !== "point" || !from.label) continue;
      const image = labelledPoint(scene, `${from.label}'`);
      if (!image || !axis) {
        reasons.push(`the image of ${from.label} is missing`);
        continue;
      }
      if (Math.abs((from.x + image.x) / 2 - axis.x) > 1.5) reasons.push(`${from.label} was not reflected in x = 0`);
      if (Math.abs(from.y - image.y) > 1.5) reasons.push(`${from.label} did not keep its y-coordinate`);
    }
  }

  if (topic === "construction") {
    const circles = scene.objects.filter((object) => object.type === "circle");
    const a = labelledPoint(scene, "A");
    const b = labelledPoint(scene, "B");
    if (!circles.length) {
      const arc = scene.objects.find((object) => object.type === "arc" && object.dashed);
      const ray = scene.objects.find((object) => object.type === "ray" && object.dashed);
      if (!arc || !ray) reasons.push("the angle bisector needs its equal arc and the bisector");
    } else if (circles.length < 2 || circles.some((circle) => circle.type === "circle" && !circle.dashed)) {
      reasons.push("both compass arcs must be kept");
    }
    if (circles.length >= 2 && circles[0].type === "circle" && circles[1].type === "circle") {
      if (Math.abs(circles[0].r - circles[1].r) > 0.5) reasons.push("the compass arcs must have equal radius");
      if (a && b && circles[0].r <= Math.hypot(b.x - a.x, b.y - a.y) / 2) {
        reasons.push("each compass radius must be greater than half the segment");
      }
    }
  }

  if (topic === "trigonometry") {
    const right = scene.objects.find((object) => object.type === "angle" && object.marker === "right");
    const hypotenuse = scene.objects.find((object) => object.type === "segment" && object.distance === "hypotenuse");
    if (!right || right.type !== "angle" || right.vertex !== "p_C") reasons.push("the right angle must sit opposite the hypotenuse");
    if (!hypotenuse || hypotenuse.id !== "seg_AB") reasons.push("the hypotenuse must be the side opposite the right angle");
  }

  if (topic === "circleTheorem") {
    if (!/centre|same segment|semicircle|cyclic|alternate/i.test(caption)) reasons.push("the circle theorem is not named");
    if (/semicircle/i.test(caption) && !scene.objects.some((object) => object.type === "angle" && object.marker === "right")) {
      reasons.push("the angle in a semicircle is not marked as 90°");
    }
  }
  if (topic === "coordinate") {
    if (!/gradient/i.test(caption) || !/distance/i.test(caption)) reasons.push("the gradient or the distance is missing");
  }
  if (topic === "transformation") {
    if (!scene.objects.some((object) => object.type === "point" && object.label?.endsWith("'"))) reasons.push("the image points are missing");
  }
  if (topic === "vector") {
    if (!scene.objects.some((object) => object.type === "segment" && object.arrow === "end")) reasons.push("the vectors are not drawn as arrows");
  }
  if (topic === "locus") {
    const dashed = scene.objects.some((object) => (object.type === "circle" || object.type === "line") && object.dashed);
    if (!dashed) reasons.push("the locus is not drawn dashed");
  }
  if (topic === "histogram") {
    if (!scene.objects.some((object) => object.type === "polygon")) reasons.push("the histogram has no bars");
  }
  if (topic === "pie") {
    const arcs = scene.objects.filter((object) => object.type === "arc");
    const sweep = arcs.reduce((sum, arc) => {
      if (arc.type !== "arc") return sum;
      let delta = arc.to - arc.from;
      while (delta <= 0) delta += 360;
      return sum + delta;
    }, 0);
    if (Math.abs(sweep - 360) > 1) reasons.push("the pie angles do not sum to 360°");
  }
  if (topic === "cumulative") {
    if (!scene.objects.some((object) => object.type === "segment")) reasons.push("the cumulative-frequency curve is missing");
  }
  if (topic === "net") {
    if (scene.objects.filter((object) => object.type === "polygon").length < 6) reasons.push("a cube net needs six faces");
  }
  if (topic === "section") {
    const circle = scene.objects.find((object) => object.type === "circle");
    const polygon = scene.objects.find((object) => object.type === "polygon");
    if (!circle && !polygon) reasons.push("the cross-section is missing");
    if (circle && circle.type === "circle" && !(circle.r > 0)) reasons.push("the circular cross-section has no radius");
  }
  if (topic === "elevation") {
    if (!scene.objects.some((object) => object.id === "horizontal")) reasons.push("elevation and depression are measured from the horizontal");
    if (scene.objects.some((object) => object.type === "angle" && object.marker === "right")) {
      reasons.push("an angle of elevation is not marked as a right angle");
    }
  }

  if (purpose && topic === "bearings" && /reflex/i.test(purpose) && !scene.objects.some((object) => object.type === "angle" && object.reflex)) {
    reasons.push("the bearing arc is not reflex");
  }
  return { ok: reasons.length === 0, reasons };
}

function stripFigureDirectives(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^\s*\[\[tool:(?:geometry|native|diagram|solid3d|object3d)/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type PlacementSection = "question" | "solution" | "teaching" | "document";

export interface PlacedDiagram {
  category: DiagramCategory;
  scene: GeometryScene | null;
  text: string;
  flag: string;
  /** A solution figure was kept out of a question or explanation. */
  withheld: boolean;
  valid: boolean;
  /** The text was a known figure. False when a diagram is needed but this builder does not cover it. */
  recognised: boolean;
  questionView: string;
}

function placementInstruction(section: PlacementSection, source: string): string {
  if (section === "solution") return "Draw the construction in the solution";
  if (section === "document" && isSolutionHeadingLine(source) === false && /\n\s*(?:worked\s+)?solution\b/i.test(`\n${source}`)) {
    return "Draw the construction in the solution";
  }
  if (section === "teaching") return "Draw the diagram";
  return "Draw the question diagram";
}

/**
 * Build, validate and place a figure for section generation, regeneration or
 * a pasted note. Question figures stay in the question. Solution figures stay
 * in the Solution. A figure that cannot be checked is flagged and omitted.
 */
export function placeComputedDiagram(input: {
  source: string;
  section: PlacementSection;
  body?: string;
}): PlacedDiagram | null {
  const source = input.source ?? "";
  const body = input.body ?? source;
  const instruction = placementInstruction(input.section, source);
  const figure = recognisedFigure(source, instruction);
  const chart = figure ? null : recogniseChart(source);
  if (chart && "insufficient" in chart) {
    return {
      category: "question",
      scene: null,
      text: stripFigureDirectives(body),
      flag: chart.insufficient,
      withheld: false,
      valid: false,
      recognised: true,
      questionView: questionView(stripFigureDirectives(body)),
    };
  }
  if (chart) {
    const embedded = (chart.node as { attrs?: { scene?: GeometryScene } })?.attrs?.scene;
    if (embedded) {
      const verdict = validateDiagramScene(embedded, chart.purpose);
      if (!verdict.ok) {
        return {
          category: chart.category,
          scene: null,
          text: stripFigureDirectives(body),
          flag: verdict.reasons.join(" "),
          withheld: false,
          valid: false,
          recognised: true,
          questionView: questionView(stripFigureDirectives(body)),
        };
      }
    }
    const graph = chart.node as { type?: string; attrs?: { functions?: { expression?: string }[]; shapes?: { label?: string }[]; connect?: string; points?: unknown[] } };
    if (graph.type === "smartGraph") {
      const expression = graph.attrs?.functions?.[0]?.expression ?? "";
      const discontinuous = /1\/x|tan/i.test(expression);
      const asymptote = (graph.attrs?.shapes ?? []).some((shape) => shape.label === "asymptote");
      if (discontinuous && !asymptote) {
        return {
          category: chart.category,
          scene: null,
          text: stripFigureDirectives(body),
          flag: "The graph was not drawn: its asymptote was not marked, and the branches were not joined.",
          withheld: false,
          valid: false,
          recognised: true,
          questionView: questionView(body),
        };
      }
      if (graph.attrs?.connect !== "scatter" && (graph.attrs?.points?.length ?? 0) > 1) {
        return {
          category: chart.category,
          scene: null,
          text: stripFigureDirectives(body),
          flag: "The graph was not drawn: its branches would have been joined across a break.",
          withheld: false,
          valid: false,
          recognised: true,
          questionView: questionView(body),
        };
      }
    }
    const rows = applyDiagramRows(rowsFromText(stripFigureDirectives(body)), {
      category: chart.category,
      steps: input.section === "question" ? [] : chart.steps,
      node: chart.node,
    }, { solutionHeadingExists: input.section === "solution" });
    const text = proposalFromRows(rows);
    return {
      category: chart.category,
      scene: embedded ?? null,
      text,
      flag: "",
      withheld: false,
      valid: true,
      recognised: true,
      questionView: questionView(text),
    };
  }
  if (!figure) {
    if ((input.section === "document" || input.section === "solution") && figureNeeded(source)) {
      return {
        category: "question",
        scene: null,
        text: stripFigureDirectives(body),
        flag: "The diagram was not reconstructed: the labels or measurements needed to draw it were not in the text, and none were invented.",
        withheld: false,
        valid: false,
        recognised: false,
        questionView: questionView(stripFigureDirectives(body)),
      };
    }
    return null;
  }
  if ("insufficient" in figure) {
    return {
      category: "question",
      scene: null,
      text: stripFigureDirectives(body),
      flag: figure.insufficient,
      withheld: false,
      valid: false,
      recognised: true,
      questionView: questionView(stripFigureDirectives(body)),
    };
  }
  const verdict = validateDiagramScene(figure.scene, figure.purpose);
  if (!verdict.ok) {
    return {
      category: figure.category,
      scene: null,
      text: stripFigureDirectives(body),
      flag: verdict.reasons.join(" "),
      withheld: false,
      valid: false,
      recognised: true,
      questionView: questionView(stripFigureDirectives(body)),
    };
  }
  const category: DiagramCategory = input.section === "teaching" && figure.category === "question"
    ? "teaching"
    : figure.category;
  if ((input.section === "question" || input.section === "teaching") && figure.category === "solution") {
    const text = stripFigureDirectives(body);
    return {
      category: figure.category,
      scene: figure.scene,
      text,
      flag: "",
      withheld: true,
      valid: true,
      recognised: true,
      questionView: questionView(text),
    };
  }
  const rows = applyDiagramRows(rowsFromText(stripFigureDirectives(body)), {
    category,
    scene: figure.scene,
    steps: input.section === "question" || category === "teaching" ? [] : figure.steps,
  }, { solutionHeadingExists: input.section === "solution" });
  const text = proposalFromRows(rows);
  return {
    category,
    scene: figure.scene,
    text,
    flag: "",
    withheld: false,
    valid: true,
    recognised: true,
    questionView: questionView(text),
  };
}

export function planAiEditDiagram(input: {
  instruction: string;
  selection: string;
  surrounding?: string;
  selectionJson?: unknown;
}): AiEditDiagramPlan | null {
  const intent = diagramEditIntent(input.instruction);
  if (!intent) return null;
  const text = `${input.selection}\n${input.surrounding ?? ""}`;
  const figure = recognisedFigure(input.selection, input.instruction) ?? (
    input.surrounding ? recognisedFigure(text, input.instruction) : null
  );
  if (!figure) return null;
  if ("insufficient" in figure) {
    return {
      handledLocally: false,
      blockModel: true,
      flag: figure.insufficient,
      intent,
      category: "question",
      purpose: "Not enough information",
      scene: null,
      steps: [],
      proposal: input.selection,
      questionView: questionView(input.selection),
    };
  }
  const prior = existingDiagram(input.selectionJson);
  const scene = editScene(prior?.scene ?? null, figure.scene);
  const baseRows = rowsFromText(input.selection);
  if (prior) {
    const slot = baseRows.find((row) => row.kind === "diagram");
    if (slot) {
      slot.scene = prior.scene;
      slot.diagramId = prior.diagramId;
    } else {
      baseRows.push({ id: "existing-json", kind: "diagram", text: "", scene: prior.scene, diagramId: prior.diagramId });
    }
  }
  const rows = applyDiagramRows(baseRows, { category: figure.category, scene, steps: figure.steps });
  const proposal = proposalFromRows(rows);
  return {
    handledLocally: true,
    blockModel: false,
    flag: "",
    intent,
    category: figure.category,
    purpose: figure.purpose,
    scene,
    steps: figure.steps,
    proposal,
    questionView: questionView(proposal),
  };
}

function directiveBlocks(text: string): string[] {
  return text.match(/\[\[tool:[\s\S]*?\]\]/g) ?? [];
}

/** Move a solution figure that a model placed above the Solution heading. */
export function relocateModelDiagram(text: string, instruction: string): string {
  if (!diagramEditIntent(instruction)) return text;
  if (/\b(question diagram|given (diagram|figure)|in the question)\b/i.test(instruction)) return text;
  if (!/\b(visuali[sz]e|construct|construction|solution|annotat|correct|draw|improve|missing)\b/i.test(instruction)) return text;
  const lines = text.split("\n");
  const solutionAt = lines.findIndex((line) => isSolutionHeadingLine(line.trim()));
  if (solutionAt < 0) return text;
  const directives: string[] = [];
  const kept: string[] = [];
  lines.forEach((line, index) => {
    if (index < solutionAt && /^\s*\[\[tool:(geometry|native|diagram)/.test(line)) directives.push(line.trim());
    else kept.push(line);
  });
  if (!directives.length) return text;
  const solutionInKept = kept.findIndex((line) => isSolutionHeadingLine(line.trim()));
  const after = kept.slice(solutionInKept + 1);
  const using = after.findIndex((line) => /\b(draw|construct|sketch|diagram|figure|north line)\b/i.test(line));
  const insertAt = solutionInKept + 1 + (using >= 0 ? using + 1 : 0);
  kept.splice(insertAt, 0, ...directives);
  return kept.join("\n");
}

/** Keep Assign lines and question headings the model dropped. */
export function preserveUnrelatedLines(selection: string, proposal: string): string {
  const mustKeep = selection.split("\n").map((line) => line.trim()).filter((line) =>
    line && (/^assign\b/i.test(line) || isQuestionHeadingLine(line) || /^question\s+\d+/i.test(line))
  );
  let out = proposal;
  for (const line of mustKeep) {
    if (!out.includes(line)) out = `${line}\n${out}`;
  }
  const selectionDirectives = directiveBlocks(selection);
  const proposalDirectives = directiveBlocks(out);
  if (selectionDirectives.length === 1 && proposalDirectives.length > 1) {
    out = out.replace(proposalDirectives[0], "").replace(/\n{3,}/g, "\n\n").trim();
  }
  return out;
}

export const EMPTY_DIAGRAM_SCENE = EMPTY_SCENE;
