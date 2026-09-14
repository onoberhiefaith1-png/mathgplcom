// Floating Number Preparation page — opens from a Lesson Note Example/Exercise/Classwork
// solution. Same notebook aesthetic. Lets the teacher generate, edit, rearrange and
// compile the Master Floating Bucket the Smartboard will later read.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { Archive, ArrowLeft, ChevronRight, Loader2, MonitorPlay, RotateCcw, Shuffle, Sparkles, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { withTimeout } from "@/lib/async/withTimeout";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { assertDisplaySafe } from "@/lib/notebook/mathDisplayGate";
import {
  type FloatingLine,
  type ContainerKind,
  type FloatingScoring,
  rearrangeIndices,
  compileBucket,
  totalMarks as computeTotalMarks,
  DEFAULT_SCORING,
  SCORE_LABELS,
  repairShiftedFloatingLines,
  markTeacherEdited,
} from "@/lib/lessonnotes/floatingCompile";
import {
  applyPayloadToLine,
  lineToPayload,
  readFloatingClipboard,
  writeFloatingClipboard,
} from "@/lib/lessonnotes/floatingClipboard";

import { adoptLineIdentities } from "@/lib/lessonnotes/lineIdentity";
import { sanitizeFillers, detectStructures, STRUCTURE_MARKUP, expandTransitionLine, dropContextualLeadingPlus } from "@/lib/smartboard/floatingExtractor";
import FloatingWorkspace from "@/components/lessonnotes/FloatingWorkspace";
import FloatingDisplayStrip from "@/components/lessonnotes/FloatingDisplayStrip";
import { AiEditPanel, type AiEditTarget } from "@/components/lessonnotes/AiEditPanel";
import { renderMathInline as renderMath } from "@/lib/notebook/mathRender";
import AssistantPanel, { type ActiveHighlight, type LineUpdatePayload } from "@/components/floating/AssistantPanel";
import { buildLessonContext } from "@/lib/floating/lessonContext";
import { readSolutionObjects, isFloatableObject, isDiagramFamily, type SolutionObject } from "@/lib/floating/solutionItems";
import { SolutionObjectView } from "@/components/lessonnotes/SolutionObjectView";
import TableWorkspace from "@/components/floating/TableWorkspace";
import { useArchivedFeature } from "@/hooks/useArchivedFeature";
import FloatingArchivePanel, { type ArchivedVersion } from "@/components/floating/FloatingArchivePanel";
import { diag } from "@/lib/diagnostics/opLog";
import {
  gridFromAnyObject,
  gridFromMatrixLatex,
  generateTableLines,
  tableLineEquation,
  cellFitsLine,
  defaultRetainedCells,

  type TableGrid,
  type TableOrientation,
} from "@/lib/floating/tableGrid";
import { isEmptyMatrixLatex, splitMatrixChip } from "@/lib/floating/matrixChips";
import DurationInput from "@/components/common/DurationInput";

/** One item of the highlight stream: a text line, or a whole table workspace. */
type Entry =
  | { kind: "text"; highlight: { uid: string; groupId: number; payload: string } }
  | { kind: "table"; objId: string; grid: TableGrid };


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

// SELECTION LAW: there is deliberately NO solution→lines derivation here.
// Only the Highlighting Page decides what becomes a Floating Number.


/**
 * Teacher chips are the source of truth. Save/reload must not reinterpret
 * chips through display conversion, because that can turn structural LaTeX
 * such as \frac / \sqrt into a different flat string. Preserve the saved
 * value exactly and only keep the parallel selection arrays index-aligned.
 */
const normalizeFloatingLine = (line: FloatingLine): FloatingLine => {
  const rawFillers = line.fillers ?? [];
  const rawSel = line.fillersSelected ?? [];
  const fillers = rawFillers.map((raw) => String(raw ?? ""));
  const fillersSelected = fillers.map((_, i) => !!rawSel[i]);
  const containers = line.containers ?? [];
  const rawCSel = line.containersSelected ?? [];
  const containersSelected = containers.map((_, i) => !!rawCSel[i]);
  const arrangement =
    line.arrangement && line.arrangement.length === fillers.length
      ? line.arrangement
      : identityArrangement(fillers.length);
  return {
    ...line,
    fillers,
    fillersSelected,
    containers,
    containersSelected,
    arrangement,
  };
};

/** A highlighted matrix is one mathematical STRUCTURE plus its cell values —
 * never a pre-filled object. The line carries an empty matrix shell chip
 * (dimensions + brackets only) followed by one chip per cell value in reading
 * order, exactly like a fraction shell plus its numerator/denominator values.
 * Lines saved under the old "whole payload in one chip" model are migrated
 * here on load, so no cell content is lost. */
const ensureAtomicMatrixFiller = (line: FloatingLine, payload: string): FloatingLine => {
  const split = splitMatrixChip(payload);
  if (!split) return line;
  const existing = line.fillers ?? [];
  const legacyAtomic =
    existing.length === 1 && !!gridFromMatrixLatex(existing[0]) && !isEmptyMatrixLatex(existing[0]);
  if (existing.length > 0 && !legacyAtomic) return line;
  const fillers = [split.shell, ...split.values];
  return {
    ...line,
    fillers,
    fillersSelected: fillers.map(() => false),
    arrangement: fillers.map((_, i) => i),
  };
};


/** Read-only note content: a diagram belongs to the Notes layer, so it is
 *  shown for context and can never be highlighted or turned into a chip. */
const NoteObjectCard = ({ objects }: { objects: SolutionObject[] }) => {
  if (!objects.length) return null;
  // Notes-layer lesson content: rendered inline inside its owning line's note,
  // at note scale — never a separate framed sheet.
  return (
    <div className="my-1 space-y-2">
      {objects.map((o) => (
        <div key={o.objId} className="lesson-doc max-w-full select-none">
          <SolutionObjectView nodeType={o.nodeType} attrs={o.attrs ?? {}} />
        </div>
      ))}
    </div>
  );
};


const FloatingNumbersPage = () => {
  const { notebookId, subsectionId } = useParams<{ notebookId: string; subsectionId: string }>();
  const navigate = useNavigate();
  // Floating Number AI is a retired feature while archived (see Application Archive).
  const { archived: aiArchivedRaw } = useArchivedFeature("floating_number_ai");
  const aiArchived = aiArchivedRaw !== false;
  const [info, setInfo] = useState<SubInfo | null>(null);
  const [lines, setLines] = useState<FloatingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirtyRef = useRef(false);

  const [fromHighlights, setFromHighlights] = useState(false);
  /* Highlight stream (text lines + table workspaces), in document order. */
  const [entries, setEntries] = useState<Entry[]>([]);
  /** Diagrams that sit ABOVE every highlight — note-only lesson content. */
  const [leadingNoteObjects, setLeadingNoteObjects] = useState<SolutionObject[]>([]);
  /* Table workspace UI state — which table is in Retention mode, and which
     manual line is currently collecting cell clicks. */
  const [retentionTable, setRetentionTable] = useState<string | null>(null);
  const [manualLineId, setManualLineId] = useState<string | null>(null);
  const [highlightsData, setHighlightsData] = useState<{ uid: string; groupId: number; payload: string }[]>([]);
  const [scoring, setScoring] = useState<FloatingScoring>(DEFAULT_SCORING);

  /* ---------- Selected line (drives the AI Assistant context) ---------- */
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const selectedLine = useMemo(
    () => lines.find((l) => l.lineId === selectedLineId) ?? null,
    [lines, selectedLineId],
  );

  /* ---------- Active highlight for the AI Assistant ----------
     A single, live highlight. Every selection change inside the workspace
     instantly replaces it; selection-collapse is ignored so the chip stays
     visible until either a new highlight appears, the user dismisses it, or
     it is consumed by a send. */
  const [activeHighlight, setActiveHighlight] = useState<ActiveHighlight | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => {
      const root = workspaceRef.current;
      if (!root) return;
      const sel = window.getSelection?.();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().trim();
      if (!text) return;
      const anchor = sel.anchorNode;
      if (!anchor) return;
      const anchorEl = anchor.nodeType === 1 ? (anchor as Element) : anchor.parentElement;
      if (!anchorEl || !root.contains(anchorEl)) return;
      const lineEl = anchorEl.closest("[data-line-id]") as HTMLElement | null;
      const lid = lineEl?.dataset.lineId ?? null;
      setActiveHighlight((prev) =>
        prev && prev.text === text && (prev.lineId ?? null) === lid
          ? prev
          : { id: newId(), text, lineId: lid },
      );
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  /* ---------- Apply / Undo from AI Assistant ---------- */
  const applyChipsFromAssistant = useCallback(
    ({ lineId, chips }: { lineId: string; chips: string[]; scaffolds?: string[] }) => {
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.lineId === lineId);
        if (idx < 0) return prev;
        // Snapshot current state for undo before mutating.
        const current = prev[idx];
        const snap = {
          chips: current.fillers,
          scaffolds: current.containers,
        };
        void supabase.auth.getSession().then(({ data }) => {
          const uid = data.session?.user?.id;
          if (!uid || !info) return;
          void supabase.from("floating_chip_snapshots").insert({
            owner_id: uid,
            subsection_id: info.subsectionId,
            line_id: lineId,
            chips: snap.chips as any,
            scaffolds: snap.scaffolds as any,
            source: "pre-assistant-apply",
          } as any);
        });
        const normalised = dropContextualLeadingPlus(chips);
        const containers = detectStructures(current.equation) as ContainerKind[];
        const next: FloatingLine = {
          ...current,
          fillers: normalised,
          containers,
          arrangement: identityArrangement(normalised.length),
          fillersSelected: normalised.map(() => false),
          containersSelected: containers.map(() => false),
        };
        const out = [...prev];
        out[idx] = next;
        dirtyRef.current = true;
        return out;
      });
    },
    [info],
  );

  const undoFromAssistant = useCallback(
    async (lineId: string) => {
      if (!info) return;
      const { data: snaps } = await supabase
        .from("floating_chip_snapshots")
        .select("*")
        .eq("subsection_id", info.subsectionId)
        .eq("line_id", lineId)
        .order("created_at", { ascending: false })
        .limit(1);
      const snap = (snaps as any[])?.[0];
      if (!snap) {
        toast({ title: "Nothing to undo", description: "No previous snapshot for this line." });
        return;
      }
      setLines((prev) =>
        prev.map((l) => {
          if (l.lineId !== lineId) return l;
          const fillers = Array.isArray(snap.chips) ? (snap.chips as string[]) : [];
          const containers = Array.isArray(snap.scaffolds)
            ? (snap.scaffolds as ContainerKind[])
            : [];
          return {
            ...l,
            fillers,
            containers,
            arrangement: identityArrangement(fillers.length),
            fillersSelected: fillers.map(() => false),
            containersSelected: containers.map(() => false),
          };
        }),
      );
      dirtyRef.current = true;
      toast({ title: "Undone", description: "Line restored to previous snapshot." });
    },
    [info],
  );

  /* ---------- Targeted line patches from AI Assistant (move/add/remove/etc) ---------- */
  const applyLineUpdateFromAssistant = useCallback(
    (p: LineUpdatePayload) => {
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.lineId === p.lineId);
        if (idx < 0) {
          toast({ title: "Line not found", description: `No line ${p.lineId.slice(0, 6)} in workspace.`, variant: "destructive" });
          return prev;
        }
        const current = prev[idx];
        const fillers = [...current.fillers];
        const containers = [...current.containers];
        let arrangement = current.arrangement.length === fillers.length
          ? [...current.arrangement]
          : identityArrangement(fillers.length);

        const snapForUndo = { chips: current.fillers, scaffolds: current.containers };

        switch (p.op) {
          case "move_filler": {
            const from = Number(p.from_index);
            const to = Number(p.to_index);
            if (!Number.isFinite(from) || !Number.isFinite(to)) return prev;
            // Operate on the visual order via arrangement.
            const order = arrangement.length === fillers.length ? arrangement : identityArrangement(fillers.length);
            if (from < 0 || from >= order.length || to < 0 || to >= order.length) return prev;
            const moved = order.splice(from, 1)[0];
            order.splice(to, 0, moved);
            arrangement = order;
            break;
          }
          case "add_filler": {
            const v = (p.value ?? "").trim();
            if (!v) return prev;
            fillers.push(v);
            arrangement = identityArrangement(fillers.length);
            if (p.container) {
              const c = String(p.container).toLowerCase() as ContainerKind;
              if (!containers.includes(c)) containers.push(c);
            }
            break;
          }
          case "remove_filler": {
            let removeIdx = -1;
            if (p.value != null) {
              const v = String(p.value).trim();
              removeIdx = fillers.findIndex((f) => f.trim() === v);
            }
            if (removeIdx < 0 && p.index != null && Number.isFinite(p.index)) {
              removeIdx = Number(p.index);
            }
            if (removeIdx < 0 || removeIdx >= fillers.length) return prev;
            fillers.splice(removeIdx, 1);
            arrangement = identityArrangement(fillers.length);
            break;
          }
          case "add_container": {
            const c = String(p.container ?? "").toLowerCase() as ContainerKind;
            if (!c || containers.includes(c)) return prev;
            containers.push(c);
            break;
          }
          case "remove_container": {
            const c = String(p.container ?? "").toLowerCase() as ContainerKind;
            const ci = containers.indexOf(c);
            if (ci < 0) return prev;
            containers.splice(ci, 1);
            break;
          }
          case "set_arrangement": {
            const arr = Array.isArray(p.arrangement) ? p.arrangement.slice() : [];
            if (arr.length !== fillers.length) return prev;
            arrangement = arr;
            break;
          }
          case "replace_line": {
            const nextFillers = (p.fillers ?? []).map((f) => String(f));
            const nextContainers = (p.containers ?? []).map((c) => String(c).toLowerCase() as ContainerKind);
            const nextArrangement = Array.isArray(p.arrangement) && p.arrangement.length === nextFillers.length
              ? p.arrangement.slice()
              : identityArrangement(nextFillers.length);
            // Snapshot for undo, then full replace.
            void supabase.auth.getSession().then(({ data }) => {
              const uid = data.session?.user?.id;
              if (!uid || !info) return;
              void supabase.from("floating_chip_snapshots").insert({
                owner_id: uid,
                subsection_id: info.subsectionId,
                line_id: p.lineId,
                chips: snapForUndo.chips as any,
                scaffolds: snapForUndo.scaffolds as any,
                source: "pre-assistant-line-update",
              } as any);
            });
            const out = [...prev];
            out[idx] = {
              ...current,
              fillers: nextFillers,
              containers: nextContainers,
              arrangement: nextArrangement,
              fillersSelected: nextFillers.map(() => false),
              containersSelected: nextContainers.map(() => false),
            };
            dirtyRef.current = true;
            return out;
          }
          default:
            return prev;
        }

        // Snapshot for undo on small-edits too.
        void supabase.auth.getSession().then(({ data }) => {
          const uid = data.session?.user?.id;
          if (!uid || !info) return;
          void supabase.from("floating_chip_snapshots").insert({
            owner_id: uid,
            subsection_id: info.subsectionId,
            line_id: p.lineId,
            chips: snapForUndo.chips as any,
            scaffolds: snapForUndo.scaffolds as any,
            source: `pre-assistant-${p.op}`,
          } as any);
        });

        const out = [...prev];
        out[idx] = {
          ...current,
          fillers,
          containers,
          arrangement,
          fillersSelected: fillers.map(() => false),
          containersSelected: containers.map(() => false),
        };
        dirtyRef.current = true;
        return out;
      });
    },
    [info],
  );



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
    const currentLine = aiEditLineIndex != null ? lines[aiEditLineIndex] : null;
    const { data, error } = await withTimeout(supabase.functions.invoke("notebook-ai", {
      body: {
        mode: "floating_line_edit",
        problem: info.problem,
        equation: target.text,
        instruction,
        currentFillers: currentLine?.fillers ?? [],
        currentContainers: currentLine?.containers ?? [],
        subject: info.subject,
        subtopic: info.subtopic,
        sectionKind: info.sectionKind,
      },
    }), 35_000, "AI editing took too long. Please try again.");
    if (error) throw error;
    const d = data as {
      equation?: string;
      fillers?: string[];
      containers?: ContainerKind[];
      diagnostics?: { id: string; label: string; status: "pass"|"fail"|"fixed"; detail?: string }[];
      status?: "clean" | "fixed" | "unresolved";
      recovery?: {
        reason: "structure_not_decomposed" | "law_violation" | "missing_terms" | "unknown";
        summary: string;
        hints: string[];
        suggestedInstructions: string[];
        canRevert: boolean;
      };
    } | null;
    if (!d || !Array.isArray(d.fillers)) throw new Error("AI returned no line");
    aiEditResultRef.current = {
      equation: String(d.equation ?? target.text),
      fillers: d.fillers.map(String),
      containers: Array.isArray(d.containers) ? d.containers as ContainerKind[] : [],
      status: d.status,
    };
    aiEditDiagRef.current = d.diagnostics && d.status
      ? { status: d.status, items: d.diagnostics, recovery: d.recovery }
      : null;
    return String(d.equation ?? target.text);
  }, [info, aiEditLineIndex, lines]);

  const aiEditResultRef = useRef<{
    equation: string;
    fillers: string[];
    containers: ContainerKind[];
    status?: "clean" | "fixed" | "unresolved";
  } | null>(null);
  const aiEditDiagRef = useRef<{
    status: "clean" | "fixed" | "unresolved";
    items: { id: string; label: string; status: "pass"|"fail"|"fixed"; detail?: string }[];
    recovery?: {
      reason: "structure_not_decomposed" | "law_violation" | "missing_terms" | "unknown";
      summary: string;
      hints: string[];
      suggestedInstructions: string[];
      canRevert: boolean;
    };
  } | null>(null);

  const applyAiEdit = useCallback((_proposed: string): boolean => {
    const i = aiEditLineIndex;
    const result = aiEditResultRef.current;
    if (i == null || !result) return false;
    if (result.status === "unresolved") {
      toast({ title: "Can't apply — issues remain", description: "Click Regenerate or add an instruction.", variant: "destructive" });
      return false;
    }
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
    return true;
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
        | { uid?: string; groupId: number; payload: string; notebookOnly?: boolean; object?: any; noteObjects?: any }[] | null;
      const persisted = (ss as any).floating_lines as FloatingLine[] | null;

      const savedScoring = (ss as any).floating_scoring as FloatingScoring | null;
      if (savedScoring && typeof savedScoring === "object") {
        setScoring({ ...DEFAULT_SCORING, ...savedScoring });
      }

      // Highlight stream, in document order. Text highlights become one
      // Floating Number line each; a highlighted TABLE becomes a workspace
      // that can own many lines. Non-table objects (diagrams) stay skipped.
      // DIAGRAM LAW: diagrams are NOTE content. They never become rows of
      // their own — each one rides the note of the entry above it, and any
      // diagram above every entry is shown on its own as note-only content.
      // DIAGRAM LAW (final): diagrams never enter the Floating Numbers page at
      // all — not as rows, not as chips, not as attached note content. They
      // stay in the Lesson Note and on the Smartboard. Only non-floatable
      // NON-diagram note content (e.g. tables shown as notes) rides here.
      const readNoteObjs = (raw: any): SolutionObject[] =>
        readSolutionObjects({ objects: Array.isArray(raw) ? raw : [] })
          .filter((o) => !isFloatableObject(o) && !isDiagramFamily(o.family));
      const allHighlights = Array.isArray(highlights) ? highlights : [];
      setLeadingNoteObjects(
        allHighlights
          .filter((h) => h.notebookOnly)
          .flatMap((h) => readNoteObjs((h as any).noteObjects)),
      );
      const noteObjByPayload = new Map<string, SolutionObject[]>();
      for (const h of allHighlights) {
        if (h.notebookOnly) continue;
        const objs = readNoteObjs((h as any).noteObjects);
        if (objs.length) noteObjByPayload.set(String(h.payload ?? ""), objs);
      }
      const ordered = allHighlights.filter((h) => !h.notebookOnly);
      const seq: Entry[] = [];
      for (const h of ordered) {
        const obj = (h as any).object;
        if (obj) {
          const parsed = readSolutionObjects({ objects: [obj] })[0];
          if (!parsed) continue;
          // DIAGRAM LAW: diagrams belong to the Notes layer. They never become
          // a floating workspace, a chip or a numbered floating line.
          if (!isFloatableObject(parsed)) continue;
          // EVERY object travels: tables and Smart Structures become
          // workspaces; diagrams, graphs, 3D scenes, animations and images
          // become a single placeable lesson object.
          const grid = gridFromAnyObject(parsed);
          if (!grid) continue;
          seq.push({ kind: "table", objId: grid.objId, grid });
          continue;
        }
        const payload = String(h.payload ?? "");
        if (!payload.trim()) continue;
        seq.push({
          kind: "text",
          highlight: { uid: String((h as any).uid ?? ""), groupId: h.groupId, payload },
        });
      }
      setEntries(seq);

      const textHighlights = seq.flatMap((e) => (e.kind === "text" ? [e.highlight] : []));
      const hasHighlights = textHighlights.length > 0 || seq.length > 0;
      setFromHighlights(textHighlights.length > 0);
      setHighlightsData(textHighlights);

      if (hasHighlights) {
        // Highlights drive the list. Re-pair each highlight to its persisted
        // line so AI-generated fillers AND the teacher's chip selections
        // (fillersSelected / containersSelected) survive every reload.
        // Pairing priority: (a) exact equation==payload match, then
        // (b) positional fallback (same index) so a selection is never lost
        // to math/LaTeX normalization drift. Only a removed highlight drops a row.
        const persistedAll: FloatingLine[] = Array.isArray(persisted)
          ? persisted.map(normalizeFloatingLine)
          : [];
        const persistedList = persistedAll.filter((p) => !p.table);
        const byTable = new Map<string, FloatingLine[]>();
        for (const p of persistedAll) {
          if (!p.table?.objId) continue;
          const arr = byTable.get(p.table.objId) ?? [];
          arr.push(p);
          byTable.set(p.table.objId, arr);
        }
        // LEGACY ADOPTION: rows saved before permanent identity existed carry
        // only a positional groupId (and, historically, chips one line out of
        // step). Adopt their identity ONCE here; from then on `sourceUid` is
        // the only key used.
        const repairedList = adoptLineIdentities(
          allHighlights as any[],
          persistedList as any[],
          subsectionId,
        ).lines as unknown as FloatingLine[];
        const used = new Set<number>();
        const reconciled: FloatingLine[] = [];
        for (const e of seq) {
          if (e.kind === "table") {
            // Restore the table's saved lines, refreshed with the latest grid.
            const saved = byTable.get(e.objId) ?? [];
            for (const s of saved) {
              reconciled.push({ ...s, table: { ...s.table!, grid: e.grid } });
            }
            continue;
          }
          const payload = String(e.highlight.payload ?? "");
          const groupId = e.highlight.groupId;
          const uid = e.highlight.uid;
          // PAIRING LAW: the highlight's PERMANENT uid, and nothing else. No
          // equation-text guess, no array position — either this line's own
          // floating row exists, or the line has no floating numbers yet.
          const idx = uid
            ? repairedList.findIndex(
                (p, i) => !used.has(i) && String((p as any).sourceUid ?? "") === uid,
              )
            : -1;
          const noteObjs = noteObjByPayload.get(payload);
          if (idx >= 0) {
            used.add(idx);
            // Lock the equation to the permanent highlight payload while keeping
            // the persisted fillers + selection state.
            reconciled.push(ensureAtomicMatrixFiller({
              ...repairedList[idx],
              sourceUid: uid,
              questionId: subsectionId,
              groupId,
              equation: payload,
              noteObjects: noteObjs,
            }, payload));
            continue;
          }
          reconciled.push(ensureAtomicMatrixFiller({
            lineId: newId(),
            sourceUid: uid,
            questionId: subsectionId,
            groupId,
            equation: payload,
            fillers: [],
            containers: [],
            arrangement: [],
            noteObjects: noteObjs,
          }, payload));
        }
        setLines(reconciled);

      } else {
        // SELECTION LAW: this page NEVER re-interprets the solution. With no
        // saved highlights there is nothing to generate — the teacher must go
        // back to the Highlighting Page and select content first.
        setLines([]);
      }

      setLoading(false);
    })();
  }, [subsectionId, notebookId, navigate]);


  /* ---------- Archive (previously generated configurations) ---------- */
  const [archiveOpen, setArchiveOpen] = useState(false);

  /** Snapshot the configuration that is about to be replaced. */
  const archiveLines = useCallback(async (source: string, snapshot: FloatingLine[]) => {
    if (!info) return;
    const rows = snapshot
      .filter((l) => (l.fillers?.length ?? 0) > 0 || (l.containers?.length ?? 0) > 0)
      .map((l) => ({
        subsection_id: info.subsectionId,
        line_id: l.lineId,
        chips: (l.fillers ?? []) as any,
        scaffolds: (l.containers ?? []) as any,
        source,
      }));
    if (rows.length === 0) return;
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return;
      await supabase
        .from("floating_chip_snapshots")
        .insert(rows.map((r) => ({ ...r, owner_id: uid })) as any);
    } catch (e) {
      console.warn("[floating] could not archive configuration", e);
    }
  }, [info]);

  const restoreArchived = useCallback((version: ArchivedVersion) => {
    const byLine = new Map(version.lines.map((l) => [l.lineId, l]));
    setLines((prev) => {
      void archiveLines("pre-restore", prev);
      return prev.map((l) => {
        const hit = byLine.get(l.lineId);
        if (!hit) return l;
        const fillers = hit.chips.map(String);
        return {
          ...l,
          fillers,
          containers: hit.containers,
          arrangement: identityArrangement(fillers.length),
          fillersSelected: fillers.map(() => false),
          containersSelected: hit.containers.map(() => false),
        };
      });
    });
    dirtyRef.current = true;
    setArchiveOpen(false);
    toast({ title: "Version restored", description: "The archived floating numbers are back on the page." });
  }, [archiveLines]);

  /* ---------- AI Generate (all lines at once) ---------- */
  const generateAll = useCallback(async () => {
    if (!info || generating) return; // single-flight — Generate can never stack
    const endDiag = diag.start("floating.generate", { subsectionId: info.subsectionId });
    setGenerating(true);
    try {
      await archiveLines("pre-generate", lines);
      const body = fromHighlights
        ? {
            mode: "floating_highlights",
            subject: info.subject,
            subtopic: info.subtopic,
            sectionKind: info.sectionKind,
            problem: info.problem,
            highlights: highlightsData.map((h) => ({
              uid: h.uid,
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
      const { data, error } = await withTimeout(
        supabase.functions.invoke("notebook-ai", { body }),
        45_000,
        "Floating-number generation took too long. Please try again.",
      );
      if (error) throw error;
      const aiLines = (data as any)?.lines as
        | { uid?: string; equation: string; fillers: string[]; containers: string[] }[]
        | undefined;
      if (!aiLines || !Array.isArray(aiLines) || aiLines.length === 0) {
        toast({ title: "AI returned no floating pieces", variant: "destructive" });
        return;
      }
      // Match AI lines back to our equation order by index; fall back to creating fresh ids.
      // Table-derived lines are owned by their table workspace — the AI pass
      // only rewrites the text-highlight lines, index-aligned with them.
      const existing = lines.filter((l) => !l.table);
      const existingByUid = new Map(
        existing
          .filter((l) => l.sourceUid)
          .map((l) => [String(l.sourceUid), l] as const),
      );
      const next: FloatingLine[] = aiLines.map((a, i) => {
        // IDENTITY: the generator echoes the source line's uid. Everything
        // this row becomes is stamped with it, so it can never drift onto a
        // neighbouring line later.
        const sourceUid = String(a.uid ?? highlightsData[i]?.uid ?? "");
        const owner = sourceUid ? existingByUid.get(sourceUid) : undefined;
        const ownerPayload = sourceUid
          ? highlightsData.find((h) => h.uid === sourceUid)?.payload
          : undefined;
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
          ? (ownerPayload ?? owner?.equation ?? a.equation ?? "")
          : (a.equation || owner?.equation || existing[i]?.equation || "");
        const matrixSplit = splitMatrixChip(equation);
        if (matrixSplit) {
          // STRUCTURE FIRST: empty matrix shell chip, then one chip per cell.
          const mFillers = [matrixSplit.shell, ...matrixSplit.values];
          return {
            lineId: owner?.lineId ?? existing[i]?.lineId ?? newId(),
            sourceUid: sourceUid || undefined,
            questionId: info.subsectionId,
            equation,
            fillers: mFillers,
            containers: [],
            arrangement: mFillers.map((_, k) => k),
            fillersSelected: mFillers.map(() => false),
            containersSelected: [],
          };
        }
        // Only show symbols that ACTUALLY appear in this equation (or in
        // structural fillers the AI tried to emit). Never default-show all.
        const containers = mergeStructures(
          detectStructures(equation) as ContainerKind[],
          structFromFillers as ContainerKind[],
          rawAiContainers,
        );

        const normalised = dropContextualLeadingPlus(fillers);
        return {
          lineId: owner?.lineId ?? existing[i]?.lineId ?? newId(),
          sourceUid: sourceUid || undefined,
          questionId: info.subsectionId,
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
      // TEACHER AUTHORITY: a line the teacher edited by hand is never
      // rewritten by Generate. Its saved version wins and is reported back.
      let preserved = 0;
      const guarded = next.map((candidate) => {
        const mine = lines.find(
          (p) =>
            !p.table &&
            p.editedByTeacher &&
            ((candidate.sourceUid && p.sourceUid === candidate.sourceUid) ||
              (!candidate.sourceUid && p.lineId === candidate.lineId)),
        );
        if (!mine) return candidate;
        preserved++;
        return mine;
      });
      // Merge back: table lines keep their slot, text lines take the new set.
      setLines((prev) => {
        if (!prev.some((l) => l.table)) return guarded;
        const queue = guarded.slice();

        const merged: FloatingLine[] = [];
        for (const l of prev) {
          if (l.table) { merged.push(l); continue; }
          const n = queue.shift();
          if (n) merged.push(n);
        }
        merged.push(...queue);
        return merged;
      });
      dirtyRef.current = true;
      toast({
        title: "Floating numbers ready",
        description:
          preserved > 0
            ? `${next.length} lines prepared · ${preserved} of your edited line${preserved === 1 ? "" : "s"} kept unchanged.`
            : `${next.length} lines prepared.`,
      });

      endDiag("ok");
    } catch (e: any) {
      endDiag("fail", { error: String(e?.message ?? e) });
      toast({ title: "Could not generate", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [info, generating, lines, fromHighlights, highlightsData, archiveLines]);

  const shuffleAll = useCallback(() => {
    dirtyRef.current = true;
    setLines((prev) => prev.map((l) => ({ ...l, arrangement: rearrangeIndices(l.fillers.length) })));
  }, []);

  /* ---------- Teacher line controls (delete / copy / paste / order) ------- */
  const mutate = useCallback((fn: (prev: FloatingLine[]) => FloatingLine[]) => {
    dirtyRef.current = true;
    setLines((prev) => fn(prev));
  }, []);

  const copyLine = useCallback(async (l: FloatingLine) => {
    const ok = await writeFloatingClipboard(lineToPayload(l));
    toast(
      ok
        ? { title: "Copied", description: "Floating objects copied — structure preserved." }
        : { title: "Could not copy", description: "Your browser blocked clipboard access.", variant: "destructive" },
    );
  }, []);

  const pasteIntoLine = useCallback(async (index: number) => {
    const payload = await readFloatingClipboard();
    if (!payload) {
      toast({ title: "Nothing to paste", description: "No mathematical content found on the clipboard.", variant: "destructive" });
      return;
    }
    mutate((prev) =>
      prev.map((p, i) => (i === index ? markTeacherEdited(applyPayloadToLine(p, payload)) : p)),
    );
    toast({ title: "Pasted", description: `${payload.fillers.length} floating objects placed on this line.` });
  }, [mutate]);

  const deleteLineContent = useCallback((index: number) => {
    mutate((prev) =>
      prev.map((p, i) =>
        i === index
          ? markTeacherEdited({
              ...p,
              fillers: [],
              containers: [],
              arrangement: [],
              fillersSelected: [],
              containersSelected: [],
            })
          : p,
      ),
    );
    toast({ title: "Line cleared", description: "You can now paste or build the correct objects." });
  }, [mutate]);

  const duplicateLine = useCallback((index: number) => {
    mutate((prev) => {
      const src = prev[index];
      if (!src || src.table) return prev;
      const copy = markTeacherEdited({
        ...src,
        lineId: newId(),
        sourceUid: undefined,
        fillers: src.fillers.slice(),
        containers: src.containers.slice(),
        arrangement: identityArrangement(src.fillers.length),
        fillersSelected: src.fillers.map(() => false),
        containersSelected: src.containers.map(() => false),
      });
      const out = prev.slice();
      out.splice(index + 1, 0, copy);
      return out;
    });
  }, [mutate]);

  const moveLine = useCallback((index: number, dir: -1 | 1) => {
    mutate((prev) => {
      const to = index + dir;
      if (to < 0 || to >= prev.length) return prev;
      if (prev[index]?.table || prev[to]?.table) return prev;
      const out = prev.slice();
      [out[index], out[to]] = [out[to], out[index]];
      return out;
    });
  }, [mutate]);

  /** Release ONE line from teacher ownership so the next Generate rebuilds it. */
  const allowRegenerate = useCallback((index: number) => {
    mutate((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, editedByTeacher: false, editedAt: undefined } : p,
      ),
    );
    toast({ title: "Line released", description: "Generate Floating Numbers will rebuild this line." });
  }, [mutate]);


  const resetAll = useCallback(() => {
    dirtyRef.current = true;
    setLines((prev) => {
      void archiveLines("pre-reset", prev);
      return prev.map((l) => ({
        ...l,
        fillers: [],
        containers: [],
        arrangement: [],
        fillersSelected: [],
        containersSelected: [],
      }));
    });
    toast({ title: "Reset", description: "All floating numbers cleared. You can now build them manually." });
  }, [archiveLines]);

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
    if (error) {
      setSaving(false);
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return false;
    }
    // Parity self-check: read back the row and verify every filler we sent
    // is present verbatim. If anything drifted (normalization, race, etc.)
    // re-issue the write once so teacher edits are never silently lost.
    try {
      const { data: roundtrip } = await supabase
        .from("notebook_subsections")
        .select("floating_lines")
        .eq("id", info.subsectionId)
        .maybeSingle();
      const saved = (roundtrip as any)?.floating_lines as FloatingLine[] | null;
      const drift =
        !Array.isArray(saved) ||
        saved.length !== cleanLines.length ||
        cleanLines.some((line, i) => {
          const other = saved[i];
          if (!other) return true;
          const a = line.fillers ?? [];
          const b = other.fillers ?? [];
          if (a.length !== b.length) return true;
          return a.some((v, j) => String(v) !== String(b[j]));
        });
      if (drift) {
        console.warn("[floating] save parity drift — re-issuing write to preserve teacher edits");
        await supabase
          .from("notebook_subsections")
          .update({
            floating_lines: cleanLines as any,
            floating_bucket: bucket as any,
            floating_scoring: scoring as any,
          })
          .eq("id", info.subsectionId);
      }
    } catch (e) {
      console.warn("[floating] parity check failed", e);
    }
    setSaving(false);
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

  /* ---------- Test on Smartboard ---------- */
  const [openingTest, setOpeningTest] = useState(false);
  const testOnSmartboard = useCallback(async () => {
    if (!info || openingTest) return;
    const end = diag.start("floating.test.launch", { subsectionId: info.subsectionId });
    setOpeningTest(true);
    try {
      if (dirtyRef.current) await persistRef.current(true);
      end("ok");
      navigate(`/lesson-notes/${notebookId}/floating/${info.subsectionId}/test`);
    } catch (e: any) {
      end("fail", { error: String(e?.message ?? e) });
      toast({ title: "Could not open the test board", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setOpeningTest(false);
    }
  }, [info, openingTest, navigate, notebookId]);

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

  /* ───────────────── Table workspaces ─────────────────
     A highlighted table owns a contiguous run of Floating Number lines.
     Orientation / Generate / Retention are independent controls. */

  const [tableConfig, setTableConfig] = useState<
    Record<string, { orientation: TableOrientation; retained: string[] }>
  >({});

  useEffect(() => {
    setTableConfig((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const l of lines) {
        const t = l.table;
        if (!t?.objId || next[t.objId]) continue;
        next[t.objId] = {
          orientation: t.orientation ?? "row",
          // HEADER RETENTION BY DEFAULT — the heading row/column of a table is
          // the teacher's label, never the student's answer.
          retained: t.retained ?? (t.grid ? defaultRetainedCells(t.grid as TableGrid) : []),
        };
        changed = true;
      }
      for (const e of entries) {
        if (e.kind !== "table" || next[e.objId]) continue;
        next[e.objId] = { orientation: "row", retained: defaultRetainedCells(e.grid) };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [lines, entries]);


  /** Render groups: text lines and table workspaces, in document order.
   *  `insertAt` is where a table's lines start inside the flat `lines` list. */
  type Group =
    | { kind: "text"; line: FloatingLine; index: number }
    | { kind: "table"; grid: TableGrid; objId: string; insertAt: number; items: { line: FloatingLine; index: number }[] };

  const groups = useMemo<Group[]>(() => {
    const out: Group[] = [];
    let i = 0;
    for (const e of entries) {
      if (e.kind === "table") {
        const items: { line: FloatingLine; index: number }[] = [];
        const insertAt = i;
        while (i < lines.length && lines[i].table?.objId === e.objId) {
          items.push({ line: lines[i], index: i });
          i++;
        }
        out.push({ kind: "table", grid: e.grid, objId: e.objId, insertAt, items });
      } else {
        while (i < lines.length && lines[i].table) i++;
        if (i < lines.length) {
          out.push({ kind: "text", line: lines[i], index: i });
          i++;
        }
      }
    }
    while (i < lines.length) {
      out.push({ kind: "text", line: lines[i], index: i });
      i++;
    }
    return out;
  }, [entries, lines]);

  /* THE NUMBERING LAW — the main path carries L-numbers (equations only) and
     one T-number per table or M-number per matrix. A branch's rows/columns are its CHILDREN, numbered
     inside that branch: T1.1 … T1.n, M1.1 … M1.n. Branches never share a series
     and never consume an L-number. */
  const numbering = useMemo(() => {
    const lineTags: Record<number, string> = {};
    const tableStep: Record<string, string> = {};
    let l = 0;
    let t = 0;
    let m = 0;
    for (const g of groups) {
      if (g.kind === "table") {
        const tag = g.grid.isMatrix ? `M${++m}` : `T${++t}`;
        tableStep[g.objId] = tag;
        for (let i = 0; i < g.items.length; i++) {
          lineTags[g.items[i].index] = `${tag}.${i + 1}`;
        }
      } else {
        l += 1;
        lineTags[g.index] = `L${l}`;
      }
    }
    return { lineTags, tableStep };
  }, [groups]);



  const patchTableLines = useCallback(
    (objId: string, patch: Partial<NonNullable<FloatingLine["table"]>>) => {
      dirtyRef.current = true;
      setLines((prev) =>
        prev.map((l) =>
          l.table?.objId === objId ? { ...l, table: { ...l.table, ...patch } } : l,
        ),
      );
    },
    [],
  );

  const setOrientation = useCallback(
    (objId: string, orientation: TableOrientation) => {
      setTableConfig((prev) => ({
        ...prev,
        [objId]: { orientation, retained: prev[objId]?.retained ?? [] },
      }));
      setManualLineId(null);
      patchTableLines(objId, { orientation });
    },
    [patchTableLines],
  );

  const toggleRetentionMode = useCallback((objId: string) => {
    setManualLineId(null);
    setRetentionTable((prev) => (prev === objId ? null : objId));
  }, []);

  const generateTable = useCallback(
    (grid: TableGrid, insertAt: number, count: number) => {
      const orientation = tableConfig[grid.objId]?.orientation ?? "row";
      const retained = tableConfig[grid.objId]?.retained ?? [];
      const built = generateTableLines(grid, orientation).map((g) => ({
        lineId: newId(),
        equation: g.values.join("  "),
        fillers: g.values,
        containers: [] as ContainerKind[],
        arrangement: identityArrangement(g.values.length),
        fillersSelected: g.values.map(() => false),
        containersSelected: [],
        marks: scoring.mode === "equal" ? scoring.marksPerLine : 0,
        table: {
          objId: grid.objId,
          label: g.label,
          orientation,
          cellKeys: g.cellKeys,
          retained,
          manual: false,
          grid,
        },
      })) as FloatingLine[];
      dirtyRef.current = true;
      setManualLineId(null);
      setLines((prev) => {
        const next = prev.slice();
        next.splice(insertAt, count, ...built);
        return next;
      });
      toast({ title: `${built.length} line${built.length === 1 ? "" : "s"} generated`, description: `${grid.label} · ${orientation === "row" ? "row" : "column"}-oriented.` });
    },
    [tableConfig, scoring.mode, scoring.marksPerLine],
  );

  const addManualLine = useCallback(
    (grid: TableGrid, insertAt: number, count: number) => {
      const orientation = tableConfig[grid.objId]?.orientation ?? "row";
      const retained = tableConfig[grid.objId]?.retained ?? [];
      const line: FloatingLine = {
        lineId: newId(),
        equation: "",
        fillers: [],
        containers: [],
        arrangement: [],
        marks: scoring.mode === "equal" ? scoring.marksPerLine : 0,
        table: {
          objId: grid.objId,
          label: "Manual line",
          orientation,
          cellKeys: [],
          retained,
          manual: true,
          grid,
        },
      };
      dirtyRef.current = true;
      setRetentionTable(null);
      setManualLineId(line.lineId);
      setLines((prev) => {
        const next = prev.slice();
        next.splice(insertAt + count, 0, line);
        return next;
      });
    },
    [tableConfig, scoring.mode, scoring.marksPerLine],
  );

  const onTableCellClick = useCallback(
    (grid: TableGrid, key: string) => {
      const objId = grid.objId;
      const orientation = tableConfig[objId]?.orientation ?? "row";

      // Retention mode — mark cells that stay visible for students.
      if (retentionTable === objId) {
        const current = tableConfig[objId]?.retained ?? [];
        const nextRetained = current.includes(key)
          ? current.filter((k) => k !== key)
          : [...current, key];
        setTableConfig((prev) => ({ ...prev, [objId]: { orientation, retained: nextRetained } }));
        patchTableLines(objId, { retained: nextRetained });
        return;
      }

      // Manual assignment — cells join the line being built.
      const target = lines.find((l) => l.lineId === manualLineId && l.table?.objId === objId);
      if (!target) {
        toast({ title: "Pick a target first", description: 'Click "+ Add Line" (or Retention) before selecting cells.' });
        return;
      }
      const existing = target.table?.cellKeys ?? [];
      if (!existing.includes(key) && !cellFitsLine(orientation, existing, key)) {
        toast({
          title: "Orientation rule",
          description: `This workspace is ${orientation}-oriented — every cell of a line must share the same ${orientation}.`,
          variant: "destructive",
        });
        return;
      }
      const cellKeys = existing.includes(key)
        ? existing.filter((k) => k !== key)
        : [...existing, key];
      const values = cellKeys
        .map((k) => tableLineEquation(grid, [k]))
        .filter((v) => v.trim().length > 0);
      dirtyRef.current = true;
      setLines((prev) =>
        prev.map((l) =>
          l.lineId !== target.lineId
            ? l
            : {
                ...l,
                equation: values.join("  "),
                fillers: values,
                arrangement: identityArrangement(values.length),
                fillersSelected: values.map(() => false),
                table: { ...l.table!, cellKeys, grid },
              },
        ),
      );
    },
    [tableConfig, retentionTable, manualLineId, lines, patchTableLines],
  );


  return (
    <div className="flex min-h-screen" style={{ background: "hsl(38 35% 92%)" }}>
      <div className="flex-1 min-w-0">
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
            <button
              onClick={() => void testOnSmartboard()}
              disabled={loading || openingTest || lines.every((l) => l.fillers.length === 0)}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5 disabled:opacity-40"
              style={{ color: "hsl(220 35% 18%)" }}
              title="Open this question on the student Smartboard — nothing is saved"
            >
              {openingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MonitorPlay className="h-3.5 w-3.5" />}
              Test on Smartboard
            </button>
            <button
              onClick={() => setArchiveOpen(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5 disabled:opacity-40"
              style={{ color: "hsl(220 35% 18%)" }}
              title="Previously generated configurations"
            >
              <Archive className="h-3.5 w-3.5" /> Archive
            </button>
            <button
              onClick={resetAll}
              disabled={loading || lines.every((l) => l.fillers.length === 0 && l.containers.length === 0)}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-red-300/60 hover:bg-red-50 disabled:opacity-40"
              style={{ color: "hsl(0 60% 45%)" }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
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

          {/* Question time lives with the question — never with a Game. */}
          <label className="inline-flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={Boolean(scoring.timerEnabled)}
              onChange={(e) => updateScoring({ timerEnabled: e.target.checked })}
            />
            <span className="text-foreground/60">Time this question</span>
          </label>
          {scoring.timerEnabled && (
            <label className="inline-flex items-center gap-1.5 text-sm">
              <DurationInput
                value={scoring.timerSeconds ?? 60}
                onChange={(seconds) => updateScoring({ timerSeconds: seconds ?? 60 })}
                title="Time for the whole question (MM:SS)"
                className="w-16 text-center text-sm rounded-md px-1.5 py-0.5 border border-foreground/20 bg-transparent tabular-nums"
              />
              <span className="text-foreground/60">mm:ss</span>
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
          ) : groups.length === 0 ? (
            <div className="py-12 text-center text-sm text-foreground/60 space-y-3">
              <div className="font-medium" style={{ color: "hsl(220 35% 18%)" }}>
                Nothing highlighted yet
              </div>
              <p className="max-w-md mx-auto">
                This page only builds what you highlighted on the Floating Highlighting Page.
                Highlight the parts of the solution you want to become Floating Numbers —
                everything you leave unhighlighted stays as lesson notes.
              </p>
              <button
                onClick={() => navigate(`/lesson-notes/${notebookId}/floating-prep/${subsectionId}`)}
                className="text-xs px-3 py-1.5 rounded-md border border-foreground/25"
                style={{ color: "hsl(220 35% 18%)" }}
              >
                Go to Floating Highlighting Page
              </button>
            </div>

          ) : (
            <div className="space-y-1" ref={workspaceRef}>
              <NoteObjectCard objects={leadingNoteObjects} />
              {groups.map((g) => {
                const renderLine = (l: FloatingLine, i: number) => {
                  const isSelected = l.lineId === selectedLineId;
                  return (
                    <div
                      key={l.lineId}
                      data-line-id={l.lineId}
                      onClick={() => setSelectedLineId(l.lineId)}
                      className="rounded-md transition-colors cursor-pointer"
                      style={isSelected ? {
                        background: "hsl(48 95% 88% / 0.4)",
                        boxShadow: "inset 3px 0 0 hsl(40 85% 50%)",
                      } : undefined}
                      title="Click to select — the AI Assistant will operate on this line"
                    >
                      <FloatingWorkspace
                        line={l}
                        index={i}
                        tag={numbering.lineTags[i]}
                        scoreLabel={scoring.label}
                        scoringMode={scoring.mode}
                        onChange={(next) => {
                          dirtyRef.current = true;
                          // Every workspace mutation is a TEACHER edit.
                          setLines((prev) =>
                            prev.map((p, idx) => (idx === i ? markTeacherEdited(next) : p)),
                          );
                        }}
                        onCopyLine={() => copyLine(l)}
                        onPasteLine={() => pasteIntoLine(i)}
                        onDeleteLine={() => deleteLineContent(i)}
                        onDuplicateLine={l.table ? undefined : () => duplicateLine(i)}
                        onMoveUp={l.table ? undefined : () => moveLine(i, -1)}
                        onMoveDown={l.table ? undefined : () => moveLine(i, 1)}
                        canMoveUp={i > 0 && !lines[i - 1]?.table}
                        canMoveDown={i < lines.length - 1 && !lines[i + 1]?.table}
                        onRegenerateLine={() => allowRegenerate(i)}
                      />

                      <NoteObjectCard
                        objects={((l.noteObjects ?? []) as SolutionObject[])}
                      />
                    </div>
                  );
                };

                if (g.kind === "text") return renderLine(g.line, g.index);

                const cfg = tableConfig[g.objId] ?? { orientation: "row" as TableOrientation, retained: [] };
                const activeLine = g.items.find((it) => it.line.lineId === manualLineId);
                return (
                  <TableWorkspace
                    key={g.objId}
                    grid={g.grid}
                    stepNo={numbering.tableStep[g.objId]}
                    orientation={cfg.orientation}
                    retained={cfg.retained}
                    retentionMode={retentionTable === g.objId}
                    activeCells={activeLine?.line.table?.cellKeys ?? []}
                    manualActive={!!activeLine}
                    lineCount={g.items.length}
                    onOrientationChange={(o) => setOrientation(g.objId, o)}
                    onGenerate={() => generateTable(g.grid, g.insertAt, g.items.length)}
                    onToggleRetention={() => toggleRetentionMode(g.objId)}
                    onAddLine={() => addManualLine(g.grid, g.insertAt, g.items.length)}
                    onCellClick={(k) => onTableCellClick(g.grid, k)}
                  >
                    {g.items.map((it) => renderLine(it.line, it.index))}
                  </TableWorkspace>
                );
              })}
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

      {archiveOpen && info && (
        <FloatingArchivePanel
          subsectionId={info.subsectionId}
          onClose={() => setArchiveOpen(false)}
          onRestore={restoreArchived}
        />
      )}

      <AiEditPanel
        open={aiEditOpen}
        target={aiEditTarget}
        onGenerate={runAiEditForLine}
        onApply={applyAiEdit}
        onClose={closeAiEdit}
        renderPreview={(text) => renderMath(text, `aie-${aiEditLineIndex ?? "x"}`)}
        simpleMode
        simpleCaption="Click Generate and AI will regenerate the floating numbers for this line. Optional instructions guide the repair."
        generateLabel="Generate Floating Numbers"
        getDiagnostics={() => aiEditDiagRef.current}
        renderProposed={() => {
          const r = aiEditResultRef.current;
          if (!r) return null;
          return (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {r.fillers.map((f, i) => {
                  const gated = assertDisplaySafe(String(f ?? ""));
                  if (!gated.safe || !gated.cleaned.trim()) return null;
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
                      {renderMath(gated.cleaned, `pf-${aiEditLineIndex}-${i}`)}
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
      {/* Right: Floating Number AI Assistant.
          Retired via the Application Archive (platform console → Application
          Archive → Floating Number AI). The implementation below is preserved
          untouched; restoring the feature mounts it again. */}
      {!aiArchived && (
      <aside className="hidden lg:flex w-[380px] h-screen sticky top-0">
        <div className="w-full h-full">
          <AssistantPanel
            lineId={selectedLine?.lineId ?? null}
            activeHighlight={activeHighlight}
            onClearHighlight={() => setActiveHighlight(null)}
            onApproveApply={applyChipsFromAssistant}
            onApproveUndo={undoFromAssistant}
            onApplyLineUpdate={applyLineUpdateFromAssistant}
            lessonContext={buildLessonContext({
              notebookId: info?.notebookId ?? null,
              subsectionId: info?.subsectionId ?? null,
              topic: info?.subtopic ?? null,
              subject: info?.subject ?? null,
              sectionKind: info?.sectionKind ?? null,
              problem: info?.problem ?? null,
              recentExamples: lines.slice(0, 6).map((l) => ({ lineId: l.lineId, text: l.equation })),
              activeLineId: selectedLine?.lineId ?? null,
              activeLineText: selectedLine?.equation ?? null,
              activeLineFillers: selectedLine?.fillers ?? [],
              activeLineContainers: (selectedLine?.containers ?? []) as string[],
              activeLineArrangement: selectedLine?.arrangement ?? [],
              lineMap: lines.map((l, idx) => ({
                lineNumber: idx + 1,
                lineId: l.lineId,
                equation: l.equation,
                fillers: (l.fillers ?? []).map((value, i) => ({ i, value })),
                containers: (l.containers ?? []) as string[],
              })),
            })}

          />
        </div>
      </aside>
      )}
    </div>
  );
};


/* ──────────────────────────── View Session ──────────────────────────── */

const renderChip = (token: string, key: string, ctx: { isFirst: boolean; prevWasEquals: boolean; selected?: boolean }) => {
  const gated = assertDisplaySafe(String(token ?? ""));
  if (!gated.safe || !gated.cleaned.trim()) return null;
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
      {renderMathInline(gated.cleaned, key)}
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
