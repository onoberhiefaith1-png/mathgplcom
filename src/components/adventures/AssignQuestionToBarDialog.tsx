// Teacher — ASSIGN ONE QUESTION TO A PROGRESS BAR.
//
//     Question  →  Class  →  Linked Adventure  →  Progress Bar
//
// The class is the gateway. A class with no linked adventure is told so and
// offered Link Adventure — a question is never silently attached to anything.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Loader2, Sparkles, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { normalizeCanvas } from "@/lib/games/types";
import { collectLinkableBars, loadBarCards, type LinkableBarGroup, type BarCard } from "@/lib/adventures/barLinks";
import { listClassAdventures, type LinkedAdventure } from "@/lib/adventures/classAdventureLinks";
import { assignQuestionToBar, removeQuestionFromBar } from "@/lib/adventures/barQuestions";
import { LinkAdventureDialog } from "./LinkAdventureDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  notebookId: string;
  sectionId: string | null;
  questionKey: string | null;
  questionLabel: string;
  onChanged?: () => void;
}

type Step = "class" | "adventure" | "bar";
type ClassRow = { id: string; name: string };

export function AssignQuestionToBarDialog({
  open,
  onOpenChange,
  notebookId,
  sectionId,
  questionKey,
  questionLabel,
  onChanged,
}: Props) {
  const [step, setStep] = useState<Step>("class");
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classRow, setClassRow] = useState<ClassRow | null>(null);
  const [adventures, setAdventures] = useState<LinkedAdventure[]>([]);
  const [adventure, setAdventure] = useState<LinkedAdventure | null>(null);
  const [groups, setGroups] = useState<LinkableBarGroup[]>([]);
  const [cards, setCards] = useState<Record<string, BarCard>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("class");
    setClassRow(null);
    setAdventure(null);
    setLoading(true);
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("classes")
        .select("id, name")
        .eq("owner_id", userData.user?.id ?? "")
        .order("created_at", { ascending: true });
      setClasses(((data ?? []) as any[]).map((r) => ({ id: r.id as string, name: (r.name as string) || "Class" })));
      setLoading(false);
    })();
  }, [open]);

  const loadAdventures = useCallback(async (cls: ClassRow) => {
    setLoading(true);
    const rows = await listClassAdventures(cls.id);
    setAdventures(rows);
    setLoading(false);
  }, []);

  const loadBars = useCallback(async (cls: ClassRow, adv: LinkedAdventure) => {
    setLoading(true);
    const { data: game } = await supabase.from("games").select("canvas").eq("id", adv.gameId).maybeSingle();
    setGroups(collectLinkableBars(normalizeCanvas((game as any)?.canvas)));
    setCards(await loadBarCards(cls.id, adv.gameId));
    setLoading(false);
  }, []);

  const pickClass = async (c: ClassRow) => {
    setClassRow(c);
    setStep("adventure");
    await loadAdventures(c);
  };

  const pickAdventure = async (a: LinkedAdventure) => {
    setAdventure(a);
    setStep("bar");
    if (classRow) await loadBars(classRow, a);
  };

  const placedOnBar = (barId: string) => {
    const card = cards[barId];
    if (!card) return false;
    return card.questions.some((q) =>
      questionKey ? q.questionKey === questionKey : q.sectionId === sectionId,
    );
  };

  const toggleBar = async (barId: string, barLabel: string) => {
    if (!classRow || !adventure || !sectionId) return;
    setBusy(barId);
    try {
      if (placedOnBar(barId)) {
        await removeQuestionFromBar({
          classId: classRow.id,
          gameId: adventure.gameId,
          barId,
          notebookId,
          questionKey,
          sectionId,
        });
        toast({ title: "Removed", description: `${questionLabel} left ${barLabel}.` });
      } else {
        await assignQuestionToBar({
          classId: classRow.id,
          gameId: adventure.gameId,
          barId,
          notebookId,
          sectionId,
          questionKey,
          barLabel,
          adventureTitle: adventure.title,
        });
        toast({ title: "Assigned", description: `${questionLabel} → ${adventure.title} · ${barLabel}` });
      }
      setCards(await loadBarCards(classRow.id, adventure.gameId));
      onChanged?.();
    } catch (e: any) {
      toast({
        title: "Could not update",
        description:
          e?.message === "no_questions"
            ? "This question has no floating-number lines yet."
             : e?.message === "adventure_not_linked"
               ? "Link this Adventure to the class before assigning questions."
            : String(e?.message ?? e),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const totalBars = useMemo(() => groups.reduce((n, g) => n + g.bars.length, 0), [groups]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Assign to Adventure
            </DialogTitle>
          </DialogHeader>

          <div className="pb-1 text-xs text-muted-foreground">
            Question: <span className="font-medium text-foreground">{questionLabel}</span>
            {classRow && <span> · {classRow.name}</span>}
            {adventure && <span> · {adventure.title}</span>}
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : step === "class" ? (
            classes.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                You have no classes yet. Create a class first.
              </div>
            ) : (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {classes.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pickClass(c)}
                      className="flex w-full items-center justify-between rounded-md border border-input px-3 py-2 text-left text-sm hover:border-primary/50 hover:bg-accent/50"
                    >
                      <span className="truncate font-medium">{c.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : step === "adventure" ? (
            adventures.length === 0 ? (
              <div className="space-y-3 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                <div>No Adventure linked to this class yet.</div>
                <Button size="sm" onClick={() => setLinkOpen(true)}>
                  Link Adventure
                </Button>
              </div>
            ) : (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {adventures.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => pickAdventure(a)}
                      className="flex w-full items-center justify-between rounded-md border border-input px-3 py-2 text-left text-sm hover:border-primary/50 hover:bg-accent/50"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{a.title}</div>
                        {a.subtopic && <div className="truncate text-xs text-muted-foreground">{a.subtopic}</div>}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : totalBars === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              This adventure has no progress bars that can carry questions yet — add one in the editor.
            </div>
          ) : (
            <div className="max-h-80 space-y-3 overflow-y-auto">
              {groups.map((grp) => (
                <div key={grp.sceneId}>
                  <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{grp.label}</div>
                  {grp.bars.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
                      Only the reserved Time Progress Bar here.
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {grp.bars.map((bar, i) => {
                        const label = bar.label || `Progress Bar ${i + 2}`;
                        const card = cards[bar.id];
                        const on = placedOnBar(bar.id);
                        return (
                          <li key={bar.id}>
                            <button
                              type="button"
                              disabled={busy === bar.id || !sectionId}
                              onClick={() => toggleBar(bar.id, label)}
                              className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                                on ? "border-primary bg-primary/10" : "border-input hover:border-primary/40"
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium">{label}</div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {card && card.questions.length > 0
                                    ? `${card.questions.length} question${card.questions.length === 1 ? "" : "s"}${
                                        card.noteTitles.length ? ` · ${card.noteTitles.join(", ")}` : ""
                                      }`
                                    : "Empty"}
                                </div>
                              </div>
                              {busy === bar.id ? (
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                              ) : on ? (
                                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-primary">
                                  <Check className="h-3.5 w-3.5" /> On this bar
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="mt-2">
            {step !== "class" && (
              <Button
                variant="ghost"
                onClick={() => (step === "bar" ? setStep("adventure") : setStep("class"))}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {classRow && (
        <LinkAdventureDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          classId={classRow.id}
          onLinked={() => void loadAdventures(classRow)}
        />
      )}
    </>
  );
}

export default AssignQuestionToBarDialog;
