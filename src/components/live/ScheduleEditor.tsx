import { Label } from "@/components/ui/label";
import { WEEK_ORDER, dayName, type ScheduleTimes } from "@/lib/live/schedule";

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

const FIELD =
  "bg-muted text-foreground border-border placeholder:text-muted-foreground focus-visible:ring-primary";

const split = (value: string | undefined, fallback: string): [string, string] => {
  const [h = fallback.split(":")[0], m = fallback.split(":")[1]] = (value ?? fallback).split(":");
  return [h, m];
};

/**
 * Teaching days, each with its own start time and (optionally) end time.
 *
 * A day's time fields appear only once that day is ticked and disappear with
 * it, so no time can belong to a day the teacher does not teach. The schedule
 * is information for the public — it never opens, closes or expires a room.
 */
const ScheduleEditor = ({
  days,
  times,
  endTimes,
  onChange,
  onEndChange,
}: {
  days: number[];
  times: ScheduleTimes;
  /** Per-day finishing time. Omit to hide the end-time column entirely. */
  endTimes?: ScheduleTimes;
  onChange: (days: number[], times: ScheduleTimes) => void;
  onEndChange?: (endTimes: ScheduleTimes) => void;
}) => {
  const showEnd = Boolean(endTimes && onEndChange);

  const toggle = (day: number) => {
    const key = String(day);
    if (days.includes(day)) {
      const nextTimes = { ...times };
      delete nextTimes[key];
      onChange(days.filter((d) => d !== day), nextTimes);
      if (endTimes && onEndChange) {
        const nextEnds = { ...endTimes };
        delete nextEnds[key];
        onEndChange(nextEnds);
      }
      return;
    }
    onChange([...days, day], { ...times, [key]: times[key] ?? "16:00" });
    if (endTimes && onEndChange) onEndChange({ ...endTimes, [key]: endTimes[key] ?? "17:00" });
  };

  const setPart = (day: number, which: "start" | "end", part: "h" | "m", value: string) => {
    const key = String(day);
    if (which === "start") {
      const [h, m] = split(times[key], "16:00");
      onChange(days, { ...times, [key]: part === "h" ? `${value}:${m}` : `${h}:${value}` });
      return;
    }
    if (!endTimes || !onEndChange) return;
    const [h, m] = split(endTimes[key], "17:00");
    onEndChange({ ...endTimes, [key]: part === "h" ? `${value}:${m}` : `${h}:${value}` });
  };

  const selected = WEEK_ORDER.filter((d) => days.includes(d));

  const TimePicker = ({ day, which }: { day: number; which: "start" | "end" }) => {
    const key = String(day);
    const raw = which === "start" ? times[key] : endTimes?.[key];
    const [h, m] = split(raw, which === "start" ? "16:00" : "17:00");
    return (
      <div className="flex items-center gap-1.5">
        <select
          aria-label={`${dayName(day)} ${which} hour`}
          value={h}
          onChange={(e) => setPart(day, which, "h", e.target.value)}
          className={`h-10 rounded-md border px-2 text-sm outline-hidden focus:border-primary ${FIELD}`}
        >
          {HOURS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <span className="text-muted-foreground">:</span>
        <select
          aria-label={`${dayName(day)} ${which} minute`}
          value={MINUTES.includes(m) ? m : "00"}
          onChange={(e) => setPart(day, which, "m", e.target.value)}
          className={`h-10 rounded-md border px-2 text-sm outline-hidden focus:border-primary ${FIELD}`}
        >
          {MINUTES.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <Label>Teaching Days</Label>
      <div className="flex flex-wrap gap-2">
        {WEEK_ORDER.map((day) => {
          const on = days.includes(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(day)}
              className={`min-h-[40px] rounded-xl border px-3 text-sm font-medium transition ${
                on
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {dayName(day).slice(0, 3)}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-background/40 p-3">
          {selected.map((day) => (
            <div key={day} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <span className="truncate text-sm font-medium">{dayName(day)}</span>
              <div className="flex flex-wrap items-center gap-2">
                <TimePicker day={day} which="start" />
                {showEnd && (
                  <>
                    <span className="text-xs text-muted-foreground">to</span>
                    <TimePicker day={day} which="end" />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Each teaching day keeps its own time. This is information for your audience — the room and its
        link stay open every day and never expire.
      </p>
    </div>
  );
};

export default ScheduleEditor;
