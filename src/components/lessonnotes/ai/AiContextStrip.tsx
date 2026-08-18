// "Add context" strip — the teacher tells the generator what it is generating
// BEFORE it generates. Every field is optional; blank means "no constraint".

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Difficulty, ReuseMode, TeacherContext } from "@/lib/lessonnotes/ai/pipeline/types";

const DIFFICULTIES: Array<{ id: Difficulty; label: string }> = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
  { id: "very_hard", label: "Very hard" },
];

const REUSE: Array<{ id: ReuseMode; label: string }> = [
  { id: "reproduce", label: "Reproduce" },
  { id: "modify", label: "Modify" },
  { id: "similar", label: "Similar" },
];

const field =
  "w-full text-xs bg-transparent border border-foreground/20 rounded px-1.5 py-1 outline-hidden focus:border-foreground/40 placeholder:text-foreground/40";

interface Props {
  value: TeacherContext;
  onChange: (next: TeacherContext) => void;
  /** Show the reuse mode row (only meaningful when material was supplied). */
  showReuse?: boolean;
}

export function AiContextStrip({ value, onChange, showReuse }: Props) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof TeacherContext>(k: K, v: TeacherContext[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="rounded border border-foreground/15">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1 px-1.5 py-1 text-[10px] uppercase tracking-wider text-popover-foreground/75 hover:text-foreground"
      >
        Add context
        <ChevronDown className={cn("h-3 w-3 ml-auto transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="p-1.5 pt-0 space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <input className={field} placeholder="Topic" value={value.topic}
              onChange={(e) => set("topic", e.target.value)} />
            <input className={field} placeholder="Subtopic" value={value.subtopic}
              onChange={(e) => set("subtopic", e.target.value)} />
            <input className={field} placeholder="Class / level" value={value.level}
              onChange={(e) => set("level", e.target.value)} />
            <input className={field} type="number" min={1} max={10} placeholder="How many"
              value={value.count}
              onChange={(e) => set("count", Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
          </div>

          <div className="flex flex-wrap gap-1">
            {DIFFICULTIES.map((d) => (
              <button key={d.id} type="button"
                onClick={() => set("difficulty", value.difficulty === d.id ? "" : d.id)}
                className={cn(
                  "text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border transition",
                  value.difficulty === d.id
                    ? "bg-primary/15 border-primary/40 text-foreground"
                    : "border-foreground/20 text-foreground/60 hover:text-foreground",
                )}>
                {d.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">
            {[
              { id: null as boolean | null, label: "Diagram: auto" },
              { id: true as boolean | null, label: "Diagram: yes" },
              { id: false as boolean | null, label: "Diagram: no" },
            ].map((d) => (
              <button key={String(d.id)} type="button" onClick={() => set("diagramRequired", d.id)}
                className={cn(
                  "text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border transition",
                  value.diagramRequired === d.id
                    ? "bg-primary/15 border-primary/40 text-foreground"
                    : "border-foreground/20 text-foreground/60 hover:text-foreground",
                )}>
                {d.label}
              </button>
            ))}
          </div>

          {showReuse && (
            <div className="flex flex-wrap gap-1">
              {REUSE.map((r) => (
                <button key={r.id} type="button"
                  onClick={() => set("reuse", value.reuse === r.id ? "" : r.id)}
                  className={cn(
                    "text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border transition",
                    value.reuse === r.id
                      ? "bg-primary/15 border-primary/40 text-foreground"
                      : "border-foreground/20 text-foreground/60 hover:text-foreground",
                  )}>
                  {r.label}
                </button>
              ))}
            </div>
          )}

          <input className={field} placeholder="Anything else the question must include"
            value={value.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      )}
    </div>
  );
}
