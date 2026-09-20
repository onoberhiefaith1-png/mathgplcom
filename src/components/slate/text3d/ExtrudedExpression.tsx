import { useEffect, useMemo, useState } from "react";
import * as opentype from "opentype.js";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cachedGeometry, q } from "@/lib/slate/vfx/geometryCache";
import { glyphSolid } from "./glyphSolids";
import type { GlyphBox } from "./glyphLayout";
import type { ResolvedTextStyle } from "@/lib/slate/textPresets";

const fontCache = new Map<string, Promise<opentype.Font>>();

function loadFont(url: string) {
  let pending = fontCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Font could not be loaded: ${url}`);
        return response.arrayBuffer();
      })
      .then((buffer) => opentype.parse(buffer));
    fontCache.set(url, pending);
  }
  return pending;
}


interface Props {
  boxes: GlyphBox[];
  fontUrl: string;
  fontSize: number;
  style: ResolvedTextStyle;
  opacity: number;
}

/** Real bevelled geometry, laid out by the same Troika pass used for editing. */
export function ExtrudedExpression({ boxes, fontUrl, fontSize, style, opacity }: Props) {
  const [font, setFont] = useState<opentype.Font | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    void loadFont(fontUrl)
      .then((loaded) => {
        if (live) setFont(loaded);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [fontUrl]);

  // One cache key per rendered expression: the same equation, size and style
  // never rebuilds its glyph solids, so re-rendering the slate is free.
  const key = useMemo(
    () =>
      [
        fontUrl,
        q(fontSize),
        style.preset,
        q(style.bevel, 4),
        q(style.extrude, 4),
        boxes.map((b) => `${b.char}${q(b.x)},${q(b.y)},${q(b.w)},${q(b.h)}`).join("|"),
      ].join("~"),
    [boxes, fontSize, fontUrl, style.bevel, style.extrude, style.preset],
  );

  const geometry = useMemo(() => {
    if (!font || failed || boxes.length === 0 || boxes.length > 120) return null;
    return cachedGeometry(key, () => buildExpression(font, fontUrl, boxes, fontSize, style));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [font, failed, key]);

  if (!geometry) return null;
  return <ExpressionMesh geometry={geometry} style={style} fontSize={fontSize} opacity={opacity} />;
}

function buildExpression(
  font: opentype.Font,
  fontKey: string,
  boxes: GlyphBox[],
  fontSize: number,
  style: ResolvedTextStyle,
) {
  {
    const pieces: THREE.BufferGeometry[] = [];
    const materialGroups: { start: number; count: number; materialIndex: number }[] = [];
    let vertexOffset = 0;
    const physicalDepth = Math.max(fontSize * 0.11, style.extrude * fontSize);
    // The bevel is only the transition from face to side. Keeping it narrow
    // prevents the depth colour from swallowing the dominant front face.
    const bevelSize = Math.min(fontSize * 0.035, Math.max(0.001, style.bevel * fontSize * 0.55));

    for (const box of boxes) {
      // Cached per character: the same glyph solid is never extruded twice.
      const solid = glyphSolid(font, fontKey, box.char, fontSize, {
        depth: physicalDepth,
        bevelSize,
        bevelSegments: style.preset === "bubble" ? 3 : 2,
        curveSegments: boxes.length > 50 ? 3 : 5,
      });
      if (!solid) continue;
      const bounds = solid.bounds;
      const sourceW = Math.max(0.0001, bounds.x2 - bounds.x1);
      const sourceH = Math.max(0.0001, bounds.y2 - bounds.y1);
      const geometryForGlyph = solid.geometry.clone();
      const fit = Math.min(1.18, (box.w * 0.98) / sourceW, (box.h * 1.02) / sourceH);
      // OpenType and Troika use opposite vertical axes. Flip the completed
      // solid while preserving the font's original contour/hole winding.
      geometryForGlyph.scale(fit, -fit, 1);
      // A subtle oblique extrusion keeps the front-facing equation readable
      // while revealing real gold side walls below/right of the blue cap.
      const positions = geometryForGlyph.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const z = positions.getZ(i);
        const progress = THREE.MathUtils.clamp(z / Math.max(physicalDepth, 0.001), 0, 1);
        positions.setX(i, positions.getX(i) - physicalDepth * 0.12 * progress);
        positions.setY(i, positions.getY(i) + physicalDepth * 0.16 * progress);
      }
      positions.needsUpdate = true;
      const centreX = (bounds.x1 + bounds.x2) * 0.5 * fit;
      const centreY = (bounds.y1 + bounds.y2) * 0.5 * fit;
      geometryForGlyph.translate(box.x - centreX, box.y + centreY, 0);
      for (const group of geometryForGlyph.groups) {
        materialGroups.push({
          start: vertexOffset + group.start,
          count: group.count,
          materialIndex: group.materialIndex === 0 ? 0 : 1,
        });
      }
      vertexOffset += geometryForGlyph.getAttribute("position").count;
      pieces.push(geometryForGlyph);
    }

    if (pieces.length === 0) return new THREE.BufferGeometry();
    const merged = mergeGeometries(pieces, false);
    for (const piece of pieces) piece.dispose();
    if (!merged) return new THREE.BufferGeometry();
    merged.clearGroups();
    for (const group of materialGroups) {
      merged.addGroup(group.start, group.count, group.materialIndex);
    }
    merged.computeVertexNormals();
    merged.computeBoundingSphere();
    return merged;
  }
}

/** Materials only — the geometry behind it is shared and never rebuilt here. */
function ExpressionMesh({ geometry, style, fontSize, opacity }: {
  geometry: THREE.BufferGeometry;
  style: ResolvedTextStyle;
  fontSize: number;
  opacity: number;
}) {
  const crystal = style.preset === "crystal";
  const neon = style.preset === "neon";
  const stone = style.preset === "stone";
  const bubble = style.preset === "bubble";

  // PERFORMANCE: every line used to own two physical materials of its own, so a
  // 50-line Game carried a hundred identical materials and the renderer uploaded
  // each one separately. Lines that share a text style now share one pair.
  const materials = useMemo(
    () =>
      cachedTextMaterials(
        [
          style.preset,
          style.face,
          style.side,
          style.glow,
          q(fontSize),
          q(opacity, 2),
        ].join("~"),
        () => {
          const face = new THREE.MeshPhysicalMaterial({
            color: style.face,
            side: THREE.DoubleSide,
            transparent: opacity < 1 || crystal,
            opacity: crystal ? opacity * 0.78 : opacity,
            roughness: stone ? 0.82 : bubble ? 0.24 : crystal ? 0.12 : 0.28,
            metalness: stone || crystal || bubble ? 0.04 : 0.12,
            clearcoat: stone ? 0 : 0.75,
            clearcoatRoughness: bubble ? 0.2 : 0.12,
            transmission: crystal ? 0.22 : 0,
            thickness: crystal ? fontSize * 0.12 : 0,
            emissive: new THREE.Color(neon ? style.glow : style.face),
            emissiveIntensity: neon ? 0.55 : crystal ? 0.22 : stone ? 0.16 : 0.3,
          });
          const side = new THREE.MeshPhysicalMaterial({
            color: style.side,
            side: THREE.DoubleSide,
            transparent: opacity < 1 || crystal,
            opacity: crystal ? opacity * 0.86 : opacity,
            roughness: stone ? 0.88 : bubble ? 0.3 : crystal ? 0.14 : 0.32,
            metalness: stone || crystal || bubble ? 0.03 : 0.34,
            clearcoat: stone ? 0 : 0.68,
            clearcoatRoughness: 0.16,
            emissive: new THREE.Color(neon ? style.side : "#000000"),
            emissiveIntensity: neon ? 0.28 : 0,
          });
          return [face, side];
        },
      ),
    [bubble, crystal, fontSize, neon, opacity, stone, style],
  );

  return <mesh geometry={geometry} material={materials} castShadow />;
}

const materialCache = new Map<string, THREE.MeshPhysicalMaterial[]>();

function cachedTextMaterials(key: string, build: () => THREE.MeshPhysicalMaterial[]) {
  const hit = materialCache.get(key);
  if (hit) {
    materialCache.delete(key);
    materialCache.set(key, hit);
    return hit;
  }
  const built = build();
  materialCache.set(key, built);
  if (materialCache.size > 48) {
    const oldest = materialCache.keys().next().value;
    if (oldest !== undefined) {
      materialCache.get(oldest)?.forEach((material) => material.dispose());
      materialCache.delete(oldest);
    }
  }
  return built;
}