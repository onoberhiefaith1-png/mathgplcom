/**
 * THE ROOM'S OWN DOOR — the inside face of the very same door you walked
 * through. It sits in the room's back-wall opening and faces into the room, so
 * turning around shows a real door instead of an open dark rectangle.
 *
 * FRAME and PANEL stay independent layers, exactly as in the corridor: the
 * frame keeps its accent material, the panel shows the imported door artwork
 * untinted. Clicking the panel leaves the room.
 */
import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useLoadedTexture } from "./surface";
import { doorStyle } from "@/lib/building/doors";

export interface RoomDoorVisual {
  color: string;
  brightness: number;
  styleKey?: string;
  textureUrl?: string;
  accent?: string;
}

const RoomDoor = ({
  visual,
  openingWidth,
  openingHeight,
  onLeave,
}: {
  visual: RoomDoorVisual;
  openingWidth: number;
  openingHeight: number;
  onLeave?: () => void;
}) => {
  const style = doorStyle(visual.styleKey);
  const url = visual.textureUrl || style.url;
  const tex = useLoadedTexture(url);

  const jambW = 0.16;
  // The leaf is fitted to the room's real opening, so the frame lines up with
  // the wall runs either side of it and with the lintel above.
  const leafH = Math.max(1.6, openingHeight - jambW);
  const leafW = Math.max(0.8, Math.min(openingWidth - jambW * 2, leafH * style.aspect));
  const openW = leafW + jambW * 2;
  const openH = leafH + jambW;
  const accent = visual.accent || "#3a5786";
  const emissive = (visual.brightness ?? 1) * 0.12;

  const frames = useRef<THREE.MeshStandardMaterial[]>([]);
  const addFrame = (m: THREE.MeshStandardMaterial | null) => {
    if (m && !frames.current.includes(m)) frames.current.push(m);
  };
  const [hovered, setHovered] = useState(false);
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-8 * Math.min(delta, 0.05));
    const ft = hovered ? 0.9 : 0;
    for (const m of frames.current) {
      m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity ?? 0, ft, k);
    }
  });

  return (
    // Local space of the room: the back wall is at z = 0 and faces +z (into the
    // room), so the door face looks the same way.
    <group position={[0, 0, 0.02]}>
      {/* Reveal / frame */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (openW / 2 - jambW / 2), openH / 2, 0.09]} castShadow>
          <boxGeometry args={[jambW, openH, 0.18]} />
          <meshStandardMaterial ref={addFrame} color={accent} emissive={accent} emissiveIntensity={0} roughness={0.55} metalness={0.15} />
        </mesh>
      ))}
      <mesh position={[0, openH - jambW / 2, 0.09]} castShadow>
        <boxGeometry args={[openW, jambW, 0.18]} />
        <meshStandardMaterial ref={addFrame} color={accent} emissive={accent} emissiveIntensity={0} roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.03, 0.09]}>
        <boxGeometry args={[openW, 0.06, 0.18]} />
        <meshStandardMaterial ref={addFrame} color={accent} emissive={accent} emissiveIntensity={0} roughness={0.7} metalness={0.1} />
      </mesh>
      {/* Solid backing behind the leaf, so the cutout never opens onto black. */}
      <mesh position={[0, openH / 2, -0.04]}>
        <planeGeometry args={[openW, openH]} />
        <meshStandardMaterial color="#0b0f18" roughness={0.95} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      {/* THE DOOR PANEL — the door's own artwork, rendered exactly as provided. */}
      <mesh
        position={[0, leafH / 2 + 0.03, 0.07]}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onLeave?.();
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
          setHovered(true);
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
          setHovered(false);
        }}
      >
        <planeGeometry args={[leafW, leafH]} />
        <meshStandardMaterial
          key={tex ? url : "flat"}
          map={tex ?? null}
          transparent
          alphaTest={0.5}
          depthWrite
          color={tex ? "#ffffff" : visual.color}
          emissive={tex ? "#ffffff" : visual.color}
          emissiveMap={tex ?? null}
          emissiveIntensity={tex ? Math.min(0.35, emissive * 0.6) : emissive * 0.5}
          roughness={0.7}
          metalness={0.05}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Local light, so the way out reads clearly instead of sitting in shadow. */}
      <pointLight position={[0, openH * 0.8, 2.2]} intensity={1.1} distance={9} decay={1.4} color="#dbe9ff" />
    </group>
  );
};

export default RoomDoor;
