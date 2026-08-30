/**
 * ACADEMY HALLWAY — the corridor you walk down.
 *
 * The hall is generated from the rooms in the database: add a room in the editor
 * and a new doorway appears here, in its stored order. The corridor extends as
 * far as the room list is long, so there is no fixed number of rooms.
 *
 * Navigation is a glide along the corridor (arrow keys, on-screen controls,
 * drag / swipe), never a rotating carousel.
 */
import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import type { AcademyRoom } from "@/lib/academy/types";

const SPACING = 7.5; // distance between doorways along the corridor
const HALL_WIDTH = 7;
const HALL_HEIGHT = 5.4;

const accentOf = (room: AcademyRoom, index: number) =>
  room.accent || ["#7dd3fc", "#fcd34d", "#a7f3d0", "#f9a8d4", "#c4b5fd", "#fdba74"][index % 6];

/** Camera glides to the focused doorway; nothing else moves the view. */
const CameraRig = ({ focus }: { focus: number }) => {
  const target = useRef(0);
  target.current = focus * SPACING;
  useFrame(({ camera }, delta) => {
    const k = 1 - Math.exp(-6 * Math.min(delta, 0.05));
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, target.current + 6.5, k);
    camera.position.y = 1.7;
    camera.position.x = 0;
    camera.lookAt(0, 1.7, target.current - 2);
  });
  return null;
};

const Corridor = ({ length }: { length: number }) => (
  <group position={[0, 0, -length / 2 + SPACING]}>
    {/* floor */}
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[HALL_WIDTH, length + 40]} />
      <meshStandardMaterial color="#1b2130" roughness={0.35} metalness={0.15} />
    </mesh>
    {/* ceiling */}
    <mesh rotation-x={Math.PI / 2} position={[0, HALL_HEIGHT, 0]}>
      <planeGeometry args={[HALL_WIDTH, length + 40]} />
      <meshStandardMaterial color="#141a26" roughness={0.9} />
    </mesh>
    {/* walls */}
    {[-1, 1].map((side) => (
      <mesh key={side} position={[(side * HALL_WIDTH) / 2, HALL_HEIGHT / 2, 0]} rotation-y={(-side * Math.PI) / 2}>
        <planeGeometry args={[length + 40, HALL_HEIGHT]} />
        <meshStandardMaterial color="#232c3d" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
    ))}
  </group>
);

const Doorway = ({
  room,
  index,
  focused,
  onEnter,
}: {
  room: AcademyRoom;
  index: number;
  focused: boolean;
  onEnter: () => void;
}) => {
  const side = index % 2 === 0 ? -1 : 1;
  const z = -index * SPACING;
  const accent = accentOf(room, index);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, delta) => {
    if (!glow.current) return;
    const k = 1 - Math.exp(-8 * Math.min(delta, 0.05));
    glow.current.emissiveIntensity = THREE.MathUtils.lerp(
      glow.current.emissiveIntensity,
      focused ? 1.5 : 0.35,
      k,
    );
  });

  return (
    <group position={[(side * HALL_WIDTH) / 2 + side * 0.02, 0, z]} rotation-y={(-side * Math.PI) / 2}>
      {/* door panel — the click target */}
      <mesh
        position={[0, 1.6, 0.02]}
        onClick={(e) => {
          e.stopPropagation();
          onEnter();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <planeGeometry args={[2.9, 3.2]} />
        <meshStandardMaterial
          ref={glow}
          color="#0f1521"
          emissive={accent}
          emissiveIntensity={0.35}
          roughness={0.4}
        />
      </mesh>
      {/* frame */}
      <mesh position={[0, 1.6, 0.01]}>
        <planeGeometry args={[3.2, 3.5]} />
        <meshStandardMaterial color={accent} roughness={0.5} />
      </mesh>
      <Suspense fallback={null}>
        <Text
          position={[0, 3.05, 0.06]}
          fontSize={0.26}
          maxWidth={2.7}
          textAlign="center"
          color="#0b1018"
          anchorY="middle"
        >
          {room.name}
        </Text>
        <Text
          position={[0, 1.5, 0.06]}
          fontSize={0.17}
          maxWidth={2.5}
          textAlign="center"
          color="#e6edf7"
          anchorY="middle"
        >
          {room.description || "Open room"}
        </Text>
        <Text position={[0, 0.55, 0.06]} fontSize={0.14} color={accent} anchorY="middle">
          {`${room.categories.filter((c) => c.is_visible).length} sections`}
        </Text>
      </Suspense>
    </group>
  );
};

export interface HallwaySceneProps {
  rooms: AcademyRoom[];
  focus: number;
  onFocusChange: (index: number) => void;
  onEnterRoom: (roomId: string) => void;
}

const HallwayScene = ({ rooms, focus, onFocusChange, onEnterRoom }: HallwaySceneProps) => {
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") onFocusChange(Math.min(rooms.length - 1, focus + 1));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") onFocusChange(Math.max(0, focus - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, rooms.length, onFocusChange]);

  const length = Math.max(rooms.length, 3) * SPACING;

  return (
    <div
      className="absolute inset-0"
      onPointerDown={(e) => (dragStart.current = e.clientX)}
      onPointerUp={(e) => {
        if (dragStart.current === null) return;
        const dx = e.clientX - dragStart.current;
        dragStart.current = null;
        if (Math.abs(dx) < 60) return;
        onFocusChange(
          dx < 0 ? Math.min(rooms.length - 1, focus + 1) : Math.max(0, focus - 1),
        );
      }}
    >
      <Canvas shadows camera={{ position: [0, 1.7, 6.5], fov: 62 }} dpr={[1, 2]}>
        <color attach="background" args={["#0b0f18"]} />
        <fog attach="fog" args={["#0b0f18", 14, 46]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 8, 4]} intensity={1.1} castShadow />
        {rooms.map((_, i) => (
          <pointLight key={i} position={[0, HALL_HEIGHT - 0.6, -i * SPACING]} intensity={9} distance={11} color="#cfe3ff" />
        ))}
        <CameraRig focus={focus} />
        <Corridor length={length} />
        {rooms.map((room, index) => (
          <Doorway
            key={room.id}
            room={room}
            index={index}
            focused={index === focus}
            onEnter={() => onEnterRoom(room.id)}
          />
        ))}
      </Canvas>
    </div>
  );
};

export default HallwayScene;
