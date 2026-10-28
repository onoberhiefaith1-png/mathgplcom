import { useCallback, useMemo, useRef, useState } from "react";
import { Redo2, Scissors, Trash2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditAction } from "@/lib/editor/project";
import type { Thumbnail } from "@/lib/editor/media";
import { peakAt } from "@/lib/editor/media";
import { clipDuration, formatTimecode, type Segment } from "@/lib/editor/types";

const TICK_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
const TRACK_LABEL_WIDTH = 128;

export interface TimelineProps {
  segments: Segment[];
  duration: number;
  sourceDuration: number;
  tlTime: number;
  pxPerSecond: number;
  onZoom: (next: number) => void;
  onSeek: (time: number) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  dispatch: (action: EditAction, options?: { coalesceKey?: string }) => void;
  thumbnails: Thumbnail[];
  peaks: number[];
  waveformReady: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export function Timeline(props: TimelineProps) {
  const {
    segments,
    duration,
    sourceDuration,
    tlTime,
    pxPerSecond,
    onZoom,
    onSeek,
    selectedId,
    onSelect,
    dispatch,
    thumbnails,
    peaks,
    waveformReady,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const width = Math.max(duration * pxPerSecond, 320);

  const tickStep = useMemo(() => {
    return TICK_STEPS.find((s) => s * pxPerSecond >= 80) ?? TICK_STEPS[TICK_STEPS.length - 1]!;
  }, [pxPerSecond]);

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= duration + tickStep; t += tickStep) out.push(Number(t.toFixed(3)));
    return out;
  }, [duration, tickStep]);

  const scrub = useCallback(
    (clientX: number, element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      onSeek((clientX - rect.left) / pxPerSecond);
    },
    [onSeek, pxPerSecond],
  );

  const startScrub = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    scrub(e.clientX, el);
    const move = (ev: PointerEvent) => scrub(ev.clientX, el);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    onZoom(pxPerSecond * (e.deltaY < 0 ? 1.15 : 0.87));
  };

  const startTrim = (
    e: React.PointerEvent,
    seg: Segment,
    side: "start" | "end",
  ) => {
    e.stopPropagation();
    const originX = e.clientX;
    const origin = side === "start" ? seg.clip.sourceStart : seg.clip.sourceEnd;
    const key = `trim-${seg.clip.id}-${side}`;
    const move = (ev: PointerEvent) => {
      const delta = (ev.clientX - originX) / pxPerSecond;
      dispatch(
        { type: "trim", id: seg.clip.id, side, sourceTime: origin + delta },
        { coalesceKey: key },
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <h3 className="text-sm font-semibold text-foreground">Timeline</h3>
        <span className="text-xs text-muted-foreground">
          {segments.length} clip{segments.length === 1 ? "" : "s"} · {formatTimecode(duration, false)}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={!canUndo}
            onClick={() => onUndo?.()}
          >
            <Undo2 className="mr-1.5 size-3.5" />
            Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={!canRedo}
            onClick={() => onRedo?.()}
          >
            <Redo2 className="mr-1.5 size-3.5" />
            Redo
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => dispatch({ type: "split", time: tlTime })}
          >
            <Scissors className="mr-1.5 size-3.5" />
            Split
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={!selectedId || segments.length <= 1}
            onClick={() => {
              if (selectedId) dispatch({ type: "delete", id: selectedId });
              onSelect(null);
            }}
          >
            <Trash2 className="mr-1.5 size-3.5" />
            Delete
          </Button>
          <div className="ml-1 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onZoom(pxPerSecond * 0.7)}
            >
              <ZoomOut className="size-4" />
              <span className="sr-only">Zoom out</span>
            </Button>
            <span className="w-14 text-center font-mono text-[11px] text-muted-foreground">
              {Math.round(pxPerSecond)} px/s
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onZoom(pxPerSecond * 1.4)}
            >
              <ZoomIn className="size-4" />
              <span className="sr-only">Zoom in</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        <div className="shrink-0 border-r border-border" style={{ width: TRACK_LABEL_WIDTH }}>
          <div className="h-7 border-b border-border" />
          <TrackLabel title="Video" subtitle="clips" />
          <TrackLabel title="Audio" subtitle={waveformReady ? "original" : "reading…"} />
          <TrackLabel title="Voice" subtitle="stage 7" muted />
          <TrackLabel title="Subtitles" subtitle="stage 8" muted />
        </div>

        <div ref={scrollRef} className="relative flex-1 overflow-x-auto" onWheel={handleWheel}>
          <div style={{ width }} className="relative">
            {/* ruler */}
            <div
              className="relative h-7 cursor-ew-resize border-b border-border bg-secondary/40 select-none"
              onPointerDown={startScrub}
            >
              {ticks.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 h-full border-l border-border/70 pl-1 text-[10px] leading-7 text-muted-foreground"
                  style={{ left: t * pxPerSecond }}
                >
                  {formatTimecode(t, tickStep < 1)}
                </div>
              ))}
            </div>

            {/* video track */}
            <div
              className="relative h-20 border-b border-border bg-background/40"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) onSelect(null);
              }}
            >
              {segments.map((seg) => (
                <ClipBlock
                  key={seg.clip.id}
                  seg={seg}
                  pxPerSecond={pxPerSecond}
                  selected={selectedId === seg.clip.id}
                  dropTarget={dragOverIndex === seg.index}
                  thumbnails={thumbnails}
                  onSelect={() => onSelect(seg.clip.id)}
                  onTrim={startTrim}
                  onDragTo={(index) => {
                    setDragOverIndex(null);
                    dispatch({ type: "reorder", from: seg.index, to: index });
                  }}
                  onDragOver={setDragOverIndex}
                  segments={segments}
                />
              ))}
            </div>

            {/* audio track */}
            <div className="relative h-16 border-b border-border bg-background/40">
              {segments.map((seg) => (
                <WaveformBlock
                  key={seg.clip.id}
                  seg={seg}
                  pxPerSecond={pxPerSecond}
                  peaks={peaks}
                  sourceDuration={sourceDuration}
                />
              ))}
            </div>

            <PlaceholderTrack label="Replacement voice — generated in Stage 7" />
            <PlaceholderTrack label="Subtitles — generated in Stage 8" />

            {/* playhead */}
            <div
              className="pointer-events-none absolute inset-y-0 z-20 w-px bg-destructive"
              style={{ left: tlTime * pxPerSecond }}
            >
              <div className="-ml-1.5 size-3 rotate-45 bg-destructive" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrackLabel({
  title,
  subtitle,
  muted,
}: {
  title: string;
  subtitle: string;
  muted?: boolean;
}) {
  const height = title === "Video" ? "h-20" : title === "Audio" ? "h-16" : "h-10";
  return (
    <div className={`${height} flex flex-col justify-center border-b border-border px-3`}>
      <span className={`text-xs font-medium ${muted ? "text-muted-foreground" : "text-foreground"}`}>
        {title}
      </span>
      <span className="text-[10px] text-muted-foreground">{subtitle}</span>
    </div>
  );
}

function PlaceholderTrack({ label }: { label: string }) {
  return (
    <div className="relative h-10 border-b border-border bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--color-border)_6px,var(--color-border)_7px)]/20">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function ClipBlock({
  seg,
  segments,
  pxPerSecond,
  selected,
  dropTarget,
  thumbnails,
  onSelect,
  onTrim,
  onDragTo,
  onDragOver,
}: {
  seg: Segment;
  segments: Segment[];
  pxPerSecond: number;
  selected: boolean;
  dropTarget: boolean;
  thumbnails: Thumbnail[];
  onSelect: () => void;
  onTrim: (e: React.PointerEvent, seg: Segment, side: "start" | "end") => void;
  onDragTo: (index: number) => void;
  onDragOver: (index: number | null) => void;
}) {
  const width = clipDuration(seg.clip) * pxPerSecond;
  const slots = Math.max(1, Math.floor(width / 72));
  const frames = Array.from({ length: slots }, (_, i) => {
    const t = seg.clip.sourceStart + (clipDuration(seg.clip) * (i + 0.5)) / slots;
    let best: Thumbnail | undefined;
    let bestDelta = Infinity;
    for (const thumb of thumbnails) {
      const delta = Math.abs(thumb.time - t);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = thumb;
      }
    }
    return best;
  });

  const startDrag = (e: React.PointerEvent) => {
    onSelect();
    const originX = e.clientX;
    let target = seg.index;
    const move = (ev: PointerEvent) => {
      const deltaSeconds = (ev.clientX - originX) / pxPerSecond;
      const center = seg.tlStart + clipDuration(seg.clip) / 2 + deltaSeconds;
      const hit = segments.find((s) => center >= s.tlStart && center < s.tlEnd);
      target = hit ? hit.index : center < 0 ? 0 : segments.length - 1;
      onDragOver(target === seg.index ? null : target);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onDragOver(null);
      if (target !== seg.index) onDragTo(target);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={startDrag}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`absolute inset-y-1 overflow-hidden rounded-md border bg-secondary transition-shadow ${
        selected ? "border-primary ring-2 ring-primary/50" : "border-border"
      } ${dropTarget ? "ring-2 ring-primary" : ""}`}
      style={{ left: seg.tlStart * pxPerSecond, width: Math.max(width, 8) }}
    >
      <div className="flex size-full">
        {frames.map((thumb, i) =>
          thumb ? (
            <img
              key={i}
              src={thumb.url}
              alt=""
              draggable={false}
              className="h-full flex-1 object-cover opacity-90"
            />
          ) : (
            <div key={i} className="h-full flex-1 bg-muted" />
          ),
        )}
      </div>
      <span className="pointer-events-none absolute bottom-0.5 left-1 rounded bg-background/80 px-1 font-mono text-[10px] text-foreground">
        {formatTimecode(clipDuration(seg.clip), false)}
      </span>
      <div
        onPointerDown={(e) => onTrim(e, seg, "start")}
        className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-primary/70 opacity-0 hover:opacity-100"
      />
      <div
        onPointerDown={(e) => onTrim(e, seg, "end")}
        className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-primary/70 opacity-0 hover:opacity-100"
      />
    </div>
  );
}

function WaveformBlock({
  seg,
  pxPerSecond,
  peaks,
  sourceDuration,
}: {
  seg: Segment;
  pxPerSecond: number;
  peaks: number[];
  sourceDuration: number;
}) {
  const width = Math.max(clipDuration(seg.clip) * pxPerSecond, 4);
  const bars = Math.max(1, Math.floor(width / 3));
  return (
    <div
      className="absolute inset-y-1 flex items-center gap-px overflow-hidden rounded-md border border-border bg-secondary/60 px-px"
      style={{ left: seg.tlStart * pxPerSecond, width }}
    >
      {Array.from({ length: bars }, (_, i) => {
        const t = seg.clip.sourceStart + (clipDuration(seg.clip) * i) / bars;
        const h = Math.max(2, peakAt(peaks, t, sourceDuration) * 100);
        return (
          <div
            key={i}
            className="w-0.5 shrink-0 rounded-full bg-primary/70"
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}