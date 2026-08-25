// Video Timer authoring — the uploaded video is the clock.
//
//   Intro : plays once, NOT timed
//   Loop  : repeats for the whole Timer duration (this is the countdown)
//   Outro : failure ending only
//
// The teacher picks or uploads a video, then sets the three regions. Preview
// buttons play each region so the boundaries can be trusted before publishing.
import { useEffect, useMemo, useRef, useState } from "react";
import { Library, Play, Upload } from "lucide-react";
import { MyGplMediaPicker } from "@/components/lessonnotes/slides/MyGplMediaPicker";
import type { GplAsset } from "@/lib/gpl/assetLibrary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SignedMedia, { useSignedUrl } from "./SignedMedia";
import { listGameAssets, renderPathOf, uploadGameAsset } from "@/lib/games/assets";
import { fmtClock, lapsNeeded, loopDurationOf, timerRegionsOf } from "@/lib/games/timerVideo";
import type { GameAssetRow, TimerVideoConfig } from "@/lib/games/types";
import { cn } from "@/lib/utils";

interface Props {
  value: TimerVideoConfig | null | undefined;
  timerSeconds: number;
  onChange: (patch: Partial<TimerVideoConfig>) => void;
}

type Phase = "intro" | "loop" | "outro";

const PHASES: { id: Phase; label: string; hint: string; tone: string }[] = [
  { id: "intro", label: "Intro", hint: "Plays once — not timed", tone: "bg-sky-500/70" },
  { id: "loop", label: "Loop", hint: "Repeats — this is the clock", tone: "bg-emerald-500/70" },
  { id: "outro", label: "Outro", hint: "Failure ending only", tone: "bg-destructive/70" },
];

const TimerVideoTimeline = ({ value, timerSeconds, onChange }: Props) => {
  const [videos, setVideos] = useState<GameAssetRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState<Phase | null>(null);
  const [gplOpen, setGplOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const signedUrl = useSignedUrl(value?.source === "url" ? null : value?.storagePath ?? null);
  const url = value?.source === "url" ? value?.storagePath ?? null : signedUrl;

  useEffect(() => {
    listGameAssets("background")
      .then((rows) => setVideos(rows.filter((r) => r.media_type === "video")))
      .catch(console.error);
  }, []);

  // The video's real length, read straight off the element. Local state means the
  // regions become editable the instant the metadata arrives, without waiting for
  // the saved value to travel back through the element.
  const [videoDuration, setVideoDuration] = useState(0);
  useEffect(() => {
    setVideoDuration(Number.isFinite(Number(value?.duration)) ? Number(value?.duration) || 0 : 0);
  }, [value?.storagePath, value?.duration]);

  const effectiveDuration = videoDuration || Number(value?.duration) || 0;
  const regions = useMemo(() => timerRegionsOf(value, effectiveDuration), [value, effectiveDuration]);
  const lap = loopDurationOf(regions);
  const laps = lapsNeeded(regions, timerSeconds);
  const ready = lap > 0.05;

  /** First sight of a video: remember its length and lay the three regions out. */
  const adoptDuration = (d: number) => {
    if (!Number.isFinite(d) || d <= 0) return;
    setVideoDuration(d);
    const needsSeed =
      value?.loopStart == null || value?.loopEnd == null || Math.abs((value?.duration ?? 0) - d) > 0.05;
    if (!needsSeed) return;
    const third = d / 3;
    onChange({
      duration: d,
      introStart: value?.introStart ?? 0,
      introEnd: value?.introEnd ?? third,
      loopStart: value?.loopStart ?? third,
      loopEnd: value?.loopEnd ?? third * 2,
      outroStart: value?.outroStart ?? third * 2,
      outroEnd: value?.outroEnd ?? d,
    });
  };

  const pick = (row: GameAssetRow) =>
    onChange({
      assetId: row.id,
      storagePath: renderPathOf(row),
      source: "storage",
      duration: undefined,
      introStart: undefined,
      introEnd: undefined,
      loopStart: undefined,
      loopEnd: undefined,
      outroStart: undefined,
      outroEnd: undefined,
    });

  /** Pick a video straight from the GPL Asset library (same storage bucket). */
  const pickGpl = (asset: GplAsset) =>
    onChange({
      assetId: asset.id,
      storagePath: asset.storage_path ?? asset.external_url ?? undefined,
      source: asset.storage_path ? "storage" : "url",
      duration: undefined,
      introStart: undefined,
      introEnd: undefined,
      loopStart: undefined,
      loopEnd: undefined,
      outroStart: undefined,
      outroEnd: undefined,
    });

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const row = await uploadGameAsset(file, "background", file.name);
      setVideos((prev) => [row, ...prev]);
      pick(row);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  // Preview: seek to the region start and stop at its end.
  const preview = (phase: Phase) => {
    const el = videoRef.current;
    if (!el) return;
    setPreviewing(phase);
    el.currentTime = regions[phase].start;
    void el.play().catch(() => undefined);
  };
  const onTimeUpdate = () => {
    const el = videoRef.current;
    if (!el || !previewing) return;
    const end = regions[previewing].end;
    if (el.currentTime >= end - 0.03) {
      el.pause();
      if (previewing === "loop") {
        el.currentTime = regions.loop.start;
        void el.play().catch(() => undefined);
      } else {
        setPreviewing(null);
      }
    }
  };

  const numField = (key: keyof TimerVideoConfig, current: number) => (
    <Input
      type="number"
      step="0.1"
      min={0}
      max={effectiveDuration || undefined}
      disabled={effectiveDuration <= 0}
      value={Number(current.toFixed(2))}
      onChange={(e) => {
        const raw = Math.max(0, Number(e.target.value) || 0);
        const clamped = effectiveDuration > 0 ? Math.min(effectiveDuration, raw) : raw;
        onChange({ [key]: clamped } as Partial<TimerVideoConfig>);
      }}
      className="h-8"
    />
  );

  return (
    <div className="space-y-3">
      {value?.storagePath ? (
        <div className="overflow-hidden rounded-md border border-border/50 bg-black/50">
          {url ? (
            <video
              ref={videoRef}
              src={url}
              muted
              playsInline
              onTimeUpdate={onTimeUpdate}
              onLoadedMetadata={(e) => adoptDuration(e.currentTarget.duration)}
              onDurationChange={(e) => adoptDuration(e.currentTarget.duration)}
              className="h-40 w-full bg-black object-contain"
            />
          ) : (
            <div className="h-40 w-full animate-pulse bg-muted/30" />
          )}
        </div>
      ) : (
        <p className="rounded-md border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground">
          Choose or upload a video. Its loop region becomes the countdown.
        </p>
      )}

      {/* Region bar */}
      {regions.duration > 0 && (
        <div className="space-y-1">
          <div className="relative h-4 w-full overflow-hidden rounded bg-muted/40">
            {PHASES.map((p) => {
              const r = regions[p.id];
              const left = (r.start / regions.duration) * 100;
              const width = Math.max(0, ((r.end - r.start) / regions.duration) * 100);
              return (
                <div
                  key={p.id}
                  title={`${p.label} — ${fmtClock(r.start)} → ${fmtClock(r.end)}`}
                  className={cn("absolute top-0 h-full", p.tone)}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Loop lap {fmtClock(lap)} · repeats {laps || 0}× to cover {fmtClock(timerSeconds)}
          </p>
        </div>
      )}

      {PHASES.map((p) => (
        <div key={p.id} className="rounded-md border border-border/40 p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold">{p.label}</div>
              <div className="text-[11px] text-muted-foreground">{p.hint}</div>
            </div>
            <Button size="sm" variant="secondary" disabled={!value?.storagePath} onClick={() => preview(p.id)}>
              <Play className="mr-1 h-3 w-3" /> Preview
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {numField(`${p.id}Start` as keyof TimerVideoConfig, regions[p.id].start)}
            {numField(`${p.id}End` as keyof TimerVideoConfig, regions[p.id].end)}
          </div>
        </div>
      ))}

      <div className="grid grid-cols-3 gap-2">
        {videos.slice(0, 9).map((v) => {
          const active = value?.assetId === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => pick(v)}
              title={v.title}
              className={cn(
                "aspect-video overflow-hidden rounded-md border bg-black/40",
                active ? "border-primary ring-2 ring-primary/50" : "border-border/50",
              )}
            >
              <SignedMedia path={renderPathOf(v)} mediaType={v.media_type} fit="cover" className="h-full w-full" />
            </button>
          );
        })}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      <p className="text-[11px] font-medium text-muted-foreground">Add timer video from</p>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 h-3.5 w-3.5" /> {busy ? "Uploading…" : "My device"}
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setGplOpen(true)}>
          <Library className="mr-1.5 h-3.5 w-3.5" /> My GPL assets
        </Button>
      </div>

      {gplOpen && (
        <MyGplMediaPicker
          kind="video"
          onClose={() => setGplOpen(false)}
          onPick={(asset) => {
            setGplOpen(false);
            pickGpl(asset);
          }}
        />
      )}
    </div>
  );
};

export default TimerVideoTimeline;
