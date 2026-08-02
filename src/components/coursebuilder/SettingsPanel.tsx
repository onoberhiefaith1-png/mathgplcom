import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Course } from "@/lib/courses/types";

const FIELD = "min-h-[44px] bg-white text-slate-900 placeholder:text-slate-400 border-slate-300";

interface Props {
  course: Course;
  onPatch: (patch: Partial<Course>) => void;
}

const Group = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="space-y-3 rounded-2xl border border-white/15 bg-white/5 p-4">
    <div>
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
    {children}
  </section>
);

const Choice = <T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; hint: string }[];
  onChange: (v: T) => void;
}) => (
  <div className="grid gap-2 sm:grid-cols-2">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`min-h-[44px] rounded-xl border px-3 py-2 text-left transition ${
          value === o.value
            ? "border-amber-300 bg-amber-400/15 text-amber-100"
            : "border-white/15 text-slate-200 hover:border-amber-300/50"
        }`}
      >
        <div className="text-sm font-medium">{o.label}</div>
        <div className="text-[11px] text-slate-400">{o.hint}</div>
      </button>
    ))}
  </div>
);

/** Everything that controls course behaviour: learning mode, completion mode,
 *  pass mark, certificate and publishing. */
const SettingsPanel = ({ course, onPatch }: Props) => (
  <div className="space-y-4">
    <Group title="Learning mode" hint="How students move through the course.">
      <Choice
        value={course.learning_mode}
        onChange={(learning_mode) => onPatch({ learning_mode })}
        options={[
          { value: "locked", label: "Locked", hint: "Each Exercise Card must reach the pass mark first." },
          { value: "unlocked", label: "Unlocked", hint: "Open anything; only the overall average must pass." },
        ]}
      />
    </Group>

    <Group title="Completion mode" hint="How students are expected to finish.">
      <Choice
        value={course.completion_mode}
        onChange={(completion_mode) => onPatch({ completion_mode })}
        options={[
          { value: "retracement", label: "Retracement", hint: "Daily target; falling behind removes progress." },
          { value: "deadline", label: "Complete by deadline", hint: "Fixed number of days, then the course resets." },
        ]}
      />
      {course.completion_mode === "deadline" ? (
        <div className="space-y-2">
          <Label className="text-slate-100">Complete within (days)</Label>
          <Input
            className={FIELD}
            type="number"
            min={1}
            value={course.deadline_days}
            onChange={(e) => onPatch({ deadline_days: Number(e.target.value) || 1 })}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-slate-100">Learning days</Label>
          <Input
            className={FIELD}
            type="number"
            min={1}
            value={course.learning_days}
            onChange={(e) => onPatch({ learning_days: Number(e.target.value) || 1 })}
          />
          <p className="text-[11px] text-slate-400">
            Daily target = total questions ÷ learning days.
          </p>
        </div>
      )}
    </Group>

    <Group title="Pass mark" hint="One pass mark for the whole course.">
      <div className="flex items-center gap-2">
        <Input
          className={`${FIELD} max-w-[120px]`}
          type="number"
          min={1}
          max={100}
          value={course.pass_mark}
          onChange={(e) => onPatch({ pass_mark: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })}
        />
        <span className="text-sm text-slate-300">%</span>
      </div>
    </Group>

    <Group title="Certificate">
      <Choice
        value={course.certificate_mode}
        onChange={(certificate_mode) => onPatch({ certificate_mode })}
        options={[
          { value: "automatic", label: "Automatic", hint: "Issued the moment requirements are met." },
          { value: "approval", label: "Teacher approval", hint: "You review before the certificate is issued." },
        ]}
      />
    </Group>

    <Group title="Status" hint="Draft courses are only visible to you.">
      <Choice
        value={course.status}
        onChange={(status) => onPatch({ status })}
        options={[
          { value: "draft", label: "Draft", hint: "Keep building." },
          { value: "published", label: "Published", hint: "Available to your students." },
        ]}
      />
    </Group>
  </div>
);

export default SettingsPanel;
