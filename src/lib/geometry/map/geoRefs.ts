// Geometry references inside a mathematical expression.
//
// A `georef` node IS the geometry object: identity lives on `objectId`, and the
// row inside it is only the visible label. Walking the tree — never matching
// text — is the single source of truth for which objects a property links to.

import { type Row, type Node, subRowsOf } from "@/lib/smartboard/mathTree";
import { rowToAscii } from "@/lib/smartboard/rowAscii";

export interface GeoRefUse {
  objectId: string;
  /** Current visible label. Purely cosmetic; may be edited or emptied. */
  label: string;
}

function walk(row: Row, out: GeoRefUse[]): void {
  for (const n of row as Node[]) {
    if (n.kind === "georef") {
      out.push({ objectId: n.objectId, label: rowToAscii(subRowsOf(n)[0] ?? []).trim() });
    }
    if (n.kind === "char") continue;
    for (const sub of subRowsOf(n)) walk(sub, out);
  }
}

/** Every geometry reference in the expression, in reading order. */
export function collectGeoRefs(row: Row): GeoRefUse[] {
  const out: GeoRefUse[] = [];
  walk(row, out);
  return out;
}

/** Distinct object ids the expression links to. */
export function geoRefObjectIds(row: Row): string[] {
  return [...new Set(collectGeoRefs(row).map((r) => r.objectId))];
}
