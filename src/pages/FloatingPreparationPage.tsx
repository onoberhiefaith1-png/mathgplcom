// Floating Number Selection Page (Stage 1) — pure highlighter.
//
// Shows ONLY the worked solution for this subsection, rendered exactly like
// the Solution view (KaTeX, line breaks preserved, no numbering, no labels).
//
// The teacher selects any range with the mouse / finger. The moment they
// release, the selection becomes one highlight block — whether it's part of a
// word, one term, a full equation, or text spanning multiple lines. They can
// make as many separate selections as they want; each one becomes one
// floating-number block, in the order they were made.
//
// Undo / Redo (buttons + ⌘Z / ⇧⌘Z) revert highlight actions.

import { tokenizeMath } from "@/lib/notebook/mathTokens";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Copy, Download, Eraser, FileText, Loader2, Redo2, Sparkles, Undo2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PAPER_LABELS, PAPER_SIZES, paperBackground,
  type PaperSize, type PaperStyle,
} from "@/lib/lessonnotes/paperThemes";
import { exportDocx } from "@/lib/lessonnotes/exportDocx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { compileBucket, type FloatingLine } from "@/lib/lessonnotes/floatingCompile";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { assertDisplaySafe } from "@/lib/notebook/mathDisplayGate";
import { cn } from "@/lib/utils";
import {
  buildSolutionItems,
  familyLabel,
  readSolutionObjects,
  isFloatableObject,
  assignNoteObjects,
  type SolutionObject,
} from "@/lib/floating/solutionItems";
import { SolutionObjectView } from "@/components/lessonnotes/SolutionObjectView";

interface TokenRef { line: number; tok: number }
interface Highlight {
  groupId: number;
  tokens: TokenRef[];
  payload: string;
  /** Plain-text block sitting immediately above this highlight in the
   *  solution source. Becomes "Notebook N" on the Smartboard; empty
   *  string means no notebook (Line N appears alone). */
  precedingNotebook?: string;
  /** Synthetic row used when the solution begins with unhighlighted content. */
  notebookOnly?: boolean;
  /** Set when the highlight is a whole object (table, diagram, chart, …)
   *  rather than a run of text tokens. */
  object?: SolutionObject;
  /** Notes-layer objects (diagrams) that belong to THIS entry's note. They are
   *  never highlightable and never become floating numbers. */
  noteObjects?: SolutionObject[];
}

interface Snapshot { highlights: Highlight[]; nextId: number }

export const restorePersistedHighlights = (
  prior: (Highlight | { groupId: number; payload: string; notebookOnly?: boolean; precedingNotebook?: string; tokens?: TokenRef[] })[] | null,
): { highlights: Highlight[]; nextId: number } => {
  if (!prior || !Array.isArray(prior) || prior.length === 0) {
    return { highlights: [], nextId: 1 };
  }
  let nextRealId = 1;
  const restored: Highlight[] = [];
  for (const p of prior as any[]) {
    if (p?.notebookOnly === true) {
      const nb = String(p.precedingNotebook ?? "").trim();
      if (!nb) continue;
      restored.push({
        groupId: -1,
        tokens: [],
        payload: "",
        precedingNotebook: nb,
        notebookOnly: true,
      });
      continue;
    }
    if (p?.object && typeof p.object === "object" && p.object.nodeType) {
      const obj = readSolutionObjects({ objects: [p.object] })[0];
      // DIAGRAM LAW: a diagram is Notes-layer content. Legacy saves that
      // highlighted a diagram are dropped, never restored as floating rows.
      if (obj && isFloatableObject(obj)) {
        restored.push({
          groupId: nextRealId++,
          tokens: [],
          payload: String(p.payload ?? `[${obj.label}]`),
          precedingNotebook: String(p.precedingNotebook ?? ""),
          notebookOnly: false,
          object: obj,
        });
      }
      continue;
    }
    if (!Array.isArray(p?.tokens) || p.tokens.length === 0) continue;
    restored.push({
      groupId: nextRealId++,
      tokens: p.tokens as TokenRef[],
      payload: String(p.payload ?? ""),
      precedingNotebook: String(p.precedingNotebook ?? ""),
      notebookOnly: false,
    });
  }
  return { highlights: restored, nextId: nextRealId };
};

/** Recompute notebook checkpoints from token order.
 *
 * Highlighted tokens become floating numbers. Unhighlighted tokens NEVER go
 * inside those floating chips; they become notebook checkpoints:
 *   • before the first highlight → a notebook-only first row
 *   • between highlight A and B → notebook for highlight A
 *   • after the final highlight → notebook for the final highlight */
/** NOTE-PURITY LAW: A note is prose. A line that carries math operators or
 *  is nearly all digits/punctuation is NOT prose and must never be saved as
 *  a note. This mirrors the read-side guard in PresentationView.notebookFor
 *  so a stray unhighlighted equation cannot leak into `precedingNotebook`.
 *  Universal — applies at line 1, line 12, line 1,000,000. */
export const looksLikeMathLine = (line: string): boolean => {
  const s = String(line ?? "").trim();
  if (!s) return false;
  if (/[=+\-−×÷/^]/.test(s)) return true;
  if (/^[\d\s.,()πθ]+$/.test(s)) return true;
  return false;
};

const stripMathLines = (text: string): string =>
  String(text ?? "")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !looksLikeMathLine(l))
    .join("\n")
    .trim();

export const recomputeNotebooks = (source: Highlight[], lines: string[]): Highlight[] => {
  const realSource = source.filter((h) => !h.notebookOnly && h.tokens.length > 0);
  if (realSource.length === 0) return realSource;
  const rows = lines.map((l) => tokenize(l));
  const flat: Array<{ line: number; tok: number; src: string; pos: number }> = [];
  rows.forEach((toks, line) => toks.forEach((src, tok) => flat.push({ line, tok, src, pos: flat.length })));
  const posByKey = new Map(flat.map((t) => [`${t.line}:${t.tok}`, t.pos] as const));
  const chunk = (fromPos: number, toPos: number): string => {
    if (toPos < fromPos) return "";
    const picked = flat.filter((t) => t.pos >= fromPos && t.pos <= toPos);
    const byLine = new Map<number, string[]>();
    for (const t of picked) {
      const arr = byLine.get(t.line) ?? [];
      arr.push(t.src);
      byLine.set(t.line, arr);
    }
    const joined = Array.from(byLine.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, toks]) => toks.join(" ").trim())
      .filter(Boolean)
      .join("\n")
      .trim();
    // Note-purity: drop any math-shaped line so unhighlighted equations
    // never surface as prose notes.
    return stripMathLines(joined);
  };
  const ordered = realSource
    .map((h) => {
      const sorted = [...h.tokens].sort((a, b) => (a.line - b.line) || (a.tok - b.tok));
      const first = sorted[0] ?? { line: Number.MAX_SAFE_INTEGER, tok: 0 };
      const positions = sorted.map((t) => posByKey.get(`${t.line}:${t.tok}`)).filter((p): p is number => typeof p === "number");
      return {
        h,
        firstLine: first.line,
        firstTok: first.tok,
        start: positions.length ? Math.min(...positions) : Number.MAX_SAFE_INTEGER,
        end: positions.length ? Math.max(...positions) : -1,
      };
    })
    .sort((a, b) => (a.firstLine - b.firstLine) || (a.firstTok - b.firstTok));
  const notebookByGroup = new Map<number, string>();
  for (let i = 0; i < ordered.length; i++) {
    const cur = ordered[i];
    const next = ordered[i + 1];
    notebookByGroup.set(cur.h.groupId, chunk(cur.end + 1, (next?.start ?? flat.length) - 1));
  }
  // Rule 1 Case B: any unhighlighted prose BEFORE the first highlight
  // becomes its OWN standalone notebook-only entry — never merged into
  // the following floating number. (Spec: notebook is always paired with
  // the highlight ABOVE it; leading prose has no highlight above, so it
  // stands alone with no floating number.)
  const leading = chunk(0, ordered[0].start - 1);
  const out = realSource.map((h) => ({ ...h, precedingNotebook: notebookByGroup.get(h.groupId) ?? "" }));
  if (leading) {
    out.unshift({
      groupId: -1,
      tokens: [],
      payload: "",
      precedingNotebook: leading,
      notebookOnly: true,
    });
  }
  return out;
};

/** Document position used to interleave object highlights with text ones.
 *  An object captured with `afterLine = L` sits immediately BEFORE line L. */
const firstLineOf = (h: Highlight): number => {
  if (h.object) return h.object.afterLine - 0.5;
  if (h.notebookOnly) return -1;
  return h.tokens.length ? Math.min(...h.tokens.map((t) => t.line)) : Number.MAX_SAFE_INTEGER;
};

const orderedHighlights = (
  source: Highlight[],
  lines: string[],
  allObjects: SolutionObject[] = [],
) => {
  // Text highlights keep the existing notebook-checkpoint behaviour untouched.
  const textOnly = source.filter((h) => !h.object);
  const objects = source.filter((h) => !!h.object);
  const withNotebooks = recomputeNotebooks(textOnly, lines);
  const merged = [...withNotebooks, ...objects]
    .map((h, i) => ({ h, i, pos: firstLineOf(h) }))
    .sort((a, b) => (a.pos - b.pos) || (a.i - b.i))
    .map(({ h }) => h);
  // DIAGRAM LAW: diagrams never become rows of their own. Each one rides the
  // NOTE of the entry above it; a diagram above everything becomes its own
  // standalone note-only entry (no floating number).
  const positioned = merged.map((h) => ({ entry: h, pos: firstLineOf(h) }));
  const { byIndex, leading } = assignNoteObjects(positioned, allObjects);
  const withObjects: Highlight[] = merged.map((h, i) => {
    const objs = byIndex.get(i);
    return objs && objs.length ? { ...h, noteObjects: objs } : h;
  });
  if (leading.length) {
    withObjects.unshift({
      groupId: -1,
      tokens: [],
      payload: "",
      precedingNotebook: "",
      notebookOnly: true,
      noteObjects: leading,
    });
  }
  return withObjects.map((h, i) => ({
    groupId: i + 1,
    tokens: h.tokens,
    payload: h.payload,
    precedingNotebook: h.precedingNotebook ?? "",
    notebookOnly: h.notebookOnly === true,
    ...(h.object ? { object: h.object } : {}),
    ...(h.noteObjects?.length ? { noteObjects: h.noteObjects } : {}),
  }));
};


const coerceFloatingLine = (line: any): FloatingLine => ({
  lineId: String(line?.lineId ?? (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as any).randomUUID()
    : `line-${Math.random().toString(36).slice(2)}`)),
  equation: String(line?.equation ?? ""),
  fillers: Array.isArray(line?.fillers) ? line.fillers : [],
  containers: Array.isArray(line?.containers) ? line.containers : [],
  arrangement: Array.isArray(line?.arrangement) ? line.arrangement : [],
  explanation: typeof line?.explanation === "string" ? line.explanation : undefined,
  fillersSelected: Array.isArray(line?.fillersSelected) ? line.fillersSelected : undefined,
  containersSelected: Array.isArray(line?.containersSelected) ? line.containersSelected : undefined,
});

/** Structure-aware tokenizer: a matrix, summation, integral, limit, fraction
 *  or root is ONE token, so it renders as one symbol instead of decaying
 *  into raw syntax fragments. */
const tokenize = (line: string): string[] => tokenizeMath(line);

const FloatingPreparationPage = () => {
  const { notebookId, subsectionId } = useParams<{ notebookId: string; subsectionId: string }>();
  /** Live solution text handed over by the lesson note's Floating chip. */
  const handoff = (useLocation() as { state?: { solutionText?: string; problemText?: string } }).state;
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  /** Which question this solution belongs to — shown in the header so a wrong
   *  pairing is visible immediately instead of silently. */
  const [questionLabel, setQuestionLabel] = useState("");

  const [paperSize, setPaperSize] = useState<PaperSize>("a4");
  const [paperStyle, setPaperStyle] = useState<PaperStyle>("ruled");
  const [documentJson, setDocumentJson] = useState<any | null>(null);
  const [objects, setObjects] = useState<SolutionObject[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const nextIdRef = useRef(1);
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);
  // Dirty flag — only true after a teacher action, so the initial DB load
  // does NOT trigger an autosave that could clobber the saved highlights.
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const latestHighlightsRef = useRef<Highlight[]>([]);
  const linesRef = useRef<string[]>([]);
  const objectsRef = useRef<SolutionObject[]>([]);
  /** True when this solution already had a saved highlight state on load. */
  const priorSavedRef = useRef(false);

  const docRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    latestHighlightsRef.current = highlights;
  }, [highlights]);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  const saveHighlightState = useCallback(async (source: Highlight[]) => {
    if (!subsectionId) return false;
    const ordered = orderedHighlights(source, linesRef.current, objectsRef.current);
    const activePayloads = new Set(ordered.filter((h) => !h.notebookOnly).map((h) => String(h.payload ?? "")));
    const { data: ss } = await supabase
      .from("notebook_subsections")
      .select("floating_lines")
      .eq("id", subsectionId)
      .maybeSingle();
    const persistedLines = Array.isArray((ss as any)?.floating_lines)
      ? ((ss as any).floating_lines as any[])
      : [];
    const activeLines = persistedLines
      .map(coerceFloatingLine)
      .filter((line) => activePayloads.has(String(line.equation ?? "")));
    const { error } = await supabase
      .from("notebook_subsections")
      .update({
        floating_highlights: ordered as any,
        floating_lines: activeLines as any,
        floating_bucket: activeLines.length > 0 ? (compileBucket(activeLines) as any) : null,
      })
      .eq("id", subsectionId);
    if (error) {
      toast({ title: "Could not save highlights", description: error.message, variant: "destructive" });
      return false;
    }
    if (JSON.stringify(ordered) === JSON.stringify(orderedHighlights(latestHighlightsRef.current, linesRef.current, objectsRef.current))) {
      dirtyRef.current = false;
    }
    return true;
  }, [subsectionId]);

  const flushHighlightState = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!dirtyRef.current) return true;
    return saveHighlightState(latestHighlightsRef.current);
  }, [saveHighlightState]);



  /* ---------- Paper size / type / export (same controls as Lesson Notes) ---------- */
  const updatePaper = useCallback(
    async (patch: { paper_size?: PaperSize; paper_style?: PaperStyle }) => {
      if (patch.paper_size) setPaperSize(patch.paper_size);
      if (patch.paper_style) setPaperStyle(patch.paper_style);
      if (!notebookId) return;
      const { error } = await supabase.from("notebooks").update(patch as any).eq("id", notebookId);
      if (error) {
        toast({ title: "Could not save paper settings", description: error.message, variant: "destructive" });
      }
    },
    [notebookId],
  );

  const handleExportDocx = useCallback(async () => {
    try {
      await exportDocx(documentJson ?? { type: "doc", content: [] }, title || "lesson-notes");
    } catch (e: any) {
      toast({ title: "DOCX export failed", description: String(e?.message ?? e), variant: "destructive" });
    }
  }, [documentJson, title]);

  /* ---------- Load solution-only content + prior highlights ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!notebookId || !subsectionId) return;
      const [nbRes, ssRes, blocksRes] = await Promise.all([
        supabase
          .from("notebooks")
          .select("title, paper_size, paper_style, document_json")
          .eq("id", notebookId)
          .maybeSingle(),
        supabase
          .from("notebook_subsections")
          .select("floating_highlights")
          .eq("id", subsectionId)
          .maybeSingle(),
        supabase
          .from("notebook_blocks")
          .select("kind, content_ascii, content_json, order_index")
          .eq("subsection_id", subsectionId)
          .order("order_index", { ascending: true }),
      ]);
      if (!alive) return;
      setTitle(nbRes.data?.title ?? "");
      setPaperSize(((nbRes.data as any)?.paper_size as PaperSize) || "a4");
      setPaperStyle(((nbRes.data as any)?.paper_style as PaperStyle) || "ruled");
      setDocumentJson((nbRes.data as any)?.document_json ?? null);
      const solBlock = (blocksRes.data ?? []).find((b: any) => b.kind === "solution") as any;
      // Direct handoff: the Floating chip passes the live solution text from
      // the lesson note, so a solution that is visible on screen is NEVER
      // reported as missing here — even if the DB row hasn't caught up.
      const handed = String((handoff as any)?.solutionText ?? "").trim();
      let solution: string = solBlock?.content_ascii ?? "";
      if (!solution.trim() && handed) {
        solution = handed;
        if (solBlock) {
          void supabase
            .from("notebook_blocks")
            .update({ content_ascii: handed } as any)
            .eq("subsection_id", subsectionId)
            .eq("kind", "solution" as any);
        }
      }
      const flat = solution
        .split("\n")
        .map((l: string) => l.replace(/\s+$/, ""))
        .filter((l: string) => l.trim().length > 0);
      setLines(flat);
      setObjects(readSolutionObjects(solBlock?.content_json));

      const prior = (ssRes.data as any)?.floating_highlights as
        | (Highlight | { groupId: number; payload: string })[]
        | null;
      if (prior && Array.isArray(prior) && prior.length > 0) {
        const restored = restorePersistedHighlights(prior as any);
        setHighlights(restored.highlights);
        nextIdRef.current = restored.nextId;
        priorSavedRef.current = true;
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [notebookId, subsectionId]);

  /* ---------- Diagram note-content seeding ----------
   * A diagram is never highlighted, so without this the teacher could leave
   * the page having "done nothing" and the diagram would never reach the
   * Floating Number page or the Smartboard note. Seeding runs only when it
   * cannot clobber a saved state: either highlights exist (and were restored)
   * or nothing was ever saved for this solution. */
  const seededRef = useRef(false);
  useEffect(() => {
    if (loading || seededRef.current) return;
    const diagrams = objects.filter((o) => !isFloatableObject(o));
    if (diagrams.length === 0) return;
    if (priorSavedRef.current && highlights.length === 0) return;
    seededRef.current = true;
    void saveHighlightState(highlights);
  }, [loading, objects, highlights, saveHighlightState]);


  /* ---------- Tokenized rows ---------- */
  const rows = useMemo(() => lines.map((l) => tokenize(l)), [lines]);

  /* ---------- Text + object stream, in document order ---------- */
  const items = useMemo(() => buildSolutionItems(lines, objects), [lines, objects]);
  const highlightedObjectIds = useMemo(
    () => new Set(highlights.filter((h) => h.object).map((h) => h.object!.objId)),
    [highlights],
  );


  const selectedSet = useMemo(() => {
    const s = new Set<string>();
    for (const h of highlights) for (const t of h.tokens) s.add(`${t.line}:${t.tok}`);
    return s;
  }, [highlights]);

  /* ---------- History ---------- */
  const pushHistory = useCallback(() => {
    undoStack.current.push({
      highlights: highlights.map((h) => ({ ...h, tokens: h.tokens.map((t) => ({ ...t })) })),
      nextId: nextIdRef.current,
    });
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
  }, [highlights]);

  const applySnapshot = (snap: Snapshot) => {
    setHighlights(snap.highlights.map((h) => ({ ...h, tokens: h.tokens.map((t) => ({ ...t })) })));
    nextIdRef.current = snap.nextId;
  };

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push({
      highlights: highlights.map((h) => ({ ...h, tokens: h.tokens.map((t) => ({ ...t })) })),
      nextId: nextIdRef.current,
    });
    applySnapshot(prev);
    dirtyRef.current = true;
    refresh();
  }, [highlights]);

  const redo = useCallback(() => {
    const nxt = redoStack.current.pop();
    if (!nxt) return;
    undoStack.current.push({
      highlights: highlights.map((h) => ({ ...h, tokens: h.tokens.map((t) => ({ ...t })) })),
      nextId: nextIdRef.current,
    });
    applySnapshot(nxt);
    dirtyRef.current = true;
    refresh();

  }, [highlights]);

  /* ---------- Selection → immediate commit ---------- */
  const captureSelection = useCallback(() => {
    const root = docRef.current;
    if (!root) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;

    const tokenEls = Array.from(root.querySelectorAll<HTMLElement>("[data-tok-key]"));
    const touched: { line: number; tok: number; src: string }[] = [];
    for (const el of tokenEls) {
      if (range.intersectsNode(el)) {
        const [lineStr, tokStr] = (el.dataset.tokKey ?? "").split(":");
        const src = el.dataset.tokSrc ?? "";
        const line = Number(lineStr);
        const tok = Number(tokStr);
        if (!Number.isNaN(line) && !Number.isNaN(tok) && src) {
          touched.push({ line, tok, src });
        }
      }
    }
    sel.removeAllRanges();
    if (touched.length === 0) return;
    touched.sort((a, b) => (a.line - b.line) || (a.tok - b.tok));

    // Toggle: if any touched token is already inside an existing
    // highlight, remove that highlight (the user's way to undo it).
    const touchedKeys = new Set(touched.map((t) => `${t.line}:${t.tok}`));
    const overlapping = highlights.find((h) =>
      h.tokens.some((tk) => touchedKeys.has(`${tk.line}:${tk.tok}`)),
    );
    if (overlapping) {
      pushHistory();
      dirtyRef.current = true;
      setHighlights((prev) =>
        prev
          .filter((h) => h.groupId !== overlapping.groupId)
          .map((h, i) => ({ ...h, groupId: i + 1 })),
      );
      return;
    }

    // Build literal selected text (preserves newlines for multi-line).
    const parts: string[] = [];
    let curLine = touched[0].line;
    let lineBuf: string[] = [];
    const flush = () => { if (lineBuf.length) parts.push(lineBuf.join(" ")); lineBuf = []; };
    for (const t of touched) {
      if (t.line !== curLine) { flush(); curLine = t.line; }
      lineBuf.push(t.src);
    }
    flush();
    const payload = parts.join("\n");

    pushHistory();
    dirtyRef.current = true;
    setHighlights((prev) => [
      ...prev,
      {
        groupId: nextIdRef.current++,
        tokens: touched.map(({ line, tok }) => ({ line, tok })),
        payload,
      },
    ]);
  }, [highlights, pushHistory]);



  useEffect(() => {
    const onUp = () => {
      // Defer one frame so the browser finishes updating the Selection.
      requestAnimationFrame(captureSelection);
    };
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [captureSelection]);

  /* ---------- Keyboard shortcuts (undo / redo) ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
        e.preventDefault(); redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);


  const clearAll = useCallback(() => {
    if (highlights.length === 0) return;
    pushHistory();
    dirtyRef.current = true;
    setHighlights([]);
    nextIdRef.current = 1;
  }, [highlights.length, pushHistory]);

  /* ---------- One-click object highlight (tables / diagrams) ---------- */
  const toggleObject = useCallback((obj: SolutionObject) => {
    // Diagrams can never be highlighted or turned into Floating Numbers.
    if (!isFloatableObject(obj)) return;
    pushHistory();
    dirtyRef.current = true;
    setHighlights((prev) => {
      const already = prev.some((h) => h.object?.objId === obj.objId);
      if (already) return prev.filter((h) => h.object?.objId !== obj.objId);
      return [
        ...prev,
        {
          groupId: nextIdRef.current++,
          tokens: [],
          payload: `[${obj.label}]`,
          object: obj,
        },
      ];
    });
  }, [pushHistory]);


  const removeHighlight = useCallback((groupId: number) => {
    pushHistory();
    dirtyRef.current = true;
    setHighlights((prev) =>
      prev.filter((h) => h.groupId !== groupId).map((h, i) => ({ ...h, groupId: i + 1 })),
    );
  }, [pushHistory]);

  /* ---------- Autosave highlights on every change ---------- */
  useEffect(() => {
    if (!dirtyRef.current || !subsectionId) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      saveHighlightState(latestHighlightsRef.current);
    }, 300);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [highlights, subsectionId, saveHighlightState]);

  useEffect(() => {
    return () => {
      flushHighlightState();
    };
  }, [flushHighlightState]);


  /* ---------- Generate ---------- */
  const generate = useCallback(async () => {
    if (!subsectionId || !notebookId) return;
    if (highlights.filter((h) => !h.notebookOnly).length === 0) {
      toast({ title: "Highlight something first", description: "Drag across any part of the solution." });
      return;
    }
    setSubmitting(true);
    const ok = await flushHighlightState();
    setSubmitting(false);
    if (!ok) {
      return;
    }
    navigate(`/lesson-notes/${notebookId}/floating/${subsectionId}`);
  }, [flushHighlightState, highlights, navigate, notebookId, subsectionId]);

  const summary = useMemo(() => {
    const realCount = highlights.filter((h) => !h.notebookOnly).length;
    if (realCount === 0) return "No highlights yet.";
    return `${realCount} highlight${realCount === 1 ? "" : "s"} ready.`;
  }, [highlights]);

  return (
    <div className="min-h-screen" style={{ background: "#15132a" }}>
      <header
        className="sticky top-0 z-30 backdrop-blur-md border-b border-foreground/10"
        style={{ background: "rgba(21,19,42,0.85)" }}
      >
        <div className="mx-auto max-w-5xl px-4 py-2.5 flex items-center gap-2">
          <button
            onClick={async () => {
              await flushHighlightState();
              navigate(`/lesson-notes/${notebookId}`);
            }}
            className="inline-flex items-center gap-1.5 text-sm text-foreground/70 hover:text-foreground px-2 py-1 rounded"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Lesson Note
          </button>
          <div className="flex-1 min-w-[140px] text-center">
            <p className="hidden lg:block text-[9px] uppercase tracking-[0.4em] text-foreground/40 truncate">
              Floating Number Selection
            </p>
            <h1 className="text-sm font-medium truncate text-foreground/90">
              {title || "Notebook"} — Solution
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 justify-end">
            <span className="hidden xl:inline text-[11px] text-foreground/55 mr-1">{summary}</span>

            <select
              value={paperSize}
              onChange={(e) => updatePaper({ paper_size: e.target.value as PaperSize })}
              className="text-xs bg-transparent border border-foreground/20 rounded px-1.5 py-1.5 text-foreground/85 hover:bg-foreground/10"
              title="Paper size"
            >
              {(Object.entries(PAPER_SIZES) as [PaperSize, { label: string }][]).map(([k, v]) => (
                <option key={k} value={k} style={{ color: "#15132a" }}>{v.label}</option>
              ))}
            </select>
            <select
              value={paperStyle}
              onChange={(e) => updatePaper({ paper_style: e.target.value as PaperStyle })}
              className="text-xs bg-transparent border border-foreground/20 rounded px-1.5 py-1.5 text-foreground/85 hover:bg-foreground/10"
              title="Paper type"
            >
              {(["plain", "ruled", "math", "grid", "dotted"] as PaperStyle[]).map((k) => (
                <option key={k} value={k} style={{ color: "#15132a" }}>{PAPER_LABELS[k]}</option>
              ))}
            </select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-foreground/20 text-foreground/80 hover:bg-foreground/10"
                  title="Export"
                >
                  <Download className="h-3.5 w-3.5" /> Export
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportDocx}>
                  <FileText className="h-4 w-4 mr-2" /> DOCX (Word, WPS, Google Docs)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.print()}>
                  <Download className="h-4 w-4 mr-2" /> PDF (via Print)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={async () => {
                const text = lines.join("\n");
                if (!text.trim()) {
                  toast({ title: "Nothing to copy", description: "This solution is empty." });
                  return;
                }
                try {
                  await navigator.clipboard.writeText(text);
                  toast({ title: "Solution copied" });
                } catch {
                  toast({ title: "Couldn't copy", variant: "destructive" });
                }
              }}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-foreground/20 text-foreground/80 hover:bg-foreground/10"
              title="Copy the solution text"
            >
              <Copy className="h-3.5 w-3.5" /> Copy solution
            </button>
            <button
              onClick={undo}
              disabled={undoStack.current.length === 0}
              className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md border border-foreground/20 text-foreground/80 hover:bg-foreground/10 disabled:opacity-40"
              title="Undo (⌘Z)"
            ><Undo2 className="h-3.5 w-3.5" /></button>
            <button
              onClick={redo}
              disabled={redoStack.current.length === 0}
              className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md border border-foreground/20 text-foreground/80 hover:bg-foreground/10 disabled:opacity-40"
              title="Redo (⇧⌘Z)"
            ><Redo2 className="h-3.5 w-3.5" /></button>
            <button
              onClick={clearAll}
              disabled={highlights.length === 0}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-foreground/20 text-foreground/80 hover:bg-foreground/10 disabled:opacity-40"
            >
              <Eraser className="h-3.5 w-3.5" /> Clear
            </button>
            <button
              onClick={generate}
              disabled={submitting || highlights.filter((h) => !h.notebookOnly).length === 0}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md disabled:opacity-50"
              style={{ background: "hsl(48 95% 60%)", color: "hsl(220 35% 12%)" }}
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Generate Floating Numbers
            </button>
          </div>
        </div>
      </header>

      <main className="py-8 px-4">
        {loading ? (
          <div className="text-center text-foreground/60 py-20">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading solution…
          </div>
        ) : items.length === 0 ? (
          <div className="mx-auto max-w-3xl rounded-md p-8 text-center text-foreground/55 text-sm border border-border/40">
            This solution is still empty. Write or generate the solution in the
            lesson note, then come back to pick your floating numbers.
          </div>

        ) : (
          <div
            ref={docRef}
            className="rounded-md p-8 select-text"
            style={{
              width: `min(100%, ${PAPER_SIZES[paperSize].widthMm * (96 / 25.4)}px)`,
              marginLeft: "auto",
              marginRight: "auto",
              background: "hsl(0 0% 100%)",
              ...paperBackground(paperStyle),
              border: "1px solid hsl(220 15% 60% / 0.25)",
              color: "hsl(220 35% 18%)",
              lineHeight: "36px",
              fontSize: "18px",
            }}
          >
            {items.map((item) => {
              if (item.kind === "object") {
                const obj = item.object;
                const floatable = isFloatableObject(obj);
                const on = floatable && highlightedObjectIds.has(obj.objId);
                if (!floatable) {
                  // NOTES LAYER — a diagram is permanent lesson content. It
                  // renders inline, exactly where it sits in the note: no card,
                  // no caption, no extra sheet. It can never be highlighted,
                  // numbered or converted into a Floating Number.
                  return (
                    <div
                      key={`obj-${obj.objId}`}
                      className="group/noteobj relative my-2 select-none"
                      style={{ lineHeight: "normal" }}
                      title={`${familyLabel(obj.family)} · notes content`}
                    >
                      <SolutionObjectView nodeType={obj.nodeType} attrs={obj.attrs} />
                      <span
                        className="pointer-events-none absolute right-0 top-0 rounded px-1.5 py-0.5 text-[11px] opacity-0 transition-opacity group-hover/noteobj:opacity-100"
                        style={{ background: "hsl(220 20% 96%)", color: "hsl(220 20% 45%)" }}
                      >
                        notes content
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={`obj-${obj.objId}`}
                    className={cn(
                      "my-4 rounded-md p-3 transition-colors",
                      on
                        ? "bg-yellow-200/60 ring-2 ring-yellow-500/70"
                        : "ring-1 ring-[hsl(220_15%_60%/0.3)]",
                    )}
                    style={{ lineHeight: "normal" }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleObject(obj)}
                      className="inline-flex items-center gap-2 text-[13px] font-medium mb-2 select-none"
                      style={{ color: "hsl(220 35% 22%)" }}
                    >
                      <span
                        className={cn(
                          "inline-flex h-4 w-4 items-center justify-center rounded-[3px] border text-[11px] leading-none",
                          on
                            ? "bg-yellow-500 border-yellow-600 text-white"
                            : "border-[hsl(220_20%_45%)] bg-white/70",
                        )}
                      >
                        {on ? "✓" : ""}
                      </span>
                      Highlight this {familyLabel(obj.family)}
                    </button>
                    <div className="overflow-x-auto">
                      <SolutionObjectView nodeType={obj.nodeType} attrs={obj.attrs} />
                    </div>
                  </div>
                );
              }
              const li = item.index;
              const toks = rows[li] ?? [];
              return (
                <div key={`line-${li}`} className="whitespace-nowrap overflow-x-auto">
                  {toks.map((src, ti) => {
                    const key = `${li}:${ti}`;
                    const selected = selectedSet.has(key);
                    return (
                      <span
                        key={ti}
                        data-tok-key={key}
                        data-tok-src={src}
                        className={cn(
                          "inline-block align-baseline px-0.5 mr-1 rounded-sm transition-colors",
                          selected && "bg-yellow-300/80 ring-1 ring-yellow-500/40",
                        )}
                      >
                        {renderMathInline(src, `fp-${li}-${ti}`)}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}



        {highlights.length > 0 && !loading && (
          <div className="mx-auto max-w-3xl mt-6">
            <div
              className="rounded-md p-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/55 mb-2">
                Highlights (in the order you made them)
              </div>
              <ul className="space-y-1.5">
                {highlights.filter((h) => !h.notebookOnly).map((h) => {
                  const safePayload = h.object ? "" : assertDisplaySafe(h.payload).cleaned;
                  return (
                  <li key={h.groupId} className="flex items-start gap-2 text-sm text-foreground/85">
                    <span className="text-foreground/40 mt-0.5">•</span>
                    <span className="flex-1 break-words whitespace-pre-wrap text-[15px] leading-7">
                      {h.object
                        ? `Whole ${familyLabel(h.object.family).toLowerCase()}`
                        : renderMathInline(safePayload, `highlight-summary-${h.groupId}`)}
                    </span>
                    <button
                      onClick={() => removeHighlight(h.groupId)}
                      className="text-[11px] text-foreground/50 hover:text-foreground"
                    >
                      remove
                    </button>
                  </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[11px] text-foreground/45 italic">
                Each highlight becomes one floating-number block, in the order shown above.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default FloatingPreparationPage;
