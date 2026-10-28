/**
 * FRAME OBJECT — a real 3D frame the Building system BUILDS, not a picture of a
 * frame.
 *
 * Four solid mitred bars with genuine thickness stand off the wall, bevelled on
 * their inner and outer edges. Their centre is an EMPTY recessed opening: the
 * teacher's picture is a separate content layer dropped into that recess, so the
 * same frame can show an assignment today and a course tomorrow. Walking left or
 * right past it reveals the bars' side faces, exactly like a mounted object.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";

import { frameProfile, type FrameProfile } from "@/lib/building/frameStyles";
import type { BuildingFrame, FrameMount } from "@/lib/building/frames";
import { useCoverFit, useImageTexture } from "./useImageTexture";
import WallGizmo, { type WallTransform } from "./WallGizmo";

export interface FrameStructureProps {
  profile: FrameProfile;
  width: number;
  height: number;
  /** highlight while the teacher is positioning it */
  selected?: boolean;
  /**
   * The recessed backboard is what an EMPTY object shows. Once a picture is
   * inside, the backboard must not be built at all: it sits in front of the
   * content layer and would hide the picture completely.
   */
  showBack?: boolean;
}

/** Bar thickness in metres, always readable and never thinner than a real moulding. */
export const barThickness = (profile: FrameProfile, width: number) =>
  Math.min(Math.max(width * profile.bar, 0.07), 0.3);

/**
 * The physical structure: four bars, bevel lips, and the recessed backboard the
 * picture sits against. Shared by frames and windows so the whole building keeps
 * one architectural language.
 */
export const FrameStructure = ({
  profile,
  width,
  height,
  selected = false,
  showBack = true,
}: FrameStructureProps) => {
  const bar = barThickness(profile, width);
  const depth = profile.depth;
  const innerW = Math.max(width - bar * 2, 0.1);
  const innerH = Math.max(height - bar * 2, 0.1);
  const face = selected ? "#7dd3fc" : profile.face;

  const barMaterial = (
    <meshStandardMaterial
      color={face}
      roughness={profile.roughness}
      metalness={profile.metalness}
      emissive={selected ? "#38bdf8" : "#000000"}
      emissiveIntensity={selected ? 0.35 : 0}
    />
  );

  return (
    <group>
      {/* Four mitred bars — solid boxes with real depth and side faces. */}
      <mesh position={[0, height / 2 - bar / 2, depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[width, bar, depth]} />
        {barMaterial}
      </mesh>
      <mesh position={[0, -height / 2 + bar / 2, depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[width, bar, depth]} />
        {barMaterial}
      </mesh>
      <mesh position={[-width / 2 + bar / 2, 0, depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[bar, height - bar * 2, depth]} />
        {barMaterial}
      </mesh>
      <mesh position={[width / 2 - bar / 2, 0, depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[bar, height - bar * 2, depth]} />
        {barMaterial}
      </mesh>

      {/* Raised bevel lip around the opening — the frame's inner edge. */}
      {[
        { p: [0, innerH / 2 + bar * 0.16, depth * 0.98] as [number, number, number], s: [innerW + bar * 0.34, bar * 0.3, depth * 0.2] as [number, number, number] },
        { p: [0, -innerH / 2 - bar * 0.16, depth * 0.98] as [number, number, number], s: [innerW + bar * 0.34, bar * 0.3, depth * 0.2] as [number, number, number] },
        { p: [-innerW / 2 - bar * 0.16, 0, depth * 0.98] as [number, number, number], s: [bar * 0.3, innerH + bar * 0.34, depth * 0.2] as [number, number, number] },
        { p: [innerW / 2 + bar * 0.16, 0, depth * 0.98] as [number, number, number], s: [bar * 0.3, innerH + bar * 0.34, depth * 0.2] as [number, number, number] },
      ].map((b, i) => (
        <mesh key={`bevel-${i}`} position={b.p}>
          <boxGeometry args={b.s} />
          <meshStandardMaterial color={profile.bevel} roughness={0.3} metalness={Math.min(1, profile.metalness + 0.1)} />
        </mesh>
      ))}

      {/* Outer bevel band, so the object reads as moulded, not as a slab. It is
          built as four edge strips: a full slab here would seal the opening and
          hide whatever is placed inside. */}
      {[
        { p: [0, height / 2 - bar / 2, depth * 0.2] as [number, number, number], s: [width + 0.015, bar, depth * 0.12] as [number, number, number] },
        { p: [0, -height / 2 + bar / 2, depth * 0.2] as [number, number, number], s: [width + 0.015, bar, depth * 0.12] as [number, number, number] },
        { p: [-width / 2 + bar / 2, 0, depth * 0.2] as [number, number, number], s: [bar + 0.015, height - bar * 2, depth * 0.12] as [number, number, number] },
        { p: [width / 2 - bar / 2, 0, depth * 0.2] as [number, number, number], s: [bar + 0.015, height - bar * 2, depth * 0.12] as [number, number, number] },
      ].map((b, i) => (
        <mesh key={`band-${i}`} position={b.p}>
          <boxGeometry args={b.s} />
          <meshStandardMaterial color={profile.bevel} roughness={0.4} metalness={profile.metalness} />
        </mesh>
      ))}

      {/* Recessed backboard — what an EMPTY object shows, and nothing more. */}
      {showBack && (
        <mesh position={[0, 0, depth * 0.22]} receiveShadow>
          <boxGeometry args={[innerW + bar * 0.4, innerH + bar * 0.4, depth * 0.1]} />
          <meshStandardMaterial color={profile.back} roughness={0.85} metalness={0.05} />
        </mesh>
      )}

      <FrameOrnaments profile={profile} width={width} height={height} bar={bar} depth={depth} />
    </group>
  );
};

/** Style detail: scrolls, brass plates, light strips or carved vines. */
const FrameOrnaments = ({
  profile,
  width,
  height,
  bar,
  depth,
}: {
  profile: FrameProfile;
  width: number;
  height: number;
  bar: number;
  depth: number;
}) => {
  const cx = width / 2 - bar / 2;
  const cy = height / 2 - bar / 2;
  const corners: [number, number][] = [
    [-cx, cy],
    [cx, cy],
    [-cx, -cy],
    [cx, -cy],
  ];

  if (profile.ornament === "corner-scroll") {
    return (
      <group>
        {corners.map(([x, y], i) => (
          <mesh key={`scroll-${i}`} position={[x, y, depth * 1.05]} rotation-z={Math.PI / 4}>
            <boxGeometry args={[bar * 1.15, bar * 1.15, depth * 0.28]} />
            <meshStandardMaterial color={profile.bevel} roughness={0.25} metalness={0.95} />
          </mesh>
        ))}
        {[cy, -cy].map((y, i) => (
          <mesh key={`crest-${i}`} position={[0, y, depth * 1.05]} rotation-z={Math.PI / 4}>
            <boxGeometry args={[bar * 0.8, bar * 0.8, depth * 0.28]} />
            <meshStandardMaterial color={profile.bevel} roughness={0.25} metalness={0.95} />
          </mesh>
        ))}
      </group>
    );
  }

  if (profile.ornament === "corner-plate") {
    return (
      <group>
        {corners.map(([x, y], i) => (
          <mesh key={`plate-${i}`} position={[x, y, depth * 1.03]}>
            <boxGeometry args={[bar * 1.3, bar * 1.3, depth * 0.16]} />
            <meshStandardMaterial color={profile.bevel} roughness={0.35} metalness={0.9} />
          </mesh>
        ))}
        {/* Brass name plaque on the top bar. */}
        <mesh position={[0, cy, depth * 1.03]}>
          <boxGeometry args={[width * 0.26, bar * 0.85, depth * 0.16]} />
          <meshStandardMaterial color={profile.bevel} roughness={0.3} metalness={0.9} />
        </mesh>
      </group>
    );
  }

  if (profile.ornament === "light-strip") {
    const glow = profile.glow ?? "#2f86ff";
    return (
      <group>
        {[cy, -cy].map((y, i) => (
          <mesh key={`strip-${i}`} position={[0, y, depth * 1.04]}>
            <boxGeometry args={[width * 0.3, bar * 0.28, depth * 0.1]} />
            <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
        ))}
        {[-cx, cx].map((x, i) => (
          <mesh key={`vstrip-${i}`} position={[x, 0, depth * 1.04]}>
            <boxGeometry args={[bar * 0.28, height * 0.24, depth * 0.1]} />
            <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
        ))}
      </group>
    );
  }

  if (profile.ornament === "vine") {
    return (
      <group>
        {corners.map(([x, y], i) => (
          <mesh key={`vine-${i}`} position={[x, y, depth * 1.02]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[bar * 0.5, bar * 0.16, 8, 16]} />
            <meshStandardMaterial color={profile.bevel} roughness={0.7} metalness={0.1} />
          </mesh>
        ))}
        {[-0.25, 0.25].map((f, i) => (
          <mesh key={`leaf-${i}`} position={[width * f, cy, depth * 1.02]} rotation-z={Math.PI / 5}>
            <sphereGeometry args={[bar * 0.32, 10, 8]} />
            <meshStandardMaterial color="#4d8a3a" roughness={0.6} />
          </mesh>
        ))}
      </group>
    );
  }

  return null;
};

interface FrameObjectProps {
  frame: BuildingFrame;
  mount: FrameMount;
  /** Resolved URL of the picture placed inside — optional by design. */
  contentUrl?: string | null;
  selected?: boolean;
  linkCount?: number;
  onSelect?: (frame: BuildingFrame) => void;
  /** Editor only: show the drag/resize handles on this frame. */
  editable?: boolean;
  onTransform?: (next: WallTransform) => void;
}

const FrameObject = ({
  frame,
  mount,
  contentUrl,
  selected = false,
  linkCount = 0,
  onSelect,
  editable = false,
  onTransform,
}: FrameObjectProps) => {
  const profile = useMemo(() => frameProfile(frame.design, "frame"), [frame.design]);
  const { width, height } = mount;
  const bar = barThickness(profile, width);
  const innerW = Math.max(width - bar * 2, 0.1);
  const innerH = Math.max(height - bar * 2, 0.1);
  const tex = useImageTexture(contentUrl);
  useCoverFit(tex, innerW, innerH);

  return (
    <group position={mount.position} rotation-y={mount.yaw}>
      {/* Mount plate, so the object is fixed to the wall with real contact. */}
      <mesh position={[0, 0, 0.012]}>
        <boxGeometry args={[width + 0.05, height + 0.05, 0.03]} />
        <meshStandardMaterial color="#0f1626" roughness={0.7} metalness={0.2} />
      </mesh>

      <FrameStructure profile={profile} width={width} height={height} selected={selected} />

      {/* CONTENT LAYER — the teacher's picture, sitting inside the recess. It is
          never baked into the frame, so replacing it leaves the frame untouched. */}
      <mesh
        position={[0, 0, profile.depth * 0.3]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(frame);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <planeGeometry args={[innerW, innerH]} />
        {tex ? (
          <meshStandardMaterial map={tex} roughness={0.55} metalness={0.05} toneMapped={false} />
        ) : (
          <meshStandardMaterial color={profile.back} roughness={0.9} metalness={0.05} />
        )}
      </mesh>

      {!tex && (
        <Text
          position={[0, 0, profile.depth * 0.34]}
          fontSize={Math.min(0.16, innerH * 0.18)}
          maxWidth={innerW * 0.85}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
          material-depthWrite={false}
        >
          ADD A PICTURE
        </Text>
      )}

      {/* Wall wash, so bars cast real shadows instead of reading flat. */}
      <pointLight position={[0, height / 2 + 0.4, 0.9]} intensity={3} distance={5} decay={2} color="#fff4e2" />

      {/* Name strip under the frame. */}
      <group position={[0, -height / 2 - 0.22, 0.02]}>
        <mesh>
          <boxGeometry args={[Math.min(width + 0.08, 3.4), 0.3, 0.05]} />
          <meshStandardMaterial color="#16213e" roughness={0.45} metalness={0.25} />
        </mesh>
        <Text
          position={[0, 0, 0.035]}
          fontSize={0.14}
          maxWidth={Math.min(width, 3.2)}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          material-depthWrite={false}
        >
          {`${frame.name.toUpperCase()}${linkCount > 1 ? ` · ${linkCount} ITEMS` : ""}`}
        </Text>
      </group>
      {/* DIRECT MANIPULATION — slide the frame along its wall, or grab a grip to
          resize it. Nothing can leave the wall it belongs to. */}
      {editable && onTransform && (
        <WallGizmo
          width={width}
          height={height}
          alongLength={mount.alongLength}
          alongSign={mount.alongSign}
          minWidth={0.4}
          maxWidth={Math.min(6, mount.alongLength * 0.9)}
          maxY={3.4}
          locked={!!frame.locked}
          current={{
            offset_along: frame.offset_along,
            offset_y: frame.offset_y,
            width: frame.width,
            height_ratio: frame.height_ratio,
          }}
          onCommit={onTransform}
        />
      )}

    </group>
  );
};

export default FrameObject;
