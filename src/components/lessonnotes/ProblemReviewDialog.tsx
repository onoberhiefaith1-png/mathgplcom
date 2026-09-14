import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogHeader, AlertDialogTitle, AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ReviewIssue } from "@/lib/lessonnotes/ai/problemReview";

/**
 * The mathematical referee's panel. It only ever appears when a GENUINE
 * mathematical problem was found, and its buttons belong to that specific
 * problem — never a generic "Generate anyway".
 */
export function ProblemReviewDialog({
  issue, heading, open, onChoose,
}: {
  issue: ReviewIssue | null;
  heading?: string;
  open: boolean;
  /** `null` = the teacher dismissed the panel (cancel). */
  onChoose: (actionId: string | null) => void;
}) {
  if (!issue) return null;
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onChoose(null); }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{issue.title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              {heading ? (
                <p className="text-muted-foreground text-sm">{heading}</p>
              ) : null}
              <p className="text-foreground">{issue.detail}</p>
              {issue.affected ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Affected: </span>
                  {issue.affected}
                </p>
              ) : null}
              {issue.recommendation ? (
                <p className="rounded-md border bg-muted/40 p-3 text-sm">
                  <span className="text-muted-foreground">Recommended: </span>
                  {issue.recommendation}
                </p>
              ) : null}
              <p className="text-muted-foreground text-sm">Choose how to continue:</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {issue.actions.map((a) => (
            <Button
              key={a.id}
              className="w-full"
              variant={a.id === "cancel" ? "ghost" : "default"}
              onClick={() => onChoose(a.id === "cancel" ? null : a.id)}
            >
              {a.label}
            </Button>
          ))}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
