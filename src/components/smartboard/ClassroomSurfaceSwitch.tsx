import { BookOpen, Library, Presentation } from "lucide-react";
import type { ClassroomBoardSurface } from "@/lib/smartboard/classroomAcademia";

const OPTIONS: {
  id: ClassroomBoardSurface;
  label: string;
  icon: typeof BookOpen;
}[] = [
  { id: "lesson", label: "Lesson", icon: Presentation },
  { id: "notes", label: "Lesson Notes", icon: BookOpen },
  { id: "academia", label: "Academia", icon: Library },
];

/**
 * Lesson and Lesson Notes stay where they are. Academia is the control on
 * the right. Followers see the current choice and cannot change it.
 */
export function ClassroomSurfaceSwitch({
  value,
  onChange,
  disabled = false,
}: {
  value: ClassroomBoardSurface;
  onChange?: (next: ClassroomBoardSurface) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Smartboard surface"
      data-testid="smartboard-surface-switch"
      className="inline-flex items-center overflow-hidden rounded-lg border border-black/15 bg-white/90 text-slate-900 shadow-sm"
    >
      {OPTIONS.map((option, index) => {
        const Icon = option.icon;
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            data-surface={option.id}
            onClick={() => onChange?.(option.id)}
            className={`inline-flex min-h-9 items-center gap-1.5 px-3 py-1 text-xs font-semibold ${
              index > 0 ? "border-l border-black/10" : ""
            } ${selected ? "bg-slate-900 text-white" : "hover:bg-black/5"} disabled:cursor-default`}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default ClassroomSurfaceSwitch;
