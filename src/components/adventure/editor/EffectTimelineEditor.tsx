import { useEffect, useRef, useState } from "react";
import type { LayoutItem } from "@/lib/adventure/types";

interface Props {
  item: LayoutItem;
  onChange: (patch: Partial<LayoutItem>) => void;
}

/**
 * Tiny timeline scrubber. Bound to the underlying video duration.
 * Four draggable handles: enterEnd, activeStart, activeEnd, exitStart.
 */
export default function EffectTimelineEditor({ item, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => setDuration(v.duration || 0);
    v.addEventListener("loadedmetadata", onMeta);
    if (v.readyState >= 1) onMeta();
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [item.src]);

  const pb = item.playback ?? { direction: "forward", speed: 1, loopMode: "forever", freezeLastFrame: false };
  const enterEnd = pb.enterEnd ?? 0;
  const activeStart = pb.activeStart ?? enterEnd;
  const activeEnd = pb.activeEnd ?? (duration || 1);
  const exitStart = pb.exitStart ?? activeEnd;

  const pct = (t: number) => duration > 0 ? (t / duration) * 100 : 0;

  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - rect.left) / rect.width) * duration;
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, Math.min(duration, t));
  };

  const handle = (
    label: string, value: number, color: string,
    update: (t: number) => void,
  ) => (
    <div
      title={`${label}: ${value.toFixed(2)}s`}
      className={`absolute top-0 h-full w-1 ${color} cursor-ew-resize`}
      style={{ left: `${pct(value)}%` }}
      onPointerDown={(e) => {
        e.stopPropagation();
        const rect = e.currentTarget.parentElement!.getBoundingClientRect();
        const move = (ev: PointerEvent) => {
          const t = ((ev.clientX - rect.left) / rect.width) * duration;
          update(Math.max(0, Math.min(duration, t)));
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
    >
      <span className="absolute -top-4 -translate-x-1/2 text-[9px] text-muted-foreground whitespace-nowrap">{label}</span>
    </div>
  );

  const set = (patch: Partial<NonNullable<LayoutItem["playback"]>>) =>
    onChange({ playback: { ...pb, ...patch } });

  return (
    <div className="space-y-2">
      <video ref={videoRef} src={item.src} muted className="hidden" preload="metadata" />
      <div className="text-[10px] text-muted-foreground">Duration: {duration.toFixed(2)}s</div>
      <div
        className="relative h-6 rounded bg-muted cursor-crosshair"
        onClick={onTrackClick}
      >
        {/* Active region */}
        <div
          className="absolute top-0 h-full bg-primary/30"
          style={{ left: `${pct(activeStart)}%`, width: `${pct(activeEnd - activeStart)}%` }}
        />
        {handle("Enter", enterEnd, "bg-blue-500", (t) => set({ enterEnd: t }))}
        {handle("A-Start", activeStart, "bg-green-500", (t) => set({ activeStart: t }))}
        {handle("A-End", activeEnd, "bg-green-700", (t) => set({ activeEnd: t }))}
        {handle("Exit", exitStart, "bg-red-500", (t) => set({ exitStart: t }))}
      </div>
      <div className="flex flex-wrap gap-1 pt-3">
        {(["forward", "reverse", "pingpong"] as const).map((d) => (
          <button key={d}
            onClick={() => set({ direction: d })}
            className={`px-2 py-0.5 text-[10px] rounded border ${pb.direction === d ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >{d}</button>
        ))}
        {(["forever", "once", "count"] as const).map((m) => (
          <button key={m}
            onClick={() => set({ loopMode: m })}
            className={`px-2 py-0.5 text-[10px] rounded border ${pb.loopMode === m ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >{m}</button>
        ))}
        <label className="text-[10px] flex items-center gap-1 ml-1">
          <input type="checkbox" checked={pb.freezeLastFrame} onChange={(e) => set({ freezeLastFrame: e.target.checked })} />
          Freeze last
        </label>
      </div>
      <div className="flex items-center gap-2 text-[10px]">
        <span>Speed</span>
        {[0.25, 0.5, 1, 2, 4].map((s) => (
          <button key={s}
            onClick={() => set({ speed: s })}
            className={`px-2 py-0.5 rounded border ${pb.speed === s ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >{s}×</button>
        ))}
      </div>
    </div>
  );
}
