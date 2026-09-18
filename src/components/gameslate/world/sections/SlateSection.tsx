import { useMemo } from "react";
import * as THREE from "three";
import type { NumberSettings } from "@/lib/slate/types";
import { defaultNumberSettings } from "@/lib/slate/defaults";
import type { PbrMaps } from "../pbr";
import { seeded, type Construction } from "./construction";

/** Lightens (t > 0) or darkens (t < 0) a hex colour. */
const tintOf = (hex: string, t: number) => {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(t >= 0 ? "#ffffff" : "#000000"), Math.abs(t));
  return `#${c.getHexString()}`;
};

/**
 * The section marker, drawn as a cut in the material rather than flat text:
 * a dark interior offset into the surface and a lit lip on the opposite edge,
 * with the chosen colour rendered faithfully as the body.
 */
const plateCache = new Map<string, THREE.Texture>();
function numeralPlate(index: number, n: NumberSettings): THREE.Texture {
  const ink = n.colour ?? "#e6d7b4";
  const sunk = n.relief !== "raised";
  const key = [index, ink, n.depth, n.bevel, n.shadow, n.contrast, n.relief].join("|");
  const hit = plateCache.get(key);
  if (hit) return hit;

  const S = 160;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, S, S);
  ctx.font = "700 92px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = String(index + 1);
  const dir = sunk ? 1 : -1;
  const cut = 3.2 * Math.max(0.15, n.depth);
  const lip = 2.6 * Math.max(0.15, n.bevel);

  // contact shadow hugging the cut
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${Math.min(0.85, 0.5 * n.shadow)})`;
  ctx.shadowBlur = 7 * Math.max(0.2, n.shadow);
  ctx.fillStyle = tintOf(ink, -0.8);
  ctx.globalAlpha = Math.min(1, 0.8 * n.contrast);
  ctx.fillText(label, S / 2, S / 2 + dir * cut);
  ctx.restore();

  // lit lip on the opposite edge
  ctx.globalAlpha = Math.min(1, 0.75 * n.contrast);
  ctx.fillStyle = tintOf(ink, 0.6);
  ctx.fillText(label, S / 2, S / 2 - dir * lip);

  // the body: exactly the chosen colour
  ctx.globalAlpha = 1;
  ctx.fillStyle = ink;
  ctx.fillText(label, S / 2, S / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  plateCache.set(key, texture);
  return texture;
}

/** Box whose outer edges are broken up, so no section is machine-straight. */
function brokenBox(w: number, h: number, d: number, jitter: number, seed: number) {
  const geometry = new THREE.BoxGeometry(w, h, d, 8, 6, 1);
  const position = geometry.attributes["position"] as THREE.BufferAttribute;
  const amount = jitter * 0.05;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const n = (k: number) => (seeded(seed + i * 0.17, k) - 0.5) * amount;
    if (Math.abs(Math.abs(x) - w / 2) < 1e-4) position.setX(i, x + n(1));
    if (Math.abs(Math.abs(y) - h / 2) < 1e-4) position.setY(i, y + n(2));
    if (z > 0) position.setZ(i, z + n(3) * 0.6);
  }
  geometry.computeVertexNormals();
  return geometry;
}

interface Props {
  index: number;
  width: number;
  height: number;
  maps: PbrMaps;
  build: Construction;
  physical?: "glass" | "ice" | undefined;
  accent: string;
  numbers?: NumberSettings;
  /** Transparent slate: no material at all, only a faint outline. */
  transparent?: boolean;
  none?: boolean;
  ornament?: "royal" | "leaf" | "magic" | "cloud" | "silk" | undefined;
  /** Keeps the line marker tied to the Game Line when the material is offset. */
  numberOffsetX?: number;
}

/**
 * One writing section built as real geometry: a slab of the material with a
 * carved bed sunk into its face, a bevelled rim around that bed, and whatever
 * construction detail the material calls for (joints, banding, rivets).
 */
export function SlateSection({
  index,
  width,
  height,
  maps,
  build,
  physical,
  accent,
  numbers,
  transparent,
  none,
  ornament,
  numberOffsetX,
}: Props) {
  const numberStyle = numbers ?? defaultNumberSettings();
  const bodyH = Math.max(0.3, height);
  const bedW = width - build.inset * 2;
  const bedH = Math.max(0.2, bodyH - build.inset * 0.85);
  const tone = build.tones[index % build.tones.length] ?? 1;
  const tilt = (seeded(index, 7) - 0.5) * 0.012 * build.jitter;
  const shift = (seeded(index, 11) - 0.5) * 0.03 * build.jitter;

  const colour = useMemo(() => new THREE.Color(maps.color).multiplyScalar(tone), [maps.color, tone]);
  const bedColour = useMemo(() => colour.clone().multiplyScalar(0.64), [colour]);

  const rim = (w: number, h: number, x: number, y: number) => (
    <mesh position={[x, y, -build.recess / 2]} castShadow receiveShadow>
      <boxGeometry args={[w, h, build.recess]} />
      <meshStandardMaterial
        map={maps.map}
        normalMap={maps.normalMap}
        roughnessMap={maps.roughnessMap}
        normalScale={maps.normalScale}
        roughness={Math.min(1, maps.roughness * 1.05)}
        metalness={maps.metalness}
        color={colour}
      />
    </mesh>
  );

  const rivet = (x: number, y: number, key: string) => (
    <mesh key={key} position={[x, y, 0.03]} castShadow>
      <sphereGeometry args={[0.045, 12, 10]} />
      <meshStandardMaterial color="#4d4438" roughness={0.42} metalness={0.85} />
    </mesh>
  );

  const numberPlate = numberStyle.visible ? (
    <mesh
      position={[
        numberOffsetX ?? (numberStyle.align === "right" ? 1 : -1) * (width / 2 - build.inset * 0.48),
        numberStyle.vertical === "middle" ? 0 : bodyH / 2 - build.inset * 0.5,
        0.006,
      ]}
    >
      <planeGeometry args={[0.3 * numberStyle.size, 0.3 * numberStyle.size]} />
      <meshBasicMaterial
        map={numeralPlate(index, numberStyle)}
        transparent
        opacity={numberStyle.opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  ) : null;

  if (none) return numberPlate;

  const ornamentLayer = (() => {
    if (!ornament) return null;
    if (ornament === "cloud") {
      const puffs = [
        [-0.38, 0.34, 0.24], [-0.13, 0.42, 0.3], [0.16, 0.4, 0.27], [0.4, 0.31, 0.22],
        [-0.42, -0.32, 0.21], [-0.12, -0.4, 0.28], [0.18, -0.39, 0.25], [0.42, -0.28, 0.2],
      ] as const;
      return puffs.map(([nx, ny, radius], i) => {
        const r = Math.min(radius, bodyH * 0.34);
        return (
          <mesh key={i} position={[nx * width, ny * bodyH, -(r * 0.45) - 0.01]} scale={[1.35, 0.8, 0.45]}>
            <sphereGeometry args={[r, 18, 12]} />
            <meshStandardMaterial color="#eef8ff" roughness={0.72} transparent opacity={0.86} />
          </mesh>
        );
      });
    }
    if (ornament === "leaf") {
      return [-1, 1].flatMap((side) =>
        [-0.34, 0, 0.34].map((ny, i) => (
          <mesh
            key={`${side}:${i}`}
            position={[side * (width / 2 + 0.025), ny * bodyH, 0.04]}
            rotation={[0, 0, side * (0.5 + i * 0.35)]}
            scale={[1, 1.65, 1]}
          >
            <sphereGeometry args={[Math.min(0.075, bodyH * 0.11), 12, 8]} />
            <meshStandardMaterial color={i % 2 ? "#497c35" : "#6e9f40"} roughness={0.82} />
          </mesh>
        )),
      );
    }
    if (ornament === "royal") {
      return (
        <>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (width / 2 + 0.035), 0, 0.035]}>
              <boxGeometry args={[0.075, bodyH * 0.88, 0.07]} />
              <meshStandardMaterial color="#d7a72f" metalness={0.72} roughness={0.25} />
            </mesh>
          ))}
          <mesh position={[0, bodyH / 2 + 0.03, 0.04]}>
            <boxGeometry args={[width * 0.38, 0.065, 0.075]} />
            <meshStandardMaterial color="#e7b83c" metalness={0.78} roughness={0.22} />
          </mesh>
        </>
      );
    }
    if (ornament === "silk") {
      return [-1, 1].map((side) => (
        <mesh key={side} position={[side * (width / 2 + 0.09), -bodyH * 0.08, -0.015]} rotation={[0, 0, side * 0.22]}>
          <boxGeometry args={[0.22, bodyH * 0.7, 0.055]} />
          <meshStandardMaterial color="#b31746" roughness={0.3} metalness={0.04} />
        </mesh>
      ));
    }
    return (
      <mesh position={[0, 0, 0.045]}>
        <boxGeometry args={[width + 0.1, bodyH + 0.1, 0.025]} />
        <meshBasicMaterial color={accent} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    );
  })();

  // Transparent slate: nothing physical is built. The world behind stays fully
  // visible; only a faint outline says where this writing area begins and ends.
  if (transparent) {
    const edge = 0.012;
    const line = (w: number, h: number, x: number, y: number, key: string) => (
      <mesh key={key} position={[x, y, 0]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.16}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    );
    return (
      <group>
        {line(bedW, edge, 0, bedH / 2, "top")}
        {line(bedW, edge, 0, -bedH / 2, "bottom")}
        {line(edge, bedH, -bedW / 2, 0, "left")}
        {line(edge, bedH, bedW / 2, 0, "right")}
        {numberPlate}
      </group>
    );
  }

  return (
    <group position={[shift, 0, 0]} rotation={[0, 0, tilt]}>
      {/* the physical slab */}
      <mesh position={[0, 0, -build.depth / 2]} receiveShadow>
        <boxGeometry args={[width, bodyH, Math.max(0.02, build.depth), 3, 2, 1]} />
        {physical ? (
          <meshPhysicalMaterial
            map={maps.map}
            normalMap={maps.normalMap}
            roughnessMap={maps.roughnessMap}
            normalScale={maps.normalScale}
            roughness={physical === "ice" ? 0.22 : 0.06}
            metalness={0}
            transmission={physical === "ice" ? 0.45 : 0.82}
            thickness={physical === "ice" ? 0.5 : 0.3}
            ior={physical === "ice" ? 1.31 : 1.5}
            attenuationDistance={physical === "ice" ? 1.4 : 3}
            attenuationColor={physical === "ice" ? "#bfe4f5" : "#dff2ff"}
            clearcoat={0.6}
            color={colour}
          />
        ) : (
          <meshStandardMaterial
            map={maps.map}
            normalMap={maps.normalMap}
            roughnessMap={maps.roughnessMap}
            aoMap={maps.aoMap}
            normalScale={maps.normalScale}
            roughness={maps.roughness}
            metalness={maps.metalness}
            color={colour}
          />
        )}
      </mesh>

      {/* carved writing bed, sunk below the face */}
      <mesh position={[0, 0, -build.recess]} receiveShadow>
        <planeGeometry args={[bedW, bedH]} />
        <meshStandardMaterial
          map={maps.map}
          normalMap={maps.normalMap}
          roughnessMap={maps.roughnessMap}
          normalScale={maps.normalScale}
          roughness={Math.min(1, maps.roughness * 1.12)}
          metalness={maps.metalness * 0.8}
          color={bedColour}
        />
      </mesh>

      {/* bevelled rim walls around the bed */}
      {rim(bedW + build.bevel * 2, build.bevel, 0, bedH / 2 + build.bevel / 2)}
      {rim(bedW + build.bevel * 2, build.bevel, 0, -bedH / 2 - build.bevel / 2)}
      {rim(build.bevel, bedH, -bedW / 2 - build.bevel / 2, 0)}
      {rim(build.bevel, bedH, bedW / 2 + build.bevel / 2, 0)}

      {/* section number, cut into the margin of the material itself */}
      {numberStyle.visible ? (
        <mesh
          position={[
            numberOffsetX ?? (numberStyle.align === "right" ? 1 : -1) * (width / 2 - build.inset * 0.48),
            numberStyle.vertical === "middle" ? 0 : bodyH / 2 - build.inset * 0.5,
            0.006,
          ]}
        >
          <planeGeometry args={[0.3 * numberStyle.size, 0.3 * numberStyle.size]} />
          <meshBasicMaterial
            map={numeralPlate(index, numberStyle)}
            transparent
            opacity={numberStyle.opacity}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : null}

      {build.joints ? (
        <>
          <mesh position={[0, bodyH / 2 - 0.02, 0.012]}>
            <boxGeometry args={[width, 0.035, 0.05]} />
            <meshStandardMaterial color={bedColour} roughness={0.95} metalness={0.02} />
          </mesh>
          <mesh position={[0, -bodyH / 2 + 0.02, 0.012]}>
            <boxGeometry args={[width, 0.035, 0.05]} />
            <meshStandardMaterial color={bedColour} roughness={0.95} metalness={0.02} />
          </mesh>
        </>
      ) : null}

      {build.bands ? (
        <>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (width / 2 - build.inset * 0.42), 0, 0.03]} castShadow>
              <boxGeometry args={[0.18, bodyH * 0.96, 0.06]} />
              <meshStandardMaterial color="#3c362c" roughness={0.5} metalness={0.8} />
            </mesh>
          ))}
        </>
      ) : null}

      {build.rivets
        ? [-1, 1].flatMap((sx) =>
            [-1, 1].map((sy) =>
              rivet(
                sx * (width / 2 - build.inset * 0.42),
                sy * (bodyH / 2 - build.inset * 0.32),
                `${sx}:${sy}`,
              ),
            ),
          )
        : null}

      {build.frost ? (
        <mesh position={[0, 0, -build.recess + 0.002]}>
          <ringGeometry args={[Math.min(bedW, bedH) * 0.5, Math.max(bedW, bedH) * 0.68, 4, 1]} />
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={0.14 * build.frost}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ) : null}
      {ornamentLayer}
    </group>
  );
}
