// Smartboard Flow layer: fixed character in the reserved right-hand zone,
// emotion queue buttons beneath it, and the live Sensor + Trail.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { loadFlow, loadNotebookFlow, saveFlow } from "@/lib/flow/api";
import DraggableResizable, { type Placement } from "./DraggableResizable";
import { flowReducer, initialFlow, type FlowEvent, type FlowState } from "@/lib/flow/machine";
import { validateScenes, withRanges } from "@/lib/flow/segments";
import type { FlowConfig } from "@/lib/flow/types";
import FlowCharacter from "./FlowCharacter";
import FlowTrail from "./FlowTrail";
import FlowEmotionBar from "./FlowEmotionBar";
import { sceneLabel } from "@/lib/flow/segments";

export const FlowOverlay = ({ notebookId, hashOn, showControls, onActiveChange }: { notebookId?: string | null; hashOn: boolean; showControls: boolean; onActiveChange?: (active: boolean) => void }) => {
  const [cfg, setCfg] = useState<FlowConfig | null>(null);
  useEffect(() => {
    if (!notebookId) return;
    loadNotebookFlow(notebookId).then(setCfg);
  }, [notebookId]);
  const ok = !!cfg && cfg.enabled && cfg.clips.length > 0 && validateScenes(cfg.scenes).length === 0;
  useEffect(() => { onActiveChange?.(ok); }, [ok, onActiveChange]);
  useEffect(() => () => onActiveChange?.(false), [onActiveChange]);
  if (!ok) return null;
  return <FlowRuntime cfg={cfg!} hashOn={hashOn} showControls={showControls} />;
};

const FlowRuntime = ({ cfg, hashOn, showControls }: { cfg: FlowConfig; hashOn: boolean; showControls: boolean }) => {
  const ranges = useMemo(() => withRanges(cfg.scenes), [cfg.scenes]);
  const reducer = useMemo(() => flowReducer(cfg.scenes), [cfg.scenes]);
  const [playKey, setPlayKey] = useState(0);
  const [state, rawDispatch] = useReducer(
    (s: FlowState, e: FlowEvent) => reducer(s, e),
    cfg.scenes,
    initialFlow,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const baseId = useMemo(() => cfg.scenes.find((s) => s.type === "base")?.id ?? null, [cfg.scenes]);
  const dispatch = useCallback((e: FlowEvent) => {
    rawDispatch(e);
    const s = stateRef.current;
    // An emotion picked over the base loop starts playing at once.
    const instant = e.type === "EMOTION" && s.mode === "character" && !s.pendingOut && s.current === baseId;
    if (e.type === "SCENE_END" || e.type === "HASH_OFF" || instant) setPlayKey((k) => k + 1);
  }, [baseId]);

  const firstHash = useRef(true);
  useEffect(() => {
    if (firstHash.current) { firstHash.current = false; if (!hashOn) return; }
    dispatch({ type: hashOn ? "HASH_ON" : "HASH_OFF" });
  }, [hashOn, dispatch]);

  const current = ranges.find((r) => r.id === state.current) ?? null;
  const emotions = ranges.filter((r) => r.type === "emotion");

  // Sensor source: the Smartboard writing caret, else the pointer.
  const pointer = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const on = (e: PointerEvent) => { pointer.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("pointermove", on);
    return () => window.removeEventListener("pointermove", on);
  }, []);
  const getPoint = useCallback(() => {
    const el = document.querySelector(".sb-sensor") as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width || r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return pointer.current;
  }, []);

  const inSensor = state.mode === "sensor";
  const volume = cfg.position.volume ?? 0.75;

  const [charPos, setCharPos] = useState<Placement>(() => cfg.position.character ?? { x: 0.85, y: 0.65, scale: cfg.position.scale ?? 1 });
  const [barPos, setBarPos] = useState<Placement>(() => cfg.position.emotionBar ?? { x: 0.85, y: 0.95, scale: 1 });
  const cfgRef = useRef(cfg);
  const commit = useCallback(async (patch: Partial<FlowConfig["position"]>) => {
    if (!showControls) return;
    try {
      const fresh = (await loadFlow(cfg.id)) ?? cfgRef.current;
      const next = { ...fresh, position: { ...fresh.position, ...patch } };
      cfgRef.current = next;
      await saveFlow(next);
    } catch (e) { console.warn("Flow position save failed", e); }
  }, [cfg.id, showControls]);

  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const barW = emotions.length * 34 + 20;
  const showBar = showControls && state.mode === "character" && !state.pendingOut && !hashOn && emotions.length > 0;

  return (
    <>
      <DraggableResizable
        label="character"
        value={charPos}
        min={0.3}
        max={10}
        editable={showControls && !inSensor}
        onChange={setCharPos}
        onCommit={(p) => commit({ character: p })}
        baseW={vp.w * 0.2}
        baseH={vp.w * 0.2 * 4 / 3}
        controls="subject-top"
      >
        <div className="pointer-events-auto absolute inset-0">
          <FlowCharacter
            clips={cfg.clips}
            range={current ? { start: current.start, end: current.end } : null}
            playKey={playKey}
            onSceneEnd={() => dispatch({ type: "SCENE_END" })}
            visible={!inSensor && !!current}
            volume={volume}
          />
        </div>
      </DraggableResizable>
      {(inSensor || cfg.position.trailMode === "always") && <FlowTrail active settings={cfg.trail} getPoint={getPoint} />}
      {showBar && (
        <DraggableResizable
          label="emotion buttons"
          value={barPos}
          min={0.5}
          max={2}
          editable
          onChange={setBarPos}
          onCommit={(p) => commit({ emotionBar: p })}
          baseW={barW}
          baseH={36}
        >
          <div style={{ width: barW, transform: `scale(${barPos.scale})`, transformOrigin: "top left" }}>
            <FlowEmotionBar
              emotions={emotions.map((e) => ({ id: e.id, label: sceneLabel(e) }))}
              queued={state.queue.length}
              onPick={(id) => dispatch({ type: "EMOTION", id })}
              backgroundColor={cfg.position.emotionBackground}
            />
          </div>
        </DraggableResizable>
      )}
    </>
  );
};

export default FlowOverlay;
