import { pointById, type GeoLabel, type GeoObject, type GeometryScene } from "./scene";

export interface Position { x: number; y: number }
export interface Placement extends Position { angle: number }
export interface PuzzlePiece {
  id: string;
  name: string;
  scene: GeometryScene;
  visible: string[];
  origin: Position;
  anchors: Position[];
  variants: Position[][];
  signature: string;
  canRotate: boolean;
  previewRadius: number;
  isText: boolean;
  joints: Position[];
}

const TAU = Math.PI * 2;
const TOLERANCE = 5;
export const distance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y);
const direction = (a: Position, b: Position) => Math.atan2(b.y - a.y, b.x - a.x);
const unit = (angle: number) => ({ x: Math.cos(angle), y: Math.sin(angle) });
const from = (p: Position, angle: number, radius: number): Position => {
  const u = unit(angle);
  return { x: p.x + radius * u.x, y: p.y + radius * u.y };
};
const average = (points: Position[]): Position => ({
  x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
  y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
});

export function transform(point: Position, origin: Position, pose: Placement): Position {
  const x = point.x - origin.x;
  const y = point.y - origin.y;
  return {
    x: pose.x + x * Math.cos(pose.angle) - y * Math.sin(pose.angle),
    y: pose.y + x * Math.sin(pose.angle) + y * Math.cos(pose.angle),
  };
}

const objectKey = (id: string) => JSON.stringify([id]);
const textKey = (id: string, field: string) => JSON.stringify([id, field]);

export function puzzleSelection(scene: GeometryScene): string[] {
  const config = scene.meta?.diagramPuzzle;
  if (!config || typeof config !== "object" || !("pieces" in config) || !Array.isArray(config.pieces)) return [];
  return config.pieces.filter((id): id is string => typeof id === "string");
}

export function withPuzzleSelection(scene: GeometryScene, pieces: string[], order?: string[]): GeometryScene {
  return { ...scene, meta: { ...scene.meta, diagramPuzzle: { pieces, ...(order ? { order } : {}) } } };
}

export function puzzleGroups(scene: GeometryScene): string[][] {
  const config = scene.meta?.diagramPuzzle as { groups?: unknown } | undefined;
  const ids = new Set(puzzleSelection(scene));
  const used = new Set<string>();
  const groups = Array.isArray(config?.groups) ? config.groups.flatMap((group) => {
    if (!Array.isArray(group)) return [];
    const members = group.filter((id): id is string => {
      if (typeof id !== "string" || !ids.has(id) || used.has(id)) return false;
      used.add(id);
      return true;
    });
    return members.length ? [members] : [];
  }) : [];
  return [...groups, ...[...ids].filter((id) => !used.has(id)).map((id) => [id])];
}

export function puzzleJointMarks(scene: GeometryScene): number {
  const config = scene.meta?.diagramPuzzle as { jointMarks?: unknown } | undefined;
  const marks = config?.jointMarks;
  return typeof marks === "number" && Number.isInteger(marks) && marks >= 1 && marks <= 5 ? marks : 2;
}

export function withPuzzleGroups(scene: GeometryScene, groups: string[][], jointMarks: number): GeometryScene {
  const next = withPuzzleSelection(scene, groups.flat(), groups.map((group) => group[0]));
  return { ...next, meta: { ...next.meta, diagramPuzzle: { ...(next.meta?.diagramPuzzle as object), groups, jointMarks } } };
}

export function puzzleTrayOrder(scene: GeometryScene): string[] | undefined {
  const config = scene.meta?.diagramPuzzle;
  if (!config || typeof config !== "object" || !("order" in config) || !Array.isArray(config.order)) return undefined;
  return config.order.filter((id): id is string => typeof id === "string");
}

export function arrangePuzzleTray<T extends { id: string }>(pieces: T[], order?: string[]): T[] {
  if (!order) return shuffledPieces(pieces);
  const remaining = new Map(pieces.map((piece) => [piece.id, piece]));
  const arranged: T[] = [];
  for (const id of order) {
    const piece = remaining.get(id);
    if (!piece) continue;
    arranged.push(piece);
    remaining.delete(id);
  }
  return [...arranged, ...remaining.values()];
}

function attachedText(scene: GeometryScene, object: GeoObject) {
  const labels: { id: string; field: string; label: GeoLabel }[] = [];
  const add = (
    field: string, value: string | undefined, p: Position,
    offset?: { dx: number; dy: number }, fontSize?: number, color?: string, rotation?: number,
  ) => {
    if (!value) return;
    const id = textKey(object.id, field);
    labels.push({
      id, field,
      label: {
        id, type: "label", text: value,
        x: p.x + (offset?.dx ?? 0), y: p.y + (offset?.dy ?? 0),
        fontSize, color, rotation,
      },
    });
  };
  if (object.type === "point" && !object.hidden) {
    add("label", object.label, object, object.labelOffset ?? { dx: 6, dy: -6 }, object.labelFontSize, object.color);
  }
  if (object.type === "segment") {
    const a = pointById(scene, object.a);
    const b = pointById(scene, object.b);
    if (a && b) {
      const middle = average([a, b]);
      const angle = direction(a, b);
      const upright = Math.atan(Math.tan(angle)) * 180 / Math.PI;
      const normal = (size: number) => ({ dx: -Math.sin(angle) * size, dy: Math.cos(angle) * size });
      add("label", object.label, middle, object.labelOffset ?? normal(14), 13, object.color,
        object.labelRotate ? upright : undefined);
      add("distance", object.distance ?? object.length, middle, object.distanceOffset ?? normal(-14),
        object.distanceFontSize ?? 12, object.distanceColor ?? object.color);
      add("lineText", object.lineText, middle, object.lineTextOffset ?? normal(28),
        object.lineTextFontSize, object.lineTextColor ?? object.color, upright);
    }
  }
  if (object.type === "angle" && object.marker !== "right") {
    const v = pointById(scene, object.vertex);
    const a = pointById(scene, object.a);
    const b = pointById(scene, object.b);
    if (v && a && b) {
      const start = direction(v, a);
      const sweep = Math.PI - (start - direction(v, b) + 3 * Math.PI) % TAU;
      const base = from(v, start + sweep / 2 + (object.reflex ? Math.PI : 0), (object.arcRadius ?? 18) + 12);
      const half = 3.4 * String(object.value ?? "").length + 4;
      const x = Math.min(Math.max(base.x + (object.valueOffset?.dx ?? 0), half - 24), scene.bounds.width + 24 - half);
      const y = Math.min(Math.max(base.y + (object.valueOffset?.dy ?? 0), -14), scene.bounds.height + 18);
      add("value", object.value, { x, y }, undefined, object.valueFontSize ?? 12, object.valueColor);
    }
  }
  return labels;
}

function removeText(object: GeoObject, fields: Set<string>): GeoObject {
  switch (object.type) {
    case "segment": return {
      ...object,
      label: fields.has("label") ? undefined : object.label,
      distance: fields.has("distance") ? undefined : object.distance,
      length: fields.has("distance") ? undefined : object.length,
      lineText: fields.has("lineText") ? undefined : object.lineText,
    };
    case "point": return fields.has("label") ? { ...object, label: undefined } : object;
    case "angle": return fields.has("value") ? { ...object, value: undefined } : object;
    default: return object;
  }
}

function geometry(scene: GeometryScene, object: GeoObject) {
  const points = (...ids: string[]) => {
    const found = ids.map((id) => pointById(scene, id));
    return found.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)) ? found as Position[] : [];
  };
  let anchors: Position[] = [];
  let variants: Position[][] = [];
  let attributes: unknown[] = [];
  switch (object.type) {
    case "point":
      anchors = object.hidden ? [] : [object];
      attributes = [object.label];
      break;
    case "label":
      if (typeof object.text !== "string" || !object.text.trim()) break;
      anchors = [object];
      attributes = [object.text.trim()];
      break;
    case "segment":
    case "line":
    case "ray": {
      anchors = points(object.a, object.b);
      attributes = [object.dashed ?? false];
      if (object.type === "segment") {
        attributes.push(object.label, object.distance ?? object.length, object.lineText,
          object.marks ?? null, object.parallelMarks ?? 0, object.arrow ?? "none");
        if (object.arrow === "start" || object.arrow === "end") {
          // Canonicalize to the direction of the arrow.
          if (object.arrow === "start") anchors.reverse();
          attributes[attributes.length - 1] = "end";
        } else if (!object.label && !object.distance && !object.length && !object.lineText) {
          variants = [[...anchors].reverse()];
        }
      } else if (object.type === "line") {
        variants = [[...anchors].reverse()];
      }
      break;
    }
    case "angle": {
      const [v, a, b] = points(object.vertex, object.a, object.b);
      if (v && a && b) {
        const radius = object.arcRadius ?? 18;
        anchors = [v, from(v, direction(v, a), radius), from(v, direction(v, b), radius)];
        variants = [[v, anchors[2], anchors[1]]];
      }
      attributes = [object.marker ?? "arc", !!object.reflex, object.value];
      break;
    }
    case "region":
    case "polygon": {
      anchors = points(...(object.type === "region" ? object.boundary : object.points));
      const edges = object.type === "region" ? object.edges : undefined;
      const curved = edges?.some((edge) => edge.kind !== "straight" && edge.kind !== "segment");
      if (!curved) {
        for (const order of [anchors, [...anchors].reverse()]) {
          order.forEach((_, i) => variants.push([...order.slice(i), ...order.slice(0, i)]));
        }
      }
      attributes = [object.fill, object.type === "polygon" ? object.label : object.opacity];
      if (curved) {
        attributes.push(edges?.map((edge) => edge.kind));
        // Include the referenced geometry for curved boundaries so different
        // enclosed areas with the same vertices cannot grade as equivalent.
        for (const edge of edges ?? []) {
          if (edge.kind !== "arc" && edge.kind !== "circle" && edge.kind !== "curve") continue;
          const source = scene.objects.find((item) => item.id === edge.ref);
          if (source && (source.type === "arc" || source.type === "circle" || source.type === "curve")) {
            const shape = geometry(scene, source);
            anchors.push(...shape.anchors);
            attributes.push(shape.signature, "sweep" in edge ? edge.sweep ?? "short" : null);
          }
        }
      }
      break;
    }
    case "circle":
      anchors = points(object.center);
      attributes = [object.r, object.fill, object.fillOpacity, object.label];
      break;
    case "arc": {
      const [center] = points(object.center);
      if (center) anchors = [center, from(center, -object.from * Math.PI / 180, object.r),
        from(center, -object.to * Math.PI / 180, object.r)];
      attributes = [object.r, (object.to - object.from + 360) % 360, object.fill, object.fillOpacity];
      break;
    }
    case "curve":
      anchors = points(...(object.a && object.mid && object.b ? [object.a, object.mid, object.b] : object.points ?? []));
      variants = [[...anchors].reverse()];
      attributes = [object.fill, object.fillOpacity, object.dashed ?? false];
      break;
  }
  return {
    anchors,
    variants,
    signature: JSON.stringify([object.type, ...attributes]),
    canRotate: anchors.length > 1,
  };
}

const nameFor = (object: GeoObject) => {
  if (object.type === "label") return object.text;
  if (object.type === "point") return object.label || "Point";
  if (object.type === "segment") return object.label || "Line segment";
  if (object.type === "angle") return object.marker === "right" ? "Right-angle marker" : "Angle";
  if (object.type === "region") return "Shaded region";
  return object.type[0].toUpperCase() + object.type.slice(1);
};

export function buildDiagramPuzzle(scene: GeometryScene, ids: string[]) {
  const selected = new Set(ids);
  const extractedFields = new Map<string, Set<string>>();
  const independentText: GeoLabel[] = [];
  const textSockets: { ownerId?: string; point: Position }[] = [];
  for (const object of scene.objects) {
    for (const { id, field, label } of attachedText(scene, object)) {
      if (!selected.has(id)) continue;
      if (!extractedFields.has(object.id)) extractedFields.set(object.id, new Set());
      extractedFields.get(object.id)!.add(field);
      independentText.push(label);
      textSockets.push({ ownerId: object.id, point: label });
    }
  }
  const objects = scene.objects.map((object) => {
    const fields = extractedFields.get(object.id);
    return fields ? removeText(object, fields) : object;
  });
  const workingScene = { bounds: scene.bounds, objects: [...objects, ...independentText] };
  const pieces: PuzzlePiece[] = [];
  const removed = new Set<string>();
  const addPiece = (object: GeoObject, id: string, attached: GeoLabel[] = []) => {
    const shape = geometry(workingScene, object);
    if (!shape.anchors.length || shape.anchors.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return;
    const visible = [object.id, ...attached.map((label) => label.id)];
    visible.forEach((key) => removed.add(key));
    const attachedAnchors = attached.map(({ x, y }) => ({ x, y }));
    const original = scene.objects.find((item) => item.id === object.id);
    const inlineLabels = original ? attachedText(scene, original)
      .filter((entry) => !selected.has(entry.id)).map((entry) => entry.label) : [];
    const annotations = [...attachedAnchors, ...inlineLabels];
    const origin = object.type === "angle" ? shape.anchors[0] : average(shape.anchors);
    const previewRadius = Math.max(
      20,
      ...shape.anchors.map((point) => distance(point, origin)),
      ...annotations.map((point) => distance(point, origin)),
      object.type === "circle" || object.type === "arc" ? object.r : 0,
      object.type === "label" ? object.text.length * (object.fontSize ?? 13) * 0.27 : 0,
    ) + 12;
    pieces.push({
      ...shape, id, name: nameFor(object), scene: workingScene, visible, isText: object.type === "label",
      origin, previewRadius,
      joints: object.type === "angle" ? shape.anchors.slice(0, 1)
        : object.type === "segment" || object.type === "line" || object.type === "ray" || object.type === "point"
          || object.type === "region" || object.type === "polygon" ? shape.anchors : [],
      variants: [shape.anchors, ...shape.variants]
        .filter((_, index) => index === 0 || annotations.length === 0)
        .map((order) => [...order, ...annotations]),
      signature: JSON.stringify([shape.signature, ...attached.map((label) => label.text.trim())]),
    });
  };
  for (const object of objects) {
    if (!selected.has(objectKey(object.id))) continue;
    const attached = objects.filter((label): label is GeoLabel =>
      label.type === "label" && label.ownerId === object.id && !selected.has(objectKey(label.id)));
    addPiece(object, objectKey(object.id), attached);
    if (object.type === "label") textSockets.push({ ownerId: object.ownerId, point: object });
  }
  for (const label of independentText) addPiece(label, label.id);
  const scaffold = objects.filter((object) => !removed.has(object.id) && !(object.type === "point" && object.hidden));
  const byId = new Map(pieces.map((piece) => [piece.id, piece]));
  const groups = puzzleGroups(scene).filter((group) => group.some((id) => selected.has(id)));
  const ordered = groups.flatMap((group) => {
    const members = group.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
    if (members.length < 2) return members;
    const canonical = [...members].sort((a, b) => a.signature.localeCompare(b.signature) ||
      a.origin.x - b.origin.x || a.origin.y - b.origin.y);
    const anchors = canonical.flatMap((piece) => piece.anchors);
    const origin = average(anchors);
    return [{
      id: group[0],
      name: members.map((piece) => piece.name).join(" + "),
      scene: workingScene,
      visible: members.flatMap((piece) => piece.visible),
      origin,
      anchors,
      joints: members.flatMap((piece) => piece.joints),
      variants: [canonical.flatMap((piece) => piece.variants[0])],
      signature: JSON.stringify(canonical.map((piece) => piece.signature)),
      canRotate: canonical.some((piece) => piece.canRotate) || anchors.some((point) => distance(point, origin) > 1),
      previewRadius: Math.max(...members.map((piece) => distance(piece.origin, origin) + piece.previewRadius)),
      isText: false,
    }];
  });
  const groupedIds = new Set(groups.flat());
  return {
    pieces: [...ordered, ...pieces.filter((piece) => !groupedIds.has(piece.id))],
    scene: workingScene,
    scaffoldIds: scaffold.map((object) => object.id),
    textSockets,
    scaffoldAnchors: scaffold.flatMap((object) => geometry(workingScene, object).anchors),
  };
}

export function puzzleChoices(scene: GeometryScene) {
  return scene.objects.flatMap((object) => {
    const id = objectKey(object.id);
    const main = geometry(scene, object).anchors.length ? [{ id, name: nameFor(object), objectId: object.id }] : [];
    return [...main, ...attachedText(scene, object).map(({ id, label }) => ({
      id, name: label.text, objectId: object.id,
    }))];
  });
}

export function shuffledPieces<T>(pieces: T[]) {
  const order = [...pieces];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function snapPlacement(piece: PuzzlePiece, pose: Placement, targets: Position[], radius: number): Placement {
  const current = piece.anchors.map((anchor) => transform(anchor, piece.origin, pose));
  let nearest = radius;
  let result = pose;
  for (const anchor of current) {
    for (const target of targets) {
      const gap = distance(anchor, target);
      if (gap >= nearest) continue;
      nearest = gap;
      result = { ...pose, x: pose.x + target.x - anchor.x, y: pose.y + target.y - anchor.y };
    }
  }
  return result;
}

export function snapRotation(
  piece: PuzzlePiece, pose: Placement, pivot: Position, targets: Position[], radius: number,
): Placement {
  let nearest = radius;
  let adjustment = 0;
  for (const anchor of piece.anchors) {
    const point = transform(anchor, piece.origin, pose);
    const length = distance(point, pivot);
    if (length < 1) continue;
    for (const target of targets) {
      if (Math.abs(distance(target, pivot) - length) > TOLERANCE / 2) continue;
      const gap = distance(point, target);
      if (gap >= nearest) continue;
      nearest = gap;
      adjustment = direction(pivot, target) - direction(pivot, point);
    }
  }
  return {
    ...transform(pose, pivot, { ...pivot, angle: adjustment }),
    angle: pose.angle + adjustment,
  };
}

export function gradeDiagramPuzzle(
  pieces: PuzzlePiece[], placements: ReadonlyMap<string, Placement>, anchored: boolean,
): boolean {
  if (!pieces.length || placements.size !== pieces.length) return false;
  const placed = pieces.map((piece) => {
    const pose = placements.get(piece.id);
    if (!pose || ![pose.x, pose.y, pose.angle].every(Number.isFinite)) return null;
    return piece.variants.map((order) => order.map((point) => transform(point, piece.origin, pose)));
  });
  if (placed.some((piece) => !piece)) return false;

  const fits = (origin: Position, pose: Placement) => {
    const edges = pieces.map((piece) => {
      const expected = piece.variants[0].map((point) => transform(point, origin, pose));
      return pieces.flatMap((candidate, j) =>
        candidate.signature === piece.signature && placed[j]!.some((order) =>
          order.length === expected.length && order.every((point, k) => distance(point, expected[k]) <= TOLERANCE))
          ? [j] : []);
    });
    const owners = new Map<number, number>();
    const match = (index: number, seen: Set<number>): boolean => edges[index].some((candidate) => {
      if (seen.has(candidate)) return false;
      seen.add(candidate);
      const owner = owners.get(candidate);
      if (owner !== undefined && !match(owner, seen)) return false;
      owners.set(candidate, index);
      return true;
    });
    return edges.every((_, index) => match(index, new Set()));
  };

  if (anchored) return fits({ x: 0, y: 0 }, { x: 0, y: 0, angle: 0 });

  // A long baseline keeps the inferred rotation stable despite drop tolerance.
  const reference = pieces.flatMap((piece, index) => piece.variants[0].map((point, at) => ({ piece, index, at, point })));
  let first = reference[0];
  let second = first;
  let longest = 0;
  for (const a of reference) {
    for (const b of reference) {
      const length = distance(a.point, b.point);
      if (length <= longest) continue;
      first = a;
      second = b;
      longest = length;
    }
  }
  const candidates = (item: typeof first) => pieces.flatMap((piece, index) =>
    piece.signature === item.piece.signature ? placed[index]!.map((order, variant) => ({ index, variant, point: order[item.at] })).filter((choice) => !!choice.point) : []);
  for (const a of candidates(first)) {
    if (!longest && fits(first.point, { ...a.point, angle: 0 })) return true;
    for (const b of candidates(second)) {
      if (first.index === second.index ? a.index !== b.index || a.variant !== b.variant : a.index === b.index) continue;
      if (Math.abs(distance(a.point, b.point) - longest) > TOLERANCE * 2) continue;
      const angle = direction(a.point, b.point) - direction(first.point, second.point);
      if (fits(first.point, { ...a.point, angle })) return true;
    }
  }
  return false;
}

/** Score each authored shared vertex at most once, even at a three-way join. */
export function scorePuzzleJoints(
  pieces: PuzzlePiece[], placements: ReadonlyMap<string, Placement>, marks: number,
  complete = false,
) {
  const vertices: { point: Position; pairs: [PuzzlePiece, PuzzlePiece][] }[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const first = pieces[i];
    for (const second of pieces.slice(i + 1)) {
      for (const point of first.joints) {
        if (!second.joints.some((other) => distance(point, other) < 0.01)) continue;
        let vertex = vertices.find((joint) => distance(joint.point, point) < 0.01);
        if (!vertex) {
          vertex = { point, pairs: [] };
          vertices.push(vertex);
        }
        if (!vertex.pairs.some(([a, b]) => a === first && b === second)) vertex.pairs.push([first, second]);
      }
    }
  }
  const correct = complete ? vertices.length : vertices.filter(({ point, pairs }) =>
    pairs.some(([a, b]) => {
      const pa = placements.get(a.id);
      const pb = placements.get(b.id);
      if (!pa || !pb) return false;
      if (distance(transform(point, a.origin, pa), transform(point, b.origin, pb)) > TOLERANCE) return false;
      const pairPlacements = new Map([[a.id, pa], [b.id, pb]]);
      return gradeDiagramPuzzle([a, b], pairPlacements, false);
    })).length;
  return { correct, total: vertices.length, earned: correct * marks, available: vertices.length * marks };
}
