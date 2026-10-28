import { Suspense } from "react";
import { Environment, Lightformer, Text } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { NewWritingSurface } from "@/components/gameslate/world/sections/NewWritingSurface";
import { getSurface } from "@/lib/slate/surfaces";
import { surfaceFamily } from "@/lib/slate/pbr";
import { usePbr } from "@/components/gameslate/world/pbr";
import type { SurfaceDef } from "@/lib/slate/surfaces";

const ITEMS = [
  ["new-parchment-scroll", "parchment", -2.2, 1.25],
  ["new-royal-plaque", "royal", 0, 1.25],
  ["new-crystal-glass", "crystal", 2.2, 1.25],
  ["new-magical-aura", "magic", -2.2, -1.15],
  ["new-cloud-panel", "cloud", 0, -1.15],
  ["new-silk-ribbon", "silk", 2.2, -1.15],
] as const;

function Sample({ id, kind, x, y }: { id: string; kind: NonNullable<SurfaceDef["newKind"]>; x: number; y: number }) {
  const surface = getSurface(id);
  const maps = usePbr(surfaceFamily(id), 2.2, 0.8, x * 0.03);
  return (
    <group position={[x, y, 0]} scale={0.68}>
      <NewWritingSurface kind={kind} width={2.08} height={0.84} maps={maps} accent={surface.accent} />
      <Text position={[0, 0, 0.23]} fontSize={0.21} color={surface.ink} anchorX="center" anchorY="middle" outlineWidth={0.006} outlineColor={surface.inkShadow}>2x − 3y = 0</Text>
    </group>
  );
}

export default function SurfaceComparison() {
  return (
    <div className="h-screen w-full bg-background">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 0, 7.4], fov: 56 }}>
        <color attach="background" args={["#d9dadd"]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[-3, 5, 6]} intensity={2.6} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <pointLight position={[4, 1, 4]} color="#d8efff" intensity={1.2} />
        <Suspense fallback={null}>
          {ITEMS.map(([id, kind, x, y]) => <Sample key={id} id={id} kind={kind} x={x} y={y} />)}
          <Environment resolution={64}>
            <Lightformer intensity={2.3} position={[0, 5, 4]} scale={[10, 2, 1]} />
            <Lightformer intensity={1.2} color="#8ebee8" position={[-5, 0, 1]} rotation-y={Math.PI / 2} scale={[8, 1, 1]} />
          </Environment>
        </Suspense>
      </Canvas>
    </div>
  );
}