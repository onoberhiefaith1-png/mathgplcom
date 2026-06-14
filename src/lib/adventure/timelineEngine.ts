import { useEffect, useRef } from "react";
import type { EffectPlayback } from "./types";

/** Drives a <video> element with Enter / Active(loop) / Exit segments. */
export function useEffectTimeline(
  videoRef: React.RefObject<HTMLVideoElement>,
  playback: EffectPlayback,
  phase: "enter" | "active" | "exit" = "active",
) {
  const dirRef = useRef<1 | -1>(1);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = Math.max(0.1, playback.speed);

    const onLoaded = () => {
      const dur = v.duration || 0;
      const aStart = playback.activeStart ?? 0;
      const aEnd = playback.activeEnd ?? dur;
      if (phase === "enter") v.currentTime = 0;
      else if (phase === "active") v.currentTime = aStart;
      else if (phase === "exit") v.currentTime = playback.exitStart ?? aEnd;
      v.play().catch(() => {});
    };

    const onTime = () => {
      const dur = v.duration || 0;
      const aStart = playback.activeStart ?? 0;
      const aEnd = playback.activeEnd ?? dur;

      if (phase === "active") {
        if (playback.direction === "forward") {
          if (v.currentTime >= aEnd) {
            if (playback.loopMode === "once") { v.pause(); if (playback.freezeLastFrame) v.currentTime = aEnd; }
            else v.currentTime = aStart;
          }
        } else if (playback.direction === "reverse") {
          if (v.currentTime <= aStart) v.currentTime = aEnd;
          v.currentTime -= 0.033;
        } else if (playback.direction === "pingpong") {
          if (v.currentTime >= aEnd) dirRef.current = -1;
          if (v.currentTime <= aStart) dirRef.current = 1;
          v.currentTime += dirRef.current * 0.033;
        }
      } else if (phase === "enter") {
        const end = playback.enterEnd ?? aStart;
        if (v.currentTime >= end) { v.pause(); }
      } else if (phase === "exit") {
        if (v.currentTime >= dur) {
          v.pause();
          if (playback.freezeLastFrame) v.currentTime = dur;
        }
      }
    };

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    if (v.readyState >= 1) onLoaded();
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [videoRef, playback.direction, playback.speed, playback.loopMode,
      playback.activeStart, playback.activeEnd, playback.enterEnd, playback.exitStart,
      playback.freezeLastFrame, phase]);
}
