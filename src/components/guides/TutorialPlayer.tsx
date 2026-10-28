// The tutorial video player.
//
// One reusable player for the whole application. It is mounted ONCE at app level
// and never unmounted while a tutorial session is open, so navigating between
// pages never reloads or rewinds the video.
//
// Controls: play/pause · draggable timeline · elapsed / total time · skip back
// and forward 10s · speed 1x / 2x / 3x · volume · mute · fullscreen. There is no
// auto-advance: choosing another tutorial is always a deliberate click.

import { useEffect, useRef, useState } from "react";
import {
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
  ListVideo,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tutorialVideoUrl, type Tutorial } from "@/lib/guides/tutorials";

const SPEEDS = [1, 2, 3];

const clock = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const total = Math.floor(value);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

interface Props {
  tutorial: Tutorial;
  /** All tutorials of the page this session belongs to. */
  playlist: Tutorial[];
  onSelect: (tutorial: Tutorial) => void;
  onClose: () => void;
}

const TutorialPlayer = ({ tutorial, playlist, onSelect, onClose }: Props) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showList, setShowList] = useState(false);

  // A link tutorial lives on another site: it opens there instead of playing here.
  const url = tutorial.linkUrl ? null : tutorialVideoUrl(tutorial.videoPath);

  // Only a NEW video resets the element. Layout changes never touch it, so the
  // playhead survives every split-view switch and every navigation.
  useEffect(() => {
    setTime(0);
    setDuration(0);
  }, [tutorial.id]);

  useEffect(() => {
    const el = ref.current;
    if (el) el.playbackRate = rate;
  }, [rate, tutorial.id]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
  }, [volume, muted]);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const seekBy = (delta: number) => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = Math.min(Math.max(0, el.currentTime + delta), el.duration || Infinity);
  };

  const fullscreen = () => {
    void shellRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <section
      ref={shellRef}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{tutorial.title || "Tutorial"}</h2>
          {tutorial.description && (
            <p className="truncate text-[11px] text-muted-foreground">{tutorial.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {playlist.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => setShowList((v) => !v)}
              title="Other tutorials for this page"
            >
              <ListVideo className="h-4 w-4" />
              <span className="hidden sm:inline">{playlist.length}</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" className="gap-1" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Close</span>
          </Button>
        </div>
      </header>

      {showList && playlist.length > 1 && (
        <ul className="max-h-32 shrink-0 overflow-auto border-b border-border/70 bg-muted/40 p-1 text-xs">
          {playlist.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(item);
                  setShowList(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1 text-left transition hover:bg-muted",
                  item.id === tutorial.id && "font-semibold text-foreground",
                )}
              >
                <span className="text-muted-foreground">{index + 1}.</span>
                <span className="truncate">{item.title || "Tutorial"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex min-h-0 flex-1 items-center justify-center bg-black/90">
        {url ? (
          <video
            key={tutorial.id}
            ref={ref}
            src={url}
            preload="metadata"
            playsInline
            onClick={toggle}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration || 0);
              e.currentTarget.playbackRate = rate;
            }}
            className="h-full max-h-full w-full object-contain"
          />
        ) : tutorial.linkUrl ? (
          <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
            <p className="text-sm text-white/80">This tutorial is on another site.</p>
            <a
              href={tutorial.linkUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <ExternalLink className="h-4 w-4" /> Open and watch
            </a>
            <span className="max-w-full truncate text-[11px] text-white/50">{tutorial.linkUrl}</span>
          </div>
        ) : (
          <p className="px-4 text-center text-sm text-muted-foreground">
            This tutorial has no video yet.
          </p>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-[11px] tabular-nums text-muted-foreground">{clock(time)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            aria-label="Timeline"
            onChange={(e) => {
              const el = ref.current;
              const next = Number(e.target.value);
              setTime(next);
              if (el) el.currentTime = next;
            }}
            className="h-1.5 flex-1 cursor-pointer accent-primary"
          />
          <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
            {clock(duration)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => seekBy(-10)} title="Back 10 seconds">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" className="h-9 w-9" onClick={toggle} title={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => seekBy(10)} title="Forward 10 seconds">
            <RotateCw className="h-4 w-4" />
          </Button>

          <div className="ml-1 flex items-center gap-1 rounded-full border border-border/70 p-0.5">
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRate(value)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold transition",
                  rate === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {value}×
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMuted((v) => !v)}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            aria-label="Volume"
            onChange={(e) => {
              const next = Number(e.target.value);
              setVolume(next);
              setMuted(next === 0);
            }}
            className="h-1.5 w-16 cursor-pointer accent-primary"
          />

          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={fullscreen} title="Fullscreen">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default TutorialPlayer;
