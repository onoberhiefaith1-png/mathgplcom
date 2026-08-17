// Cavity shading — how an OPENED solid reads as a real hole.
//
// Everything here is derived from the solid's own base colour, so the effect
// works identically for blue, green, purple, orange, red or grey and for any
// future colour. There is no per-hue special case anywhere in this file.
//
// The cues, in the order the eye uses them:
//   1. exterior stays bright              (unchanged material)
//   2. interior walls are clearly darker  (BackSide material)
//   3. the interior darkens with depth    (per-vertex ramp)
//   4. the opening boundary has a lip     (rim colour + weight)

import * as THREE from "three";
import type { Vec3 } from "./scene3d";

export interface CavityPalette {
  /** The solid's own colour — the exterior is never restyled. */
  exterior: string;
  /** Interior wall near the opening. */
  interior: THREE.Color;
  /** Deepest interior surface. */
  interiorDeep: THREE.Color;
  /** Opening boundary lip. */
  rim: string;
  /** Ordinary (non-opening) edge colour. */
  edge: string;
  /**
   * Extra lip weight, 1 → normal. Rises when the base colour is so dark that
   * exterior/interior shading alone cannot carry the opening, so the boundary
   * takes over the job. Keeps the cue colour-independent.
   */
  rimBoost: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Perceived lightness of a colour, 0 (black) → 1 (white).
 * Used to keep the cavity separated from the workspace background whatever
 * the theme is.
 */
export function luminanceOf(color: string | THREE.Color): number {
  const c = color instanceof THREE.Color ? color : new THREE.Color(color);
  return clamp01(0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b);
}

/**
 * Derive the cavity palette from the base colour.
 *
 * `background` is the workspace background: if the derived interior would sit
 * too close to it in value, the interior is pushed further away so the opening
 * can never dissolve into a similar background.
 */
export function cavityPalette(
  baseColor: string,
  opts: { lightTheme: boolean; background?: string } = { lightTheme: true },
): CavityPalette {
  const base = new THREE.Color(baseColor);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);

  // Proportional darkening: the interior is always a fraction of the base
  // lightness, so pale colours drop a lot and dark ones still drop visibly —
  // while never collapsing to black, which would kill the depth gradient.
  let interiorL = clamp01(Math.min(hsl.l * 0.45, Math.max(0.12, hsl.l - 0.12)));
  interiorL = Math.max(interiorL, 0.14);
  // Slightly richer inside so the darkening reads as shading, not as grey.
  const interiorS = clamp01(hsl.s * 1.12 + 0.05);

  const bgL = opts.background ? luminanceOf(opts.background) : opts.lightTheme ? 1 : 0.07;
  // Keep a real value gap between the cavity and whatever sits behind it.
  if (Math.abs(interiorL - bgL) < 0.14) {
    interiorL = bgL > 0.5 ? clamp01(interiorL - 0.18) : clamp01(interiorL + 0.2);
  }
  // Never pitch-black: the interior walls must stay legible, not disappear.
  interiorL = Math.max(interiorL, 0.1);

  const interior = new THREE.Color().setHSL(hsl.h, interiorS, interiorL);
  const interiorDeep = new THREE.Color().setHSL(
    hsl.h,
    clamp01(interiorS * 0.9),
    Math.max(0.05, interiorL * 0.45),
  );

  // The lip contrasts against the exterior, in the exterior's own hue family.
  const rim = new THREE.Color()
    .setHSL(hsl.h, clamp01(hsl.s * 0.6), hsl.l > 0.45 ? Math.max(0.1, hsl.l - 0.38) : clamp01(hsl.l + 0.5))
    .getStyle();

  const edge = new THREE.Color()
    .setHSL(hsl.h, clamp01(hsl.s * 0.35), hsl.l > 0.45 ? Math.max(0.12, hsl.l - 0.3) : clamp01(hsl.l + 0.34))
    .getStyle();

  // How much real contrast did the shading actually achieve? If the base
  // colour is very dark the exterior is already near-black, so lean on the lip.
  const gap = luminanceOf(base) - luminanceOf(interior);
  const rimBoost = gap < 0.12 ? 1.75 : gap < 0.2 ? 1.3 : 1;

  return { exterior: baseColor, interior, interiorDeep, rim, edge, rimBoost };
}

/** An opening: the polygon of a face the teacher has removed (local frame). */
export interface Opening {
  center: Vec3;
  points?: Vec3[];
}

const dist = (a: THREE.Vector3, b: Vec3) => a.distanceTo(new THREE.Vector3(b[0], b[1], b[2]));

function distanceToBoundary(v: THREE.Vector3, pts?: Vec3[]): number {
  if (!pts || pts.length < 2) return Infinity;
  let best = Infinity;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const seg = new THREE.Line3();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a.set(p[0], p[1], p[2]);
    b.set(q[0], q[1], q[2]);
    seg.set(a, b);
    const closest = seg.closestPointToPoint(v, true, new THREE.Vector3());
    best = Math.min(best, closest.distanceTo(v));
  }
  return best;
}

/**
 * Write a per-vertex colour ramp onto `geometry` so the interior gets lighter
 * near the mouth of the cavity and darker the deeper it goes, plus a subtle
 * contact shadow where a wall meets the opening lip.
 *
 * The ramp lives in the solid's LOCAL frame, so it stays correct while the
 * object rotates. Only the BackSide (interior) material consumes it.
 */
export function applyCavityDepthColors(
  geometry: THREE.BufferGeometry,
  openings: Opening[],
  palette: CavityPalette,
): void {
  const pos = geometry.getAttribute("position");
  if (!pos || !openings.length) return;

  const v = new THREE.Vector3();
  const depths = new Float32Array(pos.count);
  const rimNear = new Float32Array(pos.count);
  let max = 0;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let d = Infinity;
    let rimD = Infinity;
    for (const o of openings) {
      d = Math.min(d, dist(v, o.center));
      rimD = Math.min(rimD, distanceToBoundary(v, o.points));
    }
    depths[i] = Number.isFinite(d) ? d : 0;
    rimNear[i] = rimD;
    if (depths[i] > max) max = depths[i];
  }
  if (max <= 0) return;

  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = clamp01(depths[i] / max);
    // Ease so the mouth stays readable and the far wall goes properly deep.
    c.copy(palette.interior).lerp(palette.interiorDeep, t * t * (3 - 2 * t));
    // Contact shadow: a narrow darkening where the wall meets the lip.
    const shade = Number.isFinite(rimNear[i])
      ? 1 - 0.22 * clamp01(1 - rimNear[i] / (max * 0.22))
      : 1;
    colors[i * 3] = c.r * shade;
    colors[i * 3 + 1] = c.g * shade;
    colors[i * 3 + 2] = c.b * shade;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}
