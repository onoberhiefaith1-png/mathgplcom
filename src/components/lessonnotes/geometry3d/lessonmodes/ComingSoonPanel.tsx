// Placeholder panel for Lesson Modes scheduled for a later phase. It still
// shows the teacher exactly which tools that topic will provide.

import { LESSON_MODE_BY_ID } from "@/lib/geometry3d/lessonModes";
import type { LessonModeId } from "@/lib/geometry3d/scene3d";
import { Clock } from "lucide-react";

export function ComingSoonPanel({ mode }: { mode: LessonModeId }) {
  const def = LESSON_MODE_BY_ID[mode];
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto border-l border-foreground/10 bg-background p-3">
      <div>
        <p className="text-sm font-semibold">{def.label}</p>
        <p className="text-[11px] text-muted-foreground">{def.purpose}</p>
      </div>
      <div className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-2 text-[11px] text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> Arriving in a later phase.
      </div>
      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Planned tools</p>
        <ul className="space-y-1">
          {def.tools.map((t) => (
            <li key={t} className="rounded bg-muted/60 px-2 py-1 text-xs text-muted-foreground">{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ComingSoonPanel;
