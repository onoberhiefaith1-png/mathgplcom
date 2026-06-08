import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, useGLTF } from "@react-three/drei";
import { Box } from "lucide-react";

const Model = ({ src }: { src: string }) => {
  const { scene } = useGLTF(src);
  return <primitive object={scene} />;
};

/**
 * Lazy 3D viewer. A Canvas (and its WebGL context) is only created after the
 * user clicks "View 3D". Browsers cap active WebGL contexts (~8-16); mounting
 * one per grid card would exceed the limit and crash with
 * "Error creating WebGL context".
 */
const GlbViewer = ({ src }: { src: string }) => {
  const [active, setActive] = useState(false);

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg bg-background/40 text-muted-foreground transition hover:bg-background/60 hover:text-foreground"
        aria-label="Load 3D preview"
      >
        <Box className="h-8 w-8" />
        <span className="text-xs font-medium">View 3D</span>
      </button>
    );
  }

  return (
    <div className="aspect-square w-full overflow-hidden rounded-lg bg-background/40">
      <Canvas camera={{ position: [0, 1, 3], fov: 45 }}>
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.6}>
            <Model src={src} />
          </Stage>
        </Suspense>
        <OrbitControls autoRotate enablePan={false} />
      </Canvas>
    </div>
  );
};

export default GlbViewer;
