// Preset builders — the Universal Line Engine only ships two seeds:
//   • "line"  — a single line the teacher shapes into a segment, ray or vector.
//   • "angle" — two arms meeting at a vertex; the teacher types any angle.
//
// Legacy preset IDs from the asset library map onto one of these two.

import { DEFAULT_LINE, newLineId, type ULELine, type ULEModel } from "./types";

const W = 260, H = 180;

function mkLine(overrides: Partial<ULELine>): ULELine {
  return { ...DEFAULT_LINE, ...overrides, id: overrides.id ?? newLineId() } as ULELine;
}

function radial(cx: number, cy: number, len: number, deg: number, extras: Partial<ULELine> = {}): ULELine {
  const r = (deg * Math.PI) / 180;
  return mkLine({
    ax: cx, ay: cy,
    bx: cx + Math.cos(r) * len,
    by: cy + Math.sin(r) * len,
    ...extras,
  });
}

/** Map legacy asset-library preset IDs to one of the two engine seeds. */
export function normalisePresetId(id: string): "line" | "angle" {
  if (id.toLowerCase().startsWith("angle")) return "angle";
  return "line";
}

export function buildPreset(id: string): ULEModel {
  const kind = normalisePresetId(id);
  const cx = W / 2, cy = H / 2;
  const base = { relations: [], width: W, height: H };

  if (kind === "line") {
    return {
      ...base,
      presetId: "line",
      lines: [mkLine({ ax: 40, ay: cy, bx: W - 40, by: cy })],
      angleMarks: [],
    };
  }

  // angle — two arms sharing endpoint A at the vertex, default 60°
  const len = 90;
  const a = radial(cx, cy, len, 0, { id: "l1" });
  const b = radial(cx, cy, len, -60, { id: "l2" });
  return {
    ...base,
    presetId: "angle",
    lines: [a, b],
    angleMarks: [{
      vertexLineA: "l1", vertexLineB: "l2",
      showArc: true, showValue: true,
      label: "", arcRadius: 22, arcs: 1,
    }],
  };
}
