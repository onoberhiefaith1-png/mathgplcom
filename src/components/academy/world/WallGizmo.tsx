/**
 * WALL GIZMO — the direct-manipulation handles shared by every wall object
 * (frames, windows and the smart screen).
 *
 * The rule everywhere in the building is the same: an object belongs to ONE
 * wall, and it may slide anywhere along that wall and up or down it, but it can
 * never leave it. So the gizmo works entirely in the object's own local space:
 * local +x runs along the wall, local +y up it, and nothing ever touches z.
 *
 * While a drag is in progress the object's own group is moved and scaled live,
 * so the movement is immediate and smooth. Only when the pointer is released is
 * the final position/size handed back to be saved. Sliders elsewhere remain the
 * precise alternative — this is the fast, obvious way.
 */
import { useCallback, useRef, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";

export interface WallTransform {
  offset_along: number;
  offset_y: number;
  width: number;
  height_ratio: number;
}

export interface WallGizmoProps {
  /** current geometry of the object, in metres */
  width: number;
  height: number;
  /** metres of wall the object may travel along */
  alongLength: number;
  /** +1 when local +x increases `offset_along` */
  alongSign: 1 | -1;
  /** the values a save would start from */
  current: WallTransform;
  /** frozen objects show no handles at all */
  locked?: boolean;
  minWidth: number;
  maxWidth: number;
  /** highest centre height allowed on this wall */
  maxY: number;
  onCommit: (next: WallTransform) => void;
}

type Mode = "move" | "corner" | "side" | "top";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const HANDLE = "#38bdf8";

const WallGizmo = ({
  width,
  height,
  alongLength,
  alongSign,
  current,
  locked = false,
  minWidth,
  maxWidth,
  maxY,
  onCommit,
}: WallGizmoProps) => {
  const root = useRef<THREE.Group>(null);
  const drag = useRef<{
    mode: Mode;
    startX: number;
    startY: number;
    next: WallTransform;
  } | null>(null);
  const [active, setActive] = useState<Mode | null>(null);

  /** Pointer position in the object's own local space (x along the wall, y up). */
  const localPoint = useCallback((e: ThreeEvent<PointerEvent>) => {
    const parent = root.current?.parent;
    if (!parent) return null;
    const p = parent.worldToLocal(e.point.clone());
    return { x: p.x, y: p.y };
  }, []);

  /** Live preview: the object's own group is what actually moves. */
  const preview = (next: WallTransform) => {
    const group = root.current?.parent;
    if (!group) return;
    const dAlong = (next.offset_along - current.offset_along) * alongLength * alongSign;
    group.position.x += dAlong - (group.userData.gizmoDx ?? 0);
    group.position.y += next.offset_y - current.offset_y - (group.userData.gizmoDy ?? 0);
    group.userData.gizmoDx = dAlong;
    group.userData.gizmoDy = next.offset_y - current.offset_y;
    group.scale.set(
      next.width / current.width,
      (next.width * next.height_ratio) / (current.width * current.height_ratio),
      1,
    );
  };

  const clearPreview = () => {
    const group = root.current?.parent;
    if (!group) return;
    group.position.x -= group.userData.gizmoDx ?? 0;
    group.position.y -= group.userData.gizmoDy ?? 0;
    group.userData.gizmoDx = 0;
    group.userData.gizmoDy = 0;
    group.scale.set(1, 1, 1);
  };

  const begin = (mode: Mode) => (e: ThreeEvent<PointerEvent>) => {
    if (locked) return;
    e.stopPropagation();
    const at = localPoint(e);
    if (!at) return;
    (e.target as unknown as { setPointerCapture?: (id: number) => void })?.setPointerCapture?.(e.pointerId);
    drag.current = { mode, startX: at.x, startY: at.y, next: { ...current } };
    setActive(mode);
  };

  const move = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    const at = localPoint(e);
    if (!at) return;
    const dx = at.x - d.startX;
    const dy = at.y - d.startY;

    if (d.mode === "move") {
      const along = clamp(current.offset_along + (dx * alongSign) / alongLength, 0.04, 0.96);
      const y = clamp(current.offset_y + dy, 0.6, maxY);
      d.next = { ...current, offset_along: along, offset_y: y };
    } else if (d.mode === "corner") {
      // Corner keeps the shape: one grip makes it bigger or smaller.
      const w = clamp(current.width + dx * 2, minWidth, maxWidth);
      d.next = { ...current, width: w };
    } else if (d.mode === "side") {
      // Side grip changes width only, so the object can go wide or narrow.
      const w = clamp(current.width + dx * 2, minWidth, maxWidth);
      const h = current.width * current.height_ratio;
      d.next = { ...current, width: w, height_ratio: clamp(h / w, 0.35, 1.6) };
    } else {
      // Top grip changes height only — landscape ⇄ portrait.
      const h = clamp(current.width * current.height_ratio + dy * 2, 0.3, 6);
      d.next = { ...current, height_ratio: clamp(h / current.width, 0.35, 1.6) };
    }
    preview(d.next);
  };

  const end = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    drag.current = null;
    setActive(null);
    if (!d) return;
    e.stopPropagation();
    clearPreview();
    const changed =
      Math.abs(d.next.offset_along - current.offset_along) > 0.0005 ||
      Math.abs(d.next.offset_y - current.offset_y) > 0.005 ||
      Math.abs(d.next.width - current.width) > 0.005 ||
      Math.abs(d.next.height_ratio - current.height_ratio) > 0.005;
    if (changed) onCommit(d.next);
  };

  if (locked) return null;

  const grip = Math.max(0.09, Math.min(width, height) * 0.09);
  const z = 0.09;
  const corners: [number, number][] = [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [-width / 2, height / 2],
    [width / 2, height / 2],
  ];

  return (
    <group ref={root}>
      {/* Selection boundary, so it is obvious which object is being edited. */}
      {[
        { p: [0, height / 2 + 0.01, z] as [number, number, number], s: [width + 0.04, 0.02, 0.01] as [number, number, number] },
        { p: [0, -height / 2 - 0.01, z] as [number, number, number], s: [width + 0.04, 0.02, 0.01] as [number, number, number] },
        { p: [-width / 2 - 0.01, 0, z] as [number, number, number], s: [0.02, height + 0.04, 0.01] as [number, number, number] },
        { p: [width / 2 + 0.01, 0, z] as [number, number, number], s: [0.02, height + 0.04, 0.01] as [number, number, number] },
      ].map((b, i) => (
        <mesh key={`edge-${i}`} position={b.p} raycast={() => null}>
          <boxGeometry args={b.s} />
          <meshBasicMaterial color={HANDLE} toneMapped={false} />
        </mesh>
      ))}

      {/* Body: drag anywhere on the object to slide it along its wall. */}
      <mesh
        position={[0, 0, z]}
        onPointerDown={begin("move")}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          transparent
          opacity={active === "move" ? 0.12 : 0.02}
          color={HANDLE}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Corner grips — bigger or smaller, keeping the shape. */}
      {corners.map(([x, y], i) => (
        <mesh
          key={`corner-${i}`}
          position={[x, y, z + 0.01]}
          onPointerDown={begin("corner")}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <boxGeometry args={[grip, grip, 0.03]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}

      {/* Side grip — width only. */}
      <mesh
        position={[width / 2, 0, z + 0.01]}
        onPointerDown={begin("side")}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <boxGeometry args={[grip * 0.8, grip * 1.4, 0.03]} />
        <meshBasicMaterial color={HANDLE} toneMapped={false} />
      </mesh>

      {/* Top grip — height only, so landscape ⇄ portrait is one drag. */}
      <mesh
        position={[0, height / 2, z + 0.01]}
        onPointerDown={begin("top")}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <boxGeometry args={[grip * 1.4, grip * 0.8, 0.03]} />
        <meshBasicMaterial color={HANDLE} toneMapped={false} />
      </mesh>
    </group>
  );
};

export default WallGizmo;
