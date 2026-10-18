// Solution workspace for a multiple-choice question: a quiet Floating Numbers
// style working pad where the student works the question out before picking
// an option. Nothing here is marked — only the chosen option counts.
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import McqText from "./McqText";

export default function McqSolutionDialog({ question, n, onClose }: {
  question: string;
  n: number;
  onClose: () => void;
}) {
  const [work, setWork] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="mm-app mm-light flex max-h-[90vh] max-w-2xl flex-col bg-background text-foreground">
        <DialogHeader><DialogTitle>Solution workspace — Question {n}</DialogTitle></DialogHeader>
        <div className="rounded-xl border border-border bg-card p-3 text-sm font-medium">
          <McqText text={question} k={`sol${n}`} />
        </div>
        <p className="text-xs text-muted-foreground">
          Work the question out here, then close and choose your option. This space is yours — it is not marked.
        </p>
        <textarea
          value={work}
          onChange={(e) => setWork(e.target.value)}
          placeholder="Write your working here…"
          aria-label="Your working"
          className="min-h-64 flex-1 resize-y rounded-xl border border-border bg-card p-4 font-mono text-base leading-relaxed outline-none focus:border-primary"
        />
        <div className="flex justify-end">
          <Button onClick={onClose}>Done — choose my answer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
