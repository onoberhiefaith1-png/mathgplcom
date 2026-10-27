import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Narration, Scene } from "@/lib/games/types";
import type { NarrationRuntime } from "@/lib/games/narration";
import { getSignedUrl } from "@/lib/games/urls";
import { queueNarration, isSpeaking, narrationScheduled, pauseChannel, resumeChannelPlayback, stopChannel, subscribeNarrationActivity, type NarrationItem } from "@/lib/games/audio";

export type VoiceRegion = { id: string; start: number; end: number; loop: boolean };
export function voiceRegionAt(t: number, scenes: Scene[], released?: string | null): VoiceRegion {
  const loops = scenes.filter(s => Number.isFinite(s.loopStart) && Number.isFinite(s.loopEnd) && s.loopEnd! > s.loopStart!)
    .slice().sort((a, b) => a.loopStart! - b.loopStart!);
  const loop = loops.find(s => t >= s.loopStart! && t < s.loopEnd!);
  if (loop && loop.id !== released) return { id: loop.id, start: loop.loopStart!, end: loop.loopEnd!, loop: true };
  // A passed point is already silent while the video plays out its final lap.
  const preceding = loop ?? loops.filter(s => s.loopEnd! <= t).at(-1);
  const following = loops.find(s => s.loopStart! >= (preceding?.loopEnd ?? t));
  const start = preceding?.loopEnd ?? 0;
  const end = following?.loopStart ?? Infinity;
  return { id: `between:${preceding?.id ?? "start"}:${following?.id ?? "end"}`, start, end, loop: false };
}
const belongs = (clip: Narration, region: VoiceRegion) => clip.at >= region.start && clip.at < region.end;

/** Strict narration environments for Academia and its downloaded player.
 * Video laps preserve audio; crossing an environment always hard-stops it. */
export function useRegionalNarration(narrations: Narration[], enabled: boolean, runId: string, scenes: Scene[]): NarrationRuntime & { speaking: boolean } {
  const data = useRef({ narrations, enabled, scenes }); data.current = { narrations, enabled, scenes };
  const region = useRef<VoiceRegion | null>(null);
  const active = useRef<string | null>(null);
  const released = useRef<string | null>(null);
  const lastTime = useRef(0);
  const generation = useRef(0);
  const once = useRef(new Set<string>());
  const lap = useRef(new Set<string>());
  const pending = useRef(new Set<string>());
  const held = useRef(false);
  const waiting = useRef<NarrationItem[]>([]);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => subscribeNarrationActivity(setSpeaking), []);
  const stop = useCallback(() => {
    generation.current++;
    pending.current.clear();
    waiting.current = [];
    stopChannel("narration", 0);
  }, []);
  const enter = useCallback((next: VoiceRegion) => {
    if (region.current?.id === next.id) return;
    stop(); region.current = next; lap.current.clear();
  }, [stop]);
  const schedule = useCallback((clips: Narration[]) => {
    const owner = region.current;
    if (!owner || !data.current.enabled) return;
    const due = clips.filter(n => n.at >= 0 && belongs(n, owner) &&
      !(n.mode === "once" && once.current.has(n.id)) && !lap.current.has(n.id) &&
      !pending.current.has(n.id) && !narrationScheduled(n.id)).sort((a, b) => a.at - b.at);
    if (!due.length) return;
    const epoch = generation.current;
    for (const n of due) { lap.current.add(n.id); pending.current.add(n.id); }
    void (async () => {
      const items: NarrationItem[] = [];
      for (const n of due) {
        try {
          const src = n.source === "url" ? n.path : await getSignedUrl(n.path);
          if (epoch !== generation.current) return;
          if (!src) continue;
          if (n.mode === "once") once.current.add(n.id);
          items.push({ id: n.id, src, owner: owner.id });
        } catch { if (epoch === generation.current) pending.current.delete(n.id); }
      }
      if (epoch !== generation.current) return;
      for (const n of due) pending.current.delete(n.id);
      if (!items.length) return;
      if (!data.current.enabled) waiting.current.push(...items);
      else queueNarration(items);
    })();
  }, []);
  const onStageChange = useCallback((id: string | null) => {
    if (active.current === id) return;
    const previous = active.current;
    active.current = id;
    if (id) {
      released.current = null;
      const point = data.current.scenes.find(s => s.id === id);
      if (point) enter({ id, start: point.loopStart ?? 0, end: point.loopEnd ?? Infinity, loop: true });
    } else if (previous) {
      released.current = previous;
      enter(voiceRegionAt(lastTime.current, data.current.scenes, previous));
    }
  }, [enter]);
  const onTime = useCallback((t: number) => {
    if (!data.current.enabled || !Number.isFinite(t)) return;
    const prev = lastTime.current;
    const point = active.current && data.current.scenes.find(s => s.id === active.current);
    const next = point ? { id: point.id, start: point.loopStart ?? 0, end: point.loopEnd ?? Infinity, loop: true }
      : voiceRegionAt(t, data.current.scenes, released.current);
    const same = region.current?.id === next.id;
    const wrap = same && next.loop && t < prev - 0.2 && t >= next.start;
    enter(next);
    lastTime.current = t;
    if (wrap) {
      lap.current.clear();
      // A browser may report the first lap tick slightly after loopStart.
      schedule(data.current.narrations.filter(n => n.at <= t));
      return;
    }
    if (same && t < prev - 0.2) { stop(); lap.current.clear(); return; }
    schedule(data.current.narrations.filter(n => n.at <= t && (same ? n.at >= prev - 0.001 : n.at >= next.start)));
  }, [enter, schedule, stop]);
  const onLoopStart = useCallback((point: Scene | null | undefined) => {
    if (!point || !data.current.enabled) return;
    onStageChange(point.id);
    schedule(data.current.narrations);
  }, [onStageChange, schedule]);
  const reset = useCallback(() => {
    stop(); once.current.clear(); lap.current.clear();
    lastTime.current = 0; region.current = null; active.current = null; released.current = null;
  }, [stop]);
  const pause = useCallback(() => pauseChannel("narration"), []);
  const resume = useCallback(() => resumeChannelPlayback("narration"), []);
  useEffect(() => {
    if (!enabled) { held.current = isSpeaking(); pause(); }
    else {
      if (held.current) { held.current = false; resume(); }
      if (waiting.current.length) { const items = waiting.current; waiting.current = []; queueNarration(items); }
    }
  }, [enabled, pause, resume]);
  useEffect(() => { reset(); return stop; }, [runId, reset, stop]);
  return useMemo(() => ({ onTime, onLoopStart, onStageChange, reset, stop, pause, resume, speaking }),
    [onTime, onLoopStart, onStageChange, reset, stop, pause, resume, speaking]);
}
