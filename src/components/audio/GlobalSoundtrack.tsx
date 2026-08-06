// The global MATHGPL soundtrack.
//
// It plays everywhere except inside a game: `useAdventureAudio` suspends the
// `global` channel on entry and resumes it on exit, so no two background
// tracks ever overlap. Browsers need a gesture before audio may start, so the
// first click, key press or touch anywhere unlocks the bus.
import { useEffect } from "react";
import { playChannel, setChannelVolume, stopChannel, unlockAudio } from "@/lib/games/audio";
import { resolveMediaUrl, useHomepageConfig } from "@/lib/homepage/homepageConfig";

const GlobalSoundtrack = () => {
  const { config, ready } = useHomepageConfig();
  const enabled = config.soundtrackEnabled === true;
  const path = config.soundtrack?.path ?? null;
  const volume = typeof config.soundtrackVolume === "number" ? config.soundtrackVolume : 0.4;

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!enabled || !path) {
      stopChannel("global", 400);
      return;
    }
    let alive = true;
    void (async () => {
      const url = await resolveMediaUrl(config.soundtrack ?? null);
      if (alive && url) playChannel("global", url, { loop: true, volume });
    })();
    return () => { alive = false; };
    // `config.soundtrack` is captured by path on purpose: re-resolving on every
    // config object identity would restart the track.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, enabled, path]);

  useEffect(() => {
    setChannelVolume("global", volume);
  }, [volume]);

  return null;
};

export default GlobalSoundtrack;
