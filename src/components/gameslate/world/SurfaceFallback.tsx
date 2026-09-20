import type { Game } from "@/lib/slate/types";
import { SLATE_FRONT, SLATE_Z, VIEW_TOP, buildLayout } from "@/lib/slate/layout";

/**
 * Asset-free first paint for the Game slate.
 *
 * This deliberately uses no textures, fonts, rewards, HDRI, or uploaded media.
 * It therefore remains available while optional artwork is loading or has
 * failed, so the writing surfaces never collapse into an unexplained blank.
 */
export function SurfaceFallback({ game }: { game: Game }) {
  const slots = game.slots.length > 0 ? game.slots : [{ id: "surface-fallback" }];
  const layout = buildLayout(
    slots.map((slot) => ({
      id: slot.id,
      text: "text" in slot ? slot.text : "",
      hiddenContent: "hiddenContent" in slot ? slot.hiddenContent : "",
      contentState: "hidden" as const,
      rewards: [],
      scene: "scene" in slot ? slot.scene : {},
    })),
    game.settings.text?.size ?? 30,
  );

  return (
    <group position={[0, VIEW_TOP, SLATE_Z + SLATE_FRONT]}>
      {layout.regions.slice(0, 8).map((region, index) => (
        <group key={region.slot.id} position={[0, -region.centre, 0]}>
          <mesh position={[0, 0, -0.04]}>
            <boxGeometry args={[5.4, Math.max(0.5, region.height - 0.08), 0.08]} />
            <meshStandardMaterial color={game.surfaceColour ?? "#f4ead7"} roughness={0.82} />
          </mesh>
          <mesh position={[-2.4, Math.max(0.5, region.height - 0.08) / 2 - 0.13, 0.015]}>
            <circleGeometry args={[0.075, 20]} />
            <meshBasicMaterial color="#6f624d" />
          </mesh>
          {index === 0 ? (
            <mesh position={[0, 0, 0.01]}>
              <planeGeometry args={[4.7, 0.035]} />
              <meshBasicMaterial color="#8f826b" transparent opacity={0.38} />
            </mesh>
          ) : null}
        </group>
      ))}
      <ambientLight intensity={1.6} />
      <directionalLight position={[2, 3, 4]} intensity={2.2} />
    </group>
  );
}