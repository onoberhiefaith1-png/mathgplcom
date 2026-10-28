import * as THREE from "three";
import { cachedGeometry, q } from "@/lib/slate/vfx/geometryCache";

export function extrudedShape(
  key: string,
  points: Array<[number, number]>,
  depth: number,
  bevel = 0.025,
) {
  return cachedGeometry(key, () => {
    const shape = new THREE.Shape();
    points.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelSegments: 3,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: 6,
    });
    geometry.translate(0, 0, -depth);
    geometry.computeVertexNormals();
    return geometry;
  });
}

export function facetedPanel(width: number, height: number, depth: number, cut: number) {
  const x = width / 2;
  const y = height / 2;
  return extrudedShape(
    `facet:${q(width)}:${q(height)}:${q(depth)}:${q(cut)}`,
    [[-x + cut, -y], [x - cut, -y], [x, -y + cut], [x, y - cut], [x - cut, y], [-x + cut, y], [-x, y - cut], [-x, -y + cut]],
    depth,
    Math.min(cut * 0.32, 0.035),
  );
}

export function plaquePanel(width: number, height: number, depth: number) {
  const x = width / 2;
  const y = height / 2;
  const shoulder = Math.min(0.16, width * 0.1);
  return extrudedShape(
    `plaque:${q(width)}:${q(height)}:${q(depth)}`,
    [
      [-x + shoulder, -y], [x - shoulder, -y], [x - shoulder * 0.45, -y + shoulder * 0.45],
      [x, -y + shoulder], [x, y - shoulder], [x - shoulder * 0.45, y - shoulder * 0.45],
      [x - shoulder, y], [-x + shoulder, y], [-x + shoulder * 0.45, y - shoulder * 0.45],
      [-x, y - shoulder], [-x, -y + shoulder], [-x + shoulder * 0.45, -y + shoulder * 0.45],
    ],
    depth,
    0.024,
  );
}

export function ribbonPanel(width: number, height: number, depth: number) {
  return cachedGeometry(`ribbon:${q(width)}:${q(height)}:${q(depth)}`, () => {
    const x = width / 2;
    const y = height / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-x, -y * 0.78);
    shape.bezierCurveTo(-width * 0.25, -y * 1.18, width * 0.2, -y * 0.62, x, -y * 0.92);
    shape.lineTo(x, y * 0.78);
    shape.bezierCurveTo(width * 0.22, y * 1.15, -width * 0.2, y * 0.62, -x, y * 0.94);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.018,
      bevelThickness: 0.018,
      curveSegments: 12,
    });
    geometry.translate(0, 0, -depth);
    geometry.computeVertexNormals();
    return geometry;
  });
}

export function tubeGeometry(key: string, points: THREE.Vector3[], radius: number, closed = false) {
  return cachedGeometry(key, () => {
    const curve = new THREE.CatmullRomCurve3(points, closed, "catmullrom", 0.35);
    return new THREE.TubeGeometry(curve, Math.max(24, points.length * 8), radius, 8, closed);
  });
}

export function finialProfile() {
  return cachedGeometry("premium-finial", () => new THREE.LatheGeometry([
    new THREE.Vector2(0, -0.18),
    new THREE.Vector2(0.035, -0.15),
    new THREE.Vector2(0.075, -0.1),
    new THREE.Vector2(0.055, -0.045),
    new THREE.Vector2(0.095, 0),
    new THREE.Vector2(0.06, 0.065),
    new THREE.Vector2(0.082, 0.11),
    new THREE.Vector2(0.03, 0.16),
    new THREE.Vector2(0, 0.2),
  ], 24));
}