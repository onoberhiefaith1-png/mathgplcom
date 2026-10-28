import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Ban } from "lucide-react";
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
import type { StageBlocker } from "@/lib/editor/blockers";

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
  /** unresolved problems on this stage — always stated, never hidden */
  blockers?: StageBlocker[];
  /** accept every non-fatal problem on this stage and carry on */
  onProceedAnyway?: (() => void) | undefined;
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
  blockers = [],
  onProceedAnyway,
  children,
}: Props) {
  const previous = STAGES.find((s) => s.id === previousId);
  const fatal = blockers.filter((b) => b.fatal);
  const overridable = blockers.filter((b) => !b.fatal);
  // Nothing is ever disabled without a reason on screen: once every stated
  // problem is either gone or accepted, the stage continues.
  const approvable = blockers.length === 0 && (canApprove ?? true);
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

      {blockers.length > 0 ? (
        <div className="mx-4 mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
            <AlertTriangle className="size-3.5" />
            {blockers.length === 1
              ? "This stage reports a problem"
              : `This stage reports ${blockers.length} problems`}
          </p>
          <ul className="mt-2 space-y-2">
            {blockers.map((blocker) => (
              <li key={`${blocker.stage}:${blocker.code}`} className="text-xs">
                <p className="font-medium text-foreground">
                  {blocker.fatal ? (
                    <Ban className="mr-1 inline size-3.5 align-[-2px] text-destructive" />
                  ) : null}
                  {blocker.message}
                </p>
                {blocker.fix ? (
                  <p className="text-muted-foreground">To fix it properly: {blocker.fix}</p>
                ) : null}
                <p className="text-muted-foreground">
                  {blocker.fatal ? "Cannot be skipped: " : "Proceed anyway: "}
                  {blocker.proceed}
                </p>
                {blocker.segmentIds.length > 0 ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Affected segments: {blocker.segmentIds.slice(0, 12).join(", ")}
                    {blocker.segmentIds.length > 12
                      ? ` and ${blocker.segmentIds.length - 12} more`
                      : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {overridable.length > 0 ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={onProceedAnyway}
              disabled={!onProceedAnyway}
            >
              Proceed anyway
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          ) : null}
          {fatal.length > 0 ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {overridable.length > 0
                ? "The problem marked above cannot be skipped — the missing file has to be re-attached first."
                : "This cannot be skipped — the missing file has to be re-attached first."}
            </p>
          ) : null}
        </div>
      ) : null}

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
          <Button size="sm" disabled={!approvable} onClick={onApprove}>
            {approveLabel ?? "Approve & Continue"}
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
        ) : null}
      </footer>

    </section>
  );
}
