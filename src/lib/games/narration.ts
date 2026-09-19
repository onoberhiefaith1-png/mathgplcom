// Narration runtime + upload for Video Adventures.
//
// A narration is an audio clip pinned to an exact timestamp in the background
// video. Two playback modes only:
//
//   once   — fires the first time the playhead crosses the point in a session,
//            so a Learning Point looping back over it stays silent.
//   repeat — fires on every crossing (reminder messages).

import { useCallback, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GAME_ASSETS_BUCKET, type Narration, type Scene } from "./types";
import { getSignedUrl } from "./urls";
import {
  enqueueNarration,
  isSpeaking,
  narrationOwner,
  pauseChannel,
  queueNarration,
  resumeChannelPlayback,
  stopChannel,
  type NarrationItem,
} from "./audio";
import { bytesToGb, meterClientUsage } from "@/lib/costs/clientMeter";

const rand = () => Math.random().toString(36).slice(2, 10);

const extOf = (name: string) => {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "webm";
};

/** Upload a narration clip (file or recording) to the game asset bucket. */
export const uploadNarration = async (file: Blob, name: string): Promise<string> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const path = `${uid}/narration/${Date.now()}-${rand()}.${extOf(name)}`;
  const { error } = await supabase.storage
    .from(GAME_ASSETS_BUCKET)
    .upload(path, file, { contentType: file.type || "audio/webm", upsert: false });
  if (error) throw error;
  meterClientUsage("storage.gb_month", bytesToGb(file.size), "narration", "GB");
  return path;
};

export interface NarrationRuntime {
  /** Feed every playhead tick. */
  onTime: (t: number) => void;
  /** Hold the speaking clip where it is (the teacher pressed pause). */
  pause: () => void;
  /** Continue the held clip from exactly where it stopped. */
  resume: () => void;
  /**
   * A Learning Point just became active: speak whatever is pinned inside its
   * loop region. Play Once clips speak once per run; Repeat clips speak on
   * every activation.
   */
  onLoopStart: (loop: Scene | null | undefined) => void;
  /**
   * The stage (Learning Point) the runtime is inside right now, or `null`
   * between stages. A loop is an *environment*: whatever is speaking belongs to
   * it, so the moment the id changes — the student passes, fails, skips or
   * leaves — that sound is cut immediately, even mid-clip. Laps of the same
   * stage pass the same id and never interrupt anything.
   */
  onStageChange: (stageId: string | null) => void;
  /** Clear the "played once" memory — a new session or a Preview restart. */
  reset: () => void;
  /** Stop any clip that is currently speaking. */
  stop: () => void;
}


const TOLERANCE = 0.45;

/** A looping region on the video timeline. */
export interface NarrationRegion {
  start: number;
  end: number;
}

/** Loop regions in timeline order. */
export const narrationRegions = (scenes: Scene[] | null | undefined): NarrationRegion[] =>
  (scenes ?? [])
    .filter((s) => typeof s.loopStart === "number" && typeof s.loopEnd === "number")
    .map((s) => ({ start: s.loopStart as number, end: s.loopEnd as number }))
    .sort((a, b) => a.start - b.start);

/**
 * The loop region the playhead currently sits in, if any.
 *
 * A region is a *video* stage, never an audio boundary: while the playhead
 * laps inside it, narration keeps playing on its own clock.
 */
export const regionAt = (t: number, regions: NarrationRegion[]): NarrationRegion | null =>
  regions.find((r) => t >= r.start - TOLERANCE && t <= r.end + TOLERANCE) ?? null;

/**
 * True when a jump from `prev` to `t` is just another lap of the same loop
 * rather than real timeline progress.
 */
export const isLoopLap = (prev: number, t: number, regions: NarrationRegion[]): boolean => {
  if (t >= prev - 0.2) return false; // forward movement, not a wrap
  const region = regionAt(prev, regions);
  if (!region) return false;
  return t >= region.start - TOLERANCE && t <= region.end + TOLERANCE;
};


/**
 * Plays narrations as the playhead crosses their activation points.
 * `enabled` false keeps the runtime inert (authoring, muted preview…).
 *
 * `runId` scopes the "played once" memory to a single run: the editor Preview
 * passes a counter that increments on every Start Preview (so every preview is
 * a brand-new game and Play Once clips speak again), while gameplay passes the
 * session key so Play Once lasts the whole student session.
 */
export const useNarrationPlayback = (
  narrations: Narration[],
  enabled: boolean,
  runId?: string | number,
  /** Loop regions of this adventure — video stages, not audio boundaries. */
  scenes?: Scene[],
): NarrationRuntime => {
  const listRef = useRef(narrations);
  listRef.current = narrations;
  const regionsRef = useRef<NarrationRegion[]>([]);
  regionsRef.current = useMemo(() => narrationRegions(scenes), [scenes]);
  const playedRef = useRef<Set<string>>(new Set());
  /** Playhead position each clip last spoke at — stops a loop-start clip from
   *  speaking twice when the playhead then crosses its timestamp. */
  const firedAtRef = useRef<Map<string, number>>(new Map());
  const lastTimeRef = useRef(0);
  /** Stage (Learning Point) id the runtime is inside — the audio's owner. */
  const stageRef = useRef<string | null>(null);
  /** A clip was mid-sentence when playback paused, so resuming continues it. */
  const heldRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;


  const stop = useCallback(() => {
    stopChannel("narration", 120);
  }, []);

  /** Hold the clip where it is; `resume` continues from exactly there. */
  const pause = useCallback(() => {
    pauseChannel("narration");
  }, []);

  const resume = useCallback(() => {
    resumeChannelPlayback("narration");
  }, []);

  /**
   * The environment changed. Sound *belonging to the stage being left* dies at
   * once — a 60-second clip inside a 10-second loop is cut the instant the
   * student passes. A clip pinned outside any loop is not the stage's property,
   * so it plays on. Repeated laps pass the same id and change nothing.
   */
  const onStageChange = useCallback(
    (stageId: string | null) => {
      const previous = stageRef.current;
      if (previous === stageId) return;
      stageRef.current = stageId;
      // Only cut what the old stage owned.
      if (previous !== null && narrationOwner() === previous) stop();
    },
    [stop],
  );



  const reset = useCallback(() => {
    playedRef.current = new Set();
    firedAtRef.current = new Map();
    lastTimeRef.current = 0;
    stageRef.current = null;
    stop();
  }, [stop]);


  // Pausing playback is not a new run: the clip is held where it is and the
  // remembered playhead stays, so resuming never treats the whole timeline as
  // freshly crossed and re-fires every earlier clip at once. Only `reset()` or
  // a new `runId` wipes memory.
  useEffect(() => {
    if (enabled) {
      if (heldRef.current) { heldRef.current = false; resume(); }
      return;
    }
    heldRef.current = isSpeaking();
    pause();
  }, [enabled, pause, resume]);

  // A new run (Start Preview, or a new student session) wipes every memory:
  // Play Once clips are available again and nothing is left speaking.
  useEffect(() => {
    stop();
    playedRef.current = new Set();
    firedAtRef.current = new Map();
    lastTimeRef.current = 0;
    stageRef.current = null;
  }, [runId, stop]);



  useEffect(() => () => stop(), [stop]);

  /**
   * Speak an ordered batch. Clips due at the same moment are heard one after
   * the other instead of overwriting each other, and a clip whose address
   * cannot be prepared is skipped without holding up the rest.
   *
   * `append` keeps whatever is already speaking and lines the batch up behind
   * it — used while a clip from an earlier position is still running.
   */
  const speakBatch = useCallback(
    async (clips: Narration[], append: boolean) => {
      if (clips.length === 0) return;
      const owner = stageRef.current;
      const items: NarrationItem[] = [];
      for (const n of clips) {
        try {
          const url = n.source === "url" ? n.path : await getSignedUrl(n.path);
          if (!url) {
            console.warn("narration clip has no playable source", n.id);
            continue;
          }
          items.push({ src: url, owner });
        } catch (err) {
          console.error("narration playback failed", n.id, err);
        }
      }
      if (items.length === 0) return;
      if (append) queueNarration(items);
      else enqueueNarration(items);
    },
    [],
  );

  /**
   * Mark clips as spoken and hand them to the bus in timeline order. Once a
   * clip starts it runs on its own clock until it ends naturally — laps of the
   * video loop never cut, restart or rewind it.
   */
  const speakAll = useCallback(
    (clips: Narration[]) => {
      if (clips.length === 0) return;
      const ordered = [...clips].sort((a, b) => a.at - b.at);
      for (const n of ordered) firedAtRef.current.set(n.id, lastTimeRef.current);
      void speakBatch(ordered, isSpeaking());
    },
    [speakBatch],
  );

  /** Clips pinned inside a Learning Point's loop region. */
  const onLoopStart = useCallback(
    (loop: Scene | null | undefined) => {
      if (!enabledRef.current || !loop) return;
      const start = loop.loopStart ?? 0;
      const end = loop.loopEnd ?? start;
      const due: Narration[] = [];
      for (const n of listRef.current) {
        if (n.at < start - TOLERANCE || n.at > end + TOLERANCE) continue;
        if (n.mode === "once" && playedRef.current.has(n.id)) continue;
        playedRef.current.add(n.id);
        due.push(n);
      }
      speakAll(due);
    },
    [speakAll],
  );

  const onTime = useCallback(
    (t: number) => {
      if (!enabledRef.current) {
        lastTimeRef.current = t;
        return;
      }
      const prev = lastTimeRef.current;
      const regions = regionsRef.current;

      // Another lap of the same loop is not timeline progress: the video
      // rewinds, the narration carries on untouched.
      if (isLoopLap(prev, t, regions)) {
        lastTimeRef.current = t;
        return;
      }

      lastTimeRef.current = t;

      // A deliberate jump backwards (teacher scrubbing) stops the sound.
      if (t < prev - 0.2) {
        stop();
        return;
      }

      // While a loop stage is active, only clips belonging to it can fire —
      // passing loop end during a lap must not trigger later narration.
      const region = regionAt(t, regions);
      const due: Narration[] = [];
      for (const n of listRef.current) {
        if (n.at < 0) continue; // unassigned clips have no timeline position
        if (region && (n.at < region.start - TOLERANCE || n.at > region.end + TOLERANCE)) continue;
        const crossed = n.at > prev - 0.001 && n.at <= t + TOLERANCE && t >= n.at - TOLERANCE;
        if (!crossed) continue;
        if (n.mode === "once" && playedRef.current.has(n.id)) continue;
        const firedAt = firedAtRef.current.get(n.id);
        if (firedAt !== undefined && Math.abs(t - firedAt) < 1) continue;
        playedRef.current.add(n.id);
        due.push(n);
      }
      // One tick can cross several clips: they are heard in order, not stacked.
      speakAll(due);
    },
    [speakAll, stop],
  );


  return useMemo(
    () => ({ onTime, onLoopStart, onStageChange, pause, resume, reset, stop }),
    [onTime, onLoopStart, onStageChange, pause, resume, reset, stop],
  );

};
