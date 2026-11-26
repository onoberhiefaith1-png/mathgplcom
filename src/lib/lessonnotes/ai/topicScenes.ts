// Computed figures for the remaining classroom topics. Each builder states the
// mathematics, draws only what that mathematics determines, and can be checked
// again by validateDiagramScene.

import type { GeometryScene, GeoObject, GeoPoint } from "@/lib/geometry/scene";
import { buildTreeModel, buildVennModel, engineVisualNode, solveTwoSetVenn } from "@/lib/lessonnotes/ai/diagramSpec";
import { DEFAULT_GRAPH } from "@/lib/graph/graphModel";

type DiagramCategory = "question" | "solution" | "teaching";

export interface TopicFigure {
  category: DiagramCategory;
  purpose: string;
  scene: GeometryScene;
  steps: string[];
}

export interface TopicChart {
  category: DiagramCategory;
  purpose: string;
  node: unknown;
  steps: string[];
}

type Built = TopicFigure | { insufficient: string } | null;

const pointId = (label: string) => `p_${label.replace(/'/g, "q").replace(/[^A-Za-z0-9]/g, "")}`;

function fit(named: { label: string; east: number; north: number; hidden?: boolean }[], extra: GeoObject[], meta: GeometryScene["meta"]): GeometryScene {
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
  const s = Number.isFinite(scale) && scale > 0 ? Math.min(scale, 42) : 24;
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
  return { bounds, objects: [...points, ...extra], meta };
}

const deg = (text: string): number | null => {
  const match = text.match(/(\d+(?:\.\d+)?)\s*°/);
  return match ? Number(match[1]) : null;
};

export function centreFromCircumference(inscribed: number): number {
  return 2 * inscribed;
}

export function circumferenceFromCentre(centre: number): number {
  return centre / 2;
}

export function oppositeCyclicAngle(angle: number): number {
  return 180 - angle;
}

export function gradientOf(a: { x: number; y: number }, b: { x: number; y: number }): number | null {
  if (b.x === a.x) return null;
  return (b.y - a.y) / (b.x - a.x);
}

export function distanceOf(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function rotateAboutOrigin(point: { x: number; y: number }, quarterTurns: number): { x: number; y: number } {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 1) return { x: -point.y, y: point.x };
  if (turns === 2) return { x: -point.x, y: -point.y };
  if (turns === 3) return { x: point.y, y: -point.x };
  return { ...point };
}

export function translateBy(point: { x: number; y: number }, vector: { x: number; y: number }): { x: number; y: number } {
  return { x: point.x + vector.x, y: point.y + vector.y };
}

export function enlargeFrom(point: { x: number; y: number }, centre: { x: number; y: number }, factor: number): { x: number; y: number } {
  return { x: centre.x + factor * (point.x - centre.x), y: centre.y + factor * (point.y - centre.y) };
}

export function frequencyDensity(frequency: number, width: number): number | null {
  if (!(width > 0)) return null;
  return frequency / width;
}

export function pieAngle(frequency: number, total: number): number | null {
  if (!(total > 0)) return null;
  return (frequency / total) * 360;
}

export function vectorAdd(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  return { x: a.x + b.x, y: a.y + b.y };
}

function namedPoints(text: string): { label: string; x: number; y: number }[] {
  const points: { label: string; x: number; y: number }[] = [];
  const re = /([A-Z])\s*(['′])?\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match[2]) continue;
    points.push({ label: match[1], x: Number(match[3]), y: Number(match[4]) });
  }
  return points;
}

function circleOn(points: { label: string; east: number; north: number }[], radius: number): GeoObject {
  return { id: "circle", type: "circle", center: pointId("O"), r: radius };
}

function angleAtCentre(text: string): Built {
  if (!/angle at the centre|angle at the center|angle at the circumference/i.test(text)) return null;
  const centre = text.match(/centre[^\d]{0,24}(\d+(?:\.\d+)?)\s*°|center[^\d]{0,24}(\d+(?:\.\d+)?)\s*°/i);
  const circum = text.match(/circumference[^\d]{0,24}(\d+(?:\.\d+)?)\s*°/i);
  const givenCentre = centre ? Number(centre[1] ?? centre[2]) : null;
  const givenCircum = circum ? Number(circum[1]) : null;
  if (givenCentre == null && givenCircum == null) {
    return { insufficient: "The circle theorem diagram was not drawn: neither the centre angle nor the circumference angle was given." };
  }
  const atCentre = givenCentre ?? centreFromCircumference(givenCircum!);
  const atCircumference = givenCircum ?? circumferenceFromCentre(givenCentre!);
  if (Math.abs(atCentre - 2 * atCircumference) > 1e-6) {
    return { insufficient: "The circle theorem diagram was not drawn: the centre angle is not twice the circumference angle." };
  }
  const half = (atCentre * Math.PI) / 180 / 2;
  const named = [
    { label: "O", east: 0, north: 0 },
    { label: "A", east: Math.cos(Math.PI / 2 + half), north: Math.sin(Math.PI / 2 + half) },
    { label: "B", east: Math.cos(Math.PI / 2 - half), north: Math.sin(Math.PI / 2 - half) },
    { label: "C", east: Math.cos(-Math.PI / 2), north: Math.sin(-Math.PI / 2) },
  ];
  const scene = fit(named, [
    circleOn(named, 0),
    { id: "OA", type: "segment", a: pointId("O"), b: pointId("A") },
    { id: "OB", type: "segment", a: pointId("O"), b: pointId("B") },
    { id: "CA", type: "segment", a: pointId("C"), b: pointId("A") },
    { id: "CB", type: "segment", a: pointId("C"), b: pointId("B") },
    { id: "angO", type: "angle", vertex: pointId("O"), a: pointId("A"), b: pointId("B"), value: `${atCentre}°`, marker: "arc" },
    { id: "angC", type: "angle", vertex: pointId("C"), a: pointId("A"), b: pointId("B"), value: `${atCircumference}°`, marker: "arc" },
  ], { topic: "circleTheorem", caption: `Angle at the centre ${atCentre}° is twice ${atCircumference}° at the circumference.` });
  const centrePoint = scene.objects.find((object) => object.type === "point" && object.label === "O") as GeoPoint;
  const rim = scene.objects.find((object) => object.type === "point" && object.label === "A") as GeoPoint;
  const circle = scene.objects.find((object) => object.type === "circle");
  if (circle && circle.type === "circle") circle.r = +Math.hypot(rim.x - centrePoint.x, rim.y - centrePoint.y).toFixed(2);
  return {
    category: "solution",
    purpose: "Angle at the centre is twice the angle at the circumference",
    scene,
    steps: [`Angle at the centre = ${atCentre}°.`, `Angle at the circumference = ${atCircumference}°.`],
  };
}

function sameSegment(text: string): Built {
  if (!/same segment/i.test(text)) return null;
  const angle = deg(text);
  if (angle == null) return { insufficient: "The same-segment diagram was not drawn: the given angle was not stated." };
  const named = [
    { label: "A", east: -2, north: 0 },
    { label: "B", east: 2, north: 0 },
    { label: "C", east: -0.4, north: 2.2 },
    { label: "D", east: 0.8, north: 2.4 },
    { label: "O", east: 0, north: 0.6, hidden: true },
  ];
  const scene = fit(named, [
    { id: "circle", type: "circle", center: pointId("O"), r: 0 },
    { id: "AB", type: "segment", a: pointId("A"), b: pointId("B") },
    { id: "CA", type: "segment", a: pointId("C"), b: pointId("A") },
    { id: "CB", type: "segment", a: pointId("C"), b: pointId("B") },
    { id: "DA", type: "segment", a: pointId("D"), b: pointId("A") },
    { id: "DB", type: "segment", a: pointId("D"), b: pointId("B") },
    { id: "angC", type: "angle", vertex: pointId("C"), a: pointId("A"), b: pointId("B"), value: `${angle}°`, marker: "arc" },
    { id: "angD", type: "angle", vertex: pointId("D"), a: pointId("A"), b: pointId("B"), value: `${angle}°`, marker: "arc" },
  ], { topic: "circleTheorem", caption: `Angles in the same segment are equal: both ${angle}°.` });
  return {
    category: "solution",
    purpose: "Angles in the same segment are equal",
    scene,
    steps: [`Both angles in the same segment are ${angle}°.`],
  };
}

function semicircle(text: string): Built {
  if (!/semicircle|semi-circle/i.test(text)) return null;
  const named = [
    { label: "A", east: -2, north: 0 },
    { label: "B", east: 2, north: 0 },
    { label: "C", east: 0, north: 2 },
    { label: "O", east: 0, north: 0, hidden: true },
  ];
  const scene = fit(named, [
    { id: "circle", type: "circle", center: pointId("O"), r: 0 },
    { id: "AB", type: "segment", a: pointId("A"), b: pointId("B"), distance: "diameter" },
    { id: "CA", type: "segment", a: pointId("C"), b: pointId("A") },
    { id: "CB", type: "segment", a: pointId("C"), b: pointId("B") },
    { id: "right", type: "angle", vertex: pointId("C"), a: pointId("A"), b: pointId("B"), marker: "right" },
  ], { topic: "circleTheorem", caption: "The angle in a semicircle is 90°." });
  const o = scene.objects.find((object) => object.type === "point" && object.label === "O") as GeoPoint;
  const a = scene.objects.find((object) => object.type === "point" && object.label === "A") as GeoPoint;
  const circle = scene.objects.find((object) => object.type === "circle");
  if (circle && circle.type === "circle") circle.r = +Math.hypot(a.x - o.x, a.y - o.y).toFixed(2);
  return {
    category: "solution",
    purpose: "Angle in a semicircle",
    scene,
    steps: ["The angle in a semicircle is 90°."],
  };
}

function cyclicQuad(text: string): Built {
  if (!/cyclic quadrilateral/i.test(text)) return null;
  const angle = deg(text);
  if (angle == null) return { insufficient: "The cyclic quadrilateral was not drawn: one angle was not given, so the opposite angle was not invented." };
  const opposite = oppositeCyclicAngle(angle);
  const named = [
    { label: "A", east: -1.2, north: 1.6 },
    { label: "B", east: 1.4, north: 1.5 },
    { label: "C", east: 1.6, north: -1.2 },
    { label: "D", east: -1.5, north: -1.1 },
    { label: "O", east: 0, north: 0, hidden: true },
  ];
  const scene = fit(named, [
    { id: "circle", type: "circle", center: pointId("O"), r: 0 },
    { id: "AB", type: "segment", a: pointId("A"), b: pointId("B") },
    { id: "BC", type: "segment", a: pointId("B"), b: pointId("C") },
    { id: "CD", type: "segment", a: pointId("C"), b: pointId("D") },
    { id: "DA", type: "segment", a: pointId("D"), b: pointId("A") },
    { id: "angA", type: "angle", vertex: pointId("A"), a: pointId("B"), b: pointId("D"), value: `${angle}°`, marker: "arc" },
    { id: "angC", type: "angle", vertex: pointId("C"), a: pointId("B"), b: pointId("D"), value: `${opposite}°`, marker: "arc" },
  ], { topic: "circleTheorem", caption: `Cyclic quadrilateral: opposite angles ${angle}° and ${opposite}° sum to 180°.` });
  return {
    category: "solution",
    purpose: "Opposite angles of a cyclic quadrilateral",
    scene,
    steps: [`Opposite angle = ${opposite}°.`, `${angle}° + ${opposite}° = 180°.`],
  };
}

function alternateSegment(text: string): Built {
  if (!/alternate segment/i.test(text)) return null;
  const angle = deg(text);
  if (angle == null) return { insufficient: "The alternate-segment diagram was not drawn: the given angle was not stated." };
  const named = [
    { label: "O", east: 0, north: 0, hidden: true },
    { label: "T", east: 0, north: 2 },
    { label: "A", east: 1.8, north: 0.6 },
    { label: "B", east: -1.2, north: -1.4 },
    { label: "P", east: -1.6, north: 2 },
    { label: "Q", east: 1.6, north: 2 },
  ];
  const scene = fit(named, [
    { id: "circle", type: "circle", center: pointId("O"), r: 0 },
    { id: "tangent", type: "line", a: pointId("P"), b: pointId("Q") },
    { id: "chord", type: "segment", a: pointId("T"), b: pointId("A") },
    { id: "TB", type: "segment", a: pointId("T"), b: pointId("B") },
    { id: "AB", type: "segment", a: pointId("A"), b: pointId("B") },
    { id: "angT", type: "angle", vertex: pointId("T"), a: pointId("Q"), b: pointId("A"), value: `${angle}°`, marker: "arc" },
    { id: "angB", type: "angle", vertex: pointId("B"), a: pointId("T"), b: pointId("A"), value: `${angle}°`, marker: "arc" },
  ], { topic: "circleTheorem", caption: `Alternate segment: both angles are ${angle}°.` });
  return {
    category: "solution",
    purpose: "Alternate segment theorem",
    scene,
    steps: [`The angle between the tangent and the chord equals ${angle}° in the alternate segment.`],
  };
}

function coordinateTriangle(text: string): Built {
  if (!/gradient|distance/i.test(text)) return null;
  const points = namedPoints(text);
  if (points.length < 2) return { insufficient: "The coordinate diagram was not drawn: at least two labelled points are needed." };
  const [a, b, c] = points;
  const slope = gradientOf(a, b);
  const length = distanceOf(a, b);
  const slopeText = slope == null ? "undefined" : `${Math.round(slope * 1000) / 1000}`;
  const named = points.map((point) => ({ label: point.label, east: point.x, north: point.y }));
  const extra: GeoObject[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    extra.push({
      id: `seg_${points[i].label}${points[i + 1].label}`,
      type: "segment",
      a: pointId(points[i].label),
      b: pointId(points[i + 1].label),
      distance: i === 0 ? `${Math.round(length * 1000) / 1000}` : undefined,
    });
  }
  if (c) extra.push({ id: `seg_${c.label}${a.label}`, type: "segment", a: pointId(c.label), b: pointId(a.label) });
  let right = false;
  if (c) {
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const ac = { x: c.x - a.x, y: c.y - a.y };
    const dot = ab.x * ac.x + ab.y * ac.y;
    const scale = Math.hypot(ab.x, ab.y) * Math.hypot(ac.x, ac.y);
    right = scale > 0 && Math.abs(dot) / scale < 1e-6;
    if (right) extra.push({ id: "right", type: "angle", vertex: pointId(a.label), a: pointId(b.label), b: pointId(c.label), marker: "right" });
  }
  return {
    category: "solution",
    purpose: "Coordinate gradient and distance",
    scene: fit(named, extra, {
      topic: "coordinate",
      caption: `Gradient ${a.label}${b.label} = ${slopeText}. Distance ${a.label}${b.label} = ${Math.round(length * 1000) / 1000}.`,
    }),
    steps: [
      `Gradient of ${a.label}${b.label} = ${slopeText}.`,
      `Distance ${a.label}${b.label} = ${Math.round(length * 1000) / 1000}.`,
      ...(right ? [`The sides at ${a.label} are perpendicular.`] : []),
    ],
  };
}

function transformation(text: string): Built {
  const points = namedPoints(text);
  if (/rotat/i.test(text)) {
    if (!points.length) return { insufficient: "The rotation was not drawn: the object coordinates were not given." };
    const clockwise = /clockwise/i.test(text) && !/anti-?clockwise|counter-?clockwise/i.test(text);
    const turns = /180/.test(text) ? 2 : /270/.test(text) ? (clockwise ? 1 : 3) : clockwise ? 3 : 1;
    if (!/90|180|270/.test(text)) return { insufficient: "The rotation was not drawn: the angle of rotation was not given." };
    const images = points.map((point) => ({ ...rotateAboutOrigin(point, turns), label: `${point.label}'` }));
    const named = [
      ...points.map((point) => ({ label: point.label, east: point.x, north: point.y })),
      ...images.map((point) => ({ label: point.label, east: point.x, north: point.y })),
      { label: "O", east: 0, north: 0 },
    ];
    const extra: GeoObject[] = points.map((point) => ({
      id: `img_${point.label}`,
      type: "segment" as const,
      a: pointId(point.label),
      b: pointId(`${point.label}'`),
      dashed: true,
    }));
    return {
      category: "solution",
      purpose: "Rotation about the origin",
      scene: fit(named, extra, { topic: "transformation", caption: `Rotation ${clockwise ? "clockwise" : "anticlockwise"} by ${turns * 90}° about the origin.` }),
      steps: images.map((point, index) => `${points[index].label}'(${point.x}, ${point.y}).`),
    };
  }
  if (/translat/i.test(text)) {
    const vector = text.match(/vector\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)|\bby\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/i);
    if (!points.length || !vector) return { insufficient: "The translation was not drawn: the object or the translation vector was not given." };
    const shift = { x: Number(vector[1] ?? vector[3]), y: Number(vector[2] ?? vector[4]) };
    const images = points.map((point) => ({ ...translateBy(point, shift), label: `${point.label}'` }));
    const named = [
      ...points.map((point) => ({ label: point.label, east: point.x, north: point.y })),
      ...images.map((point) => ({ label: point.label, east: point.x, north: point.y })),
    ];
    const extra: GeoObject[] = points.map((point) => ({
      id: `vec_${point.label}`,
      type: "segment" as const,
      a: pointId(point.label),
      b: pointId(`${point.label}'`),
      arrow: "end" as const,
    }));
    return {
      category: "solution",
      purpose: "Translation",
      scene: fit(named, extra, { topic: "transformation", caption: `Translation by (${shift.x}, ${shift.y}).` }),
      steps: images.map((point, index) => `${points[index].label}'(${point.x}, ${point.y}).`),
    };
  }
  if (/enlarg/i.test(text)) {
    const factor = text.match(/(?:scale\s*)?factor\s*(-?\d+(?:\.\d+)?)|enlarg\w*\s*(?:by\s*)?(-?\d+(?:\.\d+)?)/i);
    const centre = text.match(/centre\s*([A-Z])?\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)|center\s*([A-Z])?\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/i);
    if (!points.length || !factor || !centre) return { insufficient: "The enlargement was not drawn: the object, centre or scale factor was not given." };
    const k = Number(factor[1] ?? factor[2]);
    const origin = { x: Number(centre[2] ?? centre[5]), y: Number(centre[3] ?? centre[6]) };
    const images = points.map((point) => ({ ...enlargeFrom(point, origin, k), label: `${point.label}'` }));
    const named = [
      { label: "C", east: origin.x, north: origin.y },
      ...points.map((point) => ({ label: point.label, east: point.x, north: point.y })),
      ...images.map((point) => ({ label: point.label, east: point.x, north: point.y })),
    ];
    const extra: GeoObject[] = points.flatMap((point) => ([
      { id: `ray_${point.label}`, type: "segment" as const, a: pointId("C"), b: pointId(`${point.label}'`), dashed: true },
    ]));
    return {
      category: "solution",
      purpose: "Enlargement",
      scene: fit(named, extra, { topic: "transformation", caption: `Enlargement centre (${origin.x}, ${origin.y}), scale factor ${k}.` }),
      steps: images.map((point, index) => `${points[index].label}'(${point.x}, ${point.y}).`),
    };
  }
  return null;
}

function vectors(text: string): Built {
  if (!/\bvectors?\b/i.test(text)) return null;
  const found = [...text.matchAll(/([a-z])\s*=\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/gi)];
  if (found.length < 2) return { insufficient: "The vector diagram was not drawn: two component vectors were not given." };
  const a = { label: found[0][1], x: Number(found[0][2]), y: Number(found[0][3]) };
  const b = { label: found[1][1], x: Number(found[1][2]), y: Number(found[1][3]) };
  const sum = vectorAdd(a, b);
  const named = [
    { label: "O", east: 0, north: 0 },
    { label: a.label.toUpperCase(), east: a.x, north: a.y },
    { label: b.label.toUpperCase(), east: a.x + b.x, north: a.y + b.y },
    { label: "S", east: sum.x, north: sum.y },
  ];
  return {
    category: "solution",
    purpose: "Vector addition",
    scene: fit(named, [
      { id: "va", type: "segment", a: pointId("O"), b: pointId(a.label.toUpperCase()), arrow: "end", distance: a.label },
      { id: "vb", type: "segment", a: pointId(a.label.toUpperCase()), b: pointId(b.label.toUpperCase()), arrow: "end", distance: b.label },
      { id: "sum", type: "segment", a: pointId("O"), b: pointId("S"), arrow: "end", dashed: true, distance: `${a.label}+${b.label}` },
    ], { topic: "vector", caption: `${a.label} + ${b.label} = (${sum.x}, ${sum.y}).` }),
    steps: [`${a.label} + ${b.label} = (${sum.x}, ${sum.y}).`],
  };
}

function angleBisector(text: string): Built {
  if (!/angle bisector/i.test(text)) return null;
  const named = [
    { label: "B", east: 0, north: 0 },
    { label: "A", east: -2, north: 2 },
    { label: "C", east: 2, north: 2 },
    { label: "P", east: -0.2, north: 1.2 },
    { label: "Q", east: 0.2, north: 1.2 },
    { label: "R", east: 0, north: 2.4 },
  ];
  return {
    category: "solution",
    purpose: "Angle bisector",
    scene: fit(named, [
      { id: "BA", type: "segment", a: pointId("B"), b: pointId("A") },
      { id: "BC", type: "segment", a: pointId("B"), b: pointId("C") },
      { id: "arc", type: "arc", center: pointId("B"), r: 48, from: 40, to: 140, dashed: true },
      { id: "bisector", type: "ray", a: pointId("B"), b: pointId("R"), dashed: true },
    ], { topic: "construction", caption: "Angle bisector. The compass arcs from the arms are equal." }),
    steps: ["The bisector is the ray through the intersection of the equal arcs."],
  };
}

function locus(text: string): Built {
  if (!/locus|loci/i.test(text)) return null;
  if (/equidistant from (?:the )?(?:points|two points)|from a and b/i.test(text)) {
    return {
      category: "solution",
      purpose: "Locus equidistant from two points",
      scene: fit([
        { label: "A", east: 0, north: 0 },
        { label: "B", east: 4, north: 0 },
        { label: "P", east: 2, north: 2 },
        { label: "Q", east: 2, north: -2 },
      ], [
        { id: "AB", type: "segment", a: pointId("A"), b: pointId("B") },
        { id: "locus", type: "line", a: pointId("P"), b: pointId("Q"), dashed: true },
      ], { topic: "locus", caption: "The locus is the perpendicular bisector of AB." }),
      steps: ["Every point on the dashed line is equidistant from A and B."],
    };
  }
  const radius = text.match(/(\d+(?:\.\d+)?)\s*(?:cm|units?)?/i);
  if (/from (?:a )?point|from the point/i.test(text)) {
    if (!radius) return { insufficient: "The locus was not drawn: the fixed distance from the point was not given." };
    const r = Number(radius[1]);
    const scene = fit([
      { label: "O", east: 0, north: 0 },
      { label: "R", east: r, north: 0, hidden: true },
    ], [
      { id: "locus", type: "circle", center: pointId("O"), r: 0, dashed: true },
    ], { topic: "locus", caption: `Locus of points ${r} from O.` });
    const o = scene.objects.find((object) => object.type === "point" && object.label === "O") as GeoPoint;
    const rim = scene.objects.find((object) => object.type === "point" && object.label === "R") as GeoPoint;
    const circle = scene.objects.find((object) => object.type === "circle");
    if (circle && circle.type === "circle") circle.r = +Math.hypot(rim.x - o.x, rim.y - o.y).toFixed(2);
    return { category: "solution", purpose: "Locus at a fixed distance from a point", scene, steps: [`The locus is the circle centre O radius ${r}.`] };
  }
  return { insufficient: "The locus was not drawn: the condition was not specific enough to choose a circle or a line." };
}

function netOrSection(text: string): Built {
  if (/\bnet\b/i.test(text) && /cube/i.test(text)) {
    const cells: { label: string; east: number; north: number }[] = [];
    const faces = [[1, 0], [1, 1], [0, 1], [1, 2], [2, 1], [1, 3]];
    faces.forEach(([col, row], index) => {
      const name = "ABCDEF"[index];
      [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([x, y], corner) => {
        cells.push({ label: `${name}${corner}`, east: col + x, north: row + y, ...(corner ? { hidden: true } : {}) } as { label: string; east: number; north: number; hidden?: boolean });
      });
    });
    const extra: GeoObject[] = faces.map((_, index) => {
      const name = "ABCDEF"[index];
      return { id: `face_${name}`, type: "polygon" as const, points: [0, 1, 2, 3].map((corner) => pointId(`${name}${corner}`)), fill: "none" };
    });
    return {
      category: "teaching",
      purpose: "Net of a cube",
      scene: fit(cells.map((cell) => ({ ...cell, hidden: !/0$/.test(cell.label) })), extra, { topic: "net", caption: "A cross net of a cube has six square faces." }),
      steps: ["The net has six squares. Opposite faces do not share an edge."],
    };
  }
  if (/cross-?section/i.test(text) && /cylinder/i.test(text)) {
    const perpendicular = /perpendicular|across|horizontal/i.test(text);
    if (!perpendicular && !/parallel|vertical|along the axis/i.test(text)) {
      return { insufficient: "The cross-section was not drawn: the cut was not said to be perpendicular to the axis or parallel to it." };
    }
    if (perpendicular) {
      return {
        category: "teaching",
        purpose: "Cylinder cross-section perpendicular to the axis",
    scene: (() => {
      const scene = fit([
        { label: "O", east: 0, north: 0 },
        { label: "R", east: 2, north: 0, hidden: true },
      ], [{ id: "section", type: "circle", center: pointId("O"), r: 0 }], { topic: "section", caption: "A cut perpendicular to the axis of a cylinder is a circle." });
      const o = scene.objects.find((object) => object.type === "point" && object.label === "O") as GeoPoint;
      const rim = scene.objects.find((object) => object.type === "point" && object.label === "R") as GeoPoint;
      const circle = scene.objects.find((object) => object.type === "circle");
      if (circle && circle.type === "circle") circle.r = +Math.hypot(rim.x - o.x, rim.y - o.y).toFixed(2);
      return scene;
    })(),
        steps: ["The cross-section is a circle."],
      };
    }
    return {
      category: "teaching",
      purpose: "Cylinder cross-section parallel to the axis",
      scene: fit([
        { label: "A", east: 0, north: 0 },
        { label: "B", east: 3, north: 0 },
        { label: "C", east: 3, north: 2 },
        { label: "D", east: 0, north: 2 },
      ], [{ id: "section", type: "polygon", points: ["A", "B", "C", "D"].map(pointId), fill: "none" }], { topic: "section", caption: "A cut parallel to the axis of a cylinder is a rectangle." }),
      steps: ["The cross-section is a rectangle."],
    };
  }
  return null;
}

function histogram(text: string): TopicChart | { insufficient: string } | null {
  if (!/histogram|frequency density/i.test(text)) return null;
  const rows = [...text.matchAll(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\D{0,12}(\d+(?:\.\d+)?)/g)];
  if (rows.length < 2) return { insufficient: "The histogram was not drawn: class bounds and frequencies were not both given." };
  const bars = rows.map((row) => {
    const start = Number(row[1]);
    const end = Number(row[2]);
    const frequency = Number(row[3]);
    const density = frequencyDensity(frequency, end - start);
    return { start, end, frequency, density };
  });
  if (bars.some((bar) => bar.density == null)) return { insufficient: "The histogram was not drawn: a class width was not positive." };
  const named: { label: string; east: number; north: number; hidden?: boolean }[] = [];
  const extra: GeoObject[] = [];
  bars.forEach((bar, index) => {
    const id = `B${index}`;
    named.push(
      { label: `${id}0`, east: bar.start, north: 0, hidden: true },
      { label: `${id}1`, east: bar.end, north: 0, hidden: true },
      { label: `${id}2`, east: bar.end, north: bar.density!, hidden: true },
      { label: `${id}3`, east: bar.start, north: bar.density!, hidden: true },
    );
    extra.push({ id: `bar_${index}`, type: "polygon", points: [0, 1, 2, 3].map((corner) => pointId(`${id}${corner}`)), fill: "#cbd5e1" });
  });
  return {
    category: "solution",
    purpose: "Histogram frequency density",
    node: {
      type: "geometryDiagram",
      attrs: {
        scene: fit(named, extra, {
          topic: "histogram",
          caption: bars.map((bar) => `${bar.start}-${bar.end}: density ${bar.density}`).join("; "),
        }),
        align: "center",
      },
    },
    steps: bars.map((bar) => `Frequency density for ${bar.start}–${bar.end} = ${bar.frequency}/${bar.end - bar.start} = ${bar.density}.`),
  };
}

function pie(text: string): TopicChart | { insufficient: string } | null {
  if (!/pie chart|pie angle/i.test(text)) return null;
  const rows = [...text.matchAll(/([A-Za-z][A-Za-z ]{0,20}?)\s+(\d+(?:\.\d+)?)(?!\s*°)/g)];
  const usable = rows.filter((row) => !/pie|chart|angle|total/i.test(row[1]));
  if (usable.length < 2) return { insufficient: "The pie chart was not drawn: the category frequencies were not given." };
  const parts = usable.map((row) => ({ name: row[1].trim(), frequency: Number(row[2]) }));
  const total = parts.reduce((sum, part) => sum + part.frequency, 0);
  const angles = parts.map((part) => pieAngle(part.frequency, total)!);
  if (Math.abs(angles.reduce((sum, angle) => sum + angle, 0) - 360) > 1e-6) {
    return { insufficient: "The pie chart was not drawn: the sector angles do not sum to 360°." };
  }
  let cursor = 0;
  const arcs: GeoObject[] = angles.map((angle, index) => {
    const from = cursor;
    cursor += angle;
    return { id: `slice_${index}`, type: "arc", center: pointId("O"), r: 70, from, to: cursor, fill: index % 2 ? "#e2e8f0" : "#cbd5e1", fillOpacity: 0.8 };
  });
  return {
    category: "solution",
    purpose: "Pie chart angles",
    node: {
      type: "geometryDiagram",
      attrs: { scene: fit([{ label: "O", east: 0, north: 0 }], arcs, { topic: "pie", caption: parts.map((part, index) => `${part.name} ${angles[index]}°`).join("; ") }), align: "center" },
    },
    steps: parts.map((part, index) => `${part.name}: ${part.frequency}/${total} × 360° = ${angles[index]}°.`),
  };
}

function cumulative(text: string): TopicChart | { insufficient: string } | null {
  if (!/cumulative frequency/i.test(text)) return null;
  const rows = [...text.matchAll(/(\d+(?:\.\d+)?)\s*[,:]\s*(\d+(?:\.\d+)?)/g)];
  if (rows.length < 2) return { insufficient: "The cumulative-frequency diagram was not drawn: the upper bounds and cumulative frequencies were not given." };
  const points = rows.map((row) => ({ x: Number(row[1]), y: Number(row[2]) }));
  const reading = text.match(/read(?:ing)?\s*(?:at\s*)?(\d+(?:\.\d+)?)/i);
  const named = points.map((point, index) => ({ label: `P${index}`, east: point.x, north: point.y }));
  const extra: GeoObject[] = [];
  for (let i = 0; i < points.length - 1; i++) extra.push({ id: `cf_${i}`, type: "segment", a: pointId(`P${i}`), b: pointId(`P${i + 1}`) });
  if (reading) {
    const x = Number(reading[1]);
    const maxY = Math.max(...points.map((point) => point.y));
    named.push({ label: "R0", east: x, north: 0 }, { label: "R1", east: x, north: maxY });
    extra.push({ id: "reading", type: "segment", a: pointId("R0"), b: pointId("R1"), dashed: true });
  }
  return {
    category: "solution",
    purpose: "Cumulative frequency",
    node: { type: "geometryDiagram", attrs: { scene: fit(named, extra, { topic: "cumulative", caption: "Cumulative frequency curve with a reading line." }), align: "center" } },
    steps: [reading ? `The dashed line is the reading at ${reading[1]}.` : "The curve joins the cumulative frequencies in order."],
  };
}

function graph(text: string): TopicChart | { insufficient: string } | null {
  const equation = text.match(/y\s*=\s*([^\n,;]+?)(?:\s+and\b|\s*[.]|$)/i);
  if (!equation || !/graph|asymptote|sketch/i.test(text)) return null;
  const expression = equation[1].trim().replace(/\s+/g, "");
  const asymptotes: number[] = [];
  if (/1\/x|x\^\(-1\)/i.test(expression)) asymptotes.push(0);
  if (/tan/i.test(expression)) asymptotes.push(-Math.PI / 2, Math.PI / 2);
  return {
    category: "teaching",
    purpose: "Function graph",
    node: {
      type: "smartGraph",
      attrs: {
        ...DEFAULT_GRAPH,
        connect: "scatter",
        points: [],
        functions: [{ id: "f", expression: expression.replace(/^y=/i, ""), colour: "#111827", thickness: 1.75, dash: "solid" }],
        shapes: asymptotes.map((x, index) => ({
          id: `asymptote-${index}`,
          kind: "line",
          pts: [{ x, y: -8 }, { x, y: 8 }],
          label: "asymptote",
        })),
      },
    },
    steps: asymptotes.length
      ? [`The branches are not joined. Vertical asymptotes at x = ${asymptotes.map((value) => Math.round(value * 1000) / 1000).join(", ")}.`]
      : ["The graph is one continuous branch."],
  };
}

function venn(text: string): TopicChart | { insufficient: string } | null {
  if (!/venn/i.test(text)) return null;
  const total = text.match(/(\d+)\s+(?:people|students|total|in all)/i);
  const both = text.match(/(\d+)\s+(?:do|did|study|like|play)?\s*both/i);
  const sets = [...text.matchAll(/(\d+)\s+(?:do|study|like|play|take)\s+([A-Za-z]+)/gi)];
  if (!total || !both || sets.length < 2) return { insufficient: "The Venn diagram was not drawn: the total, both sets and the overlap were not all given." };
  const solved = solveTwoSetVenn({
    total: total[1],
    A: sets[0][1],
    B: sets[1][1],
    AB: both[1],
    sets: `${sets[0][2]},${sets[1][2]}`,
  });
  if (!solved) return { insufficient: "The Venn diagram was not drawn: the region counts would have been negative, so they were not invented." };
  return {
    category: "solution",
    purpose: "Two-set Venn diagram",
    node: engineVisualNode("vennEngine", buildVennModel({
      sets: `${sets[0][2]},${sets[1][2]}`,
      total: total[1],
      A: sets[0][1],
      B: sets[1][1],
      AB: both[1],
      stage: "solution",
    })),
    steps: [`A only = ${solved.A}, both = ${solved.AB}, B only = ${solved.B}, neither = ${solved[""] ?? 0}.`],
  };
}

function tree(text: string): TopicChart | { insufficient: string } | null {
  if (!/probability tree|tree diagram/i.test(text)) return null;
  const probs = [...text.matchAll(/(\d+\/\d+|0?\.\d+)/g)].map((match) => match[1]);
  if (probs.length < 2) return { insufficient: "The probability tree was not drawn: the branch probabilities were not given." };
  const values = probs.slice(0, 2).map((value) => value.includes("/")
    ? Number(value.split("/")[0]) / Number(value.split("/")[1])
    : Number(value));
  if (Math.abs(values[0] + values[1] - 1) > 1e-6) {
    return { insufficient: "The probability tree was not drawn: the first pair of branches does not sum to 1." };
  }
  return {
    category: "solution",
    purpose: "Probability tree",
    node: engineVisualNode("treeEngine", buildTreeModel({ stages: "A,B", probs: `${probs[0]},${probs[1]}`, stage: "solution" })),
    steps: [`The branches ${probs[0]} and ${probs[1]} sum to 1.`],
  };
}

export function recogniseExamFigure(text: string, _instruction: string): Built {
  return angleAtCentre(text)
    ?? sameSegment(text)
    ?? semicircle(text)
    ?? cyclicQuad(text)
    ?? alternateSegment(text)
    ?? coordinateTriangle(text)
    ?? transformation(text)
    ?? vectors(text)
    ?? angleBisector(text)
    ?? locus(text)
    ?? netOrSection(text);
}

export function recogniseChart(text: string): TopicChart | { insufficient: string } | null {
  return histogram(text) ?? pie(text) ?? cumulative(text) ?? graph(text) ?? venn(text) ?? tree(text);
}

/** An engine scene may be inserted only when its mathematics has been checked. */
export function gateExternalScene(scene: unknown): { ok: boolean; flag: string } {
  if (!scene || typeof scene !== "object" || !Array.isArray((scene as GeometryScene).objects)) {
    return { ok: false, flag: "The diagram was not inserted: it could not be checked." };
  }
  const objects = (scene as GeometryScene).objects;
  if (!objects.length) return { ok: false, flag: "The diagram was not inserted: it had no geometry to check." };
  const ids = new Set(objects.filter((object) => object.type === "point").map((object) => object.id));
  for (const object of objects) {
    if (object.type === "point" && (!Number.isFinite(object.x) || !Number.isFinite(object.y))) {
      return { ok: false, flag: "The diagram was not inserted: a point had no real coordinates." };
    }
    if ((object.type === "segment" || object.type === "line" || object.type === "ray") && (!ids.has(object.a) || !ids.has(object.b))) {
      return { ok: false, flag: "The diagram was not inserted: a line did not join two known points." };
    }
    if (object.type === "circle" && (!(object.r > 0) || !ids.has(object.center))) {
      return { ok: false, flag: "The diagram was not inserted: the circle was not a real circle." };
    }
    if (object.type === "angle" && (!ids.has(object.vertex) || !ids.has(object.a) || !ids.has(object.b))) {
      return { ok: false, flag: "The diagram was not inserted: an angle did not use known points." };
    }
  }
  const topic = String((scene as GeometryScene).meta?.topic ?? "");
  const checked = new Set(["bearings", "circle", "circleTheorem", "reflection", "construction", "trigonometry", "elevation", "coordinate", "transformation", "vector", "locus", "histogram", "pie", "cumulative", "net", "section"]);
  if (!checked.has(topic)) {
    return { ok: false, flag: "The diagram was not inserted: it was not checked against the mathematics, so it was not placed in the question." };
  }
  return { ok: true, flag: "" };
}
