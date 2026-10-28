// Smart Coordinate Plane — component data model.
// Mirrors the Smart Geometry Editor's Component shape so panel controls
// (label / colour / thickness / dash / visibility) work identically.

export type CoordMode =
  | "cartesian4" | "cartesian1" | "polar" | "complex" | "isometric" | "dot";

export interface CoordView {
  xMin: number; xMax: number; yMin: number; yMax: number;
  gridStep: number; minorPerMajor?: number; equalScale?: boolean;
}

export interface CoordDisplay {
  showGrid: boolean; showMinor: boolean; showAxes: boolean;
  showNumbers: boolean; snap: boolean;
  axisColor: string; gridColor: string; bgColor: string;
}

export interface CoordPoint {
  x: number; y: number;
  locked?: boolean; hidden?: boolean; labelHidden?: boolean;
}

export type CurveKind =
  | "fn"        // y = f(x)
  | "sine" | "cosine" | "tangent"
  | "parabola" | "cubic" | "exponential" | "log" | "abs"
  | "circleEq"; // (x-h)^2 + (y-k)^2 = r^2

export type CoordComponentKind =
  | "point" | "segment" | "ray" | "line" | "vector"
  | "polygon" | "circle" | "arc" | "curve" | "label" | "angleMark";

export interface CoordComponent {
  id: string;
  kind: CoordComponentKind;
  /** point names referenced by this component (e.g. ["A","B"] for segment) */
  nodes?: string[];
  /** function / curve params */
  curve?: {
    kind: CurveKind;
    /** expression in x (fn), or params like a,b,c,h,k,r */
    expr?: string;
    a?: number; b?: number; c?: number;
    h?: number; k?: number; r?: number;
  };
  appearance?: {
    color?: string; fill?: string; opacity?: number;
    thickness?: number; dash?: "solid" | "dashed" | "dotted";
    arrow?: "none" | "end" | "both";
  };
  behaviour?: { visible?: boolean; locked?: boolean; layer?: number };
  content?: {
    label?: string;
    showLabel?: boolean; showLength?: boolean; showValue?: boolean;
    labelPos?: "auto" | "above" | "below" | "left" | "right";
  };
}

export interface CoordPlaneAttrs {
  family: "coordPlane";
  mode: CoordMode;
  view: CoordView;
  display: CoordDisplay;
  points: Record<string, CoordPoint>;
  components: CoordComponent[];
  selectedId?: string | null;
}

export const DEFAULT_DISPLAY: CoordDisplay = {
  showGrid: true, showMinor: false, showAxes: true, showNumbers: true, snap: true,
  axisColor: "currentColor", gridColor: "hsl(var(--border))", bgColor: "transparent",
};

export const DEFAULT_VIEW: CoordView = {
  xMin: -10, xMax: 10, yMin: -10, yMax: 10, gridStep: 1, minorPerMajor: 5, equalScale: true,
};

export function defaultAttrs(): CoordPlaneAttrs {
  return {
    family: "coordPlane",
    mode: "cartesian4",
    view: { ...DEFAULT_VIEW },
    display: { ...DEFAULT_DISPLAY },
    points: {},
    components: [],
    selectedId: null,
  };
}

export function newId(prefix = "c"): string {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`;
}

export function nextPointName(existing: Set<string>): string {
  const A = "A".charCodeAt(0);
  for (let i = 0; i < 26; i++) {
    const n = String.fromCharCode(A + i);
    if (!existing.has(n)) return n;
  }
  let i = 1;
  while (existing.has(`P${i}`)) i++;
  return `P${i}`;
}

export function displayName(c: CoordComponent): string {
  if (c.content?.label) return c.content.label;
  const n = c.nodes ?? [];
  switch (c.kind) {
    case "point":    return n[0] ?? "Point";
    case "segment":  return `Segment ${n.join("")}`;
    case "ray":      return `Ray ${n.join("→")}`;
    case "line":     return `Line ${n.join("")}`;
    case "vector":   return `Vector ${n.join("→")}`;
    case "polygon":  return `Polygon ${n.join("")}`;
    case "circle":   return `Circle ${n.join("")}`;
    case "arc":      return `Arc ${n.join("")}`;
    case "curve":    return `Curve ${c.curve?.kind ?? ""}`;
    case "label":    return "Label";
    case "angleMark":return `∠${n.join("")}`;
  }
}

// ── expression evaluator with x ──────────────────────────────────────────
// Very small parser: numbers, + - * / ^, parentheses, unary -, x,
// pi, e, sin, cos, tan, asin, acos, atan, sqrt, abs, ln, log, exp.

const FNS: Record<string, (a: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs,
  ln: Math.log, log: Math.log10, exp: Math.exp,
};

export function compileFn(src: string): ((x: number) => number) | null {
  if (!src.trim()) return null;
  // strip leading "y=" or "f(x)="
  let s = src.trim().replace(/^y\s*=\s*/i, "").replace(/^f\s*\(\s*x\s*\)\s*=\s*/i, "");
  s = s.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-")
       .replace(/²/g, "^2").replace(/³/g, "^3").replace(/√/g, "sqrt");
  // implicit multiplication: 2x -> 2*x, )( -> )*(
  s = s.replace(/(\d)([a-zA-Z(])/g, "$1*$2").replace(/\)(\()/g, ")*(");
  try {
    // Safe subset — allow only [0-9.+\-*/^()xa-z_ ] plus commas
    if (!/^[-+*/^().,\sxa-z0-9_]+$/i.test(s)) return null;
    // eslint-disable-next-line no-new-func
    const body = translate(s);
    // eslint-disable-next-line no-new-func
    const f = new Function("x", "F", "PI", "E", `return (${body});`);
    return (x: number) => {
      try { const v = f(x, FNS, Math.PI, Math.E); return Number.isFinite(v) ? v : NaN; }
      catch { return NaN; }
    };
  } catch { return null; }
}

function translate(s: string): string {
  // ^ -> **
  let out = s.replace(/\^/g, "**");
  // pi, e
  out = out.replace(/\bpi\b/gi, "PI").replace(/\be\b/g, "E");
  // fn( -> F.fn(
  out = out.replace(/\b(sin|cos|tan|asin|acos|atan|sqrt|abs|ln|log|exp)\s*\(/gi,
    (_m, name) => `F.${name.toLowerCase()}(`);
  return out;
}
