// "Restructure lesson" — rebuilds any lesson note (tidy, messy, or with every
// heading deleted) into Question session → Solution session pairs.
//
// Flow: save a restore point → classify every block → rebuild the note
// (existing solutions are moved, never rewritten) → write solutions only for
// questions that had none → the teacher reviews a summary → Accept or Undo.

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ListTree, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { nodeText } from "@/lib/lessonnotes/lessonOutline";
import {
  applyRestructurePlan,
  describeBlocks,
  validateSessionPairs,
  type RestructurePlan,
  type RestructureReport,
} from "@/lib/lessonnotes/sessionPairs";
import { classifyLessonNote } from "@/lib/lessonnotes/restructure.functions";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  editor: Editor | null;
  notebookId?: string;
  topic?: string;
  /** Write a verified solution for the question whose heading reads `label`. */
  solve?: (label: string) => Promise<void>;
}

interface Outcome {
  report: RestructureReport;
  before: any;
  solved: string[];
  flagged: string[];
  remaining: string[];
}

export function RestructureLessonButton({ editor, notebookId, topic, solve }: Props) {
  const classify = useServerFn(classifyLessonNote);
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const run = async () => {
    if (!editor || editor.isDestroyed || busy) return;
    const before = editor.getJSON();
    try {
      setBusy("Saving a restore point…");
      if (notebookId) {
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          await (supabase as any).from("notebook_restore_points").insert({
            notebook_id: notebookId,
            owner_id: auth.user.id,
            label: "Before Restructure lesson",
            snapshot: { editorDoc: before },
          });
        }
      }

      setBusy("Reading the lesson…");
      const blocks = describeBlocks(before as any, nodeText);
      const plan = (await classify({ data: { blocks, topic } })) as RestructurePlan;
      if (!plan.segments.length) throw new Error("I couldn't recognise any sessions in this note.");

      setBusy("Rebuilding sessions…");
      const { doc, report } = applyRestructurePlan(before as any, plan);
      editor.commands.setContent(doc as any, { emitUpdate: true });

      const solved: string[] = [];
      const flagged: string[] = [];
      for (const item of report.needsSolution) {
        if (!solve) { flagged.push(item.label); continue; }
        setBusy(`Writing the solution to ${item.label}…`);
        try {
          await solve(item.label);
          solved.push(item.label);
        } catch {
          flagged.push(item.label);
        }
      }

      const check = validateSessionPairs(editor.getJSON());
      setOutcome({
        report,
        before,
        solved,
        flagged,
        remaining: check.problems.map((p) => p.message),
      });
    } catch (e) {
      editor.commands.setContent(before as any, { emitUpdate: true });
      toast.error(e instanceof Error ? e.message : "Restructure failed. Your note is unchanged.");
    } finally {
      setBusy(null);
    }
  };

  const undo = () => {
    if (editor && outcome) editor.commands.setContent(outcome.before, { emitUpdate: true });
    setOutcome(null);
    toast.success("Your note is back exactly as it was.");
  };

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={!editor || !!busy}
        title="Restructure lesson — every question gets its own Solution session"
        className="p-1.5 rounded inline-flex items-center gap-1 text-xs hover:bg-foreground/10 disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListTree className="h-4 w-4" />}
        {busy ?? "Restructure lesson"}
      </button>

      <Dialog open={!!outcome} onOpenChange={(o) => { if (!o) setOutcome(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lesson restructured</DialogTitle>
            <DialogDescription>
              Every question is now followed by its own Solution session. Check the note, then keep or undo.
            </DialogDescription>
          </DialogHeader>
          {outcome && (
            <ul className="text-sm space-y-1.5">
              <li>{outcome.report.sessions} sessions, {outcome.report.pairs} question → solution pairs.</li>
              {outcome.report.movedSolutions > 0 && (
                <li>{outcome.report.movedSolutions} existing solution(s) moved under their own question.</li>
              )}
              {outcome.report.tidiedLines > 0 && <li>{outcome.report.tidiedLines} line(s) reworded for clarity.</li>}
              {outcome.solved.length > 0 && <li>Newly written: {outcome.solved.join(", ")}.</li>}
              {outcome.flagged.length > 0 && (
                <li className="text-destructive">Needs solution: {outcome.flagged.join(", ")}.</li>
              )}
              {outcome.remaining.map((m) => (
                <li key={m} className="text-destructive">{m}</li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={undo}>Undo</Button>
            <Button onClick={() => setOutcome(null)}>Keep</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
