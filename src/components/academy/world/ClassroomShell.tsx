/**
 * CLASSROOM SHELL — the empty architectural frame behind a door.
 *
 * Structure: Hallway -> Door -> Classroom. The shell is its own spatial
 * structure, never part of the hallway geometry: it is positioned just beyond
 * the door it belongs to and extends away from the corridor.
 *
 * It renders only left wall, right wall, front wall, back wall, floor, ceiling
 * and the opening back to its door. Nothing is placed inside — no smartboard,
 * table, chairs, desks, wall frames, video or camera. Those arrive later as
 * independent components and must not require this shell to be rebuilt.
 *
 * Surfaces come from `resolveSurfaces`, so a classroom follows the building's
 * Default Settings until its owner gives it Individual Settings.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { Surface } from "./surface";
import { classroomDimensions } from "@/lib/building/classroom";
import type { ClassroomKind, EnvironmentSettings } from "@/lib/building/types";

const surfaceProps = (
  env: EnvironmentSettings,
  key: "leftWall" | "rightWall" | "floor" | "roof" | "endWall" | "startWall",
  textures: Record<string, string>,
) => {
  const d = env[key];
  return {
    url: d.texture ? textures[d.texture.path] : undefined,
    presetKey: d.preset,
    color: d.color,
    scale: d.scale,
    offsetX: d.offsetX,
    offsetY: d.offsetY,
    repeat: d.repeat,
    fit: d.fit,
    brightness: d.brightness,
  };
};

export interface ClassroomShellProps {
  /** World position of the doorway this classroom belongs to. */
  door: [number, number];
  /** Unit heading pointing from the doorway INTO the room. */
  heading: [number, number];
  kind: ClassroomKind;
  name: string;
  env: EnvironmentSettings;
  textures: Record<string, string>;
  /** Doorway width of the opening back to the hallway. */
  openingWidth?: number;
}

/**
 * The camera pose for standing just inside a classroom, looking at its front
 * (teaching) wall. Kept beside the geometry so navigation and rendering can
 * never disagree about where the room is.
 */
export const classroomEntryPose = (
  door: [number, number],
  heading: [number, number],
  kind: ClassroomKind,
): { position: [number, number, number]; look: [number, number, number] } => {
  const dims = classroomDimensions(kind);
  const inset = Math.min(4, dims.length * 0.3);
  return {
    position: [door[0] + heading[0] * inset, 1.75, door[1] + heading[1] * inset],
    look: [
      door[0] + heading[0] * dims.length,
      1.55 + (dims.tiers[dims.tiers.length - 1]?.y ?? 0),
      door[1] + heading[1] * dims.length,
    ],
  };
};

const ClassroomShell = ({
  door,
  heading,
  kind,
  name,
  env,
  textures,
  openingWidth = 2.2,
}: ClassroomShellProps) => {
  const dims = useMemo(() => classroomDimensions(kind), [kind]);
  const yaw = Math.atan2(heading[0], heading[1]);
  const { width, length, height, tiers } = dims;
  const lowest = tiers[tiers.length - 1]?.y ?? 0;
  const half = width / 2;

  return (
    // Local space: +z runs from the doorway into the room, x across it.
    <group position={[door[0], 0, door[1]]} rotation-y={yaw}>
      {/* FLOOR — one slab per tier, so an auditorium physically steps down. */}
      {tiers.map((t, i) => (
        <group key={`tier-${i}`}>
          <Surface
            {...surfaceProps(env, "floor", textures)}
            planeW={width}
            planeH={t.to - t.from}
            position={[0, t.y, (t.from + t.to) / 2]}
            rotation-x={-Math.PI / 2}
            facing={THREE.FrontSide}
            receiveShadow
          >
            <planeGeometry args={[width, t.to - t.from]} />
          </Surface>
          {/* Riser between this tier and the next, facing back up the room. */}
          {i < tiers.length - 1 && (
            <Surface
              {...surfaceProps(env, "floor", textures)}
              planeW={width}
              planeH={Math.abs(t.y - tiers[i + 1].y)}
              position={[0, (t.y + tiers[i + 1].y) / 2, t.to]}
              rotation-y={Math.PI}
              facing={THREE.FrontSide}
            >
              <planeGeometry args={[width, Math.abs(t.y - tiers[i + 1].y)]} />
            </Surface>
          )}
        </group>
      ))}

      {/* CEILING — level, so the volume opens up over a stepped floor. */}
      <Surface
        {...surfaceProps(env, "roof", textures)}
        planeW={width}
        planeH={length}
        position={[0, height, length / 2]}
        rotation-x={Math.PI / 2}
        facing={THREE.FrontSide}
      >
        <planeGeometry args={[width, length]} />
      </Surface>

      {/* LEFT + RIGHT WALLS, seen from inside the room. */}
      <Surface
        {...surfaceProps(env, "leftWall", textures)}
        planeW={length}
        planeH={height - lowest}
        position={[-half, (height + lowest) / 2, length / 2]}
        rotation-y={Math.PI / 2}
        facing={THREE.FrontSide}
      >
        <planeGeometry args={[length, height - lowest]} />
      </Surface>
      <Surface
        {...surfaceProps(env, "rightWall", textures)}
        planeW={length}
        planeH={height - lowest}
        position={[half, (height + lowest) / 2, length / 2]}
        rotation-y={-Math.PI / 2}
        facing={THREE.FrontSide}
      >
        <planeGeometry args={[length, height - lowest]} />
      </Surface>

      {/* FRONT WALL — the teaching wall at the lowest point of the room. */}
      <Surface
        {...surfaceProps(env, "endWall", textures)}
        planeW={width}
        planeH={height - lowest}
        position={[0, (height + lowest) / 2, length]}
        rotation-y={Math.PI}
        facing={THREE.FrontSide}
      >
        <planeGeometry args={[width, height - lowest]} />
      </Surface>

      {/* BACK WALL — split either side of the doorway, so the way out is a real
          opening in the wall rather than a hole in an otherwise missing wall. */}
      {[-1, 1].map((side) => {
        const runW = (width - openingWidth) / 2;
        if (runW <= 0.01) return null;
        return (
          <Surface
            key={`back-${side}`}
            {...surfaceProps(env, "startWall", textures)}
            planeW={runW}
            planeH={height}
            position={[side * (openingWidth / 2 + runW / 2), height / 2, 0]}
            facing={THREE.FrontSide}
          >
            <planeGeometry args={[runW, height]} />
          </Surface>
        );
      })}
      {/* Lintel above the way out. */}
      <Surface
        {...surfaceProps(env, "startWall", textures)}
        planeW={openingWidth}
        planeH={Math.max(0.1, height - 3.1)}
        position={[0, 3.1 + (height - 3.1) / 2, 0]}
        facing={THREE.FrontSide}
      >
        <planeGeometry args={[openingWidth, Math.max(0.1, height - 3.1)]} />
      </Surface>

      {/* Room lighting, so the shell is never a dark void. */}
      <pointLight position={[0, height - 0.8, length * 0.3]} intensity={0.5} distance={length * 1.6} />
      <pointLight position={[0, height - 0.8, length * 0.8]} intensity={0.4} distance={length * 1.4} />

      {/* NAMEPLATE — wall-mounted on the teaching wall, never floating. */}
      <group position={[0, 2.5 + lowest, length - 0.06]} rotation-y={Math.PI}>
        <mesh>
          <boxGeometry args={[Math.min(width * 0.6, 4.4), 0.7, 0.09]} />
          <meshStandardMaterial color="#16213e" roughness={0.45} metalness={0.25} />
        </mesh>
        <mesh position={[0, 0, -0.055]}>
          <boxGeometry args={[Math.min(width * 0.6, 4.4) + 0.16, 0.86, 0.05]} />
          <meshStandardMaterial color="#3a5786" roughness={0.4} metalness={0.35} />
        </mesh>
        <Text
          position={[0, 0, -0.06]}
          rotation-y={Math.PI}
          fontSize={0.3}
          maxWidth={Math.min(width * 0.55, 4)}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          renderOrder={10}
          material-depthTest={true}
          material-depthWrite={false}
        >
          {name.toUpperCase()}
        </Text>
      </group>
    </group>
  );
};

export default ClassroomShell;
