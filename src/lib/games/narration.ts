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
import { GAME_ASSETS_BUCKET, type Narration } from "./types";
import { getSignedUrl } from "./urls";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;


  const stop = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
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

  useEffect(() => () => stop(), [stop]);

  const fire = useCallback(async (n: Narration) => {
    try {
      const url = n.source === "url" ? n.path : await getSignedUrl(n.path);
      if (!url) return;
      let el = audioRef.current;
      if (!el) {
        el = new Audio();
        audioRef.current = el;
      }
      el.pause();
      el.src = url;
      el.currentTime = 0;
      await el.play().catch(() => {});
    } catch (err) {
      console.error("narration playback failed", err);
    }
  }, []);

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

  return useMemo(() => ({ onTime, reset, stop }), [onTime, reset, stop]);
};
