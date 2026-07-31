// Label3D — a mathematics label that lives in 3D space and is welded to the
// geometry it describes.
//
// Why not HTML: a DOM chip is screen-aligned, cannot rotate with an edge, cannot
// be hidden behind a face, and snaps between pixel positions while orbiting.
// This renders real SDF text inside the solid's local frame, so it inherits the
// solid's transform and moves perfectly continuously with it.

import { useId, useMemo, useRef } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLabelSlot } from "./useLabelLayout";
import type { Vec3 } from "@/lib/geometry3d/scene3d";

export interface Label3DProps {
  text: string;
  /** Anchor on the element, in the parent (solid local) frame. */
  position: Vec3;
  /** Perpendicular direction the label is pushed along. */
  offsetDir?: Vec3;
  offset?: number;
  /** Baseline the label stays parallel to. null = always face the camera. */
  alignDir?: Vec3 | null;
  color?: string;
  /** Accent border colour of the backing plate. */
  accent?: string;
  light?: boolean;
  /** Base text height in world units at the reference distance. */
  size?: number;
  /** Fade / hide when the anchor sits behind geometry. */
  occlude?: boolean;
  hideOccluded?: boolean;
  /** Skip collision avoidance (useful for construction captions). */
  noLayout?: boolean;
  /** Colour density 0.1–1 — how strong the label reads on the board. */
  density?: number;
}

const _camLocal = new THREE.Vector3();
const _basisX = new THREE.Vector3();
const _basisY = new THREE.Vector3();
const _basisZ = new THREE.Vector3();
const _align = new THREE.Vector3();
const _worldPos = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _camRight = new THREE.Vector3();
const _scaleV = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

export function Label3D({
  text,
  position,
  offsetDir = [0, 1, 0],
  offset = 0.26,
  alignDir = null,
  color,
  accent,
  light = false,
  size = 0.17,
  occlude = true,
  hideOccluded = false,
  noLayout = false,
  density = 1,
}: Label3DProps) {
  const id = useId();
  const group = useRef<THREE.Group>(null);
  const textRef = useRef<THREE.Mesh & { material: THREE.Material }>(null);
  const plateRef = useRef<THREE.Mesh>(null);
  const borderRef = useRef<THREE.LineSegments>(null);
  const { camera, scene } = useThree();

  const opacity = useRef(0);
  const nextCheck = useRef(0);
  const blocked = useRef(false);
  const applied = useRef(-1);

  const plateW = Math.max(0.5, text.length * 0.6 + 0.5);
  const plateH = 1.5;

  const slot = useLabelSlot(id, noLayout ? 0 : plateW * size * 26, noLayout ? 0 : plateH * size * 22);

  const fg = color ?? (light ? "#0f172a" : "#f8fafc");
  const bg = light ? "#ffffff" : "#0b1220";

  const plateGeom = useMemo(() => new THREE.PlaneGeometry(plateW, plateH), [plateW]);
  const borderGeom = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(plateW, plateH)), [plateW]);

  useFrame(() => {
    const g = group.current;
    const parent = g?.parent;
    if (!g || !parent) return;

    // --- position: anchor + perpendicular offset (+ collision nudge) --------
    const push = offset + (noLayout ? 0 : slot.nudge);
    g.position.set(
      position[0] + offsetDir[0] * push,
      position[1] + offsetDir[1] * push,
      position[2] + offsetDir[2] * push,
    );

    g.getWorldPosition(_worldPos);
    slot.world.copy(_worldPos);

    // --- orientation: parallel to the line, plane facing the camera --------
    parent.updateWorldMatrix(true, false);
    _camLocal.copy(camera.position);
    parent.worldToLocal(_camLocal);
    _basisZ.copy(_camLocal).sub(g.position);
    if (_basisZ.lengthSq() < 1e-8) _basisZ.set(0, 0, 1);
    _basisZ.normalize();

    if (alignDir) {
      _align.set(alignDir[0], alignDir[1], alignDir[2]).normalize();
      _basisX.copy(_align).addScaledVector(_basisZ, -_align.dot(_basisZ));
      if (_basisX.lengthSq() < 1e-8) {
        _basisX.set(1, 0, 0).addScaledVector(_basisZ, -_basisZ.x);
      }
      _basisX.normalize();
      // Never let the text read backwards.
      _camRight.setFromMatrixColumn(camera.matrixWorld, 0);
      parent.getWorldQuaternion(_q);
      _dir.copy(_basisX).applyQuaternion(_q);
      if (_dir.dot(_camRight) < 0) _basisX.negate();
      _basisY.crossVectors(_basisZ, _basisX).normalize();
      _m.makeBasis(_basisX, _basisY, _basisZ);
      g.quaternion.setFromRotationMatrix(_m);
    } else {
      parent.getWorldQuaternion(_q);
      g.quaternion.copy(_q).invert().multiply(camera.quaternion);
    }

    // --- constant apparent size --------------------------------------------
    const dist = camera.position.distanceTo(_worldPos);
    parent.getWorldScale(_scaleV);
    const parentScale = (Math.abs(_scaleV.x) + Math.abs(_scaleV.y) + Math.abs(_scaleV.z)) / 3 || 1;
    const s = THREE.MathUtils.clamp(dist * 0.055, 0.55, 2.6) * (size / 0.17) / parentScale;
    g.scale.setScalar(s);

    // --- visibility: never read a label through a solid face ---------------
    const now = performance.now();
    if (occlude && now > nextCheck.current) {
      nextCheck.current = now + 70;
      _dir.copy(_worldPos).sub(camera.position);
      const d = _dir.length();
      _dir.normalize();
      _raycaster.set(camera.position, _dir);
      _raycaster.far = Math.max(0.01, d - 0.12);
      const targets: THREE.Object3D[] = [];
      scene.traverse((o) => { if (o.userData?.mathSolid) targets.push(o); });
      blocked.current = _raycaster.intersectObjects(targets, false).length > 0;
    } else if (!occlude) {
      blocked.current = false;
    }

    const target = (blocked.current ? (hideOccluded ? 0 : 0.16) : 1) * density;
    opacity.current += (target - opacity.current) * 0.18;
    const o = opacity.current;
    slot.active = o > 0.5;

    if (Math.abs(o - applied.current) > 0.01) {
      applied.current = o;
      g.visible = o > 0.02;
      const tm = textRef.current?.material as THREE.Material & { opacity: number } | undefined;
      if (tm) { tm.transparent = true; tm.opacity = o; }
      const pm = plateRef.current?.material as THREE.Material & { opacity: number } | undefined;
      if (pm) { pm.transparent = true; pm.opacity = 0.82 * o; }
      const bm = borderRef.current?.material as THREE.Material & { opacity: number } | undefined;
      if (bm) { bm.transparent = true; bm.opacity = 0.7 * o; }
    }
  });

  return (
    <group ref={group} renderOrder={20}>
      <group scale={size}>
        <mesh ref={plateRef} geometry={plateGeom} position={[0, 0, -0.01]} renderOrder={20} raycast={() => null}>
          <meshBasicMaterial color={bg} transparent opacity={0.82} depthTest={false} depthWrite={false} />
        </mesh>
        {accent && (
          <lineSegments ref={borderRef} geometry={borderGeom} position={[0, 0, -0.005]} renderOrder={21} raycast={() => null}>
            <lineBasicMaterial color={accent} transparent opacity={0.7} depthTest={false} />
          </lineSegments>
        )}
        <Text
          ref={textRef as never}
          fontSize={1}
          color={fg}
          anchorX="center"
          anchorY="middle"
          renderOrder={22}
          material-depthTest={false}
          material-transparent
          raycast={() => null}
        >
          {text}
        </Text>
      </group>
    </group>
  );
}

export default Label3D;
