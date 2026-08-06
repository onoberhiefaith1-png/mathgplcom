// Adventure sound runtime — ambience, per-scene music and one-shot effects.
//
// Nothing is generated: every clip is uploaded by the teacher. This hook only
// plays what has been assigned, through the shared audio bus so the platform
// soundtrack never overlaps a game.
import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  GAME_ASSETS_BUCKET,
  soundsOf,
  type AdventureSounds,
  type GameCanvas,
  type SoundEvent,
  type SoundRef,
} from "./types";
import { getSignedUrl } from "./urls";
import {
  enterGameAudio,
  exitGameAudio,
  playChannel,
  playSfx,
  stopChannel,
} from "./audio";

const rand = () => Math.random().toString(36).slice(2, 10);
const extOf = (name: string) => {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "mp3";
};

/** Upload a teacher-supplied sound clip to the game asset bucket. */
export const uploadSound = async (file: Blob, name: string): Promise<string> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const path = `${uid}/sound/${Date.now()}-${rand()}.${extOf(name)}`;
  const { error } = await supabase.storage
    .from(GAME_ASSETS_BUCKET)
    .upload(path, file, { contentType: file.type || "audio/mpeg", upsert: false });
  if (error) throw error;
  return path;
};

const urlOf = async (ref?: SoundRef | null): Promise<string | null> => {
  if (!ref?.path) return null;
  return ref.source === "url" ? ref.path : await getSignedUrl(ref.path);
};

export interface AdventureAudio {
  /** Fire a one-shot effect for a gameplay event. */
  effect: (event: SoundEvent) => void;
}

/**
 * @param canvas   the game canvas (sound assignments live on it)
 * @param sceneId  active scene / Learning Point, or null outside one
 * @param enabled  true while the game is actually being played
 */
export const useAdventureAudio = (
  canvas: GameCanvas | null | undefined,
  sceneId: string | null,
  enabled: boolean,
): AdventureAudio => {
  const sounds: AdventureSounds = soundsOf(canvas);
  const soundsRef = useRef(sounds);
  soundsRef.current = sounds;

  const ambiencePath = sounds.ambience?.path ?? null;
  const musicRef = sceneId ? sounds.music?.[sceneId] ?? null : null;
  const musicPath = musicRef?.path ?? null;

  // Inside a game the platform soundtrack steps aside; leaving restores it.
  useEffect(() => {
    if (!enabled) return;
    enterGameAudio();
    return () => exitGameAudio();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !ambiencePath) {
      if (!enabled) stopChannel("ambience", 250);
      return;
    }
    let alive = true;
    void (async () => {
      const url = await urlOf(soundsRef.current.ambience);
      if (alive && url) playChannel("ambience", url, { loop: true, volume: soundsRef.current.ambience?.volume ?? 0.6 });
    })();
    return () => { alive = false; };
  }, [enabled, ambiencePath]);

  // Environmental music only exists while its own scene is active.
  useEffect(() => {
    if (!enabled || !musicPath) {
      stopChannel("music", 250);
      return;
    }
    let alive = true;
    void (async () => {
      const ref = sceneId ? soundsRef.current.music?.[sceneId] ?? null : null;
      const url = await urlOf(ref);
      if (alive && url) playChannel("music", url, { loop: true, volume: ref?.volume ?? 0.7 });
    })();
    return () => { alive = false; };
  }, [enabled, musicPath, sceneId]);

  const effect = useCallback((event: SoundEvent) => {
    const ref = soundsRef.current.effects?.[event] ?? null;
    if (!ref?.path) return;
    void urlOf(ref).then((url) => playSfx(url, ref.volume ?? 1));
  }, []);

  return { effect };
};
