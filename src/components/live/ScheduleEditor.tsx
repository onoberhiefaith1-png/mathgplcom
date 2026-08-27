import { Label } from "@/components/ui/label";
import { WEEK_ORDER, dayName, type ScheduleTimes } from "@/lib/live/schedule";

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

const FIELD =
  "bg-muted text-foreground border-border placeholder:text-muted-foreground focus-visible:ring-primary";

/**
 * Teaching days, each with its own time.
 *
 * A day's time field appears only once that day is ticked and disappears with
 * it, so no time can belong to a day the teacher does not teach. The schedule
 * is information for the public — it never opens, closes or expires a room.
 */
const ScheduleEditor = ({
  days,
  times,
  onChange,
}: {
  days: number[];
  times: ScheduleTimes;
  onChange: (days: number[], times: ScheduleTimes) => void;
}) => {
  const toggle = (day: number) => {
    const key = String(day);
    if (days.includes(day)) {
      const nextTimes = { ...times };
      delete nextTimes[key];
      onChange(days.filter((d) => d !== day), nextTimes);
      return;
    }
    onChange([...days, day], { ...times, [key]: times[key] ?? "16:00" });
  };

  const setPart = (day: number, part: "h" | "m", value: string) => {
    const key = String(day);
    const [h = "16", m = "00"] = (times[key] ?? "16:00").split(":");
    onChange(days, { ...times, [key]: part === "h" ? `${value}:${m}` : `${h}:${value}` });
  };

  const selected = WEEK_ORDER.filter((d) => days.includes(d));

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
          {selected.map((day) => {
            const [h = "16", m = "00"] = (times[String(day)] ?? "16:00").split(":");
            return (
              <div key={day} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <span className="truncate text-sm font-medium">{dayName(day)}</span>
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`${dayName(day)} hour`}
                    value={h}
                    onChange={(e) => setPart(day, "h", e.target.value)}
                    className={`h-10 rounded-md border px-2 text-sm outline-hidden focus:border-primary ${FIELD}`}
                  >
                    {HOURS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <span className="text-muted-foreground">:</span>
                  <select
                    aria-label={`${dayName(day)} minute`}
                    value={MINUTES.includes(m) ? m : "00"}
                    onChange={(e) => setPart(day, "m", e.target.value)}
                    className={`h-10 rounded-md border px-2 text-sm outline-hidden focus:border-primary ${FIELD}`}
                  >
                    {MINUTES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
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
