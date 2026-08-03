import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useSignedUrl } from "./SignedMedia";
import type { VideoBackground } from "@/lib/games/types";
import { cn } from "@/lib/utils";

export interface VideoBackgroundHandle {
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  currentTime: () => number;
  duration: () => number;
}

interface VideoBackgroundLayerProps {
  video: VideoBackground;
  /** Loop region — when set, playback wraps back to `start` on reaching `end`. */
  loop?: { start: number; end: number } | null;
  /** Drives play/pause. */
  playing?: boolean;
  className?: string;
  onTime?: (t: number) => void;
  onLoaded?: (meta: { duration: number; width: number; height: number }) => void;
  onEnded?: () => void;
}

/**
 * The adventure's video background. It replaces the static background image and
 * nothing else — every overlay (progress bars, rewards, effects, characters)
 * still renders on top through the normal GameCanvas.
 *
 * The loop engine lives here: give it a `loop` region and playback stays inside
 * that region until the region is cleared, which is exactly the Checkpoint
 * behaviour (loop while the student works, resume when they're done).
 */
const VideoBackgroundLayer = forwardRef<VideoBackgroundHandle, VideoBackgroundLayerProps>(
  ({ video, loop = null, playing = true, className, onTime, onLoaded, onEnded }, ref) => {
    const signed = useSignedUrl(video.source === "storage" ? video.path : null);
    const url = video.source === "url" ? video.path : signed;
    const elRef = useRef<HTMLVideoElement | null>(null);
    const loopRef = useRef(loop);
    loopRef.current = loop;

    useImperativeHandle(ref, () => ({
      play: () => void elRef.current?.play().catch(() => {}),
      pause: () => elRef.current?.pause(),
      seek: (t: number) => {
        if (elRef.current) elRef.current.currentTime = Math.max(0, t);
      },
      currentTime: () => elRef.current?.currentTime ?? 0,
      duration: () => elRef.current?.duration ?? 0,
    }));

    // Keep the loop region honoured on every frame tick.
    useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      const onTimeUpdate = () => {
        const region = loopRef.current;
        if (region && el.currentTime >= region.end) {
          el.currentTime = region.start;
          void el.play().catch(() => {});
        }
        onTime?.(el.currentTime);
      };
      el.addEventListener("timeupdate", onTimeUpdate);
      return () => el.removeEventListener("timeupdate", onTimeUpdate);
    }, [onTime]);

    // When a loop region is switched on, snap into it.
    useEffect(() => {
      const el = elRef.current;
      if (!el || !loop) return;
      if (el.currentTime < loop.start || el.currentTime > loop.end) {
        el.currentTime = loop.start;
      }
    }, [loop]);

    useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      if (playing) void el.play().catch(() => {});
      else el.pause();
    }, [playing, url]);

    if (!url) {
      return <div className={cn("absolute inset-0 animate-pulse bg-black", className)} aria-hidden />;
    }

    return (
      <video
        ref={elRef}
        src={url}
        className={cn("absolute inset-0 h-full w-full object-cover", className)}
        muted={video.muted !== false}
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          onLoaded?.({ duration: v.duration || 0, width: v.videoWidth, height: v.videoHeight });
        }}
        onEnded={() => onEnded?.()}
      />
    );
  },
);

VideoBackgroundLayer.displayName = "VideoBackgroundLayer";

export default VideoBackgroundLayer;
