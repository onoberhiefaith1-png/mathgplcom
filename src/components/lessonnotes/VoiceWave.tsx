// Live microphone waveform — the bars react to the actual input level while
// recording, so the teacher can see their voice is being picked up.

interface Props {
  level: number;      // 0..1
  seconds: number;
  bars?: number;
  className?: string;
}

export function VoiceWave({ level, seconds, bars = 28, className }: Props) {
  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className={"flex items-center gap-2 " + (className ?? "")}>
      <div className="flex h-5 flex-1 items-center gap-[2px]">
        {Array.from({ length: bars }).map((_, i) => {
          // Deterministic per-bar shaping so the trace looks like speech
          // rather than a flat block, scaled by the live level.
          const shape = 0.35 + 0.65 * Math.abs(Math.sin((i + 1) * 1.7));
          const h = Math.max(2, Math.round(level * shape * 20));
          return (
            <span
              key={i}
              className="w-[2px] rounded-full bg-red-500/80 transition-[height] duration-75"
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>
      <span className="text-[10px] tabular-nums text-foreground/60">{mmss}</span>
    </div>
  );
}

export default VoiceWave;
