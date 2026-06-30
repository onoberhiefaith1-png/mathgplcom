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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eraser, Loader2, Redo2, Sparkles, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { compileBucket, type FloatingLine } from "@/lib/lessonnotes/floatingCompile";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { assertDisplaySafe } from "@/lib/notebook/mathDisplayGate";
import { cn } from "@/lib/utils";

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
}
interface Snapshot { highlights: Highlight[]; nextId: number }

/** Recompute notebook checkpoints from token order.
 *
 * Highlighted tokens become floating numbers. Unhighlighted tokens NEVER go
 * inside those floating chips; they become notebook checkpoints:
 *   • before the first highlight → a notebook-only first row
 *   • between highlight A and B → notebook for highlight A
 *   • after the final highlight → notebook for the final highlight */
const recomputeNotebooks = (source: Highlight[], lines: string[]): Highlight[] => {
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
    return Array.from(byLine.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, toks]) => toks.join(" ").trim())
      .filter(Boolean)
      .join("\n")
      .trim();
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
  const leading = chunk(0, ordered[0].start - 1);
  const mapped = realSource.map((h) => ({ ...h, precedingNotebook: notebookByGroup.get(h.groupId) ?? "" }));
  return leading
    ? [{ groupId: 0, tokens: [], payload: "", precedingNotebook: leading, notebookOnly: true }, ...mapped]
    : mapped;
};

const orderedHighlights = (source: Highlight[], lines: string[]) => {
  const withNotebooks = recomputeNotebooks(source, lines);
  return withNotebooks.map((h, i) => ({
    groupId: i + 1,
    tokens: h.tokens,
    payload: h.payload,
    precedingNotebook: h.precedingNotebook ?? "",
    notebookOnly: h.notebookOnly === true,
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

/** Brace-depth aware whitespace tokenizer (keeps \frac{a}{b} as one token). */
function tokenize(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
    if (ch === " " && depth === 0) {
      if (cur) { out.push(cur); cur = ""; }
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

const FloatingPreparationPage = () => {
  const { notebookId, subsectionId } = useParams<{ notebookId: string; subsectionId: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
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

  const docRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    latestHighlightsRef.current = highlights;
  }, [highlights]);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  const saveHighlightState = useCallback(async (source: Highlight[]) => {
    if (!subsectionId) return false;
    const ordered = orderedHighlights(source, linesRef.current);
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
    if (JSON.stringify(ordered) === JSON.stringify(orderedHighlights(latestHighlightsRef.current, linesRef.current))) {
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



  /* ---------- Load solution-only content + prior highlights ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!notebookId || !subsectionId) return;
      const [nbRes, ssRes, blocksRes] = await Promise.all([
        supabase.from("notebooks").select("title").eq("id", notebookId).maybeSingle(),
        supabase
          .from("notebook_subsections")
          .select("floating_highlights")
          .eq("id", subsectionId)
          .maybeSingle(),
        supabase
          .from("notebook_blocks")
          .select("kind, content_ascii, order_index")
          .eq("subsection_id", subsectionId)
          .order("order_index", { ascending: true }),
      ]);
      if (!alive) return;
      setTitle(nbRes.data?.title ?? "");
      const solution =
        (blocksRes.data ?? []).find((b: any) => b.kind === "solution")?.content_ascii ?? "";
      const flat = solution
        .split("\n")
        .map((l: string) => l.replace(/\s+$/, ""))
        .filter((l: string) => l.trim().length > 0);
      setLines(flat);

      const prior = (ssRes.data as any)?.floating_highlights as
        | (Highlight | { groupId: number; payload: string })[]
        | null;
      if (prior && Array.isArray(prior) && prior.length > 0) {
        const restored: Highlight[] = prior
          .filter((p: any) => Array.isArray(p?.tokens) && p.tokens.length > 0)
          .map((p: any, i: number) => ({
            groupId: i + 1,
            tokens: p.tokens as TokenRef[],
            payload: String(p.payload ?? ""),
            precedingNotebook: String(p.precedingNotebook ?? ""),
          }));
        setHighlights(restored);
        nextIdRef.current = restored.length + 1;
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [notebookId, subsectionId]);

  /* ---------- Tokenized rows ---------- */
  const rows = useMemo(() => lines.map((l) => tokenize(l)), [lines]);

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
    if (highlights.length === 0) {
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
  }, [flushHighlightState, highlights.length, navigate, notebookId, subsectionId]);

  const summary = useMemo(() => {
    if (highlights.length === 0) return "No highlights yet.";
    return `${highlights.length} highlight${highlights.length === 1 ? "" : "s"} ready.`;
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
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[9px] uppercase tracking-[0.4em] text-foreground/40 truncate">
              Floating Number Selection
            </p>
            <h1 className="text-sm font-medium truncate text-foreground/90">
              {title || "Notebook"} — Solution
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-foreground/55 mr-1">{summary}</span>
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
              disabled={submitting || highlights.length === 0}
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
        ) : lines.length === 0 ? (
          <div className="text-center text-foreground/55 py-20 text-sm">
            No solution found for this section. Generate the solution in the lesson note first.
          </div>
        ) : (
          <div
            ref={docRef}
            className="mx-auto max-w-3xl rounded-md p-8 select-text"
            style={{
              background:
                "repeating-linear-gradient(to bottom, hsl(38 38% 96%) 0px, hsl(38 38% 96%) 35px, hsl(220 30% 70% / 0.18) 36px)",
              border: "1px solid hsl(220 15% 60% / 0.25)",
              color: "hsl(220 35% 18%)",
              lineHeight: "36px",
              fontSize: "18px",
            }}
          >
            {rows.map((toks, li) => (
              <div key={li} className="whitespace-nowrap overflow-x-auto">
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
            ))}
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
                {highlights.map((h) => {
                  const safePayload = assertDisplaySafe(h.payload).cleaned;
                  return (
                  <li key={h.groupId} className="flex items-start gap-2 text-sm text-foreground/85">
                    <span className="text-foreground/40 mt-0.5">•</span>
                    <span className="flex-1 break-words whitespace-pre-wrap text-[15px] leading-7">
                      {renderMathInline(safePayload, `highlight-summary-${h.groupId}`)}
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
