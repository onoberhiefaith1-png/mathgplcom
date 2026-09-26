import { useTableChanges } from "@/lib/stability/useTableChanges";
import { classRoot } from "@/lib/product/workspaceRoutes";
// Teacher — Adventures for a class.
//
// The class is the gateway. It LINKS reusable adventures; each adventure shows
// its progress bars, and each bar collects whichever questions were assigned to
// it from any lesson note. The grouping key is CLASS + ADVENTURE + BAR.

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Loader2, Sparkles, Gamepad2, Link2, X, LayoutDashboard, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import { LinkAdventureDialog } from "@/components/adventures/LinkAdventureDialog";
import { normalizeCanvas } from "@/lib/games/types";
import { collectLinkableBars, loadBarCards, clearBar, type BarCard, type LinkableBarGroup } from "@/lib/adventures/barLinks";
import {
  listClassAdventures,
  unlinkAdventure,
  type LinkedAdventure,
} from "@/lib/adventures/classAdventureLinks";
import { removeQuestionFromBar, setBarPassPct } from "@/lib/adventures/barQuestions";
import { GroupSetupPanel } from "@/components/adventures/GroupSetupPanel";

type AdventureView = {
  adventure: LinkedAdventure;
  groups: LinkableBarGroup[];
  cards: Record<string, BarCard>;
  noteTitleById: Record<string, string>;
};

const ClassAdventuresPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [views, setViews] = useState<AdventureView[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!classId) return;
    const adventures = await listClassAdventures(classId);
    const built = await Promise.all(
      adventures.map(async (adventure) => {
        const { data: game } = await supabase
          .from("games")
          .select("canvas")
          .eq("id", adventure.gameId)
          .maybeSingle();
        const groups = collectLinkableBars(normalizeCanvas((game as any)?.canvas));
        const cards = await loadBarCards(classId, adventure.gameId);
        const notebookIds = Array.from(
          new Set(
            Object.values(cards)
              .flatMap((c) => c.questions.map((q) => q.notebookId))
              .filter(Boolean) as string[],
          ),
        );
        const { data: notes } = notebookIds.length
          ? await supabase.from("notebooks").select("id, title").in("id", notebookIds)
          : { data: [] as any[] };
        const noteTitleById: Record<string, string> = {};
        for (const n of (notes ?? []) as any[]) noteTitleById[n.id as string] = (n.title as string) || "Lesson Note";
        return { adventure, groups, cards, noteTitleById } as AdventureView;
      }),
    );
    setViews(built);
  }, [classId]);

  useEffect(() => {
    (async () => {
      if (!classId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=${classRoot()}/${classId}/adventures`);
        return;
      }
      const redirect = await ensureClassOwner(classId, userData.user.id);
      if (redirect) { navigate(redirect, { replace: true }); return; }
      await refresh();
      setLoading(false);
    })();
  }, [classId, navigate, refresh]);

  useTableChanges({
    name: `class-adventures-${classId}`,
    enabled: !!classId,
    watch: [
      { table: "adventure_bar_questions" },
      { table: "class_adventures" },
      { table: "class_game_boards" },
      { table: "games" },
    ],
    onChange: () => void refresh(),
  });

  const doUnlink = async (adventure: LinkedAdventure) => {
    if (!classId) return;
    const ok = window.confirm(
      `Unlink “${adventure.title}” from this class? The adventure itself and every other class keep working.`,
    );
    if (!ok) return;
    setBusy(adventure.id);
    try {
      await unlinkAdventure(classId, adventure.gameId);
      await refresh();
      toast({ title: "Adventure unlinked" });
    } catch {
      toast({ title: "Could not unlink", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const doClearBar = async (gameId: string, barId: string, label: string) => {
    if (!classId) return;
    if (!window.confirm(`Remove every question from “${label}”?`)) return;
    setBusy(barId);
    try {
      await clearBar(classId, gameId, barId);
      await refresh();
      toast({ title: "Progress bar cleared" });
    } catch {
      toast({ title: "Could not clear", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const doRemoveQuestion = async (
    gameId: string,
    barId: string,
    q: { notebookId: string | null; questionKey: string | null; sectionId: string | null },
  ) => {
    if (!classId || !q.notebookId) return;
    setBusy(`${barId}:${q.questionKey ?? q.sectionId}`);
    try {
      await removeQuestionFromBar({
        classId,
        gameId,
        barId,
        notebookId: q.notebookId,
        questionKey: q.questionKey,
        sectionId: q.sectionId,
      });
      await refresh();
    } catch {
      toast({ title: "Could not remove question", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const savePassPct = async (gameId: string, barId: string, value: string) => {
    if (!classId) return;
    const n = Number(value);
    const pct = Number.isFinite(n) && n > 0 ? Math.min(100, Math.round(n)) : null;
    await setBarPassPct(classId, gameId, barId, pct);
    await refresh();
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to={`${classRoot()}/${classId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold tracking-wide">
          <Sparkles className="h-5 w-5" /> Adventures
        </h1>
        <Link
          to={`${classRoot()}/${classId}/games`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
        >
          <Gamepad2 className="h-3.5 w-3.5" /> Games
        </Link>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setLinkOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            <Link2 className="h-3.5 w-3.5" /> Link Adventure
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : views.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No Adventure linked to this class yet. Tap <span className="font-medium text-foreground">Link Adventure</span> to
            bring one in, then assign questions to its progress bars from a lesson note.
          </div>
        ) : (
          views.map((view) => {
            const { adventure, groups, cards } = view;
            const firstBarId = groups.flatMap((g) => g.bars)[0]?.id ?? null;
            return (
              <section key={adventure.id} className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Adventure</div>
                    <div className="text-lg font-semibold">{adventure.title}</div>
                    {adventure.subtopic && <div className="text-xs text-muted-foreground">{adventure.subtopic}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`${classRoot()}/${classId}/adventures/${adventure.gameId}/dashboard`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={() => doUnlink(adventure)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-destructive/10 hover:text-destructive"
                    >
                      {busy === adventure.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                      Unlink
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {groups.map((grp) => (
                    <div key={grp.sceneId}>
                      <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span>{grp.label}</span>
                        {!grp.hasTime && <span className="normal-case text-amber-600">No time set</span>}
                      </div>
                      {grp.bars.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
                          Only the reserved Time Progress Bar here.
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {grp.bars.map((bar, i) => {
                            const label = bar.label || `Progress Bar ${i + 2}`;
                            const card = cards[bar.id];
                            const questions = card?.questions ?? [];
                            return (
                              <li key={bar.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium">{label}</div>
                                    <div className="text-xs text-muted-foreground tabular-nums">
                                      {questions.length} question{questions.length === 1 ? "" : "s"}
                                      {card?.totalMarks ? ` · ${card.totalMarks} marks total` : ""}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                      Pass %
                                      <input
                                        type="number"
                                        min={1}
                                        max={100}
                                        defaultValue={card?.passPct ?? ""}
                                        onBlur={(e) => savePassPct(adventure.gameId, bar.id, e.target.value)}
                                        className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs tabular-nums"
                                      />
                                    </label>
                                    {questions.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => doClearBar(adventure.gameId, bar.id, label)}
                                        className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[11px] hover:bg-destructive/10 hover:text-destructive"
                                      >
                                        {busy === bar.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                                        Clear
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {questions.length === 0 ? (
                                  <div className="mt-2 rounded-md border border-dashed border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
                                    Empty — assign questions to this bar from a lesson note.
                                  </div>
                                ) : (
                                  <ul className="mt-2 space-y-1">
                                    {questions.map((q) => (
                                      <li
                                        key={q.id}
                                        className="flex items-center justify-between gap-2 rounded border border-border/50 px-2 py-1 text-[11px]"
                                      >
                                        <span className="min-w-0 truncate">
                                          {(q.notebookId && view.noteTitleById[q.notebookId]) || "Lesson Note"}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => doRemoveQuestion(adventure.gameId, bar.id, q)}
                                          className="inline-flex shrink-0 items-center gap-1 rounded border border-border/60 px-1.5 py-0.5 hover:bg-destructive/10 hover:text-destructive"
                                          aria-label="Remove question from this bar"
                                        >
                                          {busy === `${bar.id}:${q.questionKey ?? q.sectionId}` ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <X className="h-3 w-3" />
                                          )}
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                {classId && firstBarId && (
                  <div className="mt-4">
                    <GroupSetupPanel classId={classId} gameId={adventure.gameId} masterBarId={firstBarId} />
                  </div>
                )}
              </section>
            );
          })
        )}
      </main>

      {classId && (
        <LinkAdventureDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          classId={classId}
          onLinked={refresh}
        />
      )}
    </div>
  );
};

export default ClassAdventuresPage;
