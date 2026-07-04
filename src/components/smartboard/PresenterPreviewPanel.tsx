// PresenterPreviewPanel — read-only, synchronized teaching guide.
//
// Renders the SAME content the /smartboard/:id/preview page renders (built
// from the same notebook + buildReservoirs pipeline and the same math
// renderer), but with:
//   • no Present/Skip pills, no AI Edit, no Approve controls
//   • a soft highlight on the item the teacher is currently presenting
//   • auto-scroll that follows the teacher's beat/line
//   • a temporary manual-scroll mode (teacher can peek ahead); resumes
//     auto-follow as soon as the teacher's position changes again, or
//     after a 6s idle grace period.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StickyNote, Pencil, Check, EyeOff, Eye, Sparkles } from "lucide-react";

import { useNotebook, type SectionRow } from "@/hooks/useNotebook";
import {
  buildReservoirs,
  type Reservoir,
  type ReservoirLine,
} from "@/lib/smartboard/presentation";
import {
  loadPlan,
  toggleSkipped,
  isSkipped,
  type PresentationPlan,
} from "@/lib/smartboard/presentationPlan";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { SmartboardLessonText } from "@/components/smartboard/SmartboardLessonText";
import type { EditTarget } from "@/lib/smartboard/manualEdit/types";

const INK = "#1a2230";
const ACCENT = "#8a6a1f";

// Border-only active highlight. The card/line background and text colors
// stay exactly the same; only the frame changes so the teacher can see which
// element the Smartboard is currently presenting.
const HIGHLIGHT_BORDER = "rgba(138,106,31,0.9)";
const HIGHLIGHT_SHADOW =
  "0 0 0 4px rgba(138,106,31,0.15), 0 6px 22px rgba(138,106,31,0.18)";

const asDisplayString = (v: unknown): string => {
  if (v == null) return "";
  const t = typeof v;
  if (t === "string") return v as string;
  if (t === "number" || t === "boolean") return String(v);
  return "";
};

const today = () => {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const InlineMath = ({ ascii }: { ascii: string }) => (
  <span className="font-serif" style={{ color: INK }}>
    {renderMathInline(asDisplayString(ascii))}
  </span>
);

const HighlightBox = ({ children }: { children: React.ReactNode }) => (
  <span
    className="inline-block rounded px-2 py-1"
    style={{
      background: "rgba(232, 201, 138, 0.4)",
      boxShadow: "0 0 0 1px rgba(138, 106, 31, 0.35) inset",
    }}
  >
    {children}
  </span>
);

const FloatingChips = ({ fillers }: { fillers: string[] }) => {
  if (!fillers || fillers.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2 pl-1">
      {fillers.map((f, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded-md border px-2.5 py-1 text-base font-serif"
          style={{
            borderColor: "rgba(59,130,246,0.35)",
            background: "rgba(59,130,246,0.08)",
            color: "#1e3a8a",
          }}
        >
          <InlineMath ascii={f} />
        </span>
      ))}
    </div>
  );
};

const NotYetAvailable = () => (
  <div className="mt-2 pl-1">
    <span
      className="inline-flex items-center rounded-md border border-dashed px-2.5 py-1 text-xs italic"
      style={{
        borderColor: "rgba(120,113,108,0.4)",
        color: "#78716c",
        background: "rgba(120,113,108,0.05)",
      }}
    >
      Floating numbers not yet available
    </span>
  </div>
);

const NoteBlock = ({ text }: { text: string }) => {
  const clean = asDisplayString(text).trim();
  if (!clean) return null;
  const noteLines = clean.split(/\r?\n+/).filter((l) => l.trim());
  return (
    <div
      className="mt-2 flex items-start gap-2 rounded-md px-3 py-2 text-[15px] leading-relaxed"
      style={{
        background: "rgba(120,113,108,0.08)",
        borderLeft: "3px solid rgba(120,113,108,0.5)",
        color: "#524a3d",
      }}
    >
      <StickyNote className="mt-0.5 h-4 w-4 flex-none opacity-70" />
      <div className="italic">
        {noteLines.map((l, i) => (
          <div key={i}>{renderMathInline(l, `note-${i}`)}</div>
        ))}
      </div>
    </div>
  );
};

type Item =
  | { id: string; kind: "cover" }
  | { id: string; kind: "prose"; caption: string; text: string }
  | {
      id: string;
      kind: "problem";
      caption: string;
      problem: string;
      reservoir?: Reservoir;
      hasFloatingData: boolean;
    };

export interface PresenterPreviewPanelProps {
  notebookId: string | null | undefined;
  /** Beat id from the live board (e.g. "__cover__", "<subId>-q", "<secId>-text"). */
  activeBeatId?: string | null;
  /** Solution line index (0-based) inside the active problem beat, if any. */
  activeLineIdx?: number | null;
  /** Emits true when the teacher is manually scrolling the panel. */
  onManualScrollChange?: (isManual: boolean) => void;
  /** Fires whenever Live Mirror Mode toggles or its selection changes.
   *  Host uses this to clear the Smartboard, mirror the selected object,
   *  and show the Live Mirror status strip. When `active` is false the
   *  Smartboard should exit mirror mode. */
  onMirrorChange?: (active: boolean, target: EditTarget | null) => void;
}

const PresenterPreviewPanel = ({
  notebookId,
  activeBeatId,
  activeLineIdx,
  onManualScrollChange,
  onMirrorChange,
}: PresenterPreviewPanelProps) => {
  const { notebook, sections, loading } = useNotebook(notebookId ?? undefined);

  // ─── Mode + selection ────────────────────────────────────────────────
  const [mode, setMode] = useState<"normal" | "edit">("normal");
  const [selection, setSelection] = useState<EditTarget | null>(null);
  const [plan, setPlan] = useState<PresentationPlan>(() => loadPlan(notebookId));
  useEffect(() => {
    setPlan(loadPlan(notebookId));
  }, [notebookId]);
  useEffect(() => {
    // Clear selection when leaving edit mode.
    if (mode !== "edit") setSelection(null);
  }, [mode]);

  // Live Mirror Mode signalling — mirror mode is active whenever the
  // teacher is in Edit mode. Selection changes propagate immediately so
  // the host can mirror the picked object onto the Smartboard.
  useEffect(() => {
    if (!onMirrorChange) return;
    if (mode === "edit") onMirrorChange(true, selection);
    else onMirrorChange(false, null);
  }, [mode, selection, onMirrorChange]);

  const toggleSkip = useCallback(
    (beatId: string) => {
      if (!notebookId) return;
      setPlan(toggleSkipped(notebookId, beatId));
    },
    [notebookId],
  );

  const selectTarget = useCallback(
    (t: EditTarget) => {
      if (mode !== "edit") return;
      setSelection((cur) =>
        cur &&
        cur.kind === t.kind &&
        cur.beatId === t.beatId &&
        cur.lineIdx === t.lineIdx &&
        cur.fillerIdx === t.fillerIdx
          ? null
          : t,
      );
    },
    [mode],
  );

  const isSelected = (t: Partial<EditTarget>) =>
    !!selection &&
    selection.kind === t.kind &&
    selection.beatId === t.beatId &&
    selection.lineIdx === t.lineIdx &&
    selection.fillerIdx === t.fillerIdx;


  const reservoirs = useMemo(() => buildReservoirs(sections), [sections]);
  const reservoirByBeat = useMemo(() => {
    const m = new Map<string, Reservoir>();
    for (const r of reservoirs) m.set(r.beatId, r);
    return m;
  }, [reservoirs]);

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    if (!notebook) return out;
    out.push({ id: "__cover__", kind: "cover" });
    const counters: Record<string, number> = {};
    for (const sec of sections as SectionRow[]) {
      if (sec.kind === "introduction" || sec.kind === "explanation" || sec.kind === "summary") {
        const text = sec.loose
          .map((b) => asDisplayString(b.content_ascii))
          .filter(Boolean)
          .join("\n\n")
          .trim();
        if (!text) continue;
        const caption =
          sec.kind === "introduction"
            ? "Introduction"
            : sec.kind === "explanation"
              ? "Explanation"
              : "Summary";
        out.push({ id: `${sec.id}-text`, kind: "prose", caption, text });
        continue;
      }
      if (["example", "exercise", "classwork", "homework"].includes(sec.kind)) {
        for (const sub of sec.subsections) {
          counters[sec.kind] = (counters[sec.kind] ?? 0) + 1;
          const n = counters[sec.kind];
          const label = sec.kind[0].toUpperCase() + sec.kind.slice(1);
          const problem = asDisplayString(
            sub.blocks.find((b) => b.kind === "problem")?.content_ascii,
          ).trim();
          if (!problem) continue;
          out.push({
            id: `${sub.id}-q`,
            kind: "problem",
            caption: `${label} ${n}`,
            problem,
            reservoir: reservoirByBeat.get(`${sub.id}-q`),
            hasFloatingData:
              Array.isArray((sub as any).floating_lines) &&
              ((sub as any).floating_lines as any[]).length > 0,
          });
        }
      }
    }
    return out;
  }, [notebook, sections, reservoirByBeat]);

  // ─── Auto-scroll + manual-scroll grace period ──────────────────────────
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const lineRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [manual, setManual] = useState(false);
  const manualTimer = useRef<number | null>(null);
  const lastActiveKey = useRef<string>("");

  const setItemRef = (id: string) => (el: HTMLElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  };
  const setLineRef = (key: string) => (el: HTMLElement | null) => {
    if (el) lineRefs.current.set(key, el);
    else lineRefs.current.delete(key);
  };

  useEffect(() => {
    onManualScrollChange?.(manual);
  }, [manual, onManualScrollChange]);

  // Detect manual scroll originating inside the panel.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let programmatic = false;
    const armManual = () => {
      if (programmatic) return;
      setManual(true);
      if (manualTimer.current) window.clearTimeout(manualTimer.current);
      manualTimer.current = window.setTimeout(() => setManual(false), 6000);
    };
    const onWheel = () => armManual();
    const onTouch = () => armManual();
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.key)) armManual();
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchmove", onTouch, { passive: true });
    el.addEventListener("keydown", onKey);
    // Expose a hook to skip flagging programmatic scrolls.
    (el as any).__setProgrammatic = (v: boolean) => { programmatic = v; };
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onTouch);
      el.removeEventListener("keydown", onKey);
      if (manualTimer.current) window.clearTimeout(manualTimer.current);
    };
  }, []);

  // Auto-scroll to the active item / line whenever it changes.
  // If the teacher was in manual mode, the position change itself pulls
  // them back — clear the manual flag immediately.
  // A key that changes as items mount so the effect re-runs after refs
  // are actually populated. Otherwise a fast beat update on first render
  // can arrive before the target DOM node exists, and never retry.
  const readyKey = items.map((i) => i.id).join("|");

  useEffect(() => {
    const key = `${activeBeatId ?? ""}::${activeLineIdx ?? ""}`;
    // Skip if nothing changed AND we already scrolled — checked by whether
    // the last stamped key matches AND we have no pending retry (we only
    // stamp on success, so a stale early return doesn't lock us out).
    if (!activeBeatId) return;
    if (key === lastActiveKey.current) return;

    // Position changed → resume auto-follow.
    if (manualTimer.current) {
      window.clearTimeout(manualTimer.current);
      manualTimer.current = null;
    }
    setManual(false);

    const lineKey =
      typeof activeLineIdx === "number"
        ? `${activeBeatId}::${activeLineIdx}`
        : null;

    let cancelled = false;
    const tryScroll = () => {
      if (cancelled) return;
      const target =
        (lineKey && lineRefs.current.get(lineKey)) ||
        itemRefs.current.get(activeBeatId);
      if (!target || !scrollerRef.current) {
        // Retry indefinitely until either the target ref mounts or the
        // active beat/line changes (cleanup flips `cancelled`). This is
        // essential because the panel's own notebook fetch can take
        // longer than a burst of rAF frames, and a stale bail-out would
        // leave the preview stuck on the previously highlighted beat.
        requestAnimationFrame(tryScroll);
        return;
      }
      const scroller = scrollerRef.current as HTMLDivElement & {
        __setProgrammatic?: (v: boolean) => void;
      };
      scroller.__setProgrammatic?.(true);
      try {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch {
        target.scrollIntoView();
      }
      lastActiveKey.current = key;
      window.setTimeout(() => scroller.__setProgrammatic?.(false), 600);
    };
    tryScroll();
    return () => {
      cancelled = true;
    };
  }, [activeBeatId, activeLineIdx, items.length, readyKey]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-500">
        Loading preview…
      </div>
    );
  }

  if (!notebook) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-500">
        No lesson to preview.
      </div>
    );
  }

  const activeStyle = (isActive: boolean): React.CSSProperties =>
    isActive
      ? { borderColor: HIGHLIGHT_BORDER, borderWidth: 2, boxShadow: HIGHLIGHT_SHADOW }
      : {};

  // ─── Edit-mode helpers ───────────────────────────────────────────────
  const selectedBorder = "rgba(59,130,246,0.9)";
  const selectedShadow = "0 0 0 3px rgba(59,130,246,0.18)";
  const editableOutline =
    mode === "edit"
      ? { cursor: "pointer" as const, outline: "1px dashed rgba(59,130,246,0.35)", outlineOffset: 2 }
      : {};

  // Live Mirror Mode: no confirmation button — selecting an item mirrors
  // it immediately via `onMirrorChange`. Keep the component as a no-op
  // to preserve existing JSX slots without extra layout work.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const AiEditButton = (_: { target: EditTarget }) => null;

  const SkipPill = ({ beatId }: { beatId: string }) => {
    if (mode !== "normal" || !notebookId) return null;
    const skipped = isSkipped(plan, beatId);
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleSkip(beatId);
        }}
        aria-label={skipped ? "Unskip" : "Skip"}
        className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold bg-white/85 hover:bg-white"
        style={{
          borderColor: skipped ? "rgba(180,83,9,0.4)" : "rgba(138,106,31,0.35)",
          color: skipped ? "#b45309" : "#524a3d",
        }}
      >
        {skipped ? (
          <>
            <EyeOff className="h-3 w-3" /> Skipped
          </>
        ) : (
          <>
            <Eye className="h-3 w-3" /> Skip
          </>
        )}
      </button>
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Mode toolbar */}
      <div
        className="flex items-center justify-between gap-2 px-4 py-2 border-b shrink-0"
        style={{ borderColor: "rgba(138,106,31,0.2)", background: "rgba(255,255,255,0.6)" }}
      >
        <p className="text-[10px] uppercase tracking-widest" style={{ color: ACCENT }}>
          {mode === "edit" ? "Edit mode — select any item" : "Normal mode"}
        </p>
        <button
          onClick={() => setMode((m) => (m === "edit" ? "normal" : "edit"))}
          className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold hover:bg-black/5"
          style={{
            borderColor: mode === "edit" ? "rgba(59,130,246,0.5)" : "rgba(138,106,31,0.35)",
            color: mode === "edit" ? "#1e40af" : INK,
            background: mode === "edit" ? "rgba(59,130,246,0.08)" : "transparent",
          }}
        >
          {mode === "edit" ? (
            <>
              <Check className="h-3.5 w-3.5" /> Done
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </>
          )}
        </button>
      </div>

      <div
        ref={scrollerRef}
        tabIndex={0}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 focus:outline-none"
        style={{
          color: INK,
          userSelect: mode === "edit" ? "text" : "none",
        }}
      >
      {items.map((it) => {
        const isActive = activeBeatId === it.id;

        if (it.kind === "cover") {
          const title = asDisplayString(notebook.title) || "Untitled";
          const subject = asDisplayString(notebook.subject);
          const subtopic = asDisplayString(notebook.subtopic);
          const target: EditTarget = { kind: "cover", beatId: it.id, caption: "Cover", text: title };
          const sel = isSelected(target);
          return (
            <section
              key={it.id}
              ref={setItemRef(it.id)}
              onClick={() => selectTarget(target)}
              className="relative rounded-2xl border p-6 text-center transition-colors"
              style={{
                background: "rgba(255,255,255,0.7)",
                borderColor: sel ? selectedBorder : "rgba(138,106,31,0.15)",
                boxShadow: sel ? selectedShadow : undefined,
                ...activeStyle(isActive && !sel),
                ...editableOutline,
              }}
            >
              <SkipPill beatId={it.id} />
              <p className="text-[9px] uppercase tracking-[0.35em]" style={{ color: ACCENT }}>
                Cover
              </p>
              <h2 className="mt-2 text-xl font-bold" style={{ color: INK }}>
                {title}
              </h2>
              {subject && <p className="mt-1 text-sm" style={{ color: "#524a3d" }}>{subject}</p>}
              {subtopic && <p className="text-sm" style={{ color: "#524a3d" }}>{subtopic}</p>}
              <p className="mt-2 text-[11px] text-neutral-500">{today()}</p>
              <AiEditButton target={target} />
            </section>
          );
        }

        if (it.kind === "prose") {
          const target: EditTarget = {
            kind: "section",
            beatId: it.id,
            caption: it.caption,
            text: it.text,
          };
          const sel = isSelected(target);
          return (
            <section
              key={it.id}
              ref={setItemRef(it.id)}
              onClick={() => selectTarget(target)}
              className="relative rounded-2xl border p-5 transition-colors"
              style={{
                background: "rgba(255,255,255,0.7)",
                borderColor: sel ? selectedBorder : "rgba(138,106,31,0.15)",
                boxShadow: sel ? selectedShadow : undefined,
                ...activeStyle(isActive && !sel),
                ...editableOutline,
              }}
            >
              <SkipPill beatId={it.id} />
              <h3 className="mb-2 text-sm font-semibold" style={{ color: INK }}>
                {it.caption}
              </h3>
              <div className="text-[14px] leading-relaxed" style={{ color: INK }}>
                <SmartboardLessonText>{it.text}</SmartboardLessonText>
              </div>
              <AiEditButton target={target} />
            </section>
          );
        }

        const res = it.reservoir;
        const subTarget: EditTarget = {
          kind: "subsection",
          beatId: it.id,
          caption: it.caption,
          text: it.problem,
        };
        const subSel = isSelected(subTarget);
        return (
          <section
            key={it.id}
            ref={setItemRef(it.id)}
            onClick={(e) => {
              if (e.target === e.currentTarget) selectTarget(subTarget);
            }}
            className="relative rounded-2xl border p-5 transition-colors"
            style={{
              background: "rgba(255,255,255,0.7)",
              borderColor: subSel ? selectedBorder : "rgba(138,106,31,0.15)",
              boxShadow: subSel ? selectedShadow : undefined,
              ...activeStyle(isActive && activeLineIdx == null && !subSel),
              ...editableOutline,
            }}
          >
            <SkipPill beatId={it.id} />
            <h3 className="mb-2 text-sm font-semibold" style={{ color: INK }}>
              {it.caption}
            </h3>
            {/* Question / problem statement — selectable on its own. */}
            {(() => {
              const qTarget: EditTarget = {
                kind: "question",
                beatId: it.id,
                caption: `${it.caption} · Question`,
                lineIdx: 0,
                text: it.problem,
              };
              const qSel = isSelected(qTarget);
              return (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    selectTarget(qTarget);
                  }}
                  className="mb-3 rounded-md px-2 py-1 text-[15px] leading-relaxed transition-colors"
                  style={{
                    color: INK,
                    border: `1px solid ${qSel ? selectedBorder : "transparent"}`,
                    boxShadow: qSel ? selectedShadow : undefined,
                    ...editableOutline,
                  }}
                >
                  <SmartboardLessonText>{it.problem}</SmartboardLessonText>
                  <AiEditButton target={qTarget} />
                </div>
              );
            })()}

            {res && res.lines.length > 0 && (
              <div className="mt-3 space-y-3">
                {res.lines.map((line: ReservoirLine, k: number) => {
                  const eq = asDisplayString(line.equation).trim();
                  const note = asDisplayString(line.notebook).trim();
                  const lineActive = isActive && activeLineIdx === k;
                  const lineKey = `${it.id}::${k}`;
                  const lineTarget: EditTarget = {
                    kind: "solution-line",
                    beatId: it.id,
                    caption: `${it.caption} · Line ${k + 1}`,
                    lineIdx: k,
                    text: eq,
                  };
                  const lineSel = isSelected(lineTarget);
                  return (
                    <div
                      key={k}
                      ref={setLineRef(lineKey)}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectTarget(lineTarget);
                      }}
                      className="relative rounded-md pl-3 pr-2 py-1.5 transition-all border"
                      style={{
                        borderColor: lineSel
                          ? selectedBorder
                          : lineActive
                          ? HIGHLIGHT_BORDER
                          : "rgba(138,106,31,0.15)",
                        borderLeftWidth: 2,
                        borderTopWidth: lineActive || lineSel ? 2 : 0,
                        borderRightWidth: lineActive || lineSel ? 2 : 0,
                        borderBottomWidth: lineActive || lineSel ? 2 : 0,
                        boxShadow: lineSel
                          ? selectedShadow
                          : lineActive
                          ? HIGHLIGHT_SHADOW
                          : "none",
                        ...editableOutline,
                      }}
                    >
                      <div
                        className="mb-1 text-[9px] font-semibold uppercase tracking-[0.25em]"
                        style={{ color: "rgba(138,106,31,0.65)" }}
                      >
                        Line {k + 1}
                      </div>
                      {!line.notebookOnly && eq && (
                        <div className="flex items-center gap-3 flex-wrap">
                          <HighlightBox>
                            <span className="text-lg">
                              <InlineMath ascii={eq} />
                            </span>
                          </HighlightBox>
                        </div>
                      )}
                      {!line.notebookOnly && eq &&
                        (it.hasFloatingData && line.fillers.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2 pl-1">
                            {line.fillers.map((f, fi) => {
                              const chipTarget: EditTarget = {
                                kind: "floating-number",
                                beatId: it.id,
                                caption: `${it.caption} · Line ${k + 1} · Chip ${fi + 1}`,
                                lineIdx: k,
                                fillerIdx: fi,
                                text: f,
                              };
                              const chipSel = isSelected(chipTarget);
                              return (
                                <button
                                  key={fi}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectTarget(chipTarget);
                                  }}
                                  className="inline-flex items-center rounded-md border px-2.5 py-1 text-base font-serif"
                                  style={{
                                    borderColor: chipSel
                                      ? selectedBorder
                                      : "rgba(59,130,246,0.35)",
                                    background: "rgba(59,130,246,0.08)",
                                    color: "#1e3a8a",
                                    boxShadow: chipSel ? selectedShadow : undefined,
                                    ...editableOutline,
                                  }}
                                >
                                  <InlineMath ascii={f} />
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <NotYetAvailable />
                        ))}
                      {note &&
                        (() => {
                          const noteTarget: EditTarget = {
                            kind: "teacher-note",
                            beatId: it.id,
                            caption: `${it.caption} · Line ${k + 1} · Note`,
                            lineIdx: k,
                            text: note,
                          };
                          const noteSel = isSelected(noteTarget);
                          return (
                            <div
                              data-note-button="true"
                              data-line-idx={k}
                              data-beat-id={it.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectTarget(noteTarget);
                              }}
                              style={{
                                border: `1px solid ${noteSel ? selectedBorder : "transparent"}`,
                                boxShadow: noteSel ? selectedShadow : undefined,
                                borderRadius: 6,
                                ...editableOutline,
                              }}
                            >
                              <NoteBlock text={note} />
                              <AiEditButton target={noteTarget} />
                            </div>
                          );
                        })()}
                      <AiEditButton target={lineTarget} />
                    </div>
                  );
                })}
              </div>
            )}
            <AiEditButton target={subTarget} />
          </section>
        );
      })}
      <div className="h-40" />
      </div>
    </div>
  );
};


export default PresenterPreviewPanel;
