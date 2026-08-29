import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusGlyph } from "./WorkflowBar";
import {
  STAGES,
  STATUS_LABEL,
  statusTone,
  type StageDef,
  type StageId,
  type StageStatus,
} from "@/lib/editor/workflow";

interface Props {
  stage: StageDef;
  status: StageStatus;
  current: boolean;
  progress?: string | undefined;
  canApprove?: boolean | undefined;
  approveLabel?: string | undefined;
  onApprove?: (() => void) | undefined;
  onNavigate: (id: StageId) => void;
  /** position in the visible workflow (the Language branch shifts the rest) */
  ordinal?: number;
  previousId?: StageId | undefined;
  children?: ReactNode;
}

export function StagePanel({
  stage,
  status,
  current,
  progress,
  canApprove,
  approveLabel,
  onApprove,
  onNavigate,
  ordinal,
  previousId,
  children,
}: Props) {
  const previous = STAGES.find((s) => s.id === previousId);
  return (
    <section
      id={`stage-${stage.id}`}
      className={`scroll-mt-28 rounded-lg border bg-card ${
        current ? "border-primary/60" : "border-border"
      }`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          Stage {ordinal ?? stage.id} — {stage.name}
        </h3>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${statusTone(status)}`}
        >
          <StatusGlyph status={status} />
          {STATUS_LABEL[status]}
        </span>
        <p className="w-full text-xs text-muted-foreground">{stage.summary}</p>
      </header>

      <div className="px-4 py-4">{children}</div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!previous}
            onClick={() => previous && onNavigate(previous.id)}
          >
            <ArrowLeft className="mr-1.5 size-4" />
            Previous stage
          </Button>
          {progress ? <span className="text-xs text-muted-foreground">{progress}</span> : null}
        </div>
        {onApprove ? (
          <Button size="sm" disabled={!canApprove} onClick={onApprove}>
            {approveLabel ?? "Approve & Continue"}
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
        ) : null}
      </footer>
    </section>
  );
}
