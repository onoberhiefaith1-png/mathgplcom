export function Waveform({ peaks }: { peaks: number[] }) {
  if (peaks.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center rounded-md bg-secondary/40 text-[11px] text-muted-foreground">
        Waveform available after extraction
      </div>
    );
  }
  const shown = peaks.filter((_, i) => i % Math.max(1, Math.floor(peaks.length / 220)) === 0);
  return (
    <div className="flex h-16 items-end gap-px rounded-md bg-secondary/40 p-1">
      {shown.map((peak, i) => (
        <span
          key={i}
          className="flex-1 rounded-sm bg-primary/70"
          style={{ height: `${Math.max(4, peak * 100)}%` }}
        />
      ))}
    </div>
  );
}
