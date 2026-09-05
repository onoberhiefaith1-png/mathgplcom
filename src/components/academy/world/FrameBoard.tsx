/**
 * FRAME BOARD — the physical shortcut board hanging on a building wall.
 *
 * It is a real object bolted flat to the wall it was placed on: never floating,
 * never part of the wall's own surface design. Clicking it is the only thing it
 * does — the frame itself holds no learning content, only shortcuts to content
 * that already exists elsewhere in MathGPL.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { Text } from "@react-three/drei";

import { frameDesign, type BuildingFrame, type FrameMount } from "@/lib/building/frames";

interface FrameBoardProps {
  frame: BuildingFrame;
  mount: FrameMount;
  /** Highlighted while the teacher is positioning this frame. */
  selected?: boolean;
  linkCount?: number;
  onSelect?: (frame: BuildingFrame) => void;
}

const FrameBoard = ({ frame, mount, selected = false, linkCount = 0, onSelect }: FrameBoardProps) => {
  const design = frameDesign(frame.design);
  const map = useTexture(design.url);
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }, [map]);

  const { width, height } = mount;

  return (
    <group position={mount.position} rotation-y={mount.yaw}>
      {/* Mount plate — gives the board real thickness against the wall. */}
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[width + 0.08, height + 0.08, 0.07]} />
        <meshStandardMaterial
          color={selected ? "#7dd3fc" : "#101a30"}
          roughness={0.5}
          metalness={0.3}
          emissive={selected ? "#38bdf8" : "#000000"}
          emissiveIntensity={selected ? 0.5 : 0}
        />
      </mesh>
      {/* The artwork itself, shown exactly as supplied. */}
      <mesh
        position={[0, 0, 0.012]}
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
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={map} transparent toneMapped={false} roughness={0.6} />
      </mesh>
      {/* Wall wash, so the board reads as lit rather than a dark rectangle. */}
      <pointLight position={[0, height / 2 + 0.4, 0.7]} intensity={3.2} distance={5} decay={2} color="#fff4e2" />
      {/* Name strip under the board. */}
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
    </group>
  );
};

export default FrameBoard;
