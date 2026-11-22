import { startLessonWorkflow } from "@/lib/diagnostics/lessonWorkflow";
// Compact "Assign to Students" dialog. Opened from the 👥 icon on a Solution
// heading. Supports two targets — Assignment (student solves on the smartboard
// directly) and Adventure (student solves inside a game).
//
// Assignment is a per-question TOGGLE: ticking an assigned class opens a
// confirmation before soft-unassigning. Student progress is preserved so a
// mistaken un-tick can be reversed without data loss.

import { useTableChanges } from "@/lib/stability/useTableChanges";
import { useEffect, useMemo, useRef, useState } from "react";
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
import AcademiaAssignPicker from "./AcademiaAssignPicker";
import McqAssignPicker from "./McqAssignPicker";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import AssignQuestionToBarDialog from "@/components/adventures/AssignQuestionToBarDialog";
import { toast } from "@/hooks/use-toast";
import { type AssessmentKind } from "@/lib/assessments/createAssessment";
import { totalMarks as computeTotalMarks, type FloatingLine } from "@/lib/lessonnotes/floatingCompile";
import {
  resolveQuestionRef,
  loadAssignmentState,
  assignAssessmentQuestion,
  unassignAssessmentQuestion,
  type QuestionRef,
} from "@/lib/assignments/pipeline";
import { afterLessonActionPaint, loadLessonAction } from "@/lib/lessonnotes/lessonAction";
import { listGames } from "@/lib/slate/storage";
import type { Game } from "@/lib/slate/types";
import { listGameQuestions, assignQuestion } from "@/lib/slate/gameQuestions";
import {
  assignGameToClass, loadGameAssignmentState, unassignGame,
} from "@/lib/slate/gameAssignments";

type AssignTarget = "academia" | "assignment" | "game" | "adventure" | "course" | "mcq";
type ClassRow = {
  id: string;
  name: string;
  /** Existing active assignment id (assignment target) if any. */
  assignmentId: string | null;
  /** Existing active Game assignment id for the chosen Game, if any. */
  gameAssignmentId: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subsectionId: string | null;
  prepare?: (signal: AbortSignal) => Promise<string | null>;
  notebookId: string;
  defaultTitle: string;
}

const KIND_OPTIONS: { value: AssessmentKind; label: string }[] = [
  { value: "classwork", label: "Classwork" },
  { value: "homework", label: "Homework" },
  { value: "assessment", label: "Assessment" },
  { value: "practice", label: "Practice" },
];

export function AssignDialog({ open, onOpenChange, subsectionId: providedId, notebookId, defaultTitle, prepare }: Props) {
  const [preparedId, setPreparedId] = useState<string | null>(null);
  const subsectionId = prepare ? preparedId : providedId;
  const prepareRef = useRef(prepare);
  prepareRef.current = prepare;
  const { active: activeWorkspace } = useWorkspace();
  // Shared (school) Workspace: Academia first, no Courses. Personal: unchanged.
  const sharedWorkspace = activeWorkspace?.kind === "school" && !activeWorkspace.isOwner;
  const [target, setTarget] = useState<AssignTarget>(sharedWorkspace ? "academia" : "assignment");
  const usesClassOptions = target !== "academia";
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    if (open) setTarget(sharedWorkspace ? "academia" : "assignment");
  }, [open, sharedWorkspace]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initiallySelected, setInitiallySelected] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<AssessmentKind>("classwork");
  const [title, setTitle] = useState(defaultTitle);
  const [scoreLabel, setScoreLabel] = useState("Marks");
  const [totalMarks, setTotalMarks] = useState<number>(0);
  const [questionRef, setQuestionRef] = useState<QuestionRef>({ subsectionId: null, sectionId: null, questionKey: null });
  const [loading, setLoading] = useState(open);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState<{ classId: string; className: string } | null>(null);
  /** Adventure target — question → class → linked adventure → progress bar. */
  const [barPickerOpen, setBarPickerOpen] = useState(false);
  /* ── Game target ─────────────────────────────────────────────────────────
     A Game is a container: this question is added to an existing Game, and the
     Game itself is what the class receives. */
  const [games, setGames] = useState<Game[]>([]);
  const [gameId, setGameId] = useState<string>("");
  const [passPercentage, setPassPercentage] = useState<number>(100);
  const [gameStats, setGameStats] = useState<{ count: number; marks: number; hasThis: boolean }>({
    count: 0, marks: 0, hasThis: false,
  });

  // Teacher's own Games — never re-authored here, only chosen.
  useEffect(() => {
    if (!open || target !== "game") return;
    let alive = true;
    void listGames().then((list) => {
      if (!alive) return;
      setGames(list);
      setGameId((prev) => (prev && list.some((g) => g.id === prev) ? prev : list[0]?.id ?? ""));
    }).catch(() => { if (alive) toast({ title: "Could not load Games", variant: "destructive" }); });
    return () => { alive = false; };
  }, [open, target]);

  // Live Game facts + which classes already have this Game.
  useEffect(() => {
    if (!open || target !== "game" || !gameId) {
      if (target === "game") setGameStats({ count: 0, marks: 0, hasThis: false });
      return;
    }
    let alive = true;
    (async () => {
      const byClass = await loadGameAssignmentState(gameId);
      if (!alive) return;
      // Questions are scoped per Class + Game: read each assigned class's own
      // Levels, not the legacy unscoped pool.
      const classIds = Array.from(byClass.keys());
      const perClass = classIds.length
        ? await Promise.all(classIds.map((cid) => listGameQuestions(gameId, cid)))
        : [await listGameQuestions(gameId)];
      if (!alive) return;
      const questions = perClass.reduce((a, b) => (b.length > a.length ? b : a), perClass[0] ?? []);
      setGameStats({
        count: questions.length,
        marks: questions.reduce((sum, q) => sum + q.totalMarks, 0),
        hasThis: subsectionId && classIds.length
          ? perClass.every((qs) => qs.some((q) => q.subsectionId === subsectionId))
          : false,
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
    })().catch(() => { if (alive) toast({ title: "Could not load Game assignments", variant: "destructive" }); });
    return () => { alive = false; };
  }, [open, target, gameId, subsectionId]);


  useEffect(() => {
    if (!open || !usesClassOptions) return;
    const controller = new AbortController();
    const end = startLessonWorkflow("assign.options", sharedWorkspace ? "school" : "personal");
    setLoading(true);
    setLoadError("");
    const cancelPaint = afterLessonActionPaint(() => {
      void loadLessonAction(async (signal) => {
        const idRequest = prepareRef.current ? prepareRef.current(signal) : Promise.resolve(providedId);
        const classRequest = supabase.auth.getUser().then(async ({ data, error }) => {
          if (error || !data.user) throw new Error("Sign in to load your classes.");
          signal.throwIfAborted();
          const { data: rows, error: classesError } = await supabase.from("classes").select("id, name")
            .eq("owner_id", data.user.id).order("created_at", { ascending: true }).abortSignal(signal);
          if (classesError) throw new Error(classesError.message);
          return rows ?? [];
        });
        const noteRequest = notebookId ? supabase.from("notebooks").select("subtopic, title, score_label")
          .eq("id", notebookId).abortSignal(signal).maybeSingle() : undefined;
        const [id, rows, note] = await Promise.all([idRequest, classRequest, noteRequest]);
        if (!id) throw new Error("This question is still being saved. Retry to open assignment options.");
        const [assignment, linesResult] = await Promise.all([
          resolveQuestionRef(id).then((ref) => loadAssignmentState(notebookId, ref).then((state) => ({ ref, ...state }))),
          supabase.from("notebook_subsections").select("floating_lines").eq("id", id).abortSignal(signal).maybeSingle(),
        ]);
        if (note?.error || linesResult.error) throw new Error(note?.error?.message ?? linesResult.error?.message);
        signal.throwIfAborted();
        return { id, rows, note: note?.data, assignment, lines: linesResult.data?.floating_lines };
      }, controller.signal).then(({ id, rows, note, assignment, lines }) => {
        if (controller.signal.aborted) return;
        const enriched = rows.map((row) => ({
          id: row.id, name: row.name ?? "Class", assignmentId: assignment.assignmentByClass.get(row.id) ?? null,
          gameAssignmentId: null,
        }));
        const preSelected = new Set(targetRef.current === "assignment"
          ? enriched.filter((row) => row.assignmentId).map((row) => row.id) : []);
        setPreparedId(id);
        setQuestionRef(assignment.ref);
        setClasses(enriched);
        setSelected(new Set(preSelected));
        setInitiallySelected(new Set(preSelected));
        setTitle(defaultTitle || note?.subtopic || note?.title || "Assignment");
        setScoreLabel(note?.score_label?.trim() || "Marks");
        setTotalMarks(computeTotalMarks((lines ?? []) as unknown as FloatingLine[]));
        setLoading(false);
        end();
      }).catch((error) => {
        if (controller.signal.aborted) return;
        end({ error });
        const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
        setLoadError(message || "Could not load assignment options.");
        setLoading(false);
      });
    });
    return () => { cancelPaint(); controller.abort(); };
  }, [open, usesClassOptions, defaultTitle, providedId, notebookId, retry, sharedWorkspace]);

  // Live sync: while the dialog is open, keep Total marks in lockstep with the
  // Floating Numbers page. Any edit there triggers a postgres_changes UPDATE on
  // the subsection row, and we recompute the total from the new floating_lines.
  useTableChanges({
    name: `assign-dialog-fl-${subsectionId}`,
    enabled: !!open && !!subsectionId,
    watch: [{ table: "notebook_subsections", event: "UPDATE", filter: `id=eq.${subsectionId}` }],
    onChange: (payload) => {
      const lines = (((payload?.new as any)?.floating_lines) ?? []) as FloatingLine[];
      setTotalMarks(computeTotalMarks(lines));
    },
    // After a reconnect there is no payload, so read the row itself.
    onResync: () => {
      void supabase
        .from("notebook_subsections")
        .select("floating_lines")
        .eq("id", subsectionId as string)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setTotalMarks(computeTotalMarks(((data.floating_lines ?? []) as unknown) as FloatingLine[]));
        });
    },
  });

  const toggle = (row: ClassRow) => {
    const currentlyOn = selected.has(row.id);
    const wasAlreadyAssigned = target === "game" ? !!row.gameAssignmentId : !!row.assignmentId;

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

  // Adding the question to the Game is a change in its own right, even when no
  // class selection moved — the Game is the container the question joins.
  const joinsGame =
    target === "game" && !!gameId && !!subsectionId && !!notebookId && !gameStats.hasThis;

  const apply = async () => {
    if (toAssign.length === 0 && toUnassign.length === 0 && !joinsGame) {
      toast({ title: "No changes", variant: "destructive" });
      return;
    }
    setBusy(true);
    const end = startLessonWorkflow("assign.submit", sharedWorkspace ? "school" : "personal");
    try {
      const errors: string[] = [];
      let firstError: unknown;
      const recordFailure = (className: string, error: unknown) => {
        if (!errors.length) firstError = error;
        const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Could not save.";
        errors.push(`${className}: ${message}`);
      };
      const unassignedIds = new Set<string>();

      // ---- Unassign side (soft — the card leaves the dashboard) ----
      for (const c of toUnassign) {
        try {
          if (target === "assignment" && c.assignmentId) {
            await unassignAssessmentQuestion(c.assignmentId);
          } else if (target === "game" && c.gameAssignmentId) {
            await unassignGame(c.gameAssignmentId);
          }
          unassignedIds.add(c.id);
        } catch (error) {
          recordFailure(c.name, error);
        }
      }

      // ---- Assign side (idempotent — revives the same row) ----
      let ok = 0;
      const assignedIds = new Map<string, string>();

      for (const c of toAssign) {
        try {
          if (target === "game") {
            if (!gameId) throw new Error("no_game");
            const id = await assignGameToClass({
              classId: c.id,
              gameId,
              passPercentage,
              title: games.find((g) => g.id === gameId)?.name ?? null,
            });
            // CLASS + GAME is the playable instance, so the question joins
            // THIS class's collection. SS1's questions never reach SS2.
            if (joinsGame) {
              const joined = await assignQuestion(gameId, notebookId, subsectionId, c.id);
              if (!joined) throw new Error("This question could not be added to the Game.");
              setGameStats((prev) => ({ ...prev, hasThis: true, count: prev.count + 1 }));
            }
            assignedIds.set(c.id, id);
            ok += 1;
            continue;
          }
          if (!notebookId || !questionRef.sectionId) throw new Error("no_question");
          const id = await assignAssessmentQuestion({
                classId: c.id,
                notebookId,
                ref: questionRef,
                kind,
                title: title.trim() || defaultTitle,
                scoreLabel,
              });
          assignedIds.set(c.id, id);
          ok += 1;
        } catch (e: any) {
          recordFailure(c.name, e);
        }
      }

      // Classes that already hold this Game still receive the new question as
      // their next Level — they are never in toAssign.
      if (target === "game" && joinsGame && gameId) {
        const unassigning = new Set(toUnassign.map((c) => c.id));
        for (const c of classes) {
          if (!initiallySelected.has(c.id) || !selected.has(c.id) || unassigning.has(c.id)) continue;
          try {
            const joined = await assignQuestion(gameId, notebookId, subsectionId, c.id);
            if (!joined) throw new Error("This question could not be added to the Game.");
            ok += 1;
          } catch (e: any) {
            recordFailure(c.name, e);
          }
        }
        if (ok > 0) setGameStats((prev) => ({ ...prev, hasThis: true, count: prev.count + 1 }));
      }


      if (ok > 0 || unassignedIds.size > 0) {
        const field = target === "assignment"
          ? "assignmentId" as const
          : target === "game"
            ? "gameAssignmentId" as const
            : "assignmentId" as const;
        setClasses((prev) => prev.map((c) => {
          if (unassignedIds.has(c.id)) return { ...c, [field]: null };
          const assignedId = assignedIds.get(c.id);
          if (!assignedId) return c;
          return { ...c, [field]: assignedId };
        }));
        setInitiallySelected((previous) => {
          const next = new Set(previous);
          for (const id of unassignedIds) next.delete(id);
          for (const id of assignedIds.keys()) next.add(id);
          return next;
        });
      }


      const parts: string[] = [];
      if (joinsGame && ok > 0) parts.push("Added to the Game");
      if (ok > 0) parts.push(`Assigned to ${ok}`);
      if (unassignedIds.size > 0) parts.push(`Unassigned ${unassignedIds.size}`);
      end(errors.length ? { error: firstError } : undefined);
      toast({
        title: parts.length ? parts.join(" · ") : "Nothing changed",
        description: errors.length ? errors.join(" • ") : undefined,
        variant: parts.length ? undefined : "destructive",
      });
      if (parts.length && !errors.length) onOpenChange(false);
    } catch (e: any) {
      end({ error: e });
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

  const changeCount = toAssign.length + toUnassign.length + (joinsGame ? 1 : 0);

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
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Assign to</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(sharedWorkspace
                    ? ([
                        { value: "academia", label: "Academia", hint: "Into a Session" },
                        { value: "mcq", label: "MCQ", hint: "Multiple-choice paper" },
                        { value: "assignment", label: "Assignment", hint: "Solve on the smartboard" },
                        { value: "game", label: "Game", hint: "Play on a Game slate" },
                        { value: "adventure", label: "Adventure", hint: "Play inside a game" },
                      ] as const)
                    : ([
                        { value: "assignment", label: "Assignment", hint: "Solve on the smartboard" },
                        { value: "game", label: "Game", hint: "Play on a Game slate" },
                        { value: "adventure", label: "Adventure", hint: "Play inside a game" },
                        { value: "course", label: "Course", hint: "Add to an Exercise Card" },
                        { value: "mcq", label: "MCQ", hint: "Multiple-choice paper" },
                      ] as const)
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        if (opt.value === target) return;
                        setTarget(opt.value);
                        const baseline = opt.value === "assignment"
                          ? new Set(classes.filter((row) => row.assignmentId).map((row) => row.id))
                          : new Set<string>();
                        setSelected(baseline);
                        setInitiallySelected(new Set(baseline));
                      }}
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

              {target === "academia" ? (
                <AcademiaAssignPicker
                  notebookId={notebookId}
                  subsectionId={providedId}
                  prepare={prepare}
                  title={defaultTitle}
                  orgId={activeWorkspace?.orgId ?? null}
                  onDone={() => onOpenChange(false)}
                />
              ) : loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading saved assignment options…
                </div>
              ) : loadError ? (
                <div className="space-y-3 py-6 text-sm" role="status">
                  <p>{loadError}</p>
                  <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>Retry</Button>
                </div>
              ) : target === "mcq" ? (
                <McqAssignPicker
                  notebookId={notebookId}
                  subsectionId={subsectionId}
                  defaultTitle={title || defaultTitle}
                  orgId={activeWorkspace?.orgId ?? null}
                  onDone={() => onOpenChange(false)}
                />
              ) : target === "course" ? (
                <AddToCoursePicker
                  notebookId={notebookId}
                  questionRef={questionRef}
                  label={title || defaultTitle}
                  totalMarks={totalMarks}
                  onDone={() => onOpenChange(false)}
                />
              ) : target === "adventure" ? (
                <div className="space-y-3 rounded-md border border-input p-4 text-sm">
                  <p className="text-muted-foreground">
                    An Adventure is reusable. Choose the class, the Adventure linked to it, and the
                    progress bar this question should sit on. One bar can hold questions from many
                    lesson notes, and the same question can sit on more than one bar.
                  </p>
                  <Button type="button" onClick={() => setBarPickerOpen(true)} disabled={!questionRef.sectionId}>
                    Choose Adventure &amp; Progress Bar
                  </Button>
                  {!questionRef.sectionId && (
                    <p className="text-[11px] text-muted-foreground">
                      This question has no saved content yet.
                    </p>
                  )}
                </div>
              ) : classes.length === 0 && target !== "game" ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  You have no classes yet. Create a class first, then assign.
                </div>
              ) : (
              <>


              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{target === "game" ? "Classes (optional)" : "Classes"}</Label>
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
                    const wasAssigned = target === "game" ? !!c.gameAssignmentId : !!c.assignmentId;
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

              {target === "game" ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Game</Label>
                    {games.length === 0 ? (
                      <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        You have no Games yet. Create one, or copy a template, then assign this question to it.
                      </div>
                    ) : (
                      <Select value={gameId} onValueChange={setGameId}>
                        <SelectTrigger><SelectValue placeholder="Choose a Game" /></SelectTrigger>
                        <SelectContent>
                          {games.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}{g.library ? " (template)" : ""}{g.subtopic ? ` — ${g.subtopic}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      A Game holds many questions. This question joins the Game
                      {gameStats.hasThis ? " — it is already part of it." : "."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Questions in this Game</Label>
                      <div className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        {gameStats.count + (gameStats.hasThis || !subsectionId ? 0 : 1)}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Total {scoreLabel.toLowerCase()}</Label>
                      <div className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        {gameStats.marks + (gameStats.hasThis ? 0 : totalMarks)} {scoreLabel}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Pass mark</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={passPercentage}
                        onChange={(e) =>
                          setPassPercentage(Math.min(100, Math.max(0, Math.floor(Number(e.target.value) || 0))))
                        }
                        className="w-20 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm tabular-nums"
                      />
                      <span className="text-sm text-muted-foreground">% of the Game total</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Students play the Game's questions in order. The mathematics, marks and
                    times come from Floating Numbers — the Game only supplies the slate and rewards.
                  </p>
                </>
              ) : (
                <>
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

              </>
              )}
            </div>
          </div>

          {target !== "adventure" && target !== "academia" && <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button onClick={apply} disabled={busy || loading || !!loadError || changeCount === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Users className="h-4 w-4 mr-1.5" />}
              {toUnassign.length > 0 && toAssign.length === 0
                ? `Unassign (${toUnassign.length})`
                : `Apply${changeCount > 0 ? ` (${changeCount})` : ""}`}
            </Button>
          </DialogFooter>}
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

      <AssignQuestionToBarDialog
        open={barPickerOpen}
        onOpenChange={setBarPickerOpen}
        notebookId={notebookId}
        sectionId={questionRef.sectionId}
        questionKey={questionRef.questionKey}
        questionLabel={title || defaultTitle}
      />
    </>
  );
}

export default AssignDialog;
