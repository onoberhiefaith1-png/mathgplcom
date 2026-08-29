import { useEffect, useRef, useState } from "react";
import { Maximize2, Pause, Play, Volume2 } from "lucide-react";
import { usePlayback } from "@/lib/editor/usePlayback";
import { cueAt, type Cue } from "@/lib/editor/subtitles";
import { formatTimecode, type Segment } from "@/lib/editor/types";

interface Props {
  src: string;
  segments: Segment[];
  duration: number;
  /** generated audio mix; null until the track is built */
  generatedUrl: string | null;
  track: "generated" | "original";
  cues: Cue[];
  showSubtitles: boolean;
}

/**
 * Plays the edited video (visual layer only) with the generated audio mix locked
 * to the video clock, so Stage 9 shows the actual finished lesson video.
 */
export function SyncedVideoPreview({
  src,
  segments,
  duration,
  generatedUrl,
  track,
  cues,
  showSubtitles,
}: Props) {
  const { videoRef, tlTime, playing, seek, toggle } = usePlayback(segments, duration);
  const audioRef = useRef<HTMLAudioElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(1);
  const useGenerated = track === "generated" && Boolean(generatedUrl);

  // The video is only the visual layer when the generated mix is selected.
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = useGenerated;
      video.volume = useGenerated ? 0 : volume;
    }
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [useGenerated, videoRef, volume]);

  // Follow play/pause of the video clock.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!useGenerated) {
      audio.pause();
      return;
    }
    if (playing) {
      audio.currentTime = tlTime;
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
    // tlTime intentionally omitted: only re-sync on transport changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, useGenerated]);

  // Drift correction while playing, and hard sync while scrubbing.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !useGenerated) return;
    if (Math.abs(audio.currentTime - tlTime) > 0.25) audio.currentTime = tlTime;
  }, [tlTime, useGenerated]);

  const cue = cueAt(cues, tlTime);

  return (
    <div ref={shellRef} className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative bg-black">
        <video
          ref={videoRef}
          src={src}
          playsInline
          className="max-h-[420px] w-full bg-black object-contain"
          onClick={toggle}
        />
        {showSubtitles && cue ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-6">
            <p className="rounded bg-black/70 px-3 py-1.5 text-center text-sm font-medium text-white">
              {cue.lines.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </p>
          </div>
        ) : null}
        {generatedUrl ? <audio ref={audioRef} src={generatedUrl} preload="auto" /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 p-2">
        <button
          type="button"
          onClick={toggle}
          className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <span className="font-mono text-[11px] text-muted-foreground">
          {formatTimecode(tlTime)} / {formatTimecode(duration)}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(duration, 0.1)}
          step={0.01}
          value={Math.min(tlTime, duration)}
          onChange={(e) => seek(Number(e.target.value))}
          className="min-w-[140px] flex-1 accent-primary"
          aria-label="Seek"
        />
        <label className="flex items-center gap-1.5 text-muted-foreground">
          <Volume2 className="size-4" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-20 accent-primary"
            aria-label="Volume"
          />
        </label>
        <button
          type="button"
          onClick={() => void shellRef.current?.requestFullscreen?.().catch(() => undefined)}
          className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground"
          aria-label="Fullscreen"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
