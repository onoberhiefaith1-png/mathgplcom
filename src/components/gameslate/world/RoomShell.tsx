import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RoomDef, RoomLight } from "@/lib/slate/rooms";
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

/** Shader for a real flame: domain-warped noise carves irregular tongues out of
 *  a tapering profile, and three emissive bands (white core, orange body, red
 *  edge) are mixed by how deep inside the flame a fragment sits. */
const FLAME_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FLAME_FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uSeed;
  uniform float uFlicker;
  uniform vec3 uTint;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float y = uv.y;
    float x = uv.x - 0.5;

    // rising, domain-warped turbulence
    vec2 q = vec2(uv.x * 3.0, uv.y * 2.2 - uTime * 1.35 + uSeed);
    float warp = fbm(q + fbm(q * 1.7) * 0.6);
    float lick = (warp - 0.5) * (0.16 + y * 0.5);

    // tapering flame profile, widest just above the fuel
    float width = 0.30 * (1.0 - pow(abs(y - 0.22) / 0.82, 1.5));
    width = max(width, 0.0);
    float d = abs(x + lick * 0.9) / max(width, 0.001);

    float body = 1.0 - smoothstep(0.55, 1.0, d);
    float tip = smoothstep(1.02, 0.55, y);
    float base = smoothstep(0.0, 0.10, y);
    float heat = body * tip * base;
    heat *= 0.75 + 0.5 * warp;
    heat *= 0.85 + 0.3 * uFlicker * sin(uTime * 11.0 + uSeed * 5.0);
    heat = clamp(heat, 0.0, 1.0);
    if (heat < 0.02) discard;

    float depthIn = heat * (1.0 - y * 0.55);
    vec3 edge = vec3(0.85, 0.14, 0.02);
    vec3 mid  = vec3(1.0, 0.52, 0.07);
    vec3 core = vec3(1.0, 0.96, 0.82);
    vec3 col = mix(edge, mid, smoothstep(0.08, 0.42, depthIn));
    col = mix(col, core, smoothstep(0.52, 0.86, depthIn));
    col *= uTint;

    gl_FragColor = vec4(col, heat * 0.95);
  }
`;

/**
 * A torch / lantern. The flame is shader-driven: irregular tongues that change
 * shape every frame, a white-hot core inside an orange body and red edge, with
 * rising embers, thin smoke and a light whose brightness, colour and position
 * are driven by the same noise, so the stone around it breathes with the fire.
 */
function LightSource({ light }: { light: RoomLight }) {
  const ref = useRef<THREE.PointLight>(null);
  const core = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Mesh>(null);
  const outer = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const smoke = useRef<THREE.Points>(null);
  const embers = useRef<THREE.Points>(null);
  const seed = useMemo(() => Math.random() * 100, []);

  const flameMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: FLAME_VERT,
        fragmentShader: FLAME_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: Math.random() * 10 },
          uFlicker: { value: light.flicker },
          uTint: { value: new THREE.Color(1, 1, 1) },
        },
      }),
    [light.flicker],
  );

  const baseColour = useMemo(() => new THREE.Color(light.colour), [light.colour]);
  const hotColour = useMemo(() => new THREE.Color(light.colour).lerp(new THREE.Color("#fff3d0"), 0.45), [light.colour]);
  const lightColour = useMemo(() => new THREE.Color(light.colour), [light.colour]);

  useEffect(() => () => flameMaterial.dispose(), [flameMaterial]);

  const puffs = useMemo(() => {
    const count = 24;
    return { count, positions: new Float32Array(count * 3), phase: Float32Array.from({ length: count }, () => Math.random()) };
  }, []);
  const sparks = useMemo(() => {
    const count = 26;
    return { count, positions: new Float32Array(count * 3), phase: Float32Array.from({ length: count }, () => Math.random()) };
  }, []);


  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const noise =
      Math.sin(t * 9.4 + seed) * 0.45 +
      Math.sin(t * 17.3 + seed * 2) * 0.3 +
      Math.sin(t * 31.7 + seed * 3) * 0.15 +
      Math.sin(t * 3.1) * 0.1;
    const f = 1 + noise * 0.28 * light.flicker;
    if (ref.current) {
      ref.current.intensity = light.intensity * f;
      // hotter flares read slightly whiter, and the source jitters a little
      lightColour.copy(baseColour).lerp(hotColour, Math.max(0, noise) * 0.5);
      ref.current.color.copy(lightColour);
      ref.current.position.set(noise * 0.03, 0.12 + noise * 0.035, noise * 0.02);
    }
    if (light.emitter === "flame") {
      flameMaterial.uniforms["uTime"]!.value = t + seed;
      (flameMaterial.uniforms["uTint"]!.value as THREE.Color)
        .copy(baseColour)
        .lerp(new THREE.Color(1, 1, 1), 0.55);
      const stretch = 1 + noise * 0.16 * light.flicker;
      if (body.current) body.current.scale.set(1 + noise * 0.05, stretch, 1);
      if (outer.current) outer.current.scale.set(1 + noise * 0.07, stretch * 0.94, 1);
    }
    if (core.current && light.emitter === "orb") core.current.scale.setScalar(1 + noise * 0.07);
    if (glow.current) {
      glow.current.scale.setScalar(1 + noise * 0.13);
      (glow.current.material as THREE.MeshBasicMaterial).opacity = 0.15 + noise * 0.05;
    }
    const advance = (
      points: THREE.Points | null,
      data: { count: number; phase: Float32Array },
      speed: number,
      rise: number,
      spread: number,
      base: number,
    ) => {
      const array = points?.geometry.attributes["position"]?.array as Float32Array | undefined;
      if (!array) return;
      for (let i = 0; i < data.count; i++) {
        const p = (t * speed + (data.phase[i] ?? 0)) % 1;
        array[i * 3] = Math.sin((data.phase[i] ?? 0) * 30 + t * 0.9) * p * spread;
        array[i * 3 + 1] = base + p * rise;
        array[i * 3 + 2] = Math.cos((data.phase[i] ?? 0) * 21 + t * 0.7) * p * spread * 0.7;
      }
      points!.geometry.attributes["position"]!.needsUpdate = true;
    };
    if (light.emitter === "flame") {
      advance(smoke.current, puffs, 0.2, 1.6, 0.2, 0.34);
      advance(embers.current, sparks, 0.55, 1.1, 0.12, 0.2);
    }
  });

  return (
    <group position={light.position}>
      <pointLight
        ref={ref}
        color={light.colour}
        intensity={light.intensity}
        distance={12}
        decay={2}
        castShadow={false}
      />
      {light.emitter === "flame" ? (
        <>
          {/* wall bracket + fuel: real geometry, not a pasted sprite */}
          <mesh position={[0, -0.62, -0.34]} castShadow receiveShadow>
            <boxGeometry args={[0.16, 0.5, 0.12]} />
            <meshStandardMaterial color="#2e2a26" metalness={0.75} roughness={0.62} />
          </mesh>
          <mesh position={[0, -0.42, -0.18]} rotation={[0.5, 0, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.4, 8]} />
            <meshStandardMaterial color="#38322c" metalness={0.8} roughness={0.5} />
          </mesh>
          <mesh position={[0, -0.4, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.06, 0.09, 0.72, 12]} />
            <meshStandardMaterial color="#2b1e13" roughness={0.95} />
          </mesh>
          <mesh position={[0, -0.05, 0]} castShadow>
            <torusGeometry args={[0.115, 0.024, 8, 20]} />
            <meshStandardMaterial color="#463629" metalness={0.72} roughness={0.48} />
          </mesh>
          {/* contact darkening where the bracket meets the wall */}
          <Contact position={[0, -0.5, -0.42]} size={[0.9, 1.2]} rotation={[0, 0, 0]} opacity={0.5} />

          {/* two crossed shader sheets give the flame volume from any angle */}
          <mesh ref={body} position={[0, 0.33, 0]} material={flameMaterial}>
            <planeGeometry args={[0.62, 0.9]} />
          </mesh>
          <mesh
            ref={outer}
            position={[0, 0.33, 0]}
            rotation={[0, Math.PI / 2, 0]}
            material={flameMaterial}
          >
            <planeGeometry args={[0.62, 0.9]} />
          </mesh>
          {/* soft heat halo, no hard bulb edge */}
          <mesh ref={glow} position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.34, 16, 16]} />
            <meshBasicMaterial
              color={light.colour}
              transparent
              opacity={0.12}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
              fog={false}
            />
          </mesh>
          <points ref={embers} frustumCulled={false}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[sparks.positions, 3]} />
            </bufferGeometry>
            <pointsMaterial
              color="#ff9b3d"
              size={0.035}
              transparent
              opacity={0.7}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
              fog={false}
            />
          </points>
          <points ref={smoke} frustumCulled={false}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[puffs.positions, 3]} />
            </bufferGeometry>
            <pointsMaterial color="#241d16" size={0.2} transparent opacity={0.16} depthWrite={false} />
          </points>
        </>
      ) : null}
      {light.emitter === "orb" ? (
        <>
          <mesh position={[0, -0.34, -0.1]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.6, 8]} />
            <meshStandardMaterial color="#39332c" metalness={0.8} roughness={0.45} />
          </mesh>
          <mesh ref={core}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshBasicMaterial color="#fff6de" toneMapped={false} fog={false} />
          </mesh>
          <mesh ref={glow}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshBasicMaterial
              color={light.colour}
              transparent
              opacity={0.18}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
              fog={false}
            />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

function Dust({ room }: { room: RoomDef }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, speeds } = useMemo(() => {
    const count = room.particles.count;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * WIDTH;
      positions[i * 3 + 1] = FLOOR_Y + Math.random() * HEIGHT;
      positions[i * 3 + 2] = BACK_Z + Math.random() * (DEPTH - 3);
      speeds[i] = 0.4 + Math.random();
    }
    return { positions, speeds };
  }, [room.particles.count]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const geo = ref.current?.geometry;
    if (!geo) return;
    const array = geo.attributes["position"]?.array as Float32Array | undefined;
    if (!array) return;
    for (let i = 0; i < speeds.length; i++) {
      array[i * 3 + 1] = (array[i * 3 + 1] ?? 0) + dt * room.particles.drift * (speeds[i] ?? 1);
      array[i * 3] = (array[i * 3] ?? 0) + dt * 0.05 * Math.sin(i + performance.now() / 4000);
      if ((array[i * 3 + 1] ?? 0) > CEIL_Y) array[i * 3 + 1] = FLOOR_Y;
    }
    geo.attributes["position"]!.needsUpdate = true;
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={room.particles.colour}
        size={room.particles.size}
        transparent
        opacity={room.particles.opacity}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

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

export function RoomShell({ room }: { room: RoomDef }) {
  const wall = usePbr(room.wallFamily, room.wallTiling[0], room.wallTiling[1]);
  const side = usePbr(room.wallFamily, room.wallTiling[0] * 1.1, room.wallTiling[1], 0.43);
  const floor = usePbr(room.floorFamily, room.floorTiling[0], room.floorTiling[1], 0.11);
  const ceiling = usePbr(room.wallFamily, room.wallTiling[0] * 1.3, room.wallTiling[1] * 1.3, 0.67);

  const icy = room.wallFamily === "ice";

  return (
    <group>
      <ambientLight color={room.ambient.colour} intensity={room.ambient.intensity} />
      <hemisphereLight
        color={room.key.colour}
        groundColor={room.floorTint}
        intensity={0.18}
      />
      <directionalLight
        color={room.key.colour}
        intensity={room.key.intensity}
        position={room.key.position}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={4}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />
      {room.lights.map((light, index) => (
        <LightSource key={index} light={light} />
      ))}

      {/* back wall */}
      <mesh position={[0, FLOOR_Y + HEIGHT / 2, BACK_Z]} receiveShadow>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        {icy ? (
          <meshPhysicalMaterial
            {...wall}
            color={room.wallTint}
            roughness={0.24}
            transmission={0.18}
            thickness={0.8}
            ior={1.31}
            clearcoat={0.7}
            clearcoatRoughness={0.2}
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
          <meshPhysicalMaterial
            {...floor}
            color={room.floorTint}
            roughness={0.3}
            transmission={0.12}
            thickness={0.6}
            ior={1.31}
            clearcoat={0.6}
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
      <Dust room={room} />
    </group>
  );
}

export const ROOM_GEOMETRY = { WIDTH, HEIGHT, DEPTH, FLOOR_Y, CEIL_Y, BACK_Z };
