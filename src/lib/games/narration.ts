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
import { playNarration, stopChannel } from "./audio";

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
  return path;
};

export interface NarrationRuntime {
  /** Feed every playhead tick. */
  onTime: (t: number) => void;
  /**
   * A Learning Point just became active: speak whatever is pinned inside its
   * loop region. Play Once clips speak once per run; Repeat clips speak on
   * every activation.
   */
  onLoopStart: (loop: Scene | null | undefined) => void;
  /** Clear the "played once" memory — a new session or a Preview restart. */
  reset: () => void;
  /** Stop any clip that is currently speaking. */
  stop: () => void;
}

const TOLERANCE = 0.45;

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
): NarrationRuntime => {
  const listRef = useRef(narrations);
  listRef.current = narrations;
  const playedRef = useRef<Set<string>>(new Set());
  const lastTimeRef = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;


  const stop = useCallback(() => {
    stopChannel("narration", 120);
  }, []);

  const reset = useCallback(() => {
    playedRef.current = new Set();
    lastTimeRef.current = 0;
    stop();
  }, [stop]);

  useEffect(() => {
    if (!enabled) {
      stop();
      playedRef.current = new Set();
      lastTimeRef.current = 0;
    }
  }, [enabled, stop]);

  // A new run (Start Preview, or a new student session) wipes every memory:
  // Play Once clips are available again and nothing is left speaking.
  useEffect(() => {
    stop();
    playedRef.current = new Set();
    lastTimeRef.current = 0;
  }, [runId, stop]);


  useEffect(() => () => stop(), [stop]);

  const fire = useCallback(async (n: Narration) => {
    try {
      const url = n.source === "url" ? n.path : await getSignedUrl(n.path);
      if (!url) return;
      // The shared audio bus owns playback: the background music ducks while
      // the clip speaks, and a queued clip resumes once audio is unlocked.
      playNarration(url);
    } catch (err) {
      console.error("narration playback failed", err);
    }
  }, []);

  /** Clips pinned inside a Learning Point's loop region. */
  const onLoopStart = useCallback(
    (loop: Scene | null | undefined) => {
      if (!enabledRef.current || !loop) return;
      const start = loop.loopStart ?? 0;
      const end = loop.loopEnd ?? start;
      for (const n of listRef.current) {
        if (n.at < start - TOLERANCE || n.at > end + TOLERANCE) continue;
        if (n.mode === "once" && playedRef.current.has(n.id)) continue;
        playedRef.current.add(n.id);
        void fire(n);
      }
    },
    [fire],
  );

  const onTime = useCallback(
    (t: number) => {
      if (!enabledRef.current) {
        lastTimeRef.current = t;
        return;
      }
      const prev = lastTimeRef.current;
      lastTimeRef.current = t;
      // A wrap (loop back / seek back) is not a forward crossing.
      const wrapped = t < prev - 0.2;
      if (wrapped) return;
      for (const n of listRef.current) {
        const crossed = n.at > prev - 0.001 && n.at <= t + TOLERANCE && t >= n.at - TOLERANCE;
        if (!crossed) continue;
        if (n.mode === "once" && playedRef.current.has(n.id)) continue;
        playedRef.current.add(n.id);
        void fire(n);
      }
    },
    [fire],
  );

  return useMemo(() => ({ onTime, onLoopStart, reset, stop }), [onTime, onLoopStart, reset, stop]);
};
