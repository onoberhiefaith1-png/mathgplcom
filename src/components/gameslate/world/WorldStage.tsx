import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { HDRI } from "@/lib/slate/pbr";
import { useWebglRecovery } from "@/lib/stability/useWebglRecovery";
import { useBootPhase } from "@/lib/game/runtime/bootStage";
import { GAME_STARTUP_DEADLINE_MS, gameStartupProgress } from "@/lib/game/runtime/startup";
import { EffectPerfOverlay } from "@/components/dev/EffectPerfOverlay";
import { PerfProbe } from "@/components/dev/PerfProbe";
import { FONTS, getSubstyle } from "@/lib/slate/text3d";
import { preloadFont } from "troika-three-text";
import { clearGeometryCache } from "@/lib/slate/vfx/geometryCache";
import { clearGlyphSolidCache } from "@/components/slate/text3d/glyphSolids";
import { clearTextMaterialCache } from "@/components/slate/text3d/ExtrudedExpression";


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
import type { SlotTextConfig } from "@/lib/slate/textConfig";

interface Props {
  game: Game;
  mode: EditorMode;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onSlotChange: (slotId: string, patch: Partial<Slot>) => void;
  onTextConfigCorrection?: (slotId: string, config: SlotTextConfig) => void;
  onRewardMove: (slotId: string, rewardId: string, x: number, y: number) => void;
  onRewardActivate: (slotId: string, rewardId: string, type: string) => void;
  onRewardConsume: (slotId: string, rewardId: string) => void;
  /** Game Play: bring this writing surface into the middle of the view. */
  focusSlotId?: string | null;
  /** Game Play: the writing surface the slate has settled on. */
  onFocusSlot?: (slotId: string) => void;
  /** Game Play: writing comes from Floating Numbers, not the keyboard. */
  readOnlyWriting?: boolean;
  /** Restore: bumped to put every text back to its saved configuration. */
  restoreKey?: number;
  /** The Content Margin was moved: where writing begins, 0–0.5 of the band. */
  onContentMarginChange?: (fraction: number) => void;
  /** Fires only after the real saved surfaces have mounted and painted. */
  onReadyChange?: (ready: boolean) => void;
  /** Reports completed startup milestones to the full-screen loader. */
  onProgressChange?: (progress: number) => void;
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
  const [canvasReady, setCanvasReady] = useState(false);
  const [surfacesReady, setSurfacesReady] = useState(false);
  const [paintedReady, setPaintedReady] = useState(false);
  const [deadlineReached, setDeadlineReached] = useState(false);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    setShowPerf(new URLSearchParams(window.location.search).has("perf"));
  }, []);

  useEffect(() => {
    setCanvasReady(false);
    setSurfacesReady(false);
    setPaintedReady(false);
    setDeadlineReached(false);
    props.onReadyChange?.(false);
    if (gpu.resetKey > 0) {
      // Cached geometry and materials belong to the context that just died.
      // Reusing them would rebuild the board out of dead buffers — blank
      // surfaces with no text. Start the caches clean instead.
      clearGeometryCache();
      clearGlyphSolidCache();
      clearTextMaterialCache();
    }
  }, [gpu.resetKey, props.onReadyChange]);


  useEffect(() => {
    let live = true;
    let settled = false;
    const style = props.game.settings.text?.style ?? "inscription";
    const font = style === "dimensional"
      ? getSubstyle(props.game.settings.text?.substyle).font
      : FONTS[style];
    const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-−×÷=()[]{}.,:;<>≤≥√ ";
    const finish = () => {
      if (!live || settled) return;
      settled = true;
    };
    preloadFont({ font, characters, sdfGlyphSize: 64 }, finish);
    preloadFont({ font: FONTS.technical, characters: "0123456789:+-", sdfGlyphSize: 64 }, () => {});
    const timeout = window.setTimeout(finish, 4000);
    return () => {
      live = false;
      window.clearTimeout(timeout);
    };
  }, [props.game.settings.text?.style, props.game.settings.text?.substyle]);

  useEffect(() => {
    if (!surfacesReady) return;
    let first = 0;
    let second = 0;
    first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => setPaintedReady(true));
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [surfacesReady, gpu.resetKey]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDeadlineReached(true), GAME_STARTUP_DEADLINE_MS);
    return () => window.clearTimeout(timeout);
  }, [gpu.resetKey]);

  const progress = gameStartupProgress({ dataReady: true, canvasReady, surfacesReady, paintedReady });
  useEffect(() => props.onProgressChange?.(progress), [progress, props.onProgressChange]);

  // Fonts, artwork, lighting and effects are optional presentation layers. They
  // may continue loading after reveal and can never hold the saved board shut.
  const stageReady = gpu.alive && (paintedReady || deadlineReached);
  useEffect(() => {
    if (!stageReady) {
      props.onReadyChange?.(false);
      return;
    }
    // Show the completed milestone for one painted frame, then expose controls.
    props.onProgressChange?.(100);
    const frame = window.requestAnimationFrame(() => props.onReadyChange?.(true));
    return () => window.cancelAnimationFrame(frame);
  }, [props.onProgressChange, props.onReadyChange, stageReady]);
  // Boot order: surfaces and input first, environment lighting next, premium
  // effects last. A later phase can never delay an earlier one.
  const phase = useBootPhase(stageReady, gpu.resetKey);


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
          shadows={!room}
          dpr={room ? 1 : [1, 1.35]}
          gl={{ antialias: !room, alpha: !room, powerPreference: "high-performance" }}
          camera={{ position: [0, 0.4, 5.4], fov: 42, near: 0.1, far: 60 }}
          onCreated={({ gl }) => {
            // linear working space in, sRGB out, filmic grade on the way there
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            if (!room) gl.setClearColor(0x000000, 0); // let the uploaded background show through
            gpu.attach(gl.domElement);
            setCanvasReady(true);
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
            {/* PHASE 1 — simple lights, always present, nothing to download.
                The board is lit and tappable from the first frame. */}
            <ambientLight color={stage.ambient.colour} intensity={stage.ambient.intensity} />
            <directionalLight
              position={stage.key.position}
              color={stage.key.colour}
              intensity={stage.key.intensity}
            />
            {/* A room carries its own lamps plus this cheap static fill, so the
                environment never needs a photographed probe: that probe costs a
                download and per-frame sampling that made writing lag. */}
            {room ? (
              <hemisphereLight
                args={[room.fog.colour, room.ambient.colour, room.env.intensity * 0.7]}
              />
            ) : null}
            {room ? <RoomShell key={room.id} room={room} /> : null}
          </Suspense>
          {/* PHASE 2 — photographed environment lighting, roomless stages only.
              A download, so it is admitted only after the board has painted. */}
          {phase >= 2 && !room ? (
            <Suspense fallback={null}>
              <Environment
                files={HDRI[stage.env.mood]}
                environmentIntensity={stage.env.intensity}
                background={false}
                resolution={256}
              />
            </Suspense>
          ) : null}

          <Suspense fallback={null}>
            <SunLight sun={props.game.settings.assets?.sun ?? null} />
          </Suspense>
          <Suspense fallback={null}>
            <SlateColumn
              room={stage}
              roomless={!room}
              scroll={scroll}
              {...props}
              onReady={() => setSurfacesReady(true)}
            />
          </Suspense>
        </Canvas>
      </WorldBoundary>
      {showPerf ? <EffectPerfOverlay /> : null}
    </div>
  );
}
