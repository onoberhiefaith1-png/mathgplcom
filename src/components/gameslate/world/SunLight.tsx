// The user's own sun / light effect. Until something is uploaded nothing is
// drawn, so the room keeps its own lighting exactly as it is.

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { assetUrl } from "@/lib/slate/assets";
import type { SunAsset } from "@/lib/slate/types";

export function SunLight({ sun }: { sun: SunAsset | null }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const disc = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const assetId = sun?.assetId ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!assetId) {
      setTexture(null);
      return;
    }
    void assetUrl(assetId).then((url) => {
      if (!url || cancelled) return;
      new THREE.TextureLoader().load(url, (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        if (cancelled) loaded.dispose();
        else setTexture(loaded);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  useFrame(({ clock }) => {
    if (!sun) return;
    const t = clock.elapsedTime;
    const pulse = sun.loop ? 1 + Math.sin(t * 0.8) * 0.04 : 1;
    if (disc.current) {
      disc.current.scale.setScalar(sun.scale * pulse);
      if (sun.loop) disc.current.rotation.z = t * 0.06;
      (disc.current.material as THREE.MeshBasicMaterial).opacity = Math.min(1, sun.glow);
    }
    if (light.current) light.current.intensity = sun.intensity * 40 * (sun.loop ? pulse : 1);
  });

  if (!sun || !texture) return null;

  return (
    <group position={[3.1, 2.9, -3.6]}>
      <pointLight ref={light} color={sun.colour} intensity={0} distance={22} decay={1.8} />
      <mesh ref={disc}>
        <planeGeometry args={[1.6, 1.6]} />
        <meshBasicMaterial
          map={texture}
          color={sun.colour}
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>
    </group>
  );
}
