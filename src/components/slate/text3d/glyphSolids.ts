// One bevelled solid per glyph, built once and reused everywhere.
//
// PERFORMANCE: extruding and triangulating a bevelled glyph is the most
// expensive synchronous thing the slate does. Caching whole expressions is not
// enough — changing one character used to rebuild every glyph of that line on
// the main thread, which is exactly the frame the player tapped on. Digits and
// operators repeat constantly across lines, so caching the solid per glyph
// turns almost every later build into a lookup. Geometry produced here is
// never mutated: callers clone before scaling, shifting or translating.

import * as opentype from "opentype.js";
import * as THREE from "three";

export interface GlyphSolid {
  geometry: THREE.ExtrudeGeometry;
  bounds: { x1: number; y1: number; x2: number; y2: number };
}

export interface GlyphSolidOptions {
  depth: number;
  bevelSize: number;
  bevelSegments: number;
  curveSegments: number;
}

const LIMIT = 512;
const cache = new Map<string, GlyphSolid>();

function pathToShapes(path: opentype.Path) {
  const drawing = new THREE.ShapePath();
  for (const command of path.commands) {
    if (command.type === "M") drawing.moveTo(command.x, command.y);
    if (command.type === "L") drawing.lineTo(command.x, command.y);
    if (command.type === "Q") drawing.quadraticCurveTo(command.x1, command.y1, command.x, command.y);
    if (command.type === "C") {
      drawing.bezierCurveTo(command.x1, command.y1, command.x2, command.y2, command.x, command.y);
    }
    if (command.type === "Z") drawing.currentPath?.closePath();
  }
  return drawing.toShapes(false);
}

const q = (value: number) => value.toFixed(4);

/**
 * The unpositioned solid for one character, in font units scaled to `fontSize`.
 * Returns null when the font has no such glyph.
 */
export function glyphSolid(
  font: opentype.Font,
  fontKey: string,
  char: string,
  fontSize: number,
  options: GlyphSolidOptions,
): GlyphSolid | null {
  if (!font.hasChar(char)) return null;
  const key = [
    fontKey,
    char,
    q(fontSize),
    q(options.depth),
    q(options.bevelSize),
    options.bevelSegments,
    options.curveSegments,
  ].join("~");

  const hit = cache.get(key);
  if (hit) {
    // refresh recency
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  const path = font.getPath(char, 0, 0, fontSize);
  const box = path.getBoundingBox();
  const geometry = new THREE.ExtrudeGeometry(pathToShapes(path), {
    depth: options.depth,
    bevelEnabled: true,
    bevelThickness: options.bevelSize * 0.65,
    bevelSize: options.bevelSize,
    bevelSegments: options.bevelSegments,
    curveSegments: options.curveSegments,
    steps: 1,
  });
  const solid: GlyphSolid = {
    geometry,
    bounds: { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 },
  };
  cache.set(key, solid);
  if (cache.size > LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.get(oldest)?.geometry.dispose();
      cache.delete(oldest);
    }
  }
  return solid;
}

/** Test/diagnostic helper. */
export const glyphSolidCacheSize = () => cache.size;

/** Dropped after a lost graphics context, so nothing dead is reused. */
export function clearGlyphSolidCache() {
  cache.forEach((solid) => solid.geometry.dispose());
  cache.clear();
}
