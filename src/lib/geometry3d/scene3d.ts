// Scene3D — the universal data model for the 3D Geometry Workspace.
//
// There is ONE workspace and ONE scene model for every 3D solid. New solids
// are added to SOLID_GROUPS + the geometry registry in Scene3DCanvas — never
// as a new editor.

import {
  DEFAULT_LABEL_SETTINGS, sanitizeLabelSettings, type LabelSettings,
} from "./labelSettings";

export type { LabelSettings, EdgeDisplay } from "./labelSettings";
export { DEFAULT_LABEL_SETTINGS } from "./labelSettings";


export type Solid3DKind =
  // prisms
  | "cube"
  | "cuboid"
  | "triangularPrism"
  | "pentagonalPrism"
  | "hexagonalPrism"
  // pyramids
  | "squarePyramid"
  | "tetrahedron"
  | "pentagonalPyramid"
  | "hexagonalPyramid"
  // curved solids
  | "cylinder"
  | "cone"
  | "sphere"
  | "hemisphere"
  | "frustum"
  // other
  | "octahedron";

export interface SolidKindDef {
  kind: Solid3DKind;
  label: string;
  /** Default shape-specific parameters. */
  params: Record<string, number>;
  /** Editable numeric parameters shown in the inspector. */
  fields: { key: string; label: string; min: number; max: number; step: number; integer?: boolean }[];
}

// Mathematical dimensions are real-world values: 0.5 mm and 5 km are both valid.
const LEN = (key: string, label: string) => ({ key, label, min: 0.001, max: 1_000_000, step: 0.1 });
const SIDES = { key: "sides", label: "Sides", min: 3, max: 24, step: 1, integer: true };

export const SOLID_DEFS: Record<Solid3DKind, SolidKindDef> = {
  cube: { kind: "cube", label: "Cube", params: { size: 2 }, fields: [LEN("size", "Edge length")] },
  cuboid: {
    kind: "cuboid", label: "Cuboid", params: { width: 2.4, height: 1.6, depth: 1.2 },
    fields: [LEN("width", "Width"), LEN("height", "Height"), LEN("depth", "Depth")],
  },
  triangularPrism: {
    kind: "triangularPrism", label: "Triangular Prism", params: { radius: 1.2, height: 2, sides: 3 },
    fields: [LEN("radius", "Base radius"), LEN("height", "Height")],
  },
  pentagonalPrism: {
    kind: "pentagonalPrism", label: "Pentagonal Prism", params: { radius: 1.2, height: 2, sides: 5 },
    fields: [LEN("radius", "Base radius"), LEN("height", "Height")],
  },
  hexagonalPrism: {
    kind: "hexagonalPrism", label: "Hexagonal Prism", params: { radius: 1.2, height: 2, sides: 6 },
    fields: [LEN("radius", "Base radius"), LEN("height", "Height")],
  },
  squarePyramid: {
    kind: "squarePyramid", label: "Square Pyramid", params: { radius: 1.4, height: 2, sides: 4 },
    fields: [LEN("radius", "Base radius"), LEN("height", "Height")],
  },
  tetrahedron: {
    kind: "tetrahedron", label: "Triangular Pyramid (Tetrahedron)", params: { radius: 1.4, height: 2, sides: 3 },
    fields: [LEN("radius", "Base radius"), LEN("height", "Height")],
  },
  pentagonalPyramid: {
    kind: "pentagonalPyramid", label: "Pentagonal Pyramid", params: { radius: 1.3, height: 2, sides: 5 },
    fields: [LEN("radius", "Base radius"), LEN("height", "Height")],
  },
  hexagonalPyramid: {
    kind: "hexagonalPyramid", label: "Hexagonal Pyramid", params: { radius: 1.3, height: 2, sides: 6 },
    fields: [LEN("radius", "Base radius"), LEN("height", "Height")],
  },
  cylinder: {
    kind: "cylinder", label: "Cylinder", params: { radius: 1, height: 2.2 },
    fields: [LEN("radius", "Radius"), LEN("height", "Height")],
  },
  cone: {
    kind: "cone", label: "Cone", params: { radius: 1.1, height: 2.2 },
    fields: [LEN("radius", "Base radius"), LEN("height", "Height")],
  },
  sphere: { kind: "sphere", label: "Sphere", params: { radius: 1.2 }, fields: [LEN("radius", "Radius")] },
  hemisphere: { kind: "hemisphere", label: "Hemisphere", params: { radius: 1.2 }, fields: [LEN("radius", "Radius")] },
  frustum: {
    kind: "frustum", label: "Frustum of a Cone", params: { radius: 1.3, topRadius: 0.6, height: 2 },
    fields: [LEN("radius", "Base radius"), LEN("topRadius", "Top radius"), LEN("height", "Height")],
  },
  octahedron: {
    kind: "octahedron", label: "Octahedron", params: { radius: 1.3 },
    fields: [LEN("radius", "Radius")],
  },
};

export const SOLID_GROUPS: { label: string; kinds: Solid3DKind[] }[] = [
  { label: "Prisms", kinds: ["cube", "cuboid", "triangularPrism", "pentagonalPrism", "hexagonalPrism"] },
  { label: "Pyramids", kinds: ["squarePyramid", "tetrahedron", "pentagonalPyramid", "hexagonalPyramid"] },
  { label: "Curved solids", kinds: ["cylinder", "cone", "sphere", "hemisphere", "frustum"] },
  { label: "Other solids", kinds: ["octahedron"] },
];

export type Vec3 = [number, number, number];

export type DisplayMode = "wireframe" | "solid";

export interface Solid3D {
  id: string;
  kind: Solid3DKind;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  /** Shape-specific numeric parameters (radius, height, sides, …). */
  params?: Record<string, number>;
  /** Visual size only — never part of the mathematics. 1 = 100%. */
  display?: { scale: number };
  style?: { display?: DisplayMode; color?: string };
  /**
   * Topological face indices the teacher has OPENED (Open Face). The geometry
   * is untouched — an open face is simply not drawn, so the solid behaves like
   * a hollow container that can be inspected from inside and closed again.
   */
  openFaces?: number[];
  /** Reserved for future labels / measurements / angles. */
  annotations?: unknown[];

}


export type ThemeMode = "light" | "dark" | "auto";

export interface Scene3DSettings {
  theme: ThemeMode;
  showGrid: boolean;
  gridColor: string;
  gridOpacity: number;
  showAxisX: boolean;
  showAxisY: boolean;
  showAxisZ: boolean;
  axisThickness: number;
  axisLabels: boolean;
  backgroundColor: string;
  backgroundBrightness: number;
  showOrigin: boolean;
  coordinateLabels: boolean;
  defaultDisplay: DisplayMode;
}

/** A mathematical element of a solid an annotation can attach to. */
export interface ElementRef {
  solidId: string;
  /** face | edge | vertex | point | vertexPair | edgePair | facePair | edgeFace | world */
  kind: string;
  index?: number;
  indices?: number[];
}

/** Per-annotation appearance. Construction lines never inherit the solid colour. */
export interface AnnotationStyle {
  lineColor?: string;
  lineWidth?: number;
  opacity?: number;
  labelText?: string;
  labelSize?: number;
}

/**
 * Annotations attach to a mathematical feature (face/edge/vertex/point) so
 * they survive resizing in Workspace Mode. Types used across Lesson Modes:
 *   highlight | label | measurement | shade | angle | point | segment | plane |
 *   ghost | netFold | construction
 *
 * The calculation engine always computes every value; an annotation is only
 * DRAWN when the teacher has switched it on (`visible === true`).
 */
export interface Annotation3D {
  id: string;
  type: string;
  target: ElementRef;
  text?: string;
  color?: string;
  /** Teacher-controlled visibility. Absent / false = calculated but not drawn. */
  visible?: boolean;
  /** Per-item styling (line colour, thickness, opacity, label size). */
  style?: AnnotationStyle;
  /** World-space position for point-kind annotations. */
  position?: Vec3;
  /** Free-form payload (transform matrix, plane spec, fold amount, …). */
  data?: Record<string, unknown>;
}

/** Display gate — the single rule every renderer obeys. */
export function isAnnotationVisible(a: Annotation3D): boolean {
  return a.visible === true;
}

/** Annotation types that are structural rather than teacher-revealed labels. */
export const ALWAYS_ON_ANNOTATIONS = new Set(["ghost", "plane", "netFold"]);

/** Filter used by every render path. */
export function visibleAnnotations(list: Annotation3D[] | undefined): Annotation3D[] {
  return (list ?? []).filter((a) => ALWAYS_ON_ANNOTATIONS.has(a.type) || isAnnotationVisible(a));
}

export type LessonModeId =
  | "facesEdgesVertices"
  | "properties"
  | "measurements"
  | "angles"
  | "surfaceArea"
  | "volume"
  | "nets"
  | "crossSections"
  | "coordinates"
  | "transformations";

export interface LessonState {
  /** null = the teacher is in Workspace Mode. */
  mode: LessonModeId | null;
  showLabels: boolean;
  /** Classroom "Show Labels" toggles. */
  labels: LabelSettings;
}

export const DEFAULT_LESSON: LessonState = {
  mode: null,
  showLabels: true,
  labels: { ...DEFAULT_LABEL_SETTINGS },
};


export interface Scene3D {
  version: 1;
  objects: Solid3D[];
  camera?: { position: Vec3; target: Vec3 };
  settings?: Scene3DSettings;
  /** Mathematical annotations bound to elements of the objects. */
  annotations?: Annotation3D[];
  lesson?: LessonState;
}


export const DEFAULT_CAMERA: { position: Vec3; target: Vec3 } = {
  position: [4, 3, 5],
  target: [0, 0, 0],
};

export const DEFAULT_SETTINGS: Scene3DSettings = {
  // The 3D / TVD workspace opens as a clean white teaching canvas.
  // Teachers can still switch the theme/background to dark at any time.
  theme: "light",
  showGrid: true,
  gridColor: "#8d93ad",
  gridOpacity: 0.6,
  showAxisX: true,
  showAxisY: true,
  showAxisZ: true,
  axisThickness: 2,
  axisLabels: true,
  backgroundColor: "#ffffff",
  backgroundBrightness: 1,
  showOrigin: true,
  coordinateLabels: false,
  defaultDisplay: "wireframe",
};


export const LIGHT_BACKGROUND = "#f6f7fb";
export const DARK_BACKGROUND = "#0d0b1e";

export const EMPTY_SCENE_3D: Scene3D = {
  version: 1,
  objects: [],
  annotations: [],
  lesson: DEFAULT_LESSON,
  camera: DEFAULT_CAMERA,

  settings: DEFAULT_SETTINGS,
};

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function vec3(raw: unknown, fallback: Vec3): Vec3 {
  if (Array.isArray(raw) && raw.length === 3 && raw.every(isNum)) {
    return [raw[0], raw[1], raw[2]] as Vec3;
  }
  return [...fallback] as Vec3;
}

const KNOWN_KINDS = new Set(Object.keys(SOLID_DEFS) as Solid3DKind[]);

/** Legacy kinds from the first version of the workspace. */
const LEGACY_KIND_MAP: Record<string, Solid3DKind> = {
  prism: "triangularPrism",
  pyramid: "squarePyramid",
};

function normalizeKind(raw: unknown): Solid3DKind {
  if (typeof raw === "string") {
    if (KNOWN_KINDS.has(raw as Solid3DKind)) return raw as Solid3DKind;
    if (LEGACY_KIND_MAP[raw]) return LEGACY_KIND_MAP[raw];
  }
  return "cube";
}

let idCounter = 0;
export function newId(prefix = "solid") {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** Create a solid with sensible mathematical defaults. */
export function createSolid(kind: Solid3DKind, display: DisplayMode = "wireframe"): Solid3D {
  const def = SOLID_DEFS[normalizeKind(kind)];
  return {
    id: newId(def.kind),
    kind: def.kind,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    params: { ...def.params },
    display: { scale: 1 },
    style: { display },
  };
}

export function duplicateSolid(solid: Solid3D, offset = 1.2): Solid3D {
  return {
    ...solid,
    id: newId(solid.kind),
    position: [solid.position[0] + offset, solid.position[1], solid.position[2] + offset],
    params: solid.params ? { ...solid.params } : undefined,
    display: solid.display ? { ...solid.display } : undefined,
    style: solid.style ? { ...solid.style } : undefined,
    openFaces: solid.openFaces ? [...solid.openFaces] : undefined,

  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function sanitizeSettings(raw: unknown): Scene3DSettings {
  const r = (raw ?? {}) as Partial<Scene3DSettings>;
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const str = (v: unknown, d: string) => (typeof v === "string" && v ? v : d);
  return {
    theme: r.theme === "light" || r.theme === "auto" || r.theme === "dark" ? r.theme : DEFAULT_SETTINGS.theme,
    showGrid: bool(r.showGrid, DEFAULT_SETTINGS.showGrid),
    gridColor: str(r.gridColor, DEFAULT_SETTINGS.gridColor),
    gridOpacity: isNum(r.gridOpacity) ? clamp(r.gridOpacity, 0, 1) : DEFAULT_SETTINGS.gridOpacity,
    showAxisX: bool(r.showAxisX, true),
    showAxisY: bool(r.showAxisY, true),
    showAxisZ: bool(r.showAxisZ, true),
    axisThickness: isNum(r.axisThickness) ? clamp(r.axisThickness, 1, 8) : DEFAULT_SETTINGS.axisThickness,
    axisLabels: bool(r.axisLabels, DEFAULT_SETTINGS.axisLabels),
    backgroundColor: str(r.backgroundColor, DEFAULT_SETTINGS.backgroundColor),
    backgroundBrightness: isNum(r.backgroundBrightness) ? clamp(r.backgroundBrightness, 0.2, 2) : 1,
    showOrigin: bool(r.showOrigin, DEFAULT_SETTINGS.showOrigin),
    coordinateLabels: bool(r.coordinateLabels, DEFAULT_SETTINGS.coordinateLabels),
    defaultDisplay: r.defaultDisplay === "solid" ? "solid" : "wireframe",
  };
}

/** Defensive parse — tolerates legacy / unknown fields so old notes never break. */
export function sanitizeScene3D(raw: unknown): Scene3D {
  if (!raw || typeof raw !== "object") {
    return { version: 1, objects: [], annotations: [], lesson: { ...DEFAULT_LESSON }, camera: { ...DEFAULT_CAMERA }, settings: { ...DEFAULT_SETTINGS } };
  }
  const r = raw as Partial<Scene3D> & Record<string, unknown>;
  const objects: Solid3D[] = Array.isArray(r.objects)
    ? r.objects.flatMap((o) => {
        if (!o || typeof o !== "object") return [];
        const obj = o as Partial<Solid3D> & { style?: Record<string, unknown> };
        const kind = normalizeKind(obj.kind);
        const rawStyle = (obj.style ?? {}) as Record<string, unknown>;
        const display: DisplayMode =
          rawStyle.display === "solid" ? "solid" : "wireframe";
        return [{
          id: typeof obj.id === "string" && obj.id ? obj.id : newId(kind),
          kind,
          position: vec3(obj.position, [0, 0, 0]),
          rotation: vec3(obj.rotation, [0, 0, 0]),
          scale: vec3(obj.scale, [1, 1, 1]),
          params: { ...SOLID_DEFS[kind].params, ...(obj.params && typeof obj.params === "object" ? obj.params : {}) },
          display: { scale: isNum(obj.display?.scale) && obj.display!.scale > 0 ? obj.display!.scale : 1 },
          style: {
            display,
            color: typeof rawStyle.color === "string" ? (rawStyle.color as string) : undefined,
          },
          openFaces: Array.isArray(obj.openFaces)
            ? Array.from(new Set(
                (obj.openFaces as unknown[])
                  .filter((n) => isNum(n) && (n as number) >= 0)
                  .map((n) => Math.round(n as number)),
              )).sort((a, b) => a - b)
            : undefined,
          annotations: Array.isArray(obj.annotations) ? obj.annotations : undefined,

        }];
      })
    : [];

  const cam = r.camera as Scene3D["camera"] | undefined;
  const knownIds = new Set(objects.map((o) => o.id));
  const annotations: Annotation3D[] = Array.isArray(r.annotations)
    ? (r.annotations as unknown[]).flatMap((a) => {
        if (!a || typeof a !== "object") return [];
        const an = a as Partial<Annotation3D> & { target?: Partial<ElementRef> };
        const t = an.target;
        if (!t || typeof t.solidId !== "string") return [];
        // world-scoped annotations (points, planes, ghosts) use solidId '__world'.
        if (!t.solidId.startsWith("__") && !knownIds.has(t.solidId)) return [];
        if (typeof t.kind !== "string" || !t.kind) return [];
        const type = typeof an.type === "string" && an.type ? an.type : "highlight";
        const indices = Array.isArray(t.indices) && t.indices.every(isNum)
          ? (t.indices as number[]).map((n) => Math.round(n))
          : undefined;
        return [{
          id: typeof an.id === "string" && an.id ? an.id : newId("ann"),
          type,
          target: {
            solidId: t.solidId,
            kind: t.kind,
            index: isNum(t.index) ? Math.round(t.index) : undefined,
            indices,
          },
          text: typeof an.text === "string" ? an.text : undefined,
          color: typeof an.color === "string" ? an.color : undefined,
          visible: an.visible === true,
          style: an.style && typeof an.style === "object" ? { ...(an.style as AnnotationStyle) } : undefined,
          position: Array.isArray(an.position) && an.position.length === 3 && an.position.every(isNum)
            ? [an.position[0], an.position[1], an.position[2]] as Vec3
            : undefined,
          data: an.data && typeof an.data === "object" ? (an.data as Record<string, unknown>) : undefined,
        } as Annotation3D];
      })
    : [];

  const rawLesson = (r.lesson ?? {}) as Partial<LessonState>;
  const lesson: LessonState = {
    mode: typeof rawLesson.mode === "string" ? (rawLesson.mode as LessonModeId) : null,
    showLabels: typeof rawLesson.showLabels === "boolean" ? rawLesson.showLabels : true,
    labels: sanitizeLabelSettings(rawLesson.labels),
  };


  return {
    version: 1,
    objects,
    annotations,
    lesson,
    camera: cam
      ? { position: vec3(cam.position, DEFAULT_CAMERA.position), target: vec3(cam.target, DEFAULT_CAMERA.target) }
      : { ...DEFAULT_CAMERA },
    settings: sanitizeSettings(r.settings),

  };
}

/** Backgrounds that are treated as "the default paper" for a theme, so
 *  flipping the theme flips the canvas even when the teacher never picked a
 *  custom colour. Any other colour is respected verbatim. */
const NEUTRAL_LIGHT = new Set([LIGHT_BACKGROUND, "#ffffff", "#fff", "#FFFFFF"]);

/** Resolve the effective background for a theme choice. */
export function resolveBackground(settings: Scene3DSettings): string {
  const bg = settings.backgroundColor;
  if (settings.theme === "light") return bg === DARK_BACKGROUND ? LIGHT_BACKGROUND : bg;
  if (settings.theme === "dark") return NEUTRAL_LIGHT.has(bg) ? DARK_BACKGROUND : bg;
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  if (prefersDark) return NEUTRAL_LIGHT.has(bg) ? DARK_BACKGROUND : bg;
  return bg === DARK_BACKGROUND ? LIGHT_BACKGROUND : bg;
}


/** True when the resolved workspace theme is light (used for label contrast). */
export function isLightTheme(settings: Scene3DSettings): boolean {
  const bg = resolveBackground(settings);
  const hex = bg.replace("#", "");
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}
