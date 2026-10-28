// Background music playback for uploaded tracks. One element at a time,
// muted together with the reward sound.

import { assetUrl } from "./assets";
import { isMuted } from "./audio";

let element: HTMLAudioElement | null = null;
let currentAssetId: string | null = null;
let wanted = false;

function ensure() {
  if (typeof window === "undefined") return null;
  if (!element) {
    element = new Audio();
    element.preload = "auto";
  }
  return element;
}

export const playingAssetId = () => (wanted ? currentAssetId : null);

/** Start (or restart) a stored track. */
export async function playTrack(assetId: string, options: { volume: number; loop: boolean }) {
  const audio = ensure();
  if (!audio) return;
  if (currentAssetId !== assetId) {
    const url = await assetUrl(assetId);
    if (!url) return;
    audio.src = url;
    currentAssetId = assetId;
  }
  audio.loop = options.loop;
  audio.volume = isMuted() ? 0 : Math.min(1, Math.max(0, options.volume));
  wanted = true;
  try {
    await audio.play();
  } catch {
    /* the browser needs a gesture first; the next click will succeed */
  }
}

export function stopTrack() {
  wanted = false;
  if (element) {
    element.pause();
    element.currentTime = 0;
  }
}

export function setTrackVolume(volume: number) {
  if (element) element.volume = isMuted() ? 0 : Math.min(1, Math.max(0, volume));
}

/** Called when the top-bar speaker is toggled. */
export function applyMute(muted: boolean, volume: number) {
  if (!element) return;
  element.volume = muted ? 0 : Math.min(1, Math.max(0, volume));
}
