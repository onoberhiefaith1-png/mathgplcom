/**
 * WINDOW OBJECT — an interior architectural window, seen from inside the room.
 *
 * Built in the same language as the existing doors: a solid 3D surround with
 * depth, side reveals into the wall, a sill and interior trim. The glass pane
 * inside it is a separate content layer (an uploaded view, a gallery image or a
 * MathGPL asset), so changing the view never changes the window.
 *
 * A window is purely environmental: it has no link, and clicking it — except
 * while the teacher is positioning it — does nothing at all.
 */
import { useMemo } from "react";

import { frameProfile } from "@/lib/building/frameStyles";
import type { BuildingFrame, FrameMount } from "@/lib/building/frames";
import { FrameStructure, barThickness } from "./FrameObject";
import { coverFit, useImageTexture } from "./useImageTexture";
import WallGizmo, { type WallTransform } from "./WallGizmo";

interface WindowObjectProps {
  frame: BuildingFrame;
  mount: FrameMount;
  contentUrl?: string | null;
  selected?: boolean;
  /** Editor only: picking the window up for positioning. */
  onSelect?: (frame: BuildingFrame) => void;
  /** Editor only: show the drag/resize handles on this window. */
  editable?: boolean;
  onTransform?: (next: WallTransform) => void;
}

const WindowObject = ({
  frame,
  mount,
  contentUrl,
  selected = false,
  onSelect,
  editable = false,
  onTransform,
}: WindowObjectProps) => {
  const profile = useMemo(() => frameProfile(frame.design, "window"), [frame.design]);
  const { width, height } = mount;
  const bar = barThickness(profile, width);
  const innerW = Math.max(width - bar * 2, 0.1);
  const innerH = Math.max(height - bar * 2, 0.1);
  const reveal = profile.depth * 0.9;
  const tex = useImageTexture(contentUrl);
  useMemo(() => coverFit(tex, innerW, innerH), [tex, innerW, innerH]);

  return (
    <group position={mount.position} rotation-y={mount.yaw}>
      {/* REVEAL — the wall thickness the window is installed into, so the
          opening reads as a hole in the wall rather than a picture on it. */}
      {[
        { p: [0, innerH / 2 + 0.005, -reveal / 2] as [number, number, number], s: [innerW, 0.02, reveal] as [number, number, number] },
        { p: [0, -innerH / 2 - 0.005, -reveal / 2] as [number, number, number], s: [innerW, 0.02, reveal] as [number, number, number] },
        { p: [-innerW / 2 - 0.005, 0, -reveal / 2] as [number, number, number], s: [0.02, innerH, reveal] as [number, number, number] },
        { p: [innerW / 2 + 0.005, 0, -reveal / 2] as [number, number, number], s: [0.02, innerH, reveal] as [number, number, number] },
      ].map((r, i) => (
        <mesh key={`reveal-${i}`} position={r.p} receiveShadow>
          <boxGeometry args={r.s} />
          <meshStandardMaterial color={profile.face} roughness={0.55} metalness={profile.metalness * 0.6} />
        </mesh>
      ))}

      {/* The view through the glass, set back inside the opening. */}
      <mesh position={[0, 0, -reveal * 0.85]}>
        <planeGeometry args={[innerW, innerH]} />
        {tex ? (
          <meshStandardMaterial
            map={tex}
            roughness={0.35}
            metalness={0.05}
            emissiveMap={tex}
            emissive="#ffffff"
            emissiveIntensity={0.5}
            toneMapped={false}
          />
        ) : (
          <meshStandardMaterial color="#25415f" roughness={0.3} metalness={0.2} />
        )}
      </mesh>

      {/* Glass pane — a thin sheen in front of the view, clickable only so the
          teacher can pick the window up while editing. */}
      <mesh
        position={[0, 0, profile.depth * 0.28]}
        onClick={(e) => {
          if (!onSelect) return;
          e.stopPropagation();
          onSelect(frame);
        }}
      >
        <planeGeometry args={[innerW, innerH]} />
        <meshStandardMaterial
          color="#cfe6ff"
          transparent
          opacity={0.16}
          roughness={0.06}
          metalness={0.35}
          depthWrite={false}
        />
      </mesh>

      {/* Glazing bar across the middle, as a real interior window has. */}
      <mesh position={[0, 0, profile.depth * 0.5]}>
        <boxGeometry args={[innerW, bar * 0.28, profile.depth * 0.35]} />
        <meshStandardMaterial color={profile.face} roughness={profile.roughness} metalness={profile.metalness} />
      </mesh>

      {/* Surround + trim, built exactly like the frames and doors. */}
      <FrameStructure profile={profile} width={width} height={height} selected={selected} />

      {/* Interior sill, projecting into the room. */}
      <mesh position={[0, -height / 2 - bar * 0.15, profile.depth * 0.72]} castShadow receiveShadow>
        <boxGeometry args={[width + bar * 0.5, bar * 0.42, profile.depth * 1.5]} />
        <meshStandardMaterial color={profile.bevel} roughness={0.5} metalness={profile.metalness * 0.8} />
      </mesh>

      {/* Daylight spill from the opening, so the window lights its own wall. */}
      <pointLight position={[0, 0, 0.7]} intensity={2.4} distance={6} decay={2} color="#dceaff" />
      {/* DIRECT MANIPULATION — the window slides and resizes on its own wall. */}
      {editable && onTransform && (
        <WallGizmo
          width={width}
          height={height}
          alongLength={mount.alongLength}
          alongSign={mount.alongSign}
          minWidth={0.5}
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

export default WindowObject;
