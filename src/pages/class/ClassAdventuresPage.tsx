import { classRoot } from "@/lib/product/workspaceRoutes";
// Teacher — Adventures for a class.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Loader2, Sparkles, Gamepad2, Link2, X, LayoutDashboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import {
  listAdventureNotes,
  type ClassAdventureNoteRow,
} from "@/lib/adventures/classAdventures";
import { LinkAdventureDialog, type LinkAdventureQuestion } from "@/components/adventures/LinkAdventureDialog";
import { compileQuestionSection } from "@/lib/assessments/createAssessment";
import { normalizeCanvas } from "@/lib/games/types";
import { checkpointLabel, unassignBar } from "@/lib/adventures/barLinks";

type BarLink = {
  id: string;
  assessment_id: string;
  game_id: string;
  progress_element_id: string;
  notebook_id: string;
  section_id: string | null;
  required_marks: number | null;
  game_title: string;
  bar_label: string;
  checkpoint_label: string;
  segments: number;
};

type Group = {
  notebookId: string;
  title: string;
  subtitle: string | null;
  rows: ClassAdventureNoteRow[];
  totalMarks: number;
  totalQuestions: number;
  assignedAt: string | null;
  dueAt: string | null;
  links: BarLink[];
  questions: LinkAdventureQuestion[];
};

const toDateInput = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : "");

const ClassAdventuresPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ClassAdventureNoteRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [linksByNotebook, setLinksByNotebook] = useState<Record<string, BarLink[]>>({});
  const [marksBySection, setMarksBySection] = useState<Record<string, number>>({});
  const [linkOpen, setLinkOpen] = useState<{ notebookId: string; title: string; questions: LinkAdventureQuestion[] } | null>(null);

  const loadLinks = useCallback(async (notebookIds: string[]) => {
    if (notebookIds.length === 0) { setLinksByNotebook({}); return; }
    const { data: boards } = await supabase
      .from("class_game_boards")
      .select("id, assessment_id, game_id, progress_element_id, notebook_id, section_id, required_marks")
      .eq("class_id", classId ?? "")
      .in("notebook_id", notebookIds);
    const list = (boards ?? []) as any[];
    const gameIds = Array.from(new Set(list.map((b) => b.game_id as string)));
    const { data: games } = gameIds.length
      ? await supabase.from("games").select("id, title, canvas").in("id", gameIds)
      : { data: [] };
    const gameMap = new Map<string, any>((games ?? []).map((g: any) => [g.id, g]));
    const map: Record<string, BarLink[]> = {};
    for (const b of list) {
      const g = gameMap.get(b.game_id);
      let barLabel = "Progress Bar";
      let segments = 10;
      let checkpointName = "";
      const canvas = normalizeCanvas(g?.canvas);
      const scenes = canvas.scenes ?? [];
      outer: for (let si = 0; si < scenes.length; si += 1) {
        const s = scenes[si];
        for (const el of s?.elements ?? []) {
          if (el?.id === b.progress_element_id) {
            barLabel = el.label || "Progress Bar";
            segments = Math.max(1, Number(el?.progress?.segments) || 10);
            checkpointName = checkpointLabel(canvas, s, si);
            break outer;
          }
        }
      }
      const link: BarLink = {
        id: b.id,
        assessment_id: b.assessment_id,
        game_id: b.game_id,
        progress_element_id: b.progress_element_id,
        notebook_id: b.notebook_id as string,
        section_id: (b.section_id as string | null) ?? null,
        required_marks: b.required_marks,
        game_title: g?.title ?? "Game",
        bar_label: barLabel,
        checkpoint_label: checkpointName,
        segments,
      };
      if (!map[link.notebook_id]) map[link.notebook_id] = [];
      map[link.notebook_id].push(link);
    }
    setLinksByNotebook(map);
  }, [classId]);

  const refresh = useCallback(async () => {
    if (!classId) return;
    const r = await listAdventureNotes(classId);
    setRows(r);
    const notebookIds = Array.from(new Set(r.map((x) => x.notebook_id)));
    await loadLinks(notebookIds);
    const entries = await Promise.all(
      r.map(async (row) => {
        if (!row.section_id) return [null, 0] as const;
        try {
          const c = await compileQuestionSection(row.section_id);
          return [row.section_id, c.total] as const;
        } catch {
          return [row.section_id, 0] as const;
        }
      }),
    );
    const marks: Record<string, number> = {};
    for (const [sid, total] of entries) { if (sid) marks[sid] = total; }
    setMarksBySection(marks);
  }, [classId, loadLinks]);

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

  useEffect(() => {
    if (!classId) return;
    const ch = supabase
      .channel(`class-adventures-${classId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "class_adventure_notes" }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "notebook_subsections" }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "class_game_boards" }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => { void refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [classId, refresh]);

  const groups: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    const seenSectionsByNotebook = new Map<string, Set<string>>();
    for (const r of rows) {
      const nb = r.notebook;
      const nbId = r.notebook_id;
      let g = map.get(nbId);
      if (!g) {
        g = {
          notebookId: nbId,
          title: nb?.title || "Lesson Note",
          subtitle: nb?.subtopic || nb?.subject || null,
          rows: [],
          totalMarks: 0,
          totalQuestions: 0,
          assignedAt: null,
          dueAt: null,
          links: linksByNotebook[nbId] ?? [],
          questions: [],
        };
        map.set(nbId, g);
        seenSectionsByNotebook.set(nbId, new Set());
      }
      g.rows.push(r);
      const seenSections = seenSectionsByNotebook.get(nbId) ?? new Set<string>();
      // Dedupe on the PERMANENT question key first — two rows for the same
      // question (from an older duplicate link) must count once.
      const sectionKey = r.question_key ?? r.section_id ?? r.id;
      const isUniqueQuestion = !seenSections.has(sectionKey);
      if (isUniqueQuestion) {
        seenSections.add(sectionKey);
        g.totalQuestions += 1;
        g.totalMarks += r.section_id ? (marksBySection[r.section_id] ?? 0) : 0;
      }
      if (!g.assignedAt || (r.created_at && r.created_at < g.assignedAt)) g.assignedAt = r.created_at;
      if (r.due_at && (!g.dueAt || r.due_at < g.dueAt)) g.dueAt = r.due_at;
      const qNumber = typeof r.section?.order_index === "number" ? r.section.order_index + 1 : null;
      const label = qNumber ? `Question ${qNumber}` : (r.section?.title || "Question");
      if (r.section_id && isUniqueQuestion) {
        g.questions.push({
          sectionId: r.section_id,
          questionKey: r.question_key ?? null,
          label,
          marks: marksBySection[r.section_id] ?? 0,
        });
      }

    }
    for (const g of map.values()) {
      g.questions.sort((a, b) => {
        const an = Number(a.label.replace(/\D+/g, "")) || 0;
        const bn = Number(b.label.replace(/\D+/g, "")) || 0;
        return an - bn;
      });
    }
    return Array.from(map.values());
  }, [rows, linksByNotebook, marksBySection]);

  const saveGroupDue = async (g: Group, value: string) => {
    const iso = value ? new Date(value).toISOString() : null;
    const ids = g.rows.map((r) => r.id);
    await supabase.from("class_adventure_notes").update({ due_at: iso } as never).in("id", ids);
    setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, due_at: iso } : r)));
  };

  const removeLink = async (link: BarLink) => {
    const ok = window.confirm(
      `Unassign “${link.bar_label}”? The Lesson Note is removed from this Progress Bar and you can assign another one.`,
    );
    if (!ok) return;
    setBusy(link.id);
    try {
      await unassignBar({ boardId: link.id, assessmentId: link.assessment_id });
      await refresh();
      toast({ title: "Lesson Note unassigned" });
    } catch {
      toast({ title: "Could not unassign", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const formatPerSlot = (total: number, segments: number) => {
    const seg = Math.max(1, segments);
    const per = total / seg;
    return Number.isInteger(per) ? String(per) : per.toFixed(1);
  };

  const labelForSection = (sectionId: string | null, questions: LinkAdventureQuestion[]) => {
    if (!sectionId) return "All questions";
    return questions.find((q) => q.sectionId === sectionId)?.label ?? "Question";
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
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No adventures yet. Open a lesson note, tap <span className="font-medium text-foreground">Assign</span> on a Solution, and pick <span className="font-medium text-foreground">Revision</span>.
          </div>
        ) : (
          groups.map((g) => {
            const primaryGameId = g.links[0]?.game_id ?? null;
            return (
              <section key={g.notebookId} className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Lesson Note</div>
                    <div className="text-lg font-semibold">{g.title}</div>
                    {g.subtitle && <div className="text-xs text-muted-foreground">{g.subtitle}</div>}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{g.totalQuestions} question{g.totalQuestions === 1 ? "" : "s"}</div>
                    <div className="tabular-nums">{g.totalMarks} marks total</div>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="text-xs">
                    <div className="mb-1 text-muted-foreground">Date Assigned</div>
                    <div className="rounded-md border border-input bg-muted/20 px-3 py-1.5 tabular-nums">
                      {g.assignedAt ? new Date(g.assignedAt).toLocaleDateString() : "—"}
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="mb-1 text-muted-foreground">Date to Complete</div>
                    <input
                      type="date"
                      value={toDateInput(g.dueAt)}
                      onChange={(e) => saveGroupDue(g, e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Linked to progress bars
                  </div>
                  {g.links.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
                      Not yet linked to a game.
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {g.links.map((l) => {
                        const marks = l.section_id ? (marksBySection[l.section_id] ?? 0) : (Number(l.required_marks) || g.totalMarks);
                        return (
                          <li
                            key={l.id}
                            className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-medium">{l.game_title}</span>
                              {l.checkpoint_label && (
                                <span className="text-muted-foreground"> · {l.checkpoint_label}</span>
                              )}
                              <span className="text-muted-foreground"> · {l.bar_label}</span>
                              <span className="text-muted-foreground"> · {labelForSection(l.section_id, g.questions)}</span>
                              {marks > 0 && (
                                <span className="text-muted-foreground"> · {formatPerSlot(marks, l.segments)} marks per slot</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeLink(l)}
                              className="inline-flex shrink-0 items-center gap-1 rounded border border-border/60 px-2 py-0.5 text-[11px] hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Unassign lesson note"
                            >
                              {busy === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                              Unassign
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setLinkOpen({ notebookId: g.notebookId, title: g.title, questions: g.questions })}
                    className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Link to Adventure
                  </button>
                  {primaryGameId && (
                    <Link
                      to={`${classRoot()}/${classId}/adventures/${primaryGameId}/dashboard`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" /> Adventure Dashboard
                    </Link>
                  )}
                </div>
              </section>
            );
          })
        )}
      </main>

      {linkOpen && classId && (
        <LinkAdventureDialog
          open={!!linkOpen}
          onOpenChange={(v) => { if (!v) setLinkOpen(null); }}
          classId={classId}
          notebookId={linkOpen.notebookId}
          noteTitle={linkOpen.title}
          questions={linkOpen.questions}
          onLinked={refresh}
        />
      )}
    </div>
  );
};

export default ClassAdventuresPage;
