/**
 * SMART SCREEN CONTROLS.
 *
 * These surfaces belong to the screen itself: they only appear once the user
 * clicks the screen inside the room, and never as loose buttons in the space.
 *
 *  · EDIT MODE (authorised editors) — a small "Smart Screen" panel whose first
 *    and main action is Upload Video, plus Replace / Remove once a video exists.
 *  · VIEW MODE (everyone else) — the playback bar for the uploaded lesson:
 *    play/pause, ±10s, timeline and volume.
 *
 * Live camera / broadcasting is deliberately not exposed in this version.
 */
import { useRef } from "react";
import {
  Film, Loader2, Pause, Play, RotateCcw, RotateCw, Trash2, Upload, Volume2, VolumeX, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { RoomScreenApi } from "@/hooks/useRoomScreen";
import { SCREEN_MAX_WIDTH, SCREEN_MIN_WIDTH } from "@/lib/building/screen";

/** The shape limits used everywhere a wall object is reshaped. */
const SCREEN_MIN_RATIO = 0.3;
const SCREEN_MAX_RATIO = 1.6;

/** One tap for the usual three, then free fine-tuning either side of them. */
const SCREEN_SHAPES: { key: string; label: string; ratio: number }[] = [
  { key: "widescreen", label: "Widescreen", ratio: 9 / 16 },
  { key: "square", label: "Square", ratio: 1 },
  { key: "portrait", label: "Portrait", ratio: 1.35 },
];

const clock = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
};

interface Props {
  api: RoomScreenApi;
  /** True while the user has the screen selected. */
  open: boolean;
  onClose: () => void;
}

/** One labelled slider, matching the frame and window controls. */
const ScreenSlider = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) => (
  <label className="block text-[11px] text-muted-foreground">
    <span className="mb-1 flex items-center justify-between">
      {label}
      <span className="tabular-nums text-foreground">{value.toFixed(2)}</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-primary"
    />
  </label>
);

const SmartScreenControls = ({ api, open, onClose }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const hasVideo = !!api.screen?.video_path;
  // What the sliders show: the teacher's own value, or a sensible starting point.
  const width = api.screen?.width ?? 4.2;
  const ratio = Number(api.screen?.height_ratio ?? 9 / 16);
  const along = api.screen?.offset_along ?? 0.5;
  const lift = api.screen?.offset_y ?? 1.15 + (width * ratio) / 2;

  // ── EDIT MODE ────────────────────────────────────────────────────────────
  if (api.canEdit) {
    return (
      <div className="absolute right-3 top-16 z-30 w-[min(88vw,320px)] space-y-2 rounded-xl border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Smart screen</p>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose} aria-label="Close smart screen settings">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void api.uploadVideo(file);
          }}
        />

        <Button
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => fileRef.current?.click()}
          disabled={!!api.busy}
        >
          <Upload className="h-4 w-4" /> {hasVideo ? "Replace video" : "Upload video"}
        </Button>

        {hasVideo ? (
          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 p-2">
            <Film className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="min-w-0 break-words text-[11px] text-foreground">
              {api.screen?.video_name ?? "Lesson video"}
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            No lesson video on this screen yet. Upload one and it stays with this room.
          </p>
        )}

        {hasVideo && (
          <Button
            size="sm"
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive"
            onClick={() => void api.removeVideo()}
            disabled={!!api.busy}
          >
            <Trash2 className="h-4 w-4" /> Remove video
          </Button>
        )}

        {/* SIZE, SHAPE AND PLACE — the screen is a wall object like any other. */}
        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-2">
          <p className="text-[11px] font-semibold text-foreground">Size and position</p>
          <div className="flex flex-wrap gap-1.5">
            {SCREEN_SHAPES.map((s) => (
              <button
                key={s.key}
                type="button"
                disabled={!!api.busy}
                onClick={() => void api.saveTransform({ height_ratio: s.ratio })}
                className={`min-h-[28px] rounded-full px-2.5 text-[11px] font-semibold disabled:opacity-40 ${
                  Math.abs(ratio - s.ratio) < 0.03
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <ScreenSlider
            label="Bigger / smaller"
            value={width}
            min={SCREEN_MIN_WIDTH}
            max={SCREEN_MAX_WIDTH}
            step={0.1}
            onChange={(v) => void api.saveTransform({ width: v })}
          />
          <ScreenSlider
            label="Shape (height ÷ width)"
            value={ratio}
            min={SCREEN_MIN_RATIO}
            max={SCREEN_MAX_RATIO}
            step={0.01}
            onChange={(v) => void api.saveTransform({ height_ratio: v })}
          />
          <ScreenSlider
            label="Across the wall"
            value={along}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => void api.saveTransform({ offset_along: v })}
          />
          <ScreenSlider
            label="Height on the wall"
            value={lift}
            min={0.8}
            max={4}
            step={0.05}
            onChange={(v) => void api.saveTransform({ offset_y: v })}
          />
          <button
            type="button"
            onClick={() =>
              void api.saveTransform({ width: 4.2, height_ratio: 9 / 16, offset_along: 0.5, offset_y: 2.1 })
            }
            className="text-[10px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Back to the room's own size
          </button>
        </div>

        {api.busy && (
          <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> {api.busy}
          </p>
        )}
        {api.error && <p className="text-[11px] text-destructive">{api.error}</p>}
      </div>
    );
  }

  // ── VIEW MODE ────────────────────────────────────────────────────────────
  if (!hasVideo) return null;

  return (
    <div className="absolute bottom-24 left-1/2 z-30 w-[min(92vw,640px)] -translate-x-1/2 rounded-2xl border border-border/60 bg-background/85 px-3 py-2 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => api.skip(-10)} aria-label="Back 10 seconds">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={api.togglePlay} aria-label={api.playing ? "Pause" : "Play"}>
          {api.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => api.skip(10)} aria-label="Forward 10 seconds">
          <RotateCw className="h-4 w-4" />
        </Button>
        <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">{clock(api.currentTime)}</span>
        <Slider
          className="mx-1 flex-1"
          value={[api.currentTime]}
          min={0}
          max={Math.max(api.duration, 1)}
          step={0.5}
          onValueChange={([v]) => api.seek(v ?? 0)}
          aria-label="Timeline"
        />
        <span className="w-10 text-[11px] tabular-nums text-muted-foreground">{clock(api.duration)}</span>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => api.setMuted(!api.muted)} aria-label={api.muted ? "Unmute" : "Mute"}>
          {api.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
        <Slider
          className="w-20"
          value={[api.muted ? 0 : api.volume]}
          min={0}
          max={1}
          step={0.05}
          onValueChange={([v]) => api.setVolume(v ?? 0)}
          aria-label="Volume"
        />
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="Close player">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default SmartScreenControls;
