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
                ) : (
                  <p className="text-muted-foreground">No mathematical content was found in this section.</p>
                )}
                {report.hasDiagram ? (
                  <p className="text-muted-foreground">A diagram belonging to this question was found.</p>
                ) : null}
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
          <AlertDialogAction onClick={onProceed}>Generate anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
