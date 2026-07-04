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

import { useEffect, useMemo, useRef, useState } from "react";
import { StickyNote } from "lucide-react";

import { useNotebook, type SectionRow } from "@/hooks/useNotebook";
import {
  buildReservoirs,
  type Reservoir,
  type ReservoirLine,
} from "@/lib/smartboard/presentation";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { SmartboardLessonText } from "@/components/smartboard/SmartboardLessonText";

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
}

const PresenterPreviewPanel = ({
  notebookId,
  activeBeatId,
  activeLineIdx,
  onManualScrollChange,
}: PresenterPreviewPanelProps) => {
  const { notebook, sections, loading } = useNotebook(notebookId ?? undefined);

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

  return (
    <div
      ref={scrollerRef}
      tabIndex={0}
      className="h-full w-full overflow-y-auto px-4 py-4 space-y-4 focus:outline-none"
      style={{ color: INK }}
    >
      {items.map((it) => {
        const isActive = activeBeatId === it.id;

        if (it.kind === "cover") {
          const title = asDisplayString(notebook.title) || "Untitled";
          const subject = asDisplayString(notebook.subject);
          const subtopic = asDisplayString(notebook.subtopic);
          return (
            <section
              key={it.id}
              ref={setItemRef(it.id)}
              className="rounded-2xl border p-6 text-center transition-colors"
              style={{
                background: "rgba(255,255,255,0.7)",
                borderColor: "rgba(138,106,31,0.15)",
                ...activeStyle(isActive),
              }}
            >
              <p className="text-[9px] uppercase tracking-[0.35em]" style={{ color: ACCENT }}>
                Cover
              </p>
              <h2 className="mt-2 text-xl font-bold" style={{ color: INK }}>
                {title}
              </h2>
              {subject && <p className="mt-1 text-sm" style={{ color: "#524a3d" }}>{subject}</p>}
              {subtopic && <p className="text-sm" style={{ color: "#524a3d" }}>{subtopic}</p>}
              <p className="mt-2 text-[11px] text-neutral-500">{today()}</p>
            </section>
          );
        }

        if (it.kind === "prose") {
          return (
            <section
              key={it.id}
              ref={setItemRef(it.id)}
              className="rounded-2xl border p-5 transition-colors"
              style={{
                background: "rgba(255,255,255,0.7)",
                borderColor: "rgba(138,106,31,0.15)",
                ...activeStyle(isActive),
              }}
            >
              <h3 className="mb-2 text-sm font-semibold" style={{ color: INK }}>
                {it.caption}
              </h3>
              <div className="text-[14px] leading-relaxed" style={{ color: INK }}>
                <SmartboardLessonText>{it.text}</SmartboardLessonText>
              </div>
            </section>
          );
        }

        const res = it.reservoir;
        return (
          <section
            key={it.id}
            ref={setItemRef(it.id)}
            className="rounded-2xl border p-5 transition-colors"
            style={{
              background: "rgba(255,255,255,0.7)",
              borderColor: "rgba(138,106,31,0.15)",
              ...activeStyle(isActive && (activeLineIdx == null)),
            }}
          >
            <h3 className="mb-2 text-sm font-semibold" style={{ color: INK }}>
              {it.caption}
            </h3>
            <div className="mb-3 text-[15px] leading-relaxed" style={{ color: INK }}>
              <SmartboardLessonText>{it.problem}</SmartboardLessonText>
            </div>

            {res && res.lines.length > 0 && (
              <div className="mt-3 space-y-3">
                {res.lines.map((line: ReservoirLine, k: number) => {
                  const eq = asDisplayString(line.equation).trim();
                  const note = asDisplayString(line.notebook).trim();
                  const lineActive = isActive && activeLineIdx === k;
                  const lineKey = `${it.id}::${k}`;
                  return (
                    <div
                      key={k}
                      ref={setLineRef(lineKey)}
                      className="rounded-md pl-3 pr-2 py-1.5 transition-all border"
                      style={{
                        borderColor: lineActive
                          ? HIGHLIGHT_BORDER
                          : "rgba(138,106,31,0.15)",
                        borderLeftWidth: lineActive ? 2 : 2,
                        borderTopWidth: lineActive ? 2 : 0,
                        borderRightWidth: lineActive ? 2 : 0,
                        borderBottomWidth: lineActive ? 2 : 0,
                        boxShadow: lineActive ? HIGHLIGHT_SHADOW : "none",
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
                      {!line.notebookOnly && eq && (
                        it.hasFloatingData && line.fillers.length > 0 ? (
                          <FloatingChips fillers={line.fillers} />
                        ) : (
                          <NotYetAvailable />
                        )
                      )}
                      {note && <NoteBlock text={note} />}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      <div className="h-40" />
    </div>
  );
};

export default PresenterPreviewPanel;
