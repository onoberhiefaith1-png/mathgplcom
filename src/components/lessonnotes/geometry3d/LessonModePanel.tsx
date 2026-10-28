// The Lesson Mode panel — the list of mathematical topics a teacher can teach
// with the prepared scene. Choosing a topic reveals only its tools.

import { LESSON_MODES } from "@/lib/geometry3d/lessonModes";
import type { LessonModeId } from "@/lib/geometry3d/scene3d";
import { cn } from "@/lib/utils";
import { GraduationCap, Lock } from "lucide-react";

interface Props {
  value: LessonModeId | null;
  onChange: (id: LessonModeId) => void;
}

export function LessonModePanel({ value, onChange }: Props) {
  return (
    <div className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-foreground/10 bg-background">
      <div className="flex items-center gap-1.5 border-b border-foreground/10 px-3 py-2">
        <GraduationCap className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide">Lesson Modes</span>
      </div>
      <nav className="flex flex-col p-1.5">
        {LESSON_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={cn(
              "flex items-center justify-between gap-2 rounded px-2.5 py-2 text-left text-xs transition",
              value === m.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            <span className="font-medium">{m.label}</span>
            {!m.ready && <Lock className="h-3 w-3 shrink-0 opacity-60" />}
          </button>
        ))}
      </nav>
      <p className="mt-auto px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
        Objects are locked in Lesson Mode. The camera stays free — rotate, zoom and pan to
        inspect the solid from any viewpoint.
      </p>
    </div>
  );
}

export default LessonModePanel;
