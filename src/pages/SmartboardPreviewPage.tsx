// Smartboard Presentation Preview — the teacher's rehearsal stage.
//
// This is NOT a debug page. It is the final teacher-facing preview before
// entering the classroom. Everything shown here is exactly what students
// will see on the Smartboard, painted with the same renderer the live
// board uses. The only additions the teacher sees are:
//
//   🟧 highlighted regions (become floating numbers)
//   🔵 floating-number chip groups
//   📘 notebook notes
//   👁 Present / 🚫 Skip pills (per block)
//   ✏  AI Edit (per line, scoped)
//
// No JSON, no [Object Object], no LaTeX residue, no section-kind chrome,
// no auto-generated captions. Content outside the Solution section is
// copied verbatim from the Lesson Note.

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Check, Eye, EyeOff, Pencil, PlayCircle, RotateCcw, StickyNote } from "lucide-react";

import { useNotebook, type SectionRow } from "@/hooks/useNotebook";
import {
  buildReservoirs,
  type Reservoir,
  type ReservoirLine,
} from "@/lib/smartboard/presentation";
import {
  clearSkipped,
  isSkipped,
  loadPlan,
  markApproved,
  toggleSkipped,
  type PresentationPlan,
} from "@/lib/smartboard/presentationPlan";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { SmartboardLessonText } from "@/components/smartboard/SmartboardLessonText";
import { PLACEHOLDER_COLOR } from "@/lib/smartboard/placeholderColor";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

/* ─────────────── Chalk styling — mirrors PresentationView whiteboard ─────────────── */

const BOARD_BG =
  "radial-gradient(120% 80% at 20% 0%, rgba(255,255,255,0.9) 0%, rgba(245,243,238,0.0) 55%)," +
  "radial-gradient(140% 100% at 80% 100%, rgba(225,228,232,0.55) 0%, rgba(245,243,238,0) 60%)," +
  "linear-gradient(160deg,#f6f4ef 0%,#eeece6 55%,#e8e6df 100%)";

const INK = "#1a2230";
const ACCENT = "#8a6a1f";

/* ─────────────── Guards ─────────────── */

/** Fail-closed string coercion. Any non-primitive (object/array) returns "".
 *  Prevents `[Object Object]` from ever reaching the DOM. */
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

/* ─────────────── Renderers ─────────────── */

// FUNDAMENTAL LAW: every piece of text on this page passes through the
// classroom math renderer before display. renderMathInline returns REACT
// NODES — render them as children, never into innerHTML (that coerces the
// element array to "[object Object],[object Object]").
const InlineMath = ({ ascii }: { ascii: string }) => (
  <span className="font-serif" style={{ color: INK }}>
    {renderMathInline(asDisplayString(ascii), "preview-page-inline", { placeholderColor: PLACEHOLDER_COLOR })}
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
  // Note prose can carry math (e.g. "For the equation 2x^{2} + 5x + 3 = 0").
  // Render every note line through the math renderer so raw LaTeX syntax
  // (\frac, \sqrt, ^{}) never reaches the teacher's eyes.
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
          <div key={i}>{renderMathInline(l, `note-${i}`, { placeholderColor: PLACEHOLDER_COLOR })}</div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────── Per-line AI Edit ─────────────── */

const AiEditPopover = ({
  lineLabel,
  onSend,
}: {
  lineLabel: string;
  onSend: (note: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100 transition"
          style={{ borderColor: "rgba(0,0,0,0.15)" }}
        >
          <Pencil className="h-3 w-3" /> AI Edit
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-2">
          <p className="text-xs text-neutral-500">
            Correction for: <span className="font-medium text-neutral-700">{lineLabel}</span>
          </p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. This should be a Notebook, not a Floating Number."
            className="min-h-[80px] text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => {
                if (!note.trim()) return;
                onSend(note.trim());
                setNote("");
                setOpen(false);
              }}
            >
              Send
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

/* ─────────────── Presentation block wrapper ─────────────── */

const Block = ({
  id,
  skipped,
  onToggle,
  caption,
  children,
}: {
  id: string;
  skipped: boolean;
  onToggle: (id: string) => void;
  caption?: string;
  children: React.ReactNode;
}) => (
  <section
    className="relative rounded-2xl border p-6 shadow-xs transition"
    style={{
      background: "rgba(255,255,255,0.7)",
      borderColor: "rgba(138,106,31,0.15)",
      opacity: skipped ? 0.4 : 1,
    }}
  >
    <div className="mb-3 flex items-start justify-between gap-4">
      <h2 className={`text-xl font-semibold ${skipped ? "line-through" : ""}`} style={{ color: INK }}>
        {caption ?? ""}
      </h2>
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex-none inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition"
        style={{
          borderColor: skipped ? "rgba(220,38,38,0.4)" : "rgba(22,163,74,0.4)",
          background: skipped ? "rgba(220,38,38,0.08)" : "rgba(22,163,74,0.08)",
          color: skipped ? "#b91c1c" : "#15803d",
        }}
      >
        {skipped ? <><EyeOff className="h-3.5 w-3.5" /> Skipped</> : <><Eye className="h-3.5 w-3.5" /> Present</>}
      </button>
    </div>
    <div>{children}</div>
  </section>
);

/* ─────────────── Page ─────────────── */

const SmartboardPreviewPage = () => {
  const { notebookId } = useParams<{ notebookId: string }>();
  const navigate = useNavigate();
  const { notebook, sections, loading } = useNotebook(notebookId);

  const reservoirs = useMemo(() => buildReservoirs(sections), [sections]);
  const reservoirByBeat = useMemo(() => {
    const m = new Map<string, Reservoir>();
    for (const r of reservoirs) m.set(r.beatId, r);
    return m;
  }, [reservoirs]);

  const [plan, setPlan] = useState<PresentationPlan>(() => loadPlan(notebookId));

  const onToggle = (id: string) => {
    if (!notebookId) return;
    setPlan(toggleSkipped(notebookId, id));
  };
  const onClear = () => {
    if (!notebookId) return;
    setPlan(clearSkipped(notebookId));
  };
  const onApprove = () => {
    if (!notebookId) return;
    markApproved(notebookId);
    toast({ title: "Presentation approved", description: "Launching Smartboard…" });
    navigate(`/smartboard/${notebookId}`);
  };
  const onAiEdit = (label: string, note: string) => {
    // The AI Workshop pipeline for per-line corrections is wired in the
    // Floating Prep page. Here we capture the teacher's note and hand off.
    console.info("[preview.ai-edit]", { label, note });
    toast({
      title: "Correction noted",
      description: "Open the Floating Numbers page to apply detailed edits.",
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: BOARD_BG }}>
        <p className="text-sm text-neutral-500">Loading preview…</p>
      </main>
    );
  }

  if (!notebook) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: BOARD_BG }}>
        <div className="text-center max-w-md">
          <h2 className="text-lg font-semibold">Nothing to preview yet</h2>
          <Button className="mt-4" onClick={() => navigate("/smartboard")}>Back to Shelf</Button>
        </div>
      </main>
    );
  }

  // Build the presentation blocks straight from the raw Lesson Note.
  // Numbering is per-section-kind (Example 1, Example 2, Exercise 1, …),
  // matching what buildReservoirs produced.
  type Item =
    | { id: string; kind: "cover" }
    | { id: string; kind: "prose"; caption: string; text: string }
    | {
        id: string;
        kind: "problem";
        caption: string;
        problem: string;
        reservoir?: Reservoir;
        subsectionId: string;
        /** Teacher has generated floating numbers on the Floating Number page. */
        hasFloatingData: boolean;
      };

  const items: Item[] = [];
  items.push({ id: "__cover__", kind: "cover" });

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
        sec.kind === "introduction" ? "Introduction" : sec.kind === "explanation" ? "Explanation" : "Summary";
      items.push({ id: `${sec.id}-text`, kind: "prose", caption, text });
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
        items.push({
          id: `${sub.id}-q`,
          kind: "problem",
          caption: `${label} ${n}`,
          problem,
          reservoir: reservoirByBeat.get(`${sub.id}-q`),
          subsectionId: sub.id,
          hasFloatingData:
            Array.isArray((sub as any).floating_lines) &&
            ((sub as any).floating_lines as any[]).length > 0,
        });
      }
    }
  }

  const totalPresent = items.filter((it) => !isSkipped(plan, it.id)).length;

  return (
    <main className="min-h-screen" style={{ background: BOARD_BG, color: INK }}>
      <header
        className="sticky top-0 z-10 backdrop-blur-md border-b"
        style={{ background: "rgba(246,244,239,0.9)", borderColor: "rgba(138,106,31,0.2)" }}
      >
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/smartboard")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Shelf
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.4em]" style={{ color: ACCENT }}>
              Presentation Preview
            </p>
            <h1 className="text-lg font-semibold truncate">
              {asDisplayString(notebook.title) || "Untitled"}
            </h1>
          </div>
          <div className="hidden sm:block text-xs text-neutral-500 mr-2">
            {totalPresent} of {items.length} to present
          </div>
          <Button variant="ghost" size="sm" onClick={onClear} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button size="sm" onClick={onApprove} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Check className="h-4 w-4" /> Approve & Go Live
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-6 space-y-4">
        {items.map((it) => {
          const skipped = isSkipped(plan, it.id);

          if (it.kind === "cover") {
            const title = asDisplayString(notebook.title) || "Untitled";
            const subject = asDisplayString(notebook.subject);
            const subtopic = asDisplayString(notebook.subtopic);
            return (
              <section
                key={it.id}
                className="relative rounded-2xl border p-8 text-center shadow-xs transition"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  borderColor: "rgba(138,106,31,0.2)",
                  opacity: skipped ? 0.4 : 1,
                }}
              >
                <button
                  type="button"
                  onClick={() => onToggle(it.id)}
                  className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition"
                  style={{
                    borderColor: skipped ? "rgba(220,38,38,0.4)" : "rgba(22,163,74,0.4)",
                    background: skipped ? "rgba(220,38,38,0.08)" : "rgba(22,163,74,0.08)",
                    color: skipped ? "#b91c1c" : "#15803d",
                  }}
                >
                  {skipped ? <><EyeOff className="h-3.5 w-3.5" /> Skipped</> : <><Eye className="h-3.5 w-3.5" /> Present</>}
                </button>
                <h2 className={`text-3xl font-bold ${skipped ? "line-through" : ""}`} style={{ color: INK }}>
                  {title}
                </h2>
                {subject && (
                  <p className="mt-3 text-lg" style={{ color: "#524a3d" }}>{subject}</p>
                )}
                {subtopic && (
                  <p className="text-lg" style={{ color: "#524a3d" }}>{subtopic}</p>
                )}
                <p className="mt-3 text-sm text-neutral-500">{today()}</p>
              </section>
            );
          }

          if (it.kind === "prose") {
            return (
              <Block key={it.id} id={it.id} skipped={skipped} onToggle={onToggle} caption={it.caption}>
                <div className="text-[16px] leading-relaxed" style={{ color: INK }}>
                  <SmartboardLessonText placeholderColor={PLACEHOLDER_COLOR}>{it.text}</SmartboardLessonText>
                </div>
                <div className="mt-3 flex justify-end">
                  <AiEditPopover
                    lineLabel={it.caption}
                    onSend={(note) => onAiEdit(it.caption, note)}
                  />
                </div>
              </Block>
            );
          }

          // problem + optional solution
          const res = it.reservoir;
          return (
            <Block key={it.id} id={it.id} skipped={skipped} onToggle={onToggle} caption={it.caption}>
              <div className="text-[17px] leading-relaxed mb-4" style={{ color: INK }}>
                <SmartboardLessonText placeholderColor={PLACEHOLDER_COLOR}>{it.problem}</SmartboardLessonText>
              </div>

              {res && res.lines.length > 0 && (
                <div className="mt-4 space-y-4">
                  {res.lines.map((line: ReservoirLine, k: number) => {
                    const eq = asDisplayString(line.equation).trim();
                    const note = asDisplayString(line.notebook).trim();
                    const label = `Line ${k + 1}`;
                    // Universal rule — same for line 1 or line 1,000,000:
                    //   1. equation (highlighted) on top
                    //   2. floating numbers underneath (exact chips from the
                    //      Floating Number page; "not yet available" if the
                    //      teacher hasn't generated them)
                    //   3. note underneath, notebook icon style
                    // One AI Edit per line — it covers all three segments.
                    return (
                      <div
                        key={k}
                        className="pl-4"
                        style={{ borderLeft: "2px solid rgba(138,106,31,0.15)" }}
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span
                            className="text-[10px] font-semibold uppercase tracking-[0.25em]"
                            style={{ color: "rgba(138,106,31,0.65)" }}
                          >
                            {label}
                          </span>
                          <AiEditPopover
                            lineLabel={label}
                            onSend={(n) => onAiEdit(`${it.caption} · ${label}`, n)}
                          />
                        </div>
                        {!line.notebookOnly && eq && (
                          <div className="flex items-center gap-3 flex-wrap">
                            <HighlightBox>
                              <span className="text-xl">
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
                        {/* line.explanation intentionally NOT rendered here:
                            on the live board it only surfaces behind the "+"
                            marker, and its text duplicates equations that
                            already appear as their own display lines. */}
                      </div>
                    );
                  })}
                </div>
              )}
            </Block>
          );
        })}

        <div className="pt-4 pb-16 flex items-center justify-between border-t border-amber-200/40">
          <p className="text-xs text-neutral-500">
            {totalPresent} of {items.length} blocks will be presented. Skipped blocks are hidden from the live board.
          </p>
          <Button onClick={onApprove} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            <PlayCircle className="h-4 w-4" /> Approve & Go Live
          </Button>
        </div>
      </section>
    </main>
  );
};

export default SmartboardPreviewPage;
