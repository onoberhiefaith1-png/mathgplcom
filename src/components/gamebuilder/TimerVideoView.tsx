// Video Timer playback — the video itself shows the passing of time.
//
//   Intro plays once (untimed) → the loop region repeats while the countdown
//   runs → on failure the outro region plays once.
//
// The clip itself carries no clock overlay — the video IS the time.
import { useEffect, useRef, useState } from "react";
import { useSignedUrl } from "./SignedMedia";
import { timerRegionsOf, type TimerVideoPhase } from "@/lib/games/timerVideo";
import type { TimerVideoConfig } from "@/lib/games/types";

interface Props {
  config: TimerVideoConfig;
  /** Seconds left on the Timer; null when the Timer has not started. Kept for
   *  API compatibility — the video clip deliberately shows no clock. */
  remainingSeconds?: number | null;
  /** true once the Timer expired without the required score. */
  failed?: boolean;
  className?: string;
}

const TimerVideoView = ({ config, failed = false, className }: Props) => {
  const signedUrl = useSignedUrl(config.source === "url" ? null : config.storagePath ?? null);
  const url = config.source === "url" ? config.storagePath ?? null : signedUrl;
  const ref = useRef<HTMLVideoElement | null>(null);
  const [phase, setPhase] = useState<TimerVideoPhase>("intro");
  const regions = timerRegionsOf(config);

  // Failure moves the playhead into the outro exactly once.
  useEffect(() => {
    if (!failed || phase === "outro") return;
    setPhase("outro");
    const el = ref.current;
    if (el) {
      el.currentTime = regions.outro.start;
      void el.play().catch(() => undefined);
    }
  }, [failed, phase, regions.outro.start]);

  const onTimeUpdate = () => {
    const el = ref.current;
    if (!el) return;
    const t = el.currentTime;
    if (phase === "intro") {
      if (t >= regions.intro.end - 0.05) {
        setPhase("loop");
        el.currentTime = regions.loop.start;
      }
      return;
    }
    if (phase === "loop") {
      if (t >= regions.loop.end - 0.05 || t < regions.loop.start - 0.5) {
        el.currentTime = regions.loop.start;
      }
      return;
    }
    if (t >= regions.outro.end - 0.05) el.pause();
  };

  return (
    <div className={className}>
      <div className="relative overflow-visible bg-transparent">
        {url ? (
          <video
            ref={ref}
            src={url}
            autoPlay
            muted
            playsInline
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={(e) => {
              e.currentTarget.currentTime = regions.intro.start;
            }}
            className="h-auto w-full bg-transparent object-contain"
          />
        ) : (
          <div className="aspect-video w-full animate-pulse bg-muted/30" />
        )}
      </div>
    </div>
  );
};

export default TimerVideoView;
