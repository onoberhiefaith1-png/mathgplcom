// Dev-only: renders ONE Game writing surface, no text or numbers, on a
// transparent background so Imagine can use a faithful picture of it.
import { Suspense } from "react";
import { Environment, Lightformer } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { NewWritingSurface } from "@/components/gameslate/world/sections/NewWritingSurface";
import { SlateSection } from "@/components/gameslate/world/sections/SlateSection";
import { getConstruction } from "@/components/gameslate/world/sections/construction";
import { surfaceMaterial } from "@/components/gameslate/world/materials";
import { usePbr } from "@/components/gameslate/world/pbr";
import { getSurface } from "@/lib/slate/surfaces";
import { surfaceFamily } from "@/lib/slate/pbr";
import { defaultNumberSettings } from "@/lib/slate/defaults";

const W = 4.2;
const H = 1.4;

function One({ id }: { id: string }) {
  const surface = getSurface(id);
  const maps = usePbr(surfaceFamily(surface.id), W * 0.52, H * 0.52);
  if (surface.newKind) {
    return <NewWritingSurface kind={surface.newKind} width={W} height={H} maps={maps} accent={surface.accent} />;
  }
  return (
    <SlateSection
      index={0}
      width={W}
      height={H}
      maps={maps}
      build={getConstruction(surface.id)}
      physical={surfaceMaterial(surface.id).physical}
      accent={surface.accent}
      numbers={{ ...defaultNumberSettings(), visible: false }}
      ornament={surface.ornament}
      cleanMetal={surface.id === "metal-plate" || surface.id === "shield"}
    />
  );
}

export default function SurfaceCapture({ id }: { id: string }) {
  return (
    <div style={{ width: 1260, height: 520, background: "transparent" }}>
      <Canvas
        gl={{ alpha: true, preserveDrawingBuffer: true }}
        dpr={1}
        camera={{ position: [0, 0, 4.1], fov: 50 }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[-3, 5, 6]} intensity={2.6} />
        <pointLight position={[4, 1, 4]} color="#d8efff" intensity={1.2} />
        <Suspense fallback={null}>
          <One id={id} />
          <Environment resolution={64}>
            <Lightformer intensity={2.3} position={[0, 5, 4]} scale={[10, 2, 1]} />
            <Lightformer intensity={1.2} color="#8ebee8" position={[-5, 0, 1]} rotation-y={Math.PI / 2} scale={[8, 1, 1]} />
          </Environment>
        </Suspense>
      </Canvas>
    </div>
  );
}
