// Floating Number Preparation page — opens from a Lesson Note Example/Exercise/Classwork
// solution. Same notebook aesthetic. Lets the teacher generate, edit, rearrange and
// compile the Master Floating Bucket the Smartboard will later read.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Loader2, Shuffle, Sparkles, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { renderMathInline } from "@/lib/notebook/mathRender";
import {
  type FloatingLine,
  type ContainerKind,
  type FloatingScoring,
  rearrangeIndices,
  compileBucket,
  totalMarks as computeTotalMarks,
  DEFAULT_SCORING,
  SCORE_LABELS,
} from "@/lib/lessonnotes/floatingCompile";
import { sanitizeFillers, detectStructures, extractTermsFromAscii, renderTermLabel, STRUCTURE_MARKUP, expandTransitionLine, dropContextualLeadingPlus } from "@/lib/smartboard/floatingExtractor";
import FloatingWorkspace from "@/components/lessonnotes/FloatingWorkspace";
import FloatingDisplayStrip from "@/components/lessonnotes/FloatingDisplayStrip";
import { AiEditPanel, type AiEditTarget } from "@/components/lessonnotes/AiEditPanel";
import { renderMathInline as renderMath } from "@/lib/notebook/mathRender";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";

const identityArrangement = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** Merge structure lists preserving order, deduped. */
const mergeStructures = (...lists: ContainerKind[][]): ContainerKind[] => {
  const seen = new Set<ContainerKind>();
  const out: ContainerKind[] = [];
  for (const list of lists) for (const c of list) if (!seen.has(c)) { seen.add(c); out.push(c); }
  return out;
};

interface SubInfo {
  subsectionId: string;
  sectionId: string;
  notebookId: string;
  notebookTitle: string;
  subject: string;
  subtopic: string;
  sectionKind: string;
  problem: string;
  solution: string;
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto
  ? (crypto as any).randomUUID()
  : `id-${Math.random().toString(36).slice(2)}`);

const linesFromSolution = (sol: string): { id: string; text: string }[] =>
  sol.split("\n").map((l) => l.trim()).filter(Boolean).map((text) => ({ id: newId(), text }));

const normalizeFloatingLine = (line: FloatingLine): FloatingLine => {
  const rawFillers = line.fillers ?? [];
  const rawSel = line.fillersSelected ?? [];
  const kept: { v: string; sel: boolean }[] = [];
  for (let i = 0; i < rawFillers.length; i++) {
    const v = toUnicodeMath(String(rawFillers[i] ?? ""));
    if (v && !isStillDirty(v)) kept.push({ v, sel: !!rawSel[i] });
  }
  const fillers = kept.map((k) => k.v);
  const fillersSelected = kept.map((k) => k.sel);
  const containers = line.containers ?? [];
  const rawCSel = line.containersSelected ?? [];
  const containersSelected = containers.map((_, i) => !!rawCSel[i]);
  return {
    ...line,
    fillers,
    fillersSelected,
    containers,
    containersSelected,
    arrangement: fillers.length === rawFillers.length ? (line.arrangement ?? []) : rearrangeIndices(fillers.length),
  };
};

const FloatingNumbersPage = () => {
  const { notebookId, subsectionId } = useParams<{ notebookId: string; subsectionId: string }>();
  const navigate = useNavigate();
  const [info, setInfo] = useState<SubInfo | null>(null);
  const [lines, setLines] = useState<FloatingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirtyRef = useRef(false);

  const [fromHighlights, setFromHighlights] = useState(false);
  const [highlightsData, setHighlightsData] = useState<{ groupId: number; payload: string }[]>([]);
  const [scoring, setScoring] = useState<FloatingScoring>(DEFAULT_SCORING);

  /* ---------- Per-line AI Edit panel ---------- */
  const [aiEditLineIndex, setAiEditLineIndex] = useState<number | null>(null);
  const [aiEditOpen, setAiEditOpen] = useState(false);
  const aiEditTarget: AiEditTarget | null =
    aiEditLineIndex != null && lines[aiEditLineIndex]
      ? { text: lines[aiEditLineIndex].equation, kind: "equation" }
      : null;

  const openAiEdit = (i: number) => {
    setAiEditLineIndex(i);
    setAiEditOpen(true);
  };
  const closeAiEdit = () => {
    setAiEditOpen(false);
    setAiEditLineIndex(null);
  };

  const runAiEditForLine = useCallback(async (instruction: string, target: AiEditTarget): Promise<string> => {
    if (!info) return target.text;
    const { data, error } = await supabase.functions.invoke("notebook-ai", {
      body: {
        mode: "floating_line_edit",
        problem: info.problem,
        equation: target.text,
        instruction,
        subject: info.subject,
        subtopic: info.subtopic,
        sectionKind: info.sectionKind,
      },
    });
    if (error) throw error;
    const d = data as {
      equation?: string;
      fillers?: string[];
      containers?: ContainerKind[];
      diagnostics?: { id: string; label: string; status: "pass"|"fail"|"fixed"; detail?: string }[];
      status?: "clean" | "fixed" | "unresolved";
    } | null;
    if (!d || !Array.isArray(d.fillers)) throw new Error("AI returned no line");
    aiEditResultRef.current = {
      equation: String(d.equation ?? target.text),
      fillers: d.fillers.map(String),
      containers: Array.isArray(d.containers) ? d.containers as ContainerKind[] : [],
    };
    aiEditDiagRef.current = d.diagnostics && d.status
      ? { status: d.status, items: d.diagnostics }
      : null;
    return String(d.equation ?? target.text);
  }, [info]);

  const aiEditResultRef = useRef<{ equation: string; fillers: string[]; containers: ContainerKind[] } | null>(null);
  const aiEditDiagRef = useRef<{
    status: "clean" | "fixed" | "unresolved";
    items: { id: string; label: string; status: "pass"|"fail"|"fixed"; detail?: string }[];
  } | null>(null);

  const applyAiEdit = useCallback((_proposed: string) => {
    const i = aiEditLineIndex;
    const result = aiEditResultRef.current;
    if (i == null || !result) return;
    setLines((prev) => prev.map((p, idx) => {
      if (idx !== i) return p;
      return {
        ...p,
        equation: result.equation,
        fillers: result.fillers,
        containers: result.containers,
        arrangement: identityArrangement(result.fillers.length),
        fillersSelected: result.fillers.map(() => false),
        containersSelected: result.containers.map(() => false),
      };
    }));
    dirtyRef.current = true;
    aiEditResultRef.current = null;
  }, [aiEditLineIndex]);


  useEffect(() => {
    (async () => {
      if (!subsectionId || !notebookId) return;
      setLoading(true);
      const [{ data: ss }, { data: nb }] = await Promise.all([
        supabase
          .from("notebook_subsections")
          .select("id, section_id, floating_lines, floating_highlights, floating_scoring, notebook_sections!inner(kind, notebook_id)")
          .eq("id", subsectionId)
          .maybeSingle(),
        supabase.from("notebooks").select("title, subject, subtopic").eq("id", notebookId).maybeSingle(),
      ]);
      if (!ss || !nb) {
        toast({ title: "Workspace not found", variant: "destructive" });
        navigate(`/lesson-notes/${notebookId}`);
        return;
      }
      const { data: blocks } = await supabase
        .from("notebook_blocks")
        .select("kind, content_ascii")
        .eq("subsection_id", subsectionId);
      const problem = blocks?.find((b: any) => b.kind === "problem")?.content_ascii ?? "";
      const solution = blocks?.find((b: any) => b.kind === "solution")?.content_ascii ?? "";

      setInfo({
        subsectionId,
        sectionId: ss.section_id,
        notebookId,
        notebookTitle: nb.title ?? "",
        subject: nb.subject ?? "Mathematics",
        subtopic: nb.subtopic ?? "",
        sectionKind: (ss as any).notebook_sections?.kind ?? "example",
        problem,
        solution,
      });

      const highlights = (ss as any).floating_highlights as
        | { groupId: number; payload: string }[] | null;
      const persisted = (ss as any).floating_lines as FloatingLine[] | null;

      const savedScoring = (ss as any).floating_scoring as FloatingScoring | null;
      if (savedScoring && typeof savedScoring === "object") {
        setScoring({ ...DEFAULT_SCORING, ...savedScoring });
      }

      const hasHighlights = !!(highlights && Array.isArray(highlights) && highlights.length > 0);
      setFromHighlights(hasHighlights);
      setHighlightsData(hasHighlights ? highlights! : []);

      if (hasHighlights) {
        // Highlights drive the list. Re-pair each highlight to its persisted
        // line so AI-generated fillers AND the teacher's chip selections
        // (fillersSelected / containersSelected) survive every reload.
        // Pairing priority: (a) exact equation==payload match, then
        // (b) positional fallback (same index) so a selection is never lost
        // to math/LaTeX normalization drift. Only a removed highlight drops a row.
        const persistedList: FloatingLine[] = Array.isArray(persisted)
          ? persisted.map(normalizeFloatingLine)
          : [];
        const used = new Set<number>();
        const reconciled: FloatingLine[] = highlights!.map((h, hi) => {
          const payload = String(h.payload ?? "");
          let idx = persistedList.findIndex(
            (p, i) => !used.has(i) && (p.equation ?? "") === payload,
          );
          // (b) positional fallback — reuse the persisted row at the same index
          // when it hasn't already been claimed by an exact match.
          if (idx < 0 && hi < persistedList.length && !used.has(hi)) {
            idx = hi;
          }
          if (idx >= 0) {
            used.add(idx);
            // Lock the equation to the permanent highlight payload while keeping
            // the persisted fillers + selection state.
            return { ...persistedList[idx], equation: payload };
          }
          return {
            lineId: newId(),
            equation: payload,
            fillers: [],
            containers: [],
            arrangement: [],
          };
        });
        setLines(reconciled);
      } else if (persisted && Array.isArray(persisted) && persisted.length > 0) {
        // Legacy: no highlights — show previously generated lines if any.
        setLines(persisted.map(normalizeFloatingLine));
      } else {
        // Legacy flow (no highlights): seed empty lines from raw solution.
        setLines(
          linesFromSolution(solution).map((l) => ({
            lineId: l.id,
            equation: l.text,
            fillers: [],
            containers: [],
            arrangement: [],
          })),
        );
      }
      setLoading(false);
    })();
  }, [subsectionId, notebookId, navigate]);


  /* ---------- AI Generate (all lines at once) ---------- */
  const generateAll = useCallback(async () => {
    if (!info) return;
    setGenerating(true);
    try {
      const body = fromHighlights
        ? {
            mode: "floating_highlights",
            subject: info.subject,
            subtopic: info.subtopic,
            sectionKind: info.sectionKind,
            problem: info.problem,
            highlights: highlightsData.map((h) => ({
              groupId: h.groupId,
              payload: h.payload,
            })),
          }
        : {
            mode: "floating",
            subject: info.subject,
            subtopic: info.subtopic,
            sectionKind: info.sectionKind,
            problem: info.problem,
            solution: info.solution,
          };
      const { data, error } = await supabase.functions.invoke("notebook-ai", { body });
      if (error) throw error;
      const aiLines = (data as any)?.lines as
        | { equation: string; fillers: string[]; containers: string[] }[]
        | undefined;
      if (!aiLines || !Array.isArray(aiLines) || aiLines.length === 0) {
        toast({ title: "AI returned no floating pieces", variant: "destructive" });
        return;
      }
      // Match AI lines back to our equation order by index; fall back to creating fresh ids.
      const existing = lines;
      const next: FloatingLine[] = aiLines.map((a, i) => {
        const rawFillers = (a.fillers ?? []).map((s) => String(s)).filter(Boolean);
        // Strip structural macros (e.g. "+\frac{1}{2}", "-\sqrt{3}") out of
        // the fillers row — they belong in the symbols row as empty shells.
        const { fillers, structures: structFromFillers } = sanitizeFillers(rawFillers);

        const rawAiContainers = (a.containers ?? [])
          .map((c) => String(c).toLowerCase())
          .filter((c): c is ContainerKind =>
            ["fraction", "bracket", "radical", "power", "log", "integral", "matrix", "differential", "abs", "vector"].includes(c),
          );

        // In highlight mode, the saved highlight payload is the permanent
        // identity for this row. Do not let AI rewrite it, or later
        // highlight reconciliation/removal cannot match the row reliably.
        const equation = fromHighlights
          ? (highlightsData[i]?.payload ?? existing[i]?.equation ?? a.equation ?? "")
          : (a.equation || existing[i]?.equation || "");
        // Only show symbols that ACTUALLY appear in this equation (or in
        // structural fillers the AI tried to emit). Never default-show all.
        const containers = mergeStructures(
          detectStructures(equation) as ContainerKind[],
          structFromFillers as ContainerKind[],
          rawAiContainers,
        );

        const normalised = dropContextualLeadingPlus(fillers);
        return {
          lineId: existing[i]?.lineId ?? newId(),
          equation,
          fillers: normalised,
          containers,
          arrangement: identityArrangement(normalised.length),
        };
      });
      // Highlight mode: each highlight is INDEPENDENT — skip the pairwise
      // TRANSITION pass that inherits fillers across lines.
      if (!fromHighlights) {
        // Pairwise TRANSITION pass. Track structures already introduced in
        // earlier lines of THIS beat: a term is split into source pieces only
        // on the FIRST line where its joining structure (fraction / radical /
        // power / bracket) appears. Subsequent lines that reuse the same
        // structure emit the compound term whole.
        const seenStructures = new Set<ContainerKind>();
        for (const c of next[0]?.containers ?? []) seenStructures.add(c);
        for (let i = 1; i < next.length; i++) {
          const prevFillers = next[i - 1].fillers;
          const { fillers: expanded, structures: added } = expandTransitionLine(
            prevFillers,
            next[i].fillers,
            seenStructures as Set<any>,
          );
          const expNorm = dropContextualLeadingPlus(expanded);
          next[i] = {
            ...next[i],
            fillers: expNorm,
            containers: mergeStructures(next[i].containers as ContainerKind[], added as ContainerKind[]),
            arrangement: identityArrangement(expNorm.length),
          };
          for (const c of next[i].containers) seenStructures.add(c);
        }
      }
      setLines(next);
      dirtyRef.current = true;
      toast({ title: "Floating numbers ready", description: `${next.length} lines prepared.` });
    } catch (e: any) {
      toast({ title: "Could not generate", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [info, lines, fromHighlights, highlightsData]);

  const shuffleAll = useCallback(() => {
    dirtyRef.current = true;
    setLines((prev) => prev.map((l) => ({ ...l, arrangement: rearrangeIndices(l.fillers.length) })));
  }, []);

  /* ---------- Persist (used by autosave + manual Save) ---------- */
  const persist = useCallback(async (silent: boolean) => {
    if (!info) return;
    setSaving(true);
    const cleanLines = lines.map(normalizeFloatingLine);
    const bucket = compileBucket(cleanLines);
    const { error } = await supabase
      .from("notebook_subsections")
      .update({
        floating_lines: cleanLines as any,
        floating_bucket: bucket as any,
        floating_scoring: scoring as any,
      })
      .eq("id", info.subsectionId);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return false;
    }
    dirtyRef.current = false;
    setSavedAt(Date.now());
    if (!silent) toast({ title: "Saved", description: `${bucket.fillers.length} floating numbers persisted.` });
    return true;
  }, [info, lines, scoring]);

  /* Manual Save — force flush + reload from DB to confirm persistence. */
  const saveNow = useCallback(async () => {
    const ok = await persist(false);
    if (!ok || !info) return;
    const { data: ss } = await supabase
      .from("notebook_subsections")
      .select("floating_lines")
      .eq("id", info.subsectionId)
      .maybeSingle();
    const persisted = (ss as any)?.floating_lines as FloatingLine[] | null;
    if (persisted && Array.isArray(persisted)) {
      setLines(persisted.map(normalizeFloatingLine));
    }
  }, [persist, info]);

  /* Auto-save: debounced 500 ms after any edit. */
  useEffect(() => {
    if (!dirtyRef.current || !info) return;
    const t = window.setTimeout(() => { persist(true); }, 500);
    return () => window.clearTimeout(t);
  }, [lines, info, persist]);

  /* Flush-on-leave: a chip toggle made right before navigating away (or a tab
     close / refresh) must never be lost to the 500 ms debounce. Keep the latest
     persist in a ref so the unmount cleanup saves the freshest state. */
  const persistRef = useRef(persist);
  useEffect(() => { persistRef.current = persist; }, [persist]);
  useEffect(() => {
    return () => { if (dirtyRef.current) void persistRef.current(true); };
  }, []);
  useEffect(() => {
    const onHide = () => { if (dirtyRef.current) void persistRef.current(true); };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, []);

  /* Save pending edits before an in-app navigation, then route. */
  const flushThenNavigate = useCallback(async (to: string) => {
    if (dirtyRef.current) await persist(true);
    navigate(to);
  }, [persist, navigate]);


  const headerLabel = useMemo(() => {
    if (!info) return "";
    const k = info.sectionKind.charAt(0).toUpperCase() + info.sectionKind.slice(1);
    return `${k} · Floating Numbers`;
  }, [info]);

  const total = useMemo(() => computeTotalMarks(lines), [lines]);

  /* Equal mode: keep every line's marks in lockstep with marksPerLine. */
  useEffect(() => {
    if (scoring.mode !== "equal") return;
    setLines((prev) => {
      let changed = false;
      const next = prev.map((l) => {
        if ((Number(l.marks) || 0) === scoring.marksPerLine) return l;
        changed = true;
        return { ...l, marks: scoring.marksPerLine };
      });
      if (changed) dirtyRef.current = true;
      return changed ? next : prev;
    });
  }, [scoring.mode, scoring.marksPerLine, lines.length]);

  const updateScoring = useCallback((patch: Partial<FloatingScoring>) => {
    dirtyRef.current = true;
    setScoring((prev) => ({ ...prev, ...patch }));
  }, []);


  return (
    <div className="min-h-screen" style={{ background: "hsl(38 35% 92%)" }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 backdrop-blur"
        style={{
          background: "hsl(38 38% 96% / 0.85)",
          borderBottom: "1px solid hsl(220 15% 60% / 0.25)",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => flushThenNavigate(`/lesson-notes/${notebookId}`)}
            className="inline-flex items-center gap-1.5 text-sm text-foreground/70 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Lesson Note
          </button>
          <div className="text-foreground/30">/</div>
          <div className="text-sm" style={{ color: "hsl(220 35% 18%)" }}>
            {info?.subtopic || info?.notebookTitle}
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-foreground/30" />
          <div className="text-[11px] uppercase tracking-[0.3em] text-foreground/55">{headerLabel}</div>

          <div className="ml-auto flex items-center gap-2">
            {savedAt && !saving && (
              <span className="text-[11px] text-foreground/45 mr-1">Saved</span>
            )}
            {saving && (
              <span className="text-[11px] text-foreground/55 mr-1 inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </span>
            )}
            <button
              onClick={() => flushThenNavigate(`/lesson-notes/${notebookId}/floating-prep/${subsectionId}`)}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5"
              style={{ color: "hsl(220 35% 18%)" }}
              title="Back to highlight selection"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              onClick={generateAll}
              disabled={generating || loading}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md disabled:opacity-50"
              style={{ background: "hsl(220 35% 18%)", color: "hsl(38 38% 96%)" }}
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Generate
            </button>
            <button
              onClick={saveNow}
              disabled={saving || loading}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5 disabled:opacity-40"
              style={{ color: "hsl(220 35% 18%)" }}
            >
              <Save className="h-3.5 w-3.5" /> Save
            </button>
            <button
              onClick={shuffleAll}
              disabled={loading || lines.every((l) => l.fillers.length === 0)}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5 disabled:opacity-40"
              style={{ color: "hsl(220 35% 18%)" }}
            >
              <Shuffle className="h-3.5 w-3.5" /> Shuffle
            </button>
          </div>
        </div>

        {/* Scoring strip */}
        <div
          className="max-w-5xl mx-auto px-6 pb-2 flex items-center gap-3 flex-wrap"
          style={{ color: "hsl(220 35% 18%)" }}
        >
          <span className="text-[10px] uppercase tracking-[0.3em] text-foreground/55">Scoring</span>

          <select
            value={scoring.label}
            onChange={(e) => updateScoring({ label: e.target.value })}
            className="text-sm rounded-md px-2 py-1 border border-foreground/20 bg-transparent"
            title="What to call the score"
          >
            {SCORE_LABELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <div className="inline-flex rounded-md overflow-hidden border border-foreground/20">
            <button
              onClick={() => updateScoring({ mode: "equal" })}
              className="text-xs px-2.5 py-1"
              style={scoring.mode === "equal"
                ? { background: "hsl(220 35% 18%)", color: "hsl(38 38% 96%)" }
                : { color: "hsl(220 35% 18%)" }}
            >
              Equal
            </button>
            <button
              onClick={() => updateScoring({ mode: "individual" })}
              className="text-xs px-2.5 py-1"
              style={scoring.mode === "individual"
                ? { background: "hsl(220 35% 18%)", color: "hsl(38 38% 96%)" }
                : { color: "hsl(220 35% 18%)" }}
            >
              Individual
            </button>
          </div>

          {scoring.mode === "equal" && (
            <label className="inline-flex items-center gap-1.5 text-sm">
              <span className="text-foreground/60">{scoring.label} per line</span>
              <input
                type="number"
                min={0}
                value={scoring.marksPerLine}
                onChange={(e) => updateScoring({ marksPerLine: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                className="w-16 text-center text-sm rounded-md px-1.5 py-0.5 border border-foreground/20 bg-transparent tabular-nums"
              />
            </label>
          )}

          <div className="ml-auto text-sm font-semibold tabular-nums">
            Total Available = {total} {scoring.label}
          </div>
        </div>
      </div>


      {/* Notebook page */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div
          className="rounded-md p-8 relative"
          style={{
            background:
              "repeating-linear-gradient(to bottom, hsl(38 38% 96%) 0px, hsl(38 38% 96%) 31px, hsl(220 30% 70% / 0.18) 32px)",
            border: "1px solid hsl(220 15% 60% / 0.25)",
            boxShadow: "0 1px 0 hsl(220 15% 60% / 0.15)",
          }}
        >
          {/* Problem strip */}
          {info?.problem && (
            <div className="mb-6">
              <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/45 mb-1">Problem</div>
              <div className="text-[18px]" style={{ color: "hsl(220 35% 18%)" }}>
                {renderMathInline(info.problem, "prob")}
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-sm text-foreground/55">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
            </div>
          ) : lines.length === 0 ? (
            <div className="py-12 text-center text-sm text-foreground/55">
              No solution lines yet. Generate the solution in the lesson note first.
            </div>
          ) : (
            <div className="space-y-1">
              {lines.map((l, i) => (
                <FloatingWorkspace
                  key={l.lineId}
                  line={l}
                  index={i}
                  scoreLabel={scoring.label}
                  scoringMode={scoring.mode}
                  onAiEdit={() => openAiEdit(i)}
                  onChange={(next) => {
                    dirtyRef.current = true;
                    setLines((prev) => prev.map((p, idx) => (idx === i ? next : p)));
                  }}
                />

              ))}
            </div>
          )}

          {/* ───── View Session (always rendered so it's discoverable) ───── */}
          {!loading && <ViewSession lines={lines} />}

          <p className="mt-8 text-[11px] text-foreground/45 italic">
            Tip: Fillers are complete mathematical terms (never split). Containers are empty
            shells. The View Session combines every line's floating numbers into one continuous
            stream and rearranges using the 2·4·1·3 pattern. Press <span className="font-semibold">Next</span> to
            compile for the Smartboard.
          </p>
        </div>
      </div>

      <AiEditPanel
        open={aiEditOpen}
        target={aiEditTarget}
        onGenerate={runAiEditForLine}
        onApply={applyAiEdit}
        onClose={closeAiEdit}
        renderPreview={(text) => renderMath(text, `aie-${aiEditLineIndex ?? "x"}`)}
        simpleMode
        simpleCaption="Click Generate and AI will regenerate the floating numbers for this line. The equation will not change."
        generateLabel="Generate Floating Numbers"
        getDiagnostics={() => aiEditDiagRef.current}
        renderProposed={() => {
          const r = aiEditResultRef.current;
          if (!r) return null;
          return (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {r.fillers.map((f, i) => {
                  const cleaned = toUnicodeMath(f);
                  if (!cleaned || isStillDirty(cleaned)) return null;
                  const term = extractTermsFromAscii(cleaned)[0];
                  const label = term ? renderTermLabel(term, { isFirst: false, prevWasEquals: false }) : cleaned;
                  return (
                    <span
                      key={`pf-${i}`}
                      className="inline-flex items-center px-2 py-1 rounded-md text-[13px]"
                      style={{
                        background: "hsl(38 38% 94%)",
                        border: "1px solid hsl(220 15% 60% / 0.35)",
                        color: "hsl(220 35% 18%)",
                      }}
                    >
                      {renderMath(label, `pf-${aiEditLineIndex}-${i}`)}
                    </span>
                  );
                })}
              </div>
              {r.containers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {r.containers.map((c, i) => (
                    <span
                      key={`pc-${i}-${c}`}
                      className="inline-flex items-center px-2 py-1 rounded-md text-[13px]"
                      style={{
                        background: "hsl(220 35% 18% / 0.06)",
                        border: "1px dashed hsl(220 35% 18% / 0.35)",
                        color: "hsl(220 35% 18%)",
                      }}
                    >
                      {renderMath(STRUCTURE_MARKUP[c], `pc-${aiEditLineIndex}-${c}`)}
                    </span>
                  ))}
                </div>
              )}
              {r.fillers.length === 0 && r.containers.length === 0 && (
                <p className="text-xs text-foreground/55">No floating numbers detected for this line.</p>
              )}
            </div>
          );
        }}
      />
    </div>
  );
};


/* ──────────────────────────── View Session ──────────────────────────── */

const renderChip = (token: string, key: string, ctx: { isFirst: boolean; prevWasEquals: boolean; selected?: boolean }) => {
  const cleaned = toUnicodeMath(token);
  if (!cleaned || isStillDirty(cleaned)) return null;
  const term = extractTermsFromAscii(cleaned)[0];
  const label = term ? renderTermLabel(term, ctx) : cleaned;
  const baseStyle = {
    background: "hsl(38 38% 94%)",
    border: "1px solid hsl(220 15% 60% / 0.35)",
    color: "hsl(220 35% 18%)",
  };
  const selStyle = {
    background: "hsl(48 95% 68%)",
    border: "1.5px solid hsl(40 85% 42%)",
    color: "hsl(220 35% 18%)",
  };
  return (
    <span
      key={key}
      className="px-2.5 py-1 rounded-md text-[15px]"
      style={ctx.selected ? selStyle : baseStyle}
    >
      {renderMathInline(label, key)}
    </span>
  );
};

const ViewSession = ({ lines }: { lines: FloatingLine[] }) => {
  const bucket = useMemo(() => compileBucket(lines.map(normalizeFloatingLine)), [lines]);
  const combined = bucket.viewCombined;
  const selected = bucket.selected;
  const structures = bucket.containers;
  const structuresSelected = bucket.containersSelected;

  const Row = ({ title, items, sel }: { title: string; items: string[]; sel: boolean[] }) => (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/55 mb-2">{title}</div>
      {items.length === 0 ? (
        <div className="text-[12px] text-foreground/40 italic">empty</div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {items.map((tok, i) =>
            renderChip(tok, `v-${title}-${i}-${tok}`, {
              isFirst: i === 0,
              prevWasEquals: i > 0 && items[i - 1] === "=",
              selected: !!sel[i],
            }),
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      id="view-session"
      className="mt-8 rounded-md p-5 scroll-mt-20"
      style={{
        background: "hsl(38 38% 96%)",
        border: "2px solid hsl(168 55% 38% / 0.55)",
      }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[11px] uppercase tracking-[0.3em] text-foreground/65">View Session</div>
      </div>
      <Row title="Floating Numbers" items={combined} sel={selected} />
      <FloatingDisplayStrip tokens={combined} selected={selected} />
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/55 mb-2">
          C · Structures
        </div>
        {structures.length === 0 ? (
          <div className="text-[12px] text-foreground/40 italic">none</div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {structures.map((c, i) => (
              <span
                key={c}
                title={c}
                className="px-3 py-1.5 rounded-md text-[15px]"
                style={structuresSelected[i] ? {
                  background: "hsl(48 95% 68%)",
                  border: "1.5px solid hsl(40 85% 42%)",
                  color: "hsl(220 35% 18%)",
                } : {
                  background: "hsl(220 35% 18% / 0.06)",
                  border: "1px dashed hsl(220 35% 18% / 0.35)",
                  color: "hsl(220 35% 18%)",
                }}
              >
                {renderMathInline(STRUCTURE_MARKUP[c], `vs-${c}`)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingNumbersPage;
