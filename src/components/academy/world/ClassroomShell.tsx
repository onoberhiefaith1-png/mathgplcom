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
  /**
   * The picture feeding the room's built-in smart screen (an uploaded lesson
   * video or the teacher's live camera). Every room has a screen; content is
   * optional.
   */
  screenVideo?: HTMLVideoElement | null;
  screenHasContent?: boolean;
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
    // Look straight down the room at standing eye height — never tipped into the
    // floor, which made a stepped auditorium read as a dark pit on entry.
    look: [door[0] + heading[0] * dims.length, 1.6, door[1] + heading[1] * dims.length],
  };
};

/** Shallow steps that close the change of level between two tiers. */
const STEP_MAX_RISE = 0.3;
const STEP_TREAD = 0.36;

const StepRun = ({
  env,
  textures,
  width,
  zTop,
  yTop,
  yBottom,
}: {
  env: EnvironmentSettings;
  textures: Record<string, string>;
  width: number;
  zTop: number;
  yTop: number;
  yBottom: number;
}) => {
  const drop = Math.abs(yTop - yBottom);
  if (drop <= 0.001) return null;
  const count = Math.max(1, Math.ceil(drop / STEP_MAX_RISE));
  const rise = drop / count;
  const props = surfaceProps(env, "floor", textures);
  return (
    <group>
      {Array.from({ length: count }, (_, k) => {
        const riserTop = yTop - k * rise;
        const riserBottom = riserTop - rise;
        const z = zTop + k * STEP_TREAD;
        return (
          <group key={`step-${k}`}>
            {/* Riser — vertical face looking back up the room. */}
            <Surface
              {...props}
              planeW={width}
              planeH={rise}
              position={[0, (riserTop + riserBottom) / 2, z]}
              rotation-y={Math.PI}
              facing={THREE.DoubleSide}
            >
              <planeGeometry args={[width, rise]} />
            </Surface>
            {/* Tread — the walking surface of this step. */}
            <Surface
              {...props}
              planeW={width}
              planeH={STEP_TREAD}
              position={[0, riserBottom, z + STEP_TREAD / 2]}
              rotation-x={-Math.PI / 2}
              facing={THREE.DoubleSide}
              receiveShadow
            >
              <planeGeometry args={[width, STEP_TREAD]} />
            </Surface>
            {/* Step wash, so a riser reads as stone rather than a black band. */}
            <pointLight
              position={[0, riserTop + 0.55, z - 0.5]}
              intensity={5}
              distance={7}
              decay={2}
              color="#fff3dd"
            />
          </group>
        );
      })}
    </group>
  );
};

const ClassroomShell = ({
  door,

  heading,
  kind,
  name,
  env,
  textures,
  openingWidth = 2.2,
  screenVideo = null,
  screenHasContent = false,
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
          {/* The change of level is a real staircase: each drop is split into
              shallow tread + riser pairs spanning the full room width. Every
              face is drawn on both sides, so a step can never be seen through
              from the level below and no open slot is left under the tier
              above. Treads sit on top of the lower slab, like stair nosings. */}
          {i < tiers.length - 1 && (
            <StepRun
              env={env}
              textures={textures}
              width={width}
              zTop={t.to}
              yTop={t.y}
              yBottom={tiers[i + 1].y}
            />
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

      {/* ROOM LIGHTING — a real ceiling grid, so a big room (and the stepped
          front of an auditorium) is lit end to end instead of fading to black. */}
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#ffffff", "#8a8f9c", 0.6]} />
      {Array.from({ length: Math.max(2, Math.round(length / 4)) }).map((_, row) => {
        const z = ((row + 0.5) * length) / Math.max(2, Math.round(length / 4));
        const xs = width > 12 ? [-width / 4, width / 4] : [0];
        return xs.map((x, col) => (
          <pointLight
            key={`lamp-${row}-${col}`}
            position={[x, height - 0.7, z]}
            intensity={0.55}
            distance={Math.max(12, length / 2)}
            decay={1.2}
          />
        ));
      })}


      {/* SMART SCREEN — the teaching display built into every room. */}
      <SmartScreen
        kind={kind}
        video={screenVideo}
        hasContent={screenHasContent}
        label={`${name.toUpperCase()} · SMART SCREEN`}
      />

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
          position={[0, 0, 0.06]}
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
