// Compact "Assign to Students" dialog. Opened from the 👥 icon on a Solution
// heading. Supports two targets — Assignment (student solves on the smartboard
// directly) and Adventure (student solves inside a game).
//
// Assignment is a per-question TOGGLE: ticking an assigned class opens a
// confirmation before soft-unassigning. Student progress is preserved so a
// mistaken un-tick can be reversed without data loss.

import { useEffect, useMemo, useState } from "react";
import { Loader2, Users } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import AddToCoursePicker from "./AddToCoursePicker";
import { toast } from "@/hooks/use-toast";
import { type AssessmentKind } from "@/lib/assessments/createAssessment";
import { totalMarks as computeTotalMarks, type FloatingLine } from "@/lib/lessonnotes/floatingCompile";
import {
  resolveQuestionRef,
  loadAssignmentState,
  assignAdventureQuestion,
  unassignAdventureQuestion,
  assignAssessmentQuestion,
  unassignAssessmentQuestion,
  syncAdventureBoards,
  type QuestionRef,
} from "@/lib/assignments/pipeline";
import { autoArchiveExpired } from "@/lib/assignments/instances";
import { listGames } from "@/lib/slate/storage";
import type { Game } from "@/lib/slate/types";
import { listGameQuestions, assignQuestion } from "@/lib/slate/gameQuestions";
import {
  assignGameToClass, loadGameAssignmentState, unassignGame,
} from "@/lib/slate/gameAssignments";

type AssignTarget = "assignment" | "game" | "adventure" | "course";
type ClassRow = {
  id: string;
  name: string;
  /** Existing active assignment id (assignment target) if any. */
  assignmentId: string | null;
  /** Existing active adventure row id if any. */
  adventureId: string | null;
  /** Existing active Game assignment id for the chosen Game, if any. */
  gameAssignmentId: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subsectionId: string | null;
  notebookId: string;
  defaultTitle: string;
}

const KIND_OPTIONS: { value: AssessmentKind; label: string }[] = [
  { value: "classwork", label: "Classwork" },
  { value: "homework", label: "Homework" },
  { value: "assessment", label: "Assessment" },
  { value: "practice", label: "Practice" },
];

export function AssignDialog({ open, onOpenChange, subsectionId, notebookId, defaultTitle }: Props) {
  const [target, setTarget] = useState<AssignTarget>("assignment");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initiallySelected, setInitiallySelected] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<AssessmentKind>("classwork");
  const [title, setTitle] = useState(defaultTitle);
  const [scoreLabel, setScoreLabel] = useState("Marks");
  const [totalMarks, setTotalMarks] = useState<number>(0);
  const [questionRef, setQuestionRef] = useState<QuestionRef>({ subsectionId: null, sectionId: null, questionKey: null });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState<{ classId: string; className: string } | null>(null);
  /* ── Game target ─────────────────────────────────────────────────────────
     A Game is a container: this question is added to an existing Game, and the
     Game itself is what the class receives. */
  const [games, setGames] = useState<Game[]>([]);
  const [gameId, setGameId] = useState<string>("");
  const [passPercentage, setPassPercentage] = useState<number>(70);
  const [gameStats, setGameStats] = useState<{ count: number; marks: number; hasThis: boolean }>({
    count: 0, marks: 0, hasThis: false,
  });

  // Teacher's own Games — never re-authored here, only chosen.
  useEffect(() => {
    if (!open || target !== "game") return;
    (async () => {
      const list = await listGames();
      setGames(list);
      setGameId((prev) => (prev && list.some((g) => g.id === prev) ? prev : list[0]?.id ?? ""));
    })();
  }, [open, target]);

  // Live Game facts + which classes already have this Game.
  useEffect(() => {
    if (!open || target !== "game" || !gameId) {
      if (target === "game") setGameStats({ count: 0, marks: 0, hasThis: false });
      return;
    }
    (async () => {
      const [questions, byClass] = await Promise.all([
        listGameQuestions(gameId),
        loadGameAssignmentState(gameId),
      ]);
      setGameStats({
        count: questions.length,
        marks: questions.reduce((sum, q) => sum + q.totalMarks, 0),
        hasThis: subsectionId ? questions.some((q) => q.subsectionId === subsectionId) : false,
      });
      const first = byClass.values().next().value;
      if (first) setPassPercentage(first.passPercentage);
      setClasses((prev) => prev.map((c) => ({
        ...c,
        gameAssignmentId: byClass.get(c.id)?.id ?? null,
      })));
      const pre = new Set(
        Array.from(byClass.keys()),
      );
      setSelected(new Set(pre));
      setInitiallySelected(new Set(pre));
    })();
  }, [open, target, gameId, subsectionId]);


  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const { data: rows } = await supabase
        .from("classes")
        .select("id, name")
        .eq("owner_id", uid ?? "")
        .order("created_at", { ascending: true });
      const classList = (rows ?? []).map((r: any) => ({ id: r.id, name: r.name ?? "Class" }));

      // Release every expired instance before deriving the checked classes.
      await Promise.all(classList.map((c) => autoArchiveExpired(c.id)));

      // Permanent question identity — survives every note edit.
      const ref = await resolveQuestionRef(subsectionId);
      setQuestionRef(ref);

      const { assignmentByClass, adventureByClass } = await loadAssignmentState(notebookId, ref);

      const enriched: ClassRow[] = classList.map((c) => ({
        ...c,
        assignmentId: assignmentByClass.get(c.id) ?? null,
        adventureId: adventureByClass.get(c.id) ?? null,
        gameAssignmentId: null,
      }));
      setClasses(enriched);

      // The Game target derives its own checked classes from the chosen Game.
      const preSelected = target === "game"
        ? new Set<string>()
        : new Set(
            enriched
              .filter((c) => (target === "assignment" ? c.assignmentId : c.adventureId))
              .map((c) => c.id),
          );
      setSelected(new Set(preSelected));
      setInitiallySelected(new Set(preSelected));


      let nbTitle = defaultTitle;
      let nbLabel = "Marks";
      if (notebookId) {
        const { data: nb } = await supabase
          .from("notebooks")
          .select("subtopic, title, score_label")
          .eq("id", notebookId)
          .maybeSingle();
        if (!nbTitle) nbTitle = (nb as any)?.subtopic || (nb as any)?.title || "Assignment";
        nbLabel = ((nb as any)?.score_label ?? "").toString().trim() || "Marks";
      }
      setTitle(nbTitle || "Assignment");
      setScoreLabel(nbLabel);

      if (subsectionId) {
        const { data: ss } = await supabase
          .from("notebook_subsections")
          .select("floating_lines")
          .eq("id", subsectionId)
          .maybeSingle();
        const lines = ((ss as any)?.floating_lines ?? []) as FloatingLine[];
        // Mirror Floating Numbers page exactly: sum(line.marks), unset = 0.
        setTotalMarks(computeTotalMarks(lines));
      }
      setLoading(false);
    })();
  }, [open, defaultTitle, subsectionId, notebookId, target]);

  // Live sync: while the dialog is open, keep Total marks in lockstep with the
  // Floating Numbers page. Any edit there triggers a postgres_changes UPDATE on
  // the subsection row, and we recompute the total from the new floating_lines.
  useEffect(() => {
    if (!open || !subsectionId) return;
    const channel = supabase
      .channel(`assign-dialog-fl-${subsectionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notebook_subsections", filter: `id=eq.${subsectionId}` },
        (payload) => {
          const lines = (((payload.new as any)?.floating_lines) ?? []) as FloatingLine[];
          setTotalMarks(computeTotalMarks(lines));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, subsectionId]);

  const toggle = (row: ClassRow) => {
    const currentlyOn = selected.has(row.id);
    const wasAlreadyAssigned = target === "assignment"
      ? !!row.assignmentId
      : target === "game"
        ? !!row.gameAssignmentId
        : !!row.adventureId;

    if (currentlyOn && wasAlreadyAssigned) {
      // Ask before removing an existing assignment.
      setConfirmUnassign({ classId: row.id, className: row.name });
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  };

  const confirmUnassignApply = () => {
    if (!confirmUnassign) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(confirmUnassign.classId);
      return next;
    });
    setConfirmUnassign(null);
  };

  const selectAll = () => setSelected(new Set(classes.map((c) => c.id)));

  const { toAssign, toUnassign } = useMemo(() => {
    const add: ClassRow[] = [];
    const rem: ClassRow[] = [];
    for (const c of classes) {
      const was = initiallySelected.has(c.id);
      const now = selected.has(c.id);
      if (now && !was) add.push(c);
      else if (!now && was) rem.push(c);
    }
    return { toAssign: add, toUnassign: rem };
  }, [classes, selected, initiallySelected]);

  const apply = async () => {
    if (toAssign.length === 0 && toUnassign.length === 0) {
      toast({ title: "No changes", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const touchedClasses = new Set<string>();

      // ---- Unassign side (soft — the card leaves the dashboard) ----
      for (const c of toUnassign) {
        if (target === "assignment" && c.assignmentId) {
          await unassignAssessmentQuestion(c.assignmentId);
        } else if (target === "adventure" && c.adventureId) {
          await unassignAdventureQuestion(c.adventureId);
        }
        touchedClasses.add(c.id);
      }

      // ---- Assign side (idempotent — revives the same row) ----
      let ok = 0;
      const errors: string[] = [];
      const assignedIds = new Map<string, string>();
      for (const c of toAssign) {
        try {
          if (!notebookId || !questionRef.sectionId) throw new Error("no_question");
          const id = target === "adventure"
            ? await assignAdventureQuestion({ classId: c.id, notebookId, ref: questionRef })
            : await assignAssessmentQuestion({
                classId: c.id,
                notebookId,
                ref: questionRef,
                kind,
                title: title.trim() || defaultTitle,
                scoreLabel,
              });
          assignedIds.set(c.id, id);
          touchedClasses.add(c.id);
          ok += 1;
        } catch (e: any) {
          errors.push(`${c.name}: ${e?.message ?? "failed"}`);
        }
      }

      // Keep every linked progress bar in step with what is now assigned.
      if (notebookId) {
        for (const cid of touchedClasses) {
          try { await syncAdventureBoards(cid, notebookId); } catch { /* non-fatal */ }
        }
      }


      if (ok > 0 || toUnassign.length > 0) {
        const unassignedIds = new Set(toUnassign.map((c) => c.id));
        setClasses((prev) => prev.map((c) => {
          if (unassignedIds.has(c.id)) {
            return target === "assignment"
              ? { ...c, assignmentId: null }
              : { ...c, adventureId: null };
          }
          const assignedId = assignedIds.get(c.id);
          if (!assignedId) return c;
          return target === "assignment"
            ? { ...c, assignmentId: assignedId }
            : { ...c, adventureId: assignedId };
        }));
        setInitiallySelected(new Set(selected));
      }

      const parts: string[] = [];
      if (ok > 0) parts.push(`Assigned to ${ok}`);
      if (toUnassign.length > 0) parts.push(`Unassigned ${toUnassign.length}`);
      toast({
        title: parts.length ? parts.join(" · ") : "Nothing changed",
        description: errors.length ? errors.join(" • ") : undefined,
        variant: parts.length ? undefined : "destructive",
      });
      if (parts.length) onOpenChange(false);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      toast({
        title: "Could not update",
        description: msg === "no_floating_lines"
          ? "This question has no floating-number lines yet. Open Floating Numbers and generate them first."
          : msg,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const changeCount = toAssign.length + toUnassign.length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Assign to Students
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 -mr-1">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading classes…
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Assign to</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "assignment", label: "Assignment", hint: "Solve on the smartboard" },
                    { value: "adventure", label: "Adventure", hint: "Play inside a game" },
                    { value: "course", label: "Course", hint: "Add to an Exercise Card" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTarget(opt.value)}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                        target === opt.value
                          ? "border-primary bg-primary/10"
                          : "border-input hover:border-primary/40"
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-[11px] text-muted-foreground">{opt.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              {target === "course" ? (
                <AddToCoursePicker
                  notebookId={notebookId}
                  questionRef={questionRef}
                  label={title || defaultTitle}
                  totalMarks={totalMarks}
                  onDone={() => onOpenChange(false)}
                />
              ) : classes.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  You have no classes yet. Create a class first, then assign.
                </div>
              ) : (
              <>


              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Classes</Label>
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Select all
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-md border border-input">
                  {classes.map((c) => {
                    const checked = selected.has(c.id);
                    const wasAssigned = target === "assignment" ? !!c.assignmentId : !!c.adventureId;
                    return (
                      <label
                        key={c.id}
                        className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2 text-sm last:border-b-0 cursor-pointer hover:bg-accent/50"
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggle(c)}
                          />
                          <span>{c.name}</span>
                        </div>
                        {wasAssigned && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {checked ? "Assigned" : "Will unassign"}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Type</Label>
                {target === "assignment" ? (
                  <Select value={kind} onValueChange={(v) => setKind(v as AssessmentKind)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KIND_OPTIONS.map((k) => (
                        <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Adventure
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Title</Label>
                <div className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {title || defaultTitle}
                </div>
                <p className="text-[11px] text-muted-foreground">Taken from the lesson note's subtopic.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Total {scoreLabel.toLowerCase()}</Label>
                <div className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {totalMarks || 0} {scoreLabel}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Live from the Floating Numbers page — changes there update here instantly.
                  {target === "assignment"
                    ? ` Shown as 0 / ${totalMarks || 0} ${scoreLabel} on the student card.`
                    : " This is the mark total for this Adventure question."}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                {target === "assignment" ? (
                  "Students receive the question and floating chips only — the solution and marking key stay hidden."
                ) : (
                  <>Adds this question to each selected class's <span className="font-medium text-foreground">Adventures</span>. Link it to a progress bar from there.</>
                )}
              </p>
              </>
              )}
            </div>
          )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button onClick={apply} disabled={busy || loading || changeCount === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Users className="h-4 w-4 mr-1.5" />}
              {toUnassign.length > 0 && toAssign.length === 0
                ? `Unassign (${toUnassign.length})`
                : `Apply${changeCount > 0 ? ` (${changeCount})` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmUnassign} onOpenChange={(v) => { if (!v) setConfirmUnassign(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unassign from {confirmUnassign?.className}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the question from students in this class. Any progress they've already made is preserved — re-assigning restores it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep assigned</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnassignApply}>Yes, unassign</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default AssignDialog;
