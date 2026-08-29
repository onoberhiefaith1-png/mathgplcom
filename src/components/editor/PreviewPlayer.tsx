import { useEffect, useRef, useState } from "react";
import {
  ChevronFirst,
  ChevronLast,
  Maximize,
  Pause,
  Play,
  Rewind,
  FastForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FRAME, formatTimecode } from "@/lib/editor/types";

export interface PreviewPlayerProps {
  src: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  tlTime: number;
  duration: number;
  playing: boolean;
  onToggle: () => void;
  onSeek: (time: number) => void;
}

const SPEEDS = ["0.25", "0.5", "0.75", "1", "1.25", "1.5", "2"];

export function PreviewPlayer(props: PreviewPlayerProps) {
  const { src, videoRef, tlTime, duration, playing, onToggle, onSeek } = props;
  const shellRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState("1");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
    video.playbackRate = Number(speed);
  }, [volume, muted, speed, videoRef]);

  const progress = duration > 0 ? (tlTime / duration) * 100 : 0;

  return (
    <div ref={shellRef} className="rounded-lg border border-border bg-card">
      <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-black">
        <video
          ref={videoRef}
          src={src}
          className="size-full object-contain"
          playsInline
          onClick={onToggle}
        />
      </div>

      <div className="px-3 pt-2">
        <div
          className="group relative h-2 cursor-pointer rounded-full bg-secondary"
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const set = (clientX: number) =>
              onSeek(((clientX - rect.left) / rect.width) * duration);
            set(e.clientX);
            const move = (ev: PointerEvent) => set(ev.clientX);
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow"
            style={{ left: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 p-3">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => onSeek(0)}>
          <ChevronFirst className="size-4" />
          <span className="sr-only">Go to start</span>
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => onSeek(tlTime - 10)}>
          <Rewind className="size-4" />
          <span className="sr-only">Back 10 seconds</span>
        </Button>
        <Button size="icon" className="size-9 rounded-full" onClick={onToggle}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          <span className="sr-only">{playing ? "Pause" : "Play"}</span>
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => onSeek(tlTime + 10)}>
          <FastForward className="size-4" />
          <span className="sr-only">Forward 10 seconds</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onSeek(duration)}
        >
          <ChevronLast className="size-4" />
          <span className="sr-only">Go to end</span>
        </Button>

        <div className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">
          <span className="text-foreground">{formatTimecode(tlTime)}</span> /{" "}
          {formatTimecode(duration)}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => onSeek(tlTime - FRAME)}
          >
            −1f
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => onSeek(tlTime + FRAME)}
          >
            +1f
          </Button>

          <Select value={speed} onValueChange={setSpeed}>
            <SelectTrigger className="h-8 w-[84px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEEDS.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {s}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setMuted((m) => !m)}
          >
            {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            <span className="sr-only">Mute</span>
          </Button>
          <Slider
            className="w-20"
            value={[muted ? 0 : volume * 100]}
            max={100}
            onValueChange={([v]) => {
              setVolume((v ?? 0) / 100);
              setMuted((v ?? 0) === 0);
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => void shellRef.current?.requestFullscreen?.()}
          >
            <Maximize className="size-4" />
            <span className="sr-only">Fullscreen</span>
          </Button>
        </div>
      </div>
    </div>
  );
}