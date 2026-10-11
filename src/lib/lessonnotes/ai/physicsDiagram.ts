// Physics Diagram Engine — builds native, editable Physics diagrams from the
// meaning Copilot writes in a [DIAGRAM ...] directive, exactly like the Maths
// diagram engine. It never consults the Asset Library or pastes a picture.
//
// Kinds: free-body, circuit, ray (reflection/refraction), wave, field lines.

type P = Record<string, string | undefined>;

export type PhysicsDiagramKind = "freeBody" | "circuit" | "ray" | "wave" | "fieldLines";

export type Direction = "up" | "down" | "left" | "right";

export interface PhysicsItem {
  id: string;
  /** force | cell | resistor | lamp | switch | ammeter | voltmeter | ... */
  type: string;
  label: string;
  dir?: Direction;
  /** For a meter in parallel: the id/label of the component it is across. */
  across?: string;
  /** "series" (on the main loop) or "parallel" (across another component). */
  placement?: "series" | "parallel";
}

export interface PhysicsDiagramModel {
  kind: PhysicsDiagramKind;
  title: string;
  items: PhysicsItem[];
  meta: Record<string, string>;
}

export const CIRCUIT_PARTS = ["cell", "battery", "resistor", "lamp", "switch", "ammeter", "voltmeter", "bulb", "rheostat", "fuse"];

/** Which Physics diagram (if any) a requested type names. */
export function classifyPhysicsDiagram(raw: string): PhysicsDiagramKind | null {
  const k = (raw || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return null;
  if (/freebody|forcediagram|forces?$/.test(k)) return "freeBody";
  if (/circuit/.test(k)) return "circuit";
  if (/raydiagram|refraction|reflection|glassblock|mirror|lens/.test(k)) return "ray";
  if (/wave|transverse|longitudinal/.test(k)) return "wave";
  if (/field|magnet|fieldlines/.test(k)) return "fieldLines";
  return null;
}

const dirOf = (s: string | undefined): Direction | undefined => {
  const d = (s ?? "").trim().toLowerCase();
  if (/^(up|upward|upwards|north)$/.test(d)) return "up";
  if (/^(down|downward|downwards|south)$/.test(d)) return "down";
  if (/^(left|west)$/.test(d)) return "left";
  if (/^(right|east)$/.test(d)) return "right";
  return undefined;
};

const parts = (s: string | undefined) => (s ?? "").split(";").map((x) => x.trim()).filter(Boolean);

/** forces="Weight W = 20 N:down; Normal reaction R:up; Push 5 N:right" */
function freeBody(p: P): PhysicsDiagramModel {
  const items: PhysicsItem[] = parts(p.forces).map((f, i) => {
    const at = f.lastIndexOf(":");
    const label = at >= 0 ? f.slice(0, at).trim() : f;
    const dir = at >= 0 ? dirOf(f.slice(at + 1)) : undefined;
    return { id: `f${i + 1}`, type: "force", label, dir: dir ?? (["down", "up", "right", "left"][i % 4] as Direction) };
  });
  return { kind: "freeBody", title: p.title ?? "Free-body diagram", items, meta: { body: p.body ?? "Body" } };
}

/** components="cell:6 V; resistor:R = 4 Ω; ammeter:A"  parallel="voltmeter:V:resistor" */
function circuit(p: P): PhysicsDiagramModel {
  const items: PhysicsItem[] = [];
  parts(p.components ?? p.series).forEach((c, i) => {
    const [type, ...rest] = c.split(":");
    items.push({ id: `c${i + 1}`, type: type.trim().toLowerCase(), label: rest.join(":").trim() || type.trim(), placement: "series" });
  });
  parts(p.parallel).forEach((c, i) => {
    const [type, label = "", across = ""] = c.split(":").map((x) => x.trim());
    items.push({ id: `p${i + 1}`, type: type.toLowerCase(), label: label || type, placement: "parallel", across });
  });
  return { kind: "circuit", title: p.title ?? "Circuit diagram", items, meta: {} };
}

function ray(p: P): PhysicsDiagramModel {
  const mode = /reflect|mirror/.test((p.mode ?? p.type ?? "").toLowerCase()) ? "reflection" : "refraction";
  return {
    kind: "ray", title: p.title ?? (mode === "reflection" ? "Reflection at a plane mirror" : "Refraction through a glass block"),
    items: [
      { id: "i", type: "angle", label: p.i ?? "i" },
      { id: "r", type: "angle", label: p.r ?? "r" },
    ],
    meta: { mode, medium: p.medium ?? (mode === "reflection" ? "Plane mirror" : "Glass") },
  };
}

function wave(p: P): PhysicsDiagramModel {
  const longitudinal = /longitudinal|sound/.test((p.wave ?? p.mode ?? p.type ?? "").toLowerCase());
  return {
    kind: "wave", title: p.title ?? (longitudinal ? "Longitudinal wave" : "Transverse wave"),
    items: [
      { id: "lambda", type: "label", label: p.wavelength ?? "λ" },
      { id: "amp", type: "label", label: p.amplitude ?? "A" },
    ],
    meta: { mode: longitudinal ? "longitudinal" : "transverse" },
  };
}

function fieldLines(p: P): PhysicsDiagramModel {
  const src = (p.source ?? p.type ?? "").toLowerCase();
  return {
    kind: "fieldLines", title: p.title ?? "Magnetic field lines",
    items: [{ id: "src", type: /wire|current/.test(src) ? "wire" : "barMagnet", label: p.label ?? "" }],
    meta: {},
  };
}

export function buildPhysicsDiagram(p: P): PhysicsDiagramModel | null {
  const kind = classifyPhysicsDiagram(p.type ?? p.kind ?? p.object ?? "");
  switch (kind) {
    case "freeBody": return freeBody(p);
    case "circuit": return circuit(p);
    case "ray": return ray(p);
    case "wave": return wave(p);
    case "fieldLines": return fieldLines(p);
    default: return null;
  }
}

/** Wiring rules a correct school circuit must obey. Empty list = valid. */
export function validateCircuit(m: PhysicsDiagramModel): string[] {
  const errors: string[] = [];
  const series = m.items.filter((x) => x.placement !== "parallel");
  const parallel = m.items.filter((x) => x.placement === "parallel");
  for (const x of m.items) if (!CIRCUIT_PARTS.includes(x.type)) errors.push(`Unknown component "${x.type}".`);
  if (!series.some((x) => x.type === "cell" || x.type === "battery")) errors.push("The circuit needs a cell or battery.");
  if (series.length < 2) errors.push("The loop needs at least one component besides the source.");
  for (const x of parallel) {
    if (x.type === "ammeter") errors.push("An ammeter must be connected in series, never in parallel.");
    const target = series.find((s) => s.type === x.across.toLowerCase() || s.label === x.across || s.id === x.across);
    if (!target) errors.push(`${x.label || x.type} must be connected across a component in the loop.`);
  }
  for (const x of series) if (x.type === "voltmeter") errors.push("A voltmeter must be connected in parallel, never in series.");
  return errors;
}
