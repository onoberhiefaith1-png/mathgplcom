import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { statusTitle, type ProblemReport } from "@/lib/lessonnotes/problemDetect";

/** Transparent "Problem Check" panel: shows exactly what the system inspected
 *  before generating a solution, so the teacher is never blocked by a vague
 *  "no problem found". */
export function ProblemCheckDialog({
  report, heading, open, onCancel, onProceed,
}: {
  report: ProblemReport | null;
  heading?: string;
  open: boolean;
  onCancel: () => void;
  onProceed: () => void;
}) {
  if (!report) return null;
  const ok = report.status === "valid";
  // The teacher is never dead-ended: when nothing was found anywhere in the
  // session, the action becomes "Generate a new question" instead of vanishing.
  const hasSomething = report.problem.trim().length > 0 || report.sources.length > 0;
  const actionLabel = hasSomething ? "Generate anyway" : "Generate a new question";
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Problem Check</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <p className={ok ? "text-foreground" : "text-amber-600 dark:text-amber-400"}>
                {ok ? "✓ " : "⚠️ "}{statusTitle(report.status)}
              </p>

              <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
                {heading ? (
                  <p><span className="text-muted-foreground">Heading detected: </span>{heading}</p>
                ) : null}
                {report.instruction ? (
                  <p><span className="text-muted-foreground">Instruction detected: </span>{report.instruction}</p>
                ) : null}
                {report.mathLines.length ? (
                  <div>
                    <span className="text-muted-foreground">Mathematics detected:</span>
                    <pre className="mt-1 whitespace-pre-wrap font-sans">{report.mathLines.join("\n")}</pre>
                  </div>
                ) : report.problem ? (
                  <div>
                    <span className="text-muted-foreground">Content inspected:</span>
                    <pre className="mt-1 whitespace-pre-wrap font-sans">{report.problem}</pre>
                  </div>
                ) : null}
                {report.sources.length ? (
                  <div>
                    <span className="text-muted-foreground">Found in this session: </span>
                    {report.sources.join("; ")}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    Nothing was found in this block, its Solution, its diagram, or the rest of this session.
                  </p>
                )}
                {report.labels.length ? (
                  <p className="text-muted-foreground">
                    Structural labels ignored: {report.labels.join(", ")}
                  </p>
                ) : null}
              </div>

              {report.issue ? <p>{report.issue}</p> : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onProceed}>{actionLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

