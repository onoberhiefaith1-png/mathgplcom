import { Check, Circle, CircleDot, Loader2, TriangleAlert } from "lucide-react";
import { STAGES, STATUS_LABEL, type StageDef, type StageId, type StageStatus } from "@/lib/editor/workflow";

interface Props {
  current: StageId;
  statusOf: (id: StageId) => StageStatus;
  onNavigate: (id: StageId) => void;
  stages?: StageDef[];
}

export function WorkflowBar({ current, statusOf, onNavigate, stages = STAGES }: Props) {
  return (
    <nav
      aria-label="Production workflow"
      className="sticky top-[52px] z-20 border-b border-border bg-background/95 backdrop-blur"
    >
      <ol className="flex items-center gap-1 overflow-x-auto px-3 py-2">
        {stages.map((stage, i) => {
          const status = statusOf(stage.id);
          const isCurrent = stage.id === current;
          return (
            <li key={stage.id} className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => onNavigate(stage.id)}
                title={`${STATUS_LABEL[status]} — ${stage.summary}`}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <StatusGlyph status={status} current={isCurrent} />
                <span className="font-medium">{stage.name}</span>
              </button>
              {i < stages.length - 1 && <span className="px-0.5 text-muted-foreground">→</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StatusGlyph({ status, current }: { status: StageStatus; current?: boolean }) {
  const cls = "size-3.5 shrink-0";
  if (status === "processing") return <Loader2 className={`${cls} animate-spin`} />;
  if (status === "approved") return <Check className={cls} />;
  if (status === "stale") return <TriangleAlert className={cls} />;
  if (status === "review" || current) return <CircleDot className={cls} />;
  return <Circle className={cls} />;
}
