// The hidden effect content, rendered inside the effect that revealed it.
//
// Nothing is visible until the reward is activated; then the configured items
// emerge from the centre of the effect, animate, settle into the arrangement,
// hold and dissolve. They are 3D symbols on the slate, never HTML.

import { useMemo, useRef } from "react";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { effectNow } from "@/lib/slate/vfx/clock";
import * as THREE from "three";
import { arrangeAt, compileScript, sampleScript } from "@/lib/slate/vfx/script";

interface Props {
  /** Raw effect code stored on the reward. */
  source: string | undefined;
  /** Effect clock time this activation started at. */
  startedAt: number;
  colour: string;
  /** Scales the whole arrangement with the reward's size. */
  size: number;
  speed: number;
}

export function ScriptStage({ source, startedAt, colour, size, speed }: Props) {
  const script = useMemo(() => compileScript(source), [source]);
  const group = useRef<THREE.Group>(null);
  const items = useRef<Array<THREE.Group | null>>([]);

  useFrame(({ clock }) => {
    if (!script || !group.current) return;
    const t = (effectNow(clock) - startedAt) * Math.max(0.4, speed);
    const state = sampleScript(script, t);
    const spread = size * 1.5;

    group.current.position.set(state.dx, state.dy, 0.14);
    group.current.rotation.z = (state.rotation * Math.PI) / 180;
    group.current.scale.setScalar(Math.max(0.01, state.scale));

    script.tokens.forEach((_, index) => {
      const node = items.current[index];
      if (!node) return;
      const [rx, ry] = arrangeAt(state.arrange, index, script.tokens.length, spread);
      // each item emerges from the centre of the effect, slightly staggered
      const stagger = Math.min(1, Math.max(0, state.reveal * script.tokens.length - index));
      const k = stagger * stagger * (3 - 2 * stagger);
      node.position.set(rx * k, ry * k, 0);
      node.scale.setScalar(0.2 + k * 0.8);
      node.rotation.z = (1 - k) * 1.2;
      const text = node.children[0] as THREE.Mesh | undefined;
      const material = text?.material as { opacity?: number } | undefined;
      if (material) material.opacity = state.opacity * k;
    });
  });

  if (!script) return null;

  return (
    <group ref={group}>
      {script.tokens.map((token, index) => (
        <group
          key={`${token}-${index}`}
          ref={(node) => {
            items.current[index] = node;
          }}
        >
          <Text
            fontSize={size * 0.62}
            font="/fonts/technical.ttf"
            color={colour}
            anchorX="center"
            anchorY="middle"
            outlineWidth={size * 0.035}
            outlineColor="#050505"
            material-transparent
            material-opacity={0}
            material-toneMapped={false}
            material-depthWrite={false}
          >
            {token}
          </Text>
        </group>
      ))}
    </group>
  );
}
