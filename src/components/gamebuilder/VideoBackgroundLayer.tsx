import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { isPlayable, loopAction, needsSeek, stallStep, STALL_RECOVER_MS } from "@/lib/academia/videoLoop";
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
  /** Fires when the file cannot be read (offline and not saved, bad file). */
  onError?: () => void;
  /** Fires when the video has a picture to show (loaded data, can play, playing). */
  onFrame?: () => void;
  /** Fires once the video can play on without stopping (readyState >= 3 / canplaythrough). */
  onReady?: () => void;
  /** True while the picture is waiting on data (waiting/stalled), false once it plays again. */
  onBuffering?: (waiting: boolean) => void;
  /** Academia only: force sound on/off and set the narration volume (0–1). */
  audible?: boolean;
  volume?: number;
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
  ({ video, loop = null, playing = true, className, onTime, onLoaded, onEnded, onError, onFrame, onReady, onBuffering, audible, volume }, ref) => {
    const signed = useSignedUrl(video.source === "storage" ? video.path : null);
    const url = video.source === "url" ? video.path : signed;
    const elRef = useRef<HTMLVideoElement | null>(null);
    const loopRef = useRef(loop);
    loopRef.current = loop;
    const playingRef = useRef(playing);
    playingRef.current = playing;
    const lastSeekAt = useRef(-Infinity);
    const recovering = useRef(false);
    const waitingSince = useRef<number | null>(null);
    const onTimeRef = useRef(onTime);
    onTimeRef.current = onTime;
    const buffering = useRef(onBuffering);
    buffering.current = onBuffering;
    const readyRef = useRef(onReady);
    readyRef.current = onReady;

    /** The one place the playhead is moved: never to where it already is, never while a seek is in flight. */
    const seekTo = useCallback((el: HTMLVideoElement, t: number) => {
      if (!needsSeek(el.currentTime, t, el.seeking)) return;
      lastSeekAt.current = Date.now();
      el.currentTime = Math.max(0, t);
    }, []);
    const playNow = useCallback((el: HTMLVideoElement) => { void el.play().catch(() => {}); }, []);

    useImperativeHandle(ref, () => ({
      play: () => void elRef.current?.play().catch(() => {}),
      pause: () => elRef.current?.pause(),
      seek: (t: number) => {
        if (elRef.current) seekTo(elRef.current, t);
      },
      currentTime: () => elRef.current?.currentTime ?? 0,
      duration: () => elRef.current?.duration ?? 0,
    }));

    // The loop is checked every painted frame while a region is set (timeupdate fires only ~4 times
    // a second, so the playhead overshot the end by up to a quarter of a second and then jumped
    // back — the visible skip). It wraps once, at the end, only if the playhead truly crossed it.
    const hasLoop = loop != null;
    const loopStart = loop?.start;
    const loopEnd = loop?.end;
    useEffect(() => {
      const el = elRef.current;
      if (!el || !hasLoop) return;
      let raf = 0;
      let timer = 0;
      const tick = () => {
        const region = loopRef.current;
        const action = loopAction({ t: el.currentTime, region, seeking: el.seeking, msSinceLastSeek: Date.now() - lastSeekAt.current });
        if (region && action !== "none") {
          seekTo(el, region.start);
          if (playingRef.current && el.paused) playNow(el);
        }
        schedule();
      };
      const schedule = () => {
        if (typeof requestAnimationFrame === "function" && !document.hidden) raf = requestAnimationFrame(tick);
        else timer = window.setTimeout(tick, 100);
      };
      schedule();
      return () => { if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf); window.clearTimeout(timer); };
    }, [hasLoop, loopStart, loopEnd, seekTo, playNow]);

    // timeupdate still reports the playhead to the page.
    useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      const onTimeUpdate = () => onTimeRef.current?.(el.currentTime);
      el.addEventListener("timeupdate", onTimeUpdate);
      return () => el.removeEventListener("timeupdate", onTimeUpdate);
    }, [url]);

    // When a loop region is switched on, snap into it — once, and only if clearly outside it.
    useEffect(() => {
      const el = elRef.current;
      if (!el || loopStart == null || loopEnd == null) return;
      if (loopAction({ t: el.currentTime, region: { start: loopStart, end: loopEnd }, seeking: el.seeking, msSinceLastSeek: Infinity }) !== "none") seekTo(el, loopStart);
    }, [loopStart, loopEnd, seekTo]);

    // Play only when the video can play on; if it cannot yet, start the moment it can.
    useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      if (!playing) { el.pause(); return; }
      if (isPlayable(el)) { playNow(el); return; }
      const go = () => { if (playingRef.current) playNow(el); };
      el.addEventListener("canplay", go, { once: true });
      return () => el.removeEventListener("canplay", go);
    }, [playing, url, playNow]);

    // Stall recovery. Waiting for data too long → pause, then play again once it can play on.
    useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      let timer = 0;
      const check = () => {
        const since = waitingSince.current;
        const step = stallStep({
          wantPlaying: playingRef.current,
          playable: isPlayable(el),
          paused: el.paused,
          waitedMs: since == null ? 0 : Date.now() - since,
          recovering: recovering.current,
        });
        if (step === "pause") { recovering.current = true; el.pause(); }
        else if (step === "resume") { recovering.current = false; waitingSince.current = null; buffering.current?.(false); playNow(el); }
        if (step === "wait" || step === "pause") timer = window.setTimeout(check, 500);
      };
      const onWait = () => {
        if (waitingSince.current == null) waitingSince.current = Date.now();
        buffering.current?.(true);
        window.clearTimeout(timer);
        timer = window.setTimeout(check, Math.min(STALL_RECOVER_MS, 500));
      };
      const onOk = () => {
        if (isPlayable(el)) {
          waitingSince.current = null;
          buffering.current?.(false);
          window.clearTimeout(timer);
          if (recovering.current) { recovering.current = false; if (playingRef.current) playNow(el); }
        }
      };
      el.addEventListener("waiting", onWait);
      el.addEventListener("stalled", onWait);
      el.addEventListener("canplay", onOk);
      el.addEventListener("canplaythrough", onOk);
      el.addEventListener("playing", onOk);
      return () => {
        window.clearTimeout(timer);
        for (const [n, f] of [["waiting", onWait], ["stalled", onWait], ["canplay", onOk], ["canplaythrough", onOk], ["playing", onOk]] as const) el.removeEventListener(n, f);
      };
    }, [url, playNow]);

    // Already buffered by the time this mounted (cached): report it.
    useEffect(() => {
      const el = elRef.current;
      if (el && isPlayable(el)) readyRef.current?.();
    }, [url]);

    useEffect(() => {
      const el = elRef.current;
      if (el && volume != null) el.volume = Math.min(1, Math.max(0, volume));
    }, [volume, url]);

    if (!url) {
      return <div className={cn("absolute inset-0 animate-pulse bg-black", className)} aria-hidden />;
    }

    return (
      <video
        ref={elRef}
        src={url}
        className={cn("absolute inset-0 h-full w-full object-cover", className)}
        muted={audible == null ? video.muted !== false : !audible}
        playsInline
        preload="auto"
        onError={() => onError?.()}
        onLoadedData={() => onFrame?.()}
        onCanPlay={() => onFrame?.()}
        onCanPlayThrough={() => onReady?.()}
        onPlaying={() => onFrame?.()}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          onLoaded?.({ duration: v.duration || 0, width: v.videoWidth, height: v.videoHeight });
        }}
        onEnded={() => {
          // A Learning Point that runs to the very end of the video must keep
          // looping: reaching the end is never "adventure complete".
          const region = loopRef.current;
          const el = elRef.current;
          if (region && el) {
            seekTo(el, region.start);
            playNow(el);
            return;
          }
          onEnded?.();
        }}
      />
    );
  },
);

VideoBackgroundLayer.displayName = "VideoBackgroundLayer";

export default VideoBackgroundLayer;
