/**
 * THE SMART SCREEN — a modern wall-integrated teaching display.
 *
 * Not a chalkboard and not a television: a slim, rounded, softly-lit panel
 * built into the teaching wall of every room. The live picture (an uploaded
 * lesson video or the teacher's camera) is painted straight onto its glass, so
 * a student keeps walking around the room while watching.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { screenMount } from "@/lib/building/screen";
import type { ClassroomKind } from "@/lib/building/types";

/** Rounded rectangle used for the bezel and the glass, so corners are soft. */
const roundedPlane = (w: number, h: number, r: number): THREE.ShapeGeometry => {
  const radius = Math.min(r, w / 2, h / 2);
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + w - radius, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + radius);
  shape.lineTo(x + w, y + h - radius);
  shape.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  shape.lineTo(x + radius, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return new THREE.ShapeGeometry(shape, 12);
};

interface Props {
  kind: ClassroomKind;
  /** The element feeding the glass. Null keeps the standby face. */
  video: HTMLVideoElement | null;
  /** True when there is something to show (uploaded video or live camera). */
  hasContent: boolean;
  /** Standby caption on an empty screen. */
  label: string;
  onSelect?: () => void;
}

const SmartScreen = ({ kind, video, hasContent, label, onSelect }: Props) => {
  const mount = useMemo(() => screenMount(kind), [kind]);
  const glassRef = useRef<THREE.Mesh>(null);

  const bezelW = mount.width + 0.18;
  const bezelH = mount.height + 0.18;

  const bezelGeo = useMemo(() => roundedPlane(bezelW, bezelH, 0.12), [bezelW, bezelH]);
  const glassGeo = useMemo(() => roundedPlane(mount.width, mount.height, 0.08), [mount.width, mount.height]);

  // One video texture per element; recreated only when the element changes.
  const texture = useMemo(() => {
    if (!video) return null;
    const t = new THREE.VideoTexture(video);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, [video]);

  useEffect(() => () => texture?.dispose(), [texture]);

  useEffect(() => {
    const mesh = glassRef.current;
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (hasContent && texture) {
      mat.map = texture;
      mat.emissiveMap = texture;
      mat.emissive = new THREE.Color("#ffffff");
      mat.emissiveIntensity = 0.85;
      mat.color = new THREE.Color("#ffffff");
    } else {
      mat.map = null;
      mat.emissiveMap = null;
      mat.emissive = new THREE.Color("#101827");
      mat.emissiveIntensity = 0.35;
      mat.color = new THREE.Color("#0d1424");
    }
    mat.needsUpdate = true;
  }, [hasContent, texture]);

  // Face the room: the teaching wall is at +z, so the panel looks back down -z.
  return (
    <group position={[0, mount.centreY, mount.wallZ - 0.06]} rotation-y={Math.PI}>
      {/* PLACEHOLDER ONLY — the housing and bezel exist while the screen is
          empty. Once a video is playing the frame disappears completely and
          the picture itself is the screen. */}
      {!hasContent && (
        <>
          <mesh position={[0, 0, 0.02]}>
            <boxGeometry args={[bezelW + 0.1, bezelH + 0.1, 0.16]} />
            <meshStandardMaterial color="#0b1020" roughness={0.6} metalness={0.35} />
          </mesh>
          <mesh geometry={bezelGeo} position={[0, 0, -0.07]}>
            <meshStandardMaterial color="#1b2440" roughness={0.35} metalness={0.55} side={THREE.FrontSide} />
          </mesh>
        </>
      )}


      {/* the glass */}
      <mesh
        ref={glassRef}
        geometry={glassGeo}
        position={[0, 0, -0.075]}
        onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(); } : undefined}
      >
        <meshStandardMaterial toneMapped={false} roughness={0.18} metalness={0.05} side={THREE.FrontSide} />
      </mesh>

      {!hasContent && (
        <Text
          position={[0, 0, -0.09]}
          fontSize={Math.min(0.26, mount.height * 0.09)}
          color="#8ea4d2"
          anchorX="center"
          anchorY="middle"
          maxWidth={mount.width * 0.85}
          textAlign="center"
        >
          {label}
        </Text>
      )}

      {/* soft glow from the panel into the room */}
      <pointLight position={[0, 0, -0.9]} intensity={hasContent ? 1.1 : 0.35} distance={9} color="#a8c6ff" />
    </group>
  );
};

export default SmartScreen;
