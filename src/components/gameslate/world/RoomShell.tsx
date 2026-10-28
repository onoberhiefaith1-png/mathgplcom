import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { RoomDef } from "@/lib/slate/rooms";
import { usePbr } from "./pbr";


const WIDTH = 13;
const HEIGHT = 7.6;
const DEPTH = 13;
const FLOOR_Y = -3.4;
const CEIL_Y = FLOOR_Y + HEIGHT;
const BACK_Z = -6.2;

/** Soft radial alpha patch — the contact darkening under anything that sits
 *  on the floor or touches a wall. Built once, reused everywhere. */
let blobTexture: THREE.Texture | null = null;
export function contactBlob(): THREE.Texture {
  if (blobTexture) return blobTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(0,0,0,0.85)");
  gradient.addColorStop(0.55, "rgba(0,0,0,0.38)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  blobTexture = new THREE.CanvasTexture(canvas);
  return blobTexture;
}

function Contact({
  position,
  size,
  opacity = 0.55,
  rotation = [-Math.PI / 2, 0, 0] as [number, number, number],
}: {
  position: [number, number, number];
  size: [number, number];
  opacity?: number;
  rotation?: [number, number, number];
}) {
  const texture = useMemo(contactBlob, []);
  return (
    <mesh position={position} rotation={rotation} renderOrder={2}>
      <planeGeometry args={size} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        color="#000000"
      />
    </mesh>
  );
}

/* The room is scenery only. It deliberately owns NO per-frame loop: the old
 * shader-flame light and drifting-dust passes were removed so nothing in the
 * environment competes with writing, selection or marking for a frame. */




function Props({ room }: { room: RoomDef }) {
  const accent = room.accent;
  const stone = usePbr(room.wallFamily, 1.4, 2.4, 0.31);
  const floorStone = usePbr(room.floorFamily, 1.2, 1.2, 0.17);

  switch (room.props) {
    case "pillars":
    case "door-frame":
    case "tablet-stands":
      return (
        <group>
          {[-5.1, 5.1].map((x) => (
            <group key={x} position={[x, FLOOR_Y, -4.4]}>
              <Contact position={[0, 0.012, 0]} size={[3.2, 3.2]} opacity={0.7} />
              <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.5, 0.7, 1.5]} />
                <meshStandardMaterial {...floorStone} color={room.floorTint} />
              </mesh>
              <mesh position={[0, HEIGHT / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.55, 0.62, HEIGHT - 1.2, 24]} />
                <meshStandardMaterial {...stone} color={room.wallTint} />
              </mesh>
              <mesh position={[0, HEIGHT - 0.5, 0]} castShadow>
                <boxGeometry args={[1.6, 0.6, 1.6]} />
                <meshStandardMaterial {...stone} color={room.ceilingTint} />
              </mesh>
            </group>
          ))}
          {room.props === "tablet-stands"
            ? [-3.4, 3.4].map((x) => (
                <group key={x} position={[x, FLOOR_Y, -3.2]}>
                  <Contact position={[0, 0.012, 0]} size={[2.4, 2.4]} opacity={0.6} />
                  <mesh position={[0, 0.5, 0]} rotation={[0, x > 0 ? -0.4 : 0.4, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.1, 1, 0.28]} />
                    <meshStandardMaterial {...stone} color={room.wallTint} />
                  </mesh>
                </group>
              ))
            : null}
        </group>
      );
    case "timber":
      return (
        <group>
          {[-2.2, 0.6, 3.4].map((x) => (
            <mesh key={x} position={[x, CEIL_Y - 0.45, -2]} castShadow>
              <boxGeometry args={[0.45, 0.45, DEPTH - 2]} />
              <meshStandardMaterial {...stone} color={room.ceilingTint} />
            </mesh>
          ))}
          {[-5.4, 5.4].map((x) => (
            <group key={x}>
              <Contact position={[x, FLOOR_Y + 0.012, -3.6]} size={[2, 2]} opacity={0.65} />
              <mesh position={[x, FLOOR_Y + HEIGHT / 2, -3.6]} castShadow receiveShadow>
                <boxGeometry args={[0.5, HEIGHT, 0.5]} />
                <meshStandardMaterial {...stone} color={room.wallTint} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "forge":
      return (
        <group>
          <Contact position={[-4.3, FLOOR_Y + 0.012, -2.4]} size={[3.4, 3]} opacity={0.7} />
          <mesh position={[-4.3, FLOOR_Y + 0.6, -2.4]} castShadow receiveShadow>
            <boxGeometry args={[2, 1.2, 1.6]} />
            <meshStandardMaterial {...stone} color="#8c837c" />
          </mesh>
          <mesh position={[-4.3, FLOOR_Y + 1.25, -2.4]}>
            <boxGeometry args={[1.4, 0.15, 1]} />
            <meshBasicMaterial color="#ff5210" toneMapped={false} fog={false} />
          </mesh>
          <Contact position={[4.6, FLOOR_Y + 0.012, -3]} size={[2.2, 2.2]} opacity={0.6} />
          <mesh position={[4.6, FLOOR_Y + 1, -3]} castShadow receiveShadow>
            <cylinderGeometry args={[0.35, 0.45, 2, 18]} />
            <meshStandardMaterial {...floorStone} color="#9a938d" metalness={0.85} />
          </mesh>
        </group>
      );
    case "shelves":
      return (
        <group>
          {[-4.6, 4.6].map((x) =>
            [0, 1.3, 2.6].map((y) => (
              <mesh key={`${x}-${y}`} position={[x, FLOOR_Y + 1 + y, -3.4]} castShadow receiveShadow>
                <boxGeometry args={[2.2, 0.16, 1]} />
                <meshStandardMaterial {...stone} color={room.wallTint} />
              </mesh>
            )),
          )}
          {[-4.6, 4.6].map((x) =>
            [0.35, 1.65, 2.95].map((y, index) => (
              <mesh key={`b${x}-${y}`} position={[x + (index - 1) * 0.3, FLOOR_Y + 1 + y, -3.4]} castShadow>
                <boxGeometry args={[1.3, 0.42, 0.7]} />
                <meshStandardMaterial color={accent} roughness={0.85} metalness={0.02} />
              </mesh>
            )),
          )}
        </group>
      );
    case "chests":
      return (
        <group>
          {[-4.2, 4.2, -2.4].map((x, index) => (
            <group key={x} position={[x, FLOOR_Y, -2.6 + index * 0.9]}>
              <Contact position={[0, 0.012, 0]} size={[2.6, 2]} opacity={0.7} />
              <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.5, 0.9, 1]} />
                <meshStandardMaterial {...stone} color="#8a6b4a" roughness={0.85} />
              </mesh>
              <mesh position={[0, 0.95, 0]} castShadow>
                <boxGeometry args={[1.55, 0.18, 1.05]} />
                <meshStandardMaterial color={accent} metalness={0.9} roughness={0.28} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "armour":
      return (
        <group>
          {[-4.4, 4.4].map((x) => (
            <group key={x} position={[x, FLOOR_Y, -3]}>
              <Contact position={[0, 0.012, 0]} size={[1.8, 1.8]} opacity={0.65} />
              <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.12, 0.16, 1.8, 12]} />
                <meshStandardMaterial color="#514a3f" roughness={0.7} metalness={0.5} />
              </mesh>
              <mesh position={[0, 2.1, 0]} castShadow>
                <sphereGeometry args={[0.34, 24, 24]} />
                <meshStandardMaterial color="#9a9078" metalness={0.95} roughness={0.28} />
              </mesh>
              {/* a shield is curved and has thickness */}
              <mesh
                position={[x > 0 ? -0.58 : 0.58, 1.5, 0.22]}
                rotation={[Math.PI / 2, 0, 0.2]}
                castShadow
                receiveShadow
              >
                <sphereGeometry args={[0.52, 28, 16, 0, Math.PI * 2, 0, Math.PI / 7]} />
                <meshStandardMaterial color={accent} metalness={0.88} roughness={0.32} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "crystals":
    case "ice-formations":
      return (
        <group>
          {[-5, -3.6, 3.6, 5].map((x, index) => (
            <group key={x}>
              <Contact
                position={[x, FLOOR_Y + 0.012, -3 - (index % 3) * 0.6]}
                size={[2, 2]}
                opacity={0.5}
              />
              <mesh
                position={[x, FLOOR_Y + 1 + (index % 2) * 0.6, -3 - (index % 3) * 0.6]}
                rotation={[0.1, index, 0.12 * (index % 3)]}
                castShadow
              >
                <octahedronGeometry args={[0.75 + (index % 3) * 0.25, 0]} />
                <meshPhysicalMaterial
                  color="#dceef6"
                  roughness={0.1}
                  metalness={0}
                  transmission={0.65}
                  thickness={1.2}
                  ior={1.31}
                  attenuationColor={accent}
                  attenuationDistance={1.6}
                  clearcoat={1}
                  clearcoatRoughness={0.08}
                />
              </mesh>
            </group>
          ))}
          {[-2.5, 2.5].map((x) => (
            <mesh key={`c${x}`} position={[x, CEIL_Y - 1.2, -4]} rotation={[Math.PI, 0, 0]} castShadow>
              <coneGeometry args={[0.35, 1.8, 10]} />
              <meshPhysicalMaterial
                color="#dceef6"
                roughness={0.14}
                transmission={0.6}
                thickness={1}
                ior={1.31}
                attenuationColor={accent}
                attenuationDistance={1.4}
                clearcoat={1}
              />
            </mesh>
          ))}
        </group>
      );
    default:
      return null;
  }
}

function RoomShellScene({ room }: { room: RoomDef }) {
  const shell = useRef<THREE.Group>(null);
  const wall = usePbr(room.wallFamily, room.wallTiling[0], room.wallTiling[1]);
  const side = usePbr(room.wallFamily, room.wallTiling[0] * 1.1, room.wallTiling[1], 0.43);
  const floor = usePbr(room.floorFamily, room.floorTiling[0], room.floorTiling[1], 0.11);
  const ceiling = usePbr(room.wallFamily, room.wallTiling[0] * 1.3, room.wallTiling[1] * 1.3, 0.67);

  const icy = room.wallFamily === "ice";

  useEffect(() => {
    const root = shell.current;
    if (!root) return;
    // The room is scenery. Its nearer walls and props must never win the
    // raycast over a writing surface or delay line selection, and nothing in
    // it moves, so its matrices are computed once instead of every frame.
    root.traverse((object) => {
      object.raycast = () => {};
      object.updateMatrix();
      object.matrixAutoUpdate = false;
    });
    root.updateMatrixWorld(true);
  }, [room.id]);


  return (
    <group ref={shell}>
      {/* WorldStage owns the shared ambient/key lights. Keeping one lighting
          rig avoids duplicate shadow work competing with live writing. */}
      {room.lights.map((light, index) => (
        <group key={index} position={light.position}>
          <pointLight
            color={light.colour}
            intensity={light.intensity}
            distance={12}
            decay={2}
            castShadow={false}
          />
          <mesh>
            <sphereGeometry args={[light.emitter === "orb" ? 0.16 : 0.1, 10, 8]} />
            <meshBasicMaterial color={light.colour} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* back wall */}
      <mesh position={[0, FLOOR_Y + HEIGHT / 2, BACK_Z]} receiveShadow>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        {icy ? (
          // Ice keeps its cold sheen through cheap reflectivity. Real
          // transmission costs an extra full-scene pass every frame, which is
          // what made writing lag inside a room.
          <meshStandardMaterial
            {...wall}
            color={room.wallTint}
            roughness={0.22}
            metalness={0.12}
            envMapIntensity={1.35}
          />
        ) : (
          <meshStandardMaterial {...wall} color={room.wallTint} />
        )}

      </mesh>
      {/* side walls */}
      {[-1, 1].map((sign) => (
        <mesh
          key={sign}
          position={[(sign * WIDTH) / 2, FLOOR_Y + HEIGHT / 2, BACK_Z + DEPTH / 2]}
          rotation={[0, (-sign * Math.PI) / 2, 0]}
          receiveShadow
        >
          <planeGeometry args={[DEPTH, HEIGHT]} />
          <meshStandardMaterial {...side} color={room.wallTint} />
        </mesh>
      ))}
      {/* floor */}
      <mesh position={[0, FLOOR_Y, BACK_Z + DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WIDTH, DEPTH]} />
        {icy ? (
          <meshStandardMaterial
            {...floor}
            color={room.floorTint}
            roughness={0.28}
            metalness={0.1}
            envMapIntensity={1.25}
          />
        ) : (
          <meshStandardMaterial {...floor} color={room.floorTint} />
        )}

      </mesh>
      {/* contact darkening where the walls meet the floor */}
      <Contact position={[0, FLOOR_Y + 0.01, BACK_Z + 1.4]} size={[WIDTH, 4.4]} opacity={0.75} />
      {[-1, 1].map((sign) => (
        <Contact
          key={sign}
          position={[(sign * WIDTH) / 2 - sign * 1.2, FLOOR_Y + 0.011, BACK_Z + DEPTH / 2]}
          size={[3.2, DEPTH]}
          opacity={0.6}
        />
      ))}
      {/* ceiling */}
      <mesh position={[0, CEIL_Y, BACK_Z + DEPTH / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[WIDTH, DEPTH]} />
        <meshStandardMaterial {...ceiling} color={room.ceilingTint} roughness={1} />
      </mesh>

      <Props room={room} />
    </group>
  );
}

/**
 * The room is a BACKGROUND layer. It re-renders only when the room itself
 * changes, so nothing about writing, line selection, marking or rewards can
 * ever rebuild the environment — or be delayed by it.
 */
export const RoomShell = memo(RoomShellScene, (a, b) => a.room.id === b.room.id);



export const ROOM_GEOMETRY = { WIDTH, HEIGHT, DEPTH, FLOOR_Y, CEIL_Y, BACK_Z };
