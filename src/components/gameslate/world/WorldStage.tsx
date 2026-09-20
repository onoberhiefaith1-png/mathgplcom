import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { HDRI } from "@/lib/slate/pbr";
import { useWebglRecovery } from "@/lib/stability/useWebglRecovery";
import { EffectPerfOverlay } from "@/components/dev/EffectPerfOverlay";
import { PerfProbe } from "@/components/dev/PerfProbe";

/** Per-room camera exposure — the grade lives here, not in saturated colours. */
function Exposure({ value }: { value: number }) {
  const gl = useThree((state) => state.gl);
  gl.toneMappingExposure = value;
  return null;
}
import { getRoom, NEUTRAL_ROOM } from "@/lib/slate/rooms";
import { BackgroundLayer } from "./BackgroundLayer";
import { RoomShell } from "./RoomShell";
import { SlateColumn } from "./SlateColumn";
import { SunLight } from "./SunLight";
import type { ScrollState } from "./SlateColumn";
import { WorldBoundary } from "./WorldBoundary";
import type { EditorMode, Game, Selection, Slot } from "@/lib/slate/types";

interface Props {
  game: Game;
  mode: EditorMode;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onSlotChange: (slotId: string, patch: Partial<Slot>) => void;
  onRewardMove: (slotId: string, rewardId: string, x: number, y: number) => void;
  onRewardActivate: (slotId: string, rewardId: string, type: string) => void;
  onRewardConsume: (slotId: string, rewardId: string) => void;
  /** Game Play: bring this writing surface into the middle of the view. */
  focusSlotId?: string | null;
  /** Game Play: the writing surface the slate has settled on. */
  onFocusSlot?: (slotId: string) => void;
  /** Game Play: writing comes from Floating Numbers, not the keyboard. */
  readOnlyWriting?: boolean;
}

/**
 * One fixed-camera 3D world. The room and the camera never move. Scrolling
 * slides the physical slate vertically through the viewpoint.
 */
export default function WorldStage(props: Props) {
  const room = getRoom(props.game.roomId);
  const stage = room ?? NEUTRAL_ROOM;
  const host = useRef<HTMLDivElement>(null);
  // A lost graphics context used to leave the board permanently black. Recovery
  // keeps the SAME context when the browser restores it, and rebuilds the view
  // exactly once if it never does.
  const gpu = useWebglRecovery("game-slate");
  const scroll = useRef<ScrollState & { locked: boolean }>({
    target: 0,
    current: 0,
    max: 0,
    locked: false,
  });

  // performance readout, development only, opt in with ?perf=1
  const [showPerf, setShowPerf] = useState(false);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    setShowPerf(new URLSearchParams(window.location.search).has("perf"));
  }, []);

  useEffect(() => {
    const node = host.current;
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const state = scroll.current;
      state.target = Math.min(state.max, Math.max(0, state.target + event.deltaY * 0.0042));
    };

    let dragging = false;
    let lastY = 0;
    const onDown = (event: PointerEvent) => {
      if (scroll.current.locked) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-writable]")) return;
      dragging = true;
      lastY = event.clientY;
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging || scroll.current.locked) return;
      const state = scroll.current;
      state.target = Math.min(state.max, Math.max(0, state.target + (event.clientY - lastY) * 0.009));
      lastY = event.clientY;
    };
    const onUp = () => {
      dragging = false;
      scroll.current.locked = false;
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div ref={host} className="absolute inset-0 touch-none">
      {/* Background is always the bottom layer; a room, if any, paints over it. */}
      <BackgroundLayer background={props.game.background} />
      <WorldBoundary>
        <Canvas
          key={gpu.resetKey}
          shadows
          dpr={[1, 1.8]}
          gl={{ antialias: true, alpha: !room, powerPreference: "high-performance" }}
          camera={{ position: [0, 0.4, 5.4], fov: 42, near: 0.1, far: 60 }}
          onCreated={({ gl }) => {
            // linear working space in, sRGB out, filmic grade on the way there
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            if (!room) gl.setClearColor(0x000000, 0); // let the uploaded background show through
            gpu.attach(gl.domElement);
          }}
        >
          <Exposure value={stage.exposure} />
          {showPerf ? <PerfProbe /> : null}
          {room ? (
            <>
              <color attach="background" args={[room.fog.colour]} />
              <fog attach="fog" args={[room.fog.colour, room.fog.near, room.fog.far]} />
            </>
          ) : null}
          <Suspense fallback={null}>
            <Suspense fallback={null}>
            {room ? (
              <>
                {/* photographed interior lighting: real reflections and ambient bounce */}
                <Environment
                  files={HDRI[room.env.mood]}
                  environmentIntensity={room.env.intensity}
                  resolution={256}
                />
                <RoomShell key={room.id} room={room} />
              </>
            ) : (
              <>
                {/* lighting only — the uploaded background stays visible behind */}
                <Environment
                  files={HDRI[stage.env.mood]}
                  environmentIntensity={stage.env.intensity}
                  background={false}
                  resolution={256}
                />
                <ambientLight color={stage.ambient.colour} intensity={stage.ambient.intensity} />
                <directionalLight
                  position={stage.key.position}
                  color={stage.key.colour}
                  intensity={stage.key.intensity}
                />
              </>
            )}
            </Suspense>
            <SunLight sun={props.game.settings.assets?.sun ?? null} />
            <SlateColumn room={stage} roomless={!room} scroll={scroll} {...props} />
          </Suspense>
        </Canvas>
      </WorldBoundary>
      {showPerf ? <EffectPerfOverlay /> : null}
    </div>
  );
}
