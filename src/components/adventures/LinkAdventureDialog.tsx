// Teacher — link a Lesson Note card's assigned questions to a specific progress
// bar of a game, for one class.
import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, ChevronRight, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { compileQuestionSections } from "@/lib/assessments/createAssessment";
import {
  normalizeCanvas,
  adventureModeOf,
  type CanvasElement,
  type GameRow,
} from "@/lib/games/types";
import {
  BAR_OCCUPIED_MESSAGE,
  collectLinkableBars,
  loadBarAssignments,
  unassignBar,
  type BarAssignment,
} from "@/lib/adventures/barLinks";
import { useClassMemberIds } from "@/hooks/useClassMemberIds";
import { ensureAssignment } from "@/lib/assignments/instances";
import { activeSchoolOrgId } from "@/lib/accounts/workspaceScope";

export type LinkAdventureQuestion = { sectionId: string; label: string; marks: number; questionKey?: string | null };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classId: string;
  notebookId: string;
  noteTitle: string;
  questions: LinkAdventureQuestion[];
  onLinked?: () => void;
}

type Step = "game" | "bar" | "config";
type BarChoice = { sceneTitle: string; el: CanvasElement };
type BarGroup = { sceneId: string; label: string; hasTime: boolean; bars: BarChoice[] };

export function LinkAdventureDialog({ open, onOpenChange, classId, notebookId, noteTitle, questions, onLinked }: Props) {
  const [step, setStep] = useState<Step>("game");
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<GameRow[]>([]);
  const [gameId, setGameId] = useState<string>("");
  const [barGroups, setBarGroups] = useState<BarGroup[]>([]);
  const [isVideo, setIsVideo] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, BarAssignment>>({});
  const [unassigning, setUnassigning] = useState<string | null>(null);
  const [chosenBar, setChosenBar] = useState<BarChoice | null>(null);
  const [goalPct, setGoalPct] = useState<number>(90);
  const [defaultMarks, setDefaultMarks] = useState<number>(0);
  const [questionCount, setQuestionCount] = useState<number>(0);
  const [scoreLabel, setScoreLabel] = useState<string>("Marks");
  const [busy, setBusy] = useState(false);

  const { count: studentCount } = useClassMemberIds(open ? classId : null);

  const lbl = scoreLabel;
  const lblLower = lbl.toLowerCase();
  const sectionKey = useMemo(() => questions.map((q) => q.sectionId).join("|"), [questions]);
  const sectionIds = useMemo(() => questions.map((q) => q.sectionId).filter(Boolean), [sectionKey]);
  const listedMarksTotal = useMemo(() => questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0), [questions]);
  const totalMarks = defaultMarks || listedMarksTotal;

  useEffect(() => {
    if (!open) return;
    setGameId(""); setBarGroups([]); setIsVideo(false); setAssignments({}); setChosenBar(null); setStep("game"); setLoading(true);
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const [{ data: gs }, { data: nb }] = await Promise.all([
        supabase.from("games").select("*").eq("owner_id", uid ?? "").order("updated_at", { ascending: false }),
        supabase.from("notebooks").select("score_label").eq("id", notebookId).maybeSingle(),
      ]);
      setGames((gs ?? []) as unknown as GameRow[]);
      const nbLabel = ((nb as any)?.score_label ?? "").toString().trim() || "Marks";
      setScoreLabel(nbLabel);
      setLoading(false);
    })();
  }, [open, notebookId]);

  useEffect(() => {
    if (!open || sectionIds.length === 0) { setDefaultMarks(0); setQuestionCount(0); return; }
    (async () => {
      try {
        const compiled = await compileQuestionSections(sectionIds);
        setDefaultMarks(compiled.total);
        setQuestionCount(compiled.questions.length);
      } catch { setDefaultMarks(0); setQuestionCount(0); }
    })();
  }, [open, sectionIds]);

  const pickGame = async (g: GameRow) => {
    const canvas = normalizeCanvas(g.canvas);
    setGameId(g.id);
    setIsVideo(adventureModeOf(canvas) === "video");
    // Progress Bars live INSIDE Learning Points, so we walk every Learning Point
    // in play order and collect its bars. The reserved Time Progress Bar of each
    // Learning Point is skipped — it never carries questions. Groups with no
    // linkable bar are still listed so the structure stays visible.
    setBarGroups(
      collectLinkableBars(canvas).map((grp) => ({
        sceneId: grp.sceneId,
        label: grp.label,
        hasTime: grp.hasTime,
        bars: grp.bars.map((el) => ({ sceneTitle: grp.label, el })),
      })),
    );
    setAssignments(await loadBarAssignments(classId, g.id));
    setStep("bar");
  };


  const pickBar = (b: BarChoice) => {
    const taken = assignments[b.el.id];
    // One Progress Bar → one Lesson Note.
    if (taken && taken.notebookId !== notebookId) {
      toast({ title: "Progress Bar already assigned", description: BAR_OCCUPIED_MESSAGE, variant: "destructive" });
      return;
    }
    setChosenBar(b);
    const existingGoal = Number(b.el.progress?.progressGoalPct);
    setGoalPct(Number.isFinite(existingGoal) && existingGoal > 0 ? Math.min(100, Math.max(1, existingGoal)) : 90);
    setStep("config");
  };

  const doUnassign = async (barId: string) => {
    const taken = assignments[barId];
    if (!taken || !gameId) return;
    setUnassigning(barId);
    try {
      await unassignBar(taken);
      setAssignments(await loadBarAssignments(classId, gameId));
      onLinked?.();
      toast({ title: "Lesson Note unassigned", description: "This Progress Bar is free again." });
    } catch (e: any) {
      toast({ title: "Could not unassign", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setUnassigning(null);
    }
  };

  const chosenGame = useMemo(() => games.find((g) => g.id === gameId), [games, gameId]);
  const noun = isVideo ? "Learning Point" : "Scene";
  const totalLinkable = useMemo(() => barGroups.reduce((n, g) => n + g.bars.length, 0), [barGroups]);
  const missingBarLabels = useMemo(
    () => barGroups.filter((g) => g.bars.length === 0).map((g) => g.label).join(", "),
    [barGroups],
  );
  const noTimeLabels = useMemo(
    () => (isVideo ? barGroups.filter((g) => !g.hasTime).map((g) => g.label).join(", ") : ""),
    [barGroups, isVideo],
  );
  const segments = Math.max(1, Number(chosenBar?.el.progress?.segments) || 10);
  const grandTotal = totalMarks * studentCount;
  const requiredScore = Math.max(1, Math.round(grandTotal * (goalPct / 100)));
  const perSlot = requiredScore / segments;
  const perSlotLabel = Number.isInteger(perSlot) ? String(perSlot) : perSlot.toFixed(1);

  const saveLink = async () => {
    if (!classId || !gameId || sectionIds.length === 0 || !chosenBar) return;
    if (!(totalMarks > 0)) {
      toast({ title: "Lesson has no marks", description: "Add floating-number marks in the lesson note first.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const barElementId = chosenBar.el.id;
    const barLabel = chosenBar.el.label || "Progress Bar";
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("not_authenticated");

      const compiled = await compileQuestionSections(sectionIds);
      if (compiled.questions.length === 0) throw new Error("no_questions");
      const questionKeys = questions.map((q) => q.questionKey).filter(Boolean) as string[];

      // The (Lesson Note + Class + Adventure) triple IS the assignment instance.
      const { assignment } = await ensureAssignment({
        classId,
        notebookId,
        gameId,
        mode: "adventure",
        questionKeys,
        title: `${chosenGame?.title ?? "Adventure"} — ${barLabel}`,
      });

      const { data: existing } = await supabase
        .from("class_game_boards")
        .select("id, assessment_id")
        .eq("class_id", classId).eq("game_id", gameId).eq("progress_element_id", barElementId)
        .maybeSingle();

      // UPDATE IN PLACE — never delete + recreate, so a re-link can't produce a
      // second assessment (the source of duplicated questions).
      let assessmentId = (existing as any)?.assessment_id as string | undefined;
      if (assessmentId) {
        const { error: updErr } = await supabase
          .from("assessments")
          .update({
            notebook_id: notebookId,
            title: `${chosenGame?.title ?? "Adventure"} — ${barLabel}`,
            score_label: lbl,
            total_marks: compiled.total,
            questions: compiled.questions as never,
            unassigned_at: null,
            assignment_id: assignment.id,
          } as never)
          .eq("id", assessmentId);
        if (updErr) throw new Error(updErr.message);
        await supabase.from("assessment_answer_keys").delete().eq("assessment_id", assessmentId);
        await supabase
          .from("assessment_answer_keys")
          .insert({ assessment_id: assessmentId, lines: compiled.answerKey as never } as never);
        await supabase
          .from("class_game_boards")
          .update({
            notebook_id: notebookId,
            section_id: null,
            question_keys: questionKeys as never,
            required_marks: compiled.total,
            assignment_id: assignment.id,
          } as never)
          .eq("id", (existing as any).id);
      } else {
        const { data: created, error: insErr } = await supabase
          .from("assessments")
          .insert({
            class_id: classId, owner_id: uid, notebook_id: notebookId, section_id: null,
            kind: "adventure" as never, title: `${chosenGame?.title ?? "Adventure"} — ${barLabel}`,
            score_label: lbl, total_marks: compiled.total, questions: compiled.questions as never,
            assignment_id: assignment.id,
          } as never)
          .select("id").single();
        if (insErr || !created) throw new Error(insErr?.message ?? "create_failed");
        assessmentId = (created as any).id as string;

        const { error: keyErr } = await supabase
          .from("assessment_answer_keys")
          .insert({ assessment_id: assessmentId, lines: compiled.answerKey as never } as never);
        if (keyErr) {
          await supabase.from("assessments").delete().eq("id", assessmentId);
          throw new Error(keyErr.message);
        }

        const { error: boardErr } = await supabase
          .from("class_game_boards")
          .insert({
            class_id: classId, game_id: gameId, progress_element_id: barElementId,
            assessment_id: assessmentId, notebook_id: notebookId, section_id: null,
            question_keys: questionKeys as never,
            required_marks: compiled.total,
            assignment_id: assignment.id,
          } as never);
        if (boardErr) {
          await supabase.from("assessments").delete().eq("id", assessmentId);
          throw new Error(boardErr.message);
        }
      }



      if (chosenGame) {
        const canvas = normalizeCanvas(chosenGame.canvas);
        for (const s of canvas.scenes) for (const el of s.elements) {
          if (el.id === barElementId && el.progress) el.progress = { ...el.progress, progressGoalPct: goalPct };
        }
        await supabase.from("games").update({ canvas: canvas as never } as never).eq("id", gameId);
      }

      toast({ title: "Adventure linked", description: `${chosenGame?.title} · ${barLabel} · ${goalPct}%` });
      onLinked?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not link", description: e?.message === "no_questions" ? "This lesson note has no questions with floating-number lines." : String(e?.message ?? e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Link to Adventure</DialogTitle>
        </DialogHeader>

        <div className="pb-1 text-xs text-muted-foreground">
          Lesson note: <span className="font-medium text-foreground">{noteTitle}</span>
          {!loading && sectionIds.length > 0 && (<span className="ml-2">· {questionCount} question{questionCount === 1 ? "" : "s"} · {(listedMarksTotal || defaultMarks)} {lblLower} total</span>)}
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…</div>
        ) : step === "game" ? (
          games.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No Adventure Games Created Yet.</div>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto">
              {games.map((g) => (
                <li key={g.id}>
                  <button type="button" disabled={questions.length === 0} onClick={() => pickGame(g)} className="flex w-full items-center justify-between rounded-md border border-input px-3 py-2 text-left text-sm hover:border-primary/50 hover:bg-accent/50 disabled:opacity-50">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{g.title}</div>
                      {g.subtopic && <div className="truncate text-xs text-muted-foreground">{g.subtopic}</div>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : step === "bar" ? (
          <>
            <div className="mb-2 text-xs text-muted-foreground">Game: <span className="font-medium text-foreground">{chosenGame?.title}</span></div>
            {totalLinkable === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {barGroups.length === 0
                  ? `This adventure has no ${noun}s yet — add one in the editor.`
                  : `Every ${noun} only has its reserved Time Progress Bar. Add a second Progress Bar in ${missingBarLabels || `each ${noun}`} to link a Lesson Note.`}
              </div>
            ) : (
              <div className="max-h-80 space-y-3 overflow-y-auto">
                {noTimeLabels && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-foreground">
                    No time set yet for {noTimeLabels}. You can link Lesson Notes now — a duration is only required before publishing.
                  </div>
                )}
                {barGroups.map((grp) => (
                  <div key={grp.sceneId}>
                    <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>{grp.label}</span>
                      {!grp.hasTime && <span className="text-amber-600 normal-case">No time set</span>}
                    </div>
                    {grp.bars.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
                        Only the reserved Time Progress Bar here — add another Progress Bar in the editor to link a Lesson Note.
                      </div>
                    ) : (
                    <ul className="space-y-1.5">

                      {grp.bars.map((b, i) => {
                        const segs = Math.max(1, Number(b.el.progress?.segments) || 10);
                        const taken = assignments[b.el.id];
                        const blocked = !!taken && taken.notebookId !== notebookId;
                        return (
                          <li key={b.el.id} className={`rounded-md border px-3 py-2 text-sm ${blocked ? "border-border/60 bg-muted/20" : "border-input"}`}>
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                disabled={busy || blocked}
                                onClick={() => pickBar(b)}
                                className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left disabled:cursor-not-allowed"
                              >
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{b.el.label || `Progress Bar ${i + 2}`}</div>
                                  <div className="truncate text-xs text-muted-foreground">
                                    {taken
                                      ? `${taken.notebookTitle}${taken.questionCount ? ` · ${taken.questionCount} question${taken.questionCount === 1 ? "" : "s"}` : ""}`
                                      : `Empty · ${segs} slots`}
                                  </div>
                                </div>
                                {!blocked && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                              </button>
                              {taken && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={unassigning === b.el.id || busy}
                                  onClick={() => doUnassign(b.el.id)}
                                >
                                  {unassigning === b.el.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Unassign"}
                                </Button>
                              )}
                            </div>
                            {blocked && (
                              <div className="mt-1 text-[11px] text-muted-foreground">{BAR_OCCUPIED_MESSAGE}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    )}

                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs">
              <RowKV k="Lesson Note" v={noteTitle} />
              <RowKV k="Assigned Questions" v={String(questionCount)} />
              <RowKV k={`Total ${lbl}`} v={String(totalMarks)} />
              <RowKV k="Number of Students" v={String(studentCount)} />
              <RowKV k={`Grand Total ${lbl}`} v={String(grandTotal)} hint={`${totalMarks} × ${studentCount}`} />
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-3">
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">Progress Goal (%)</label>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={100} value={goalPct} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setGoalPct(Math.min(100, Math.max(1, Math.round(v)))); }} className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm tabular-nums" />
                <span className="text-xs text-muted-foreground">of Grand Total required.</span>
              </div>
            </div>
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-xs">
              <RowKV k={`Required Progress ${lbl}`} v={<span className="font-semibold text-primary">{requiredScore}</span>} />
              <RowKV k="Progress Bar" v={<span className="font-semibold text-primary">{segments} slots · {perSlotLabel} {lblLower}/slot</span>} />
            </div>
          </div>
        )}

        <DialogFooter className="mt-2">
          {step === "bar" && (
            <Button variant="ghost" onClick={() => setStep("game")} disabled={busy}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Button>
          )}
          {step === "config" && (
            <>
              <Button variant="ghost" onClick={() => setStep("bar")} disabled={busy}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Button>
              <Button onClick={saveLink} disabled={busy || !(totalMarks > 0)}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Link Adventure</Button>
            </>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RowKV({ k, v, hint }: { k: string; v: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-0.5">
      <div className="min-w-0">
        <div className="text-foreground">{k}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="shrink-0 tabular-nums">{v}</div>
    </div>
  );
}

export default LinkAdventureDialog;
