// Classroom label settings — which annotations a lesson displays.
// Kept dependency-free so both the scene model and the labeling engine can use
// it without an import cycle.

export type EdgeDisplay = "name" | "length" | "both";

export interface LabelSettings {
  vertices: boolean;
  edges: boolean;
  faces: boolean;
  angles: boolean;
  radius: boolean;
  diameter: boolean;
  height: boolean;
  slantHeight: boolean;
  measurements: boolean;
  coordinates: boolean;
  construction: boolean;
  /** Hide (rather than fade) labels that sit behind the solid. */
  hideOccluded: boolean;
  edgeDisplay: EdgeDisplay;
}

// These are CATEGORY MASTER SWITCHES only. They can hide a whole category, but
// they never reveal anything: an individual annotation is drawn only when the
// teacher has switched that item on (Annotation3D.visible === true).
// A freshly inserted solid therefore always appears completely clean.
export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  vertices: true,
  edges: true,
  faces: true,
  angles: true,
  radius: true,
  diameter: true,
  height: true,
  slantHeight: true,
  measurements: true,
  coordinates: true,
  construction: true,
  hideOccluded: false,
  edgeDisplay: "name",
};

export function sanitizeLabelSettings(raw: unknown): LabelSettings {
  const r = (raw ?? {}) as Partial<LabelSettings>;
  const b = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  return {
    vertices: b(r.vertices, DEFAULT_LABEL_SETTINGS.vertices),
    edges: b(r.edges, DEFAULT_LABEL_SETTINGS.edges),
    faces: b(r.faces, DEFAULT_LABEL_SETTINGS.faces),
    angles: b(r.angles, DEFAULT_LABEL_SETTINGS.angles),
    radius: b(r.radius, DEFAULT_LABEL_SETTINGS.radius),
    diameter: b(r.diameter, DEFAULT_LABEL_SETTINGS.diameter),
    height: b(r.height, DEFAULT_LABEL_SETTINGS.height),
    slantHeight: b(r.slantHeight, DEFAULT_LABEL_SETTINGS.slantHeight),
    measurements: b(r.measurements, DEFAULT_LABEL_SETTINGS.measurements),
    coordinates: b(r.coordinates, DEFAULT_LABEL_SETTINGS.coordinates),
    construction: b(r.construction, DEFAULT_LABEL_SETTINGS.construction),
    hideOccluded: b(r.hideOccluded, DEFAULT_LABEL_SETTINGS.hideOccluded),
    edgeDisplay:
      r.edgeDisplay === "length" || r.edgeDisplay === "both" ? r.edgeDisplay : "name",
  };
}
