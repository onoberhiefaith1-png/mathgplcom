// Smartboard Presentation Preview — the teacher's rehearsal stage.
//
// Renders every beat + reservoir line the live smartboard will present, in
// order, using the same chalk styling, so the teacher can verify floating
// numbers and notebook attachments BEFORE walking into the classroom.
//
// Per-unit Present/Skip toggles let the teacher exclude sections from the
// upcoming presentation without editing the lesson note. When they hit
// "Approve & Go Live", the live board is launched — it reads the same skip
// flags via `applyPlan`, guaranteeing a 1:1 relationship between what the
// teacher rehearsed here and what the class actually sees.

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Eye, EyeOff, PlayCircle, RotateCcw, StickyNote } from "lucide-react";

import { useNotebook } from "@/hooks/useNotebook";
import { buildBeats, buildReservoirs, type Beat, type Reservoir, type ReservoirLine } from "@/lib/smartboard/presentation";
import {
  applyPlan,
  clearSkipped,
  isSkipped,
  loadPlan,
  markApproved,
  toggleSkipped,
  type PresentationPlan,
} from "@/lib/smartboard/presentationPlan";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

/* ─────────────── Chalk styling — mirrors PresentationView ─────────────── */

const BOARD_BG =
  "radial-gradient(120% 80% at 20% 0%, rgba(255,255,255,0.9) 0%, rgba(245,243,238,0.0) 55%)," +
  "radial-gradient(140% 100% at 80% 100%, rgba(225,228,232,0.55) 0%, rgba(245,243,238,0) 60%)," +
  "linear-gradient(160deg,#f6f4ef 0%,#eeece6 55%,#e8e6df 100%)";

const INK = "#1a2230";
const ACCENT = "#8a6a1f";

/* ─────────────── Renderers ─────────────── */

const Math = ({ ascii }: { ascii: string }) => (
  <span
    className="font-serif"
    style={{ color: INK }}
    dangerouslySetInnerHTML={{ __html: renderMathInline(ascii ?? "") }}
  />
);

const HighlightBox = ({ children }: { children: React.ReactNode }) => (
  <span
    className="inline-block rounded px-2 py-0.5"
    style={{
      background: "rgba(232, 201, 138, 0.35)",
      boxShadow: "0 0 0 1px rgba(138, 106, 31, 0.35) inset",
    }}
  >
    {children}
  </span>
);

const RoleChip = ({
  kind,
  index,
}: {
  kind: "floating" | "notebook" | "none";
  index?: number;
}) => {
  if (kind === "floating") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: "rgba(59, 130, 246, 0.12)", color: "#1e40af" }}>
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
        Floating Number {index !== undefined ? `#${index}` : ""}
      </span>
    );
  }
  if (kind === "notebook") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: "rgba(120, 113, 108, 0.12)", color: "#57534e" }}>
        <StickyNote className="h-3 w-3" /> Notebook
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
      —
    </span>
  );
};

const SolutionLineRow = ({
  line,
  floatingIndex,
}: {
  line: ReservoirLine;
  floatingIndex: number;
}) => {
  const hasFloating = !line.notebookOnly && line.fillers.length > 0;
  const hasNotebook = !!line.notebook && line.notebook.trim().length > 0;

  return (
    <div className="py-2 border-l-2 pl-4" style={{ borderColor: "rgba(138,106,31,0.2)" }}>
      {hasNotebook && (
        <div className="mb-1.5 flex items-start gap-2 text-[15px] leading-relaxed" style={{ color: "#524a3d" }}>
          <StickyNote className="mt-1 h-3.5 w-3.5 flex-none opacity-60" />
          <div className="italic whitespace-pre-wrap">{line.notebook}</div>
        </div>
      )}
      {!line.notebookOnly && line.equation && (
        <div className="flex items-center gap-3 flex-wrap">
          <HighlightBox>
            <span className="text-xl">
              <Math ascii={line.equation} />
            </span>
          </HighlightBox>
          <RoleChip kind={hasFloating ? "floating" : hasNotebook ? "notebook" : "none"} index={hasFloating ? floatingIndex : undefined} />
        </div>
      )}
      {hasFloating && (
        <div className="mt-1.5 flex flex-wrap gap-1.5 pl-1">
          {line.fillers.map((f, i) => (
            <span
              key={i}
              className="inline-block rounded border px-2 py-0.5 text-sm font-serif"
              style={{ borderColor: "rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.06)", color: "#1e3a8a" }}
            >
              <Math ascii={f} />
            </span>
          ))}
        </div>
      )}
      {line.explanation && (
        <div className="mt-1 text-xs text-neutral-500 italic whitespace-pre-wrap pl-1">
          {line.explanation}
        </div>
      )}
    </div>
  );
};

const Unit = ({
  id,
  title,
  skipped,
  onToggle,
  children,
}: {
  id: string;
  title: React.ReactNode;
  skipped: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) => (
  <section
    className="relative rounded-2xl border p-6 shadow-sm transition"
    style={{
      background: "rgba(255,255,255,0.65)",
      borderColor: "rgba(138,106,31,0.15)",
      opacity: skipped ? 0.4 : 1,
    }}
  >
    <div className="flex items-start justify-between gap-4 mb-3">
      <div className={skipped ? "line-through" : ""}>{title}</div>
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

  const beats = useMemo(() => buildBeats(sections, notebook), [sections, notebook]);
  const reservoirs = useMemo(() => buildReservoirs(sections), [sections]);
  const reservoirByBeat = useMemo(() => {
    const m = new Map<string, Reservoir>();
    for (const r of reservoirs) m.set(r.beatId, r);
    return m;
  }, [reservoirs]);

  const [plan, setPlan] = useState<PresentationPlan>(() => loadPlan(notebookId));

  const onToggle = (beatId: string) => {
    if (!notebookId) return;
    setPlan(toggleSkipped(notebookId, beatId));
  };

  const onClear = () => {
    if (!notebookId) return;
    setPlan(clearSkipped(notebookId));
  };

  const onApprove = () => {
    if (!notebookId) return;
    markApproved(notebookId);
    toast({ title: "Preview approved", description: "Launching Live Smartboard…" });
    navigate(`/smartboard/${notebookId}`);
  };

  // Preview reflects the effect of skips (dimmed but visible).
  const activePreview = useMemo(() => applyPlan(beats, reservoirs, plan), [beats, reservoirs, plan]);
  const activeCount = activePreview.beats.length;
  const totalCount = beats.length;

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: BOARD_BG }}>
        <p className="text-sm text-neutral-500">Loading preview…</p>
      </main>
    );
  }

  if (!notebook || beats.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: BOARD_BG }}>
        <div className="text-center max-w-md">
          <h2 className="text-lg font-semibold">Nothing to preview yet</h2>
          <p className="mt-2 text-sm text-neutral-500">
            This lesson note has no content the Smartboard can present.
          </p>
          <Button className="mt-4" onClick={() => navigate("/smartboard")}>Back to Shelf</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: BOARD_BG, color: INK }}>
      <header className="sticky top-0 z-10 backdrop-blur-md border-b" style={{ background: "rgba(246,244,239,0.85)", borderColor: "rgba(138,106,31,0.2)" }}>
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/smartboard")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Shelf
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.4em]" style={{ color: ACCENT }}>Smartboard Preview</p>
            <h1 className="text-xl font-semibold truncate">{notebook.title ?? "Untitled"}</h1>
          </div>
          <div className="hidden sm:block text-xs text-neutral-500 mr-2">
            {activeCount} of {totalCount} units to present
          </div>
          <Button variant="ghost" size="sm" onClick={onClear} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button size="sm" onClick={onApprove} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Check className="h-4 w-4" /> Approve & Go Live
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50/60 p-3 text-xs text-amber-900">
          <strong>Rehearsal mode.</strong> Everything below is exactly what students will see, in order.
          Use <em>Present / Skip</em> per unit to control what appears during the lesson without editing the note.
          When approved, the Live Smartboard follows this plan 1:1.
        </div>

        {beats.map((beat) => {
          const skipped = isSkipped(plan, beat.id);
          const res = reservoirByBeat.get(beat.id);

          if (beat.id === "__cover__") {
            return (
              <Unit key={beat.id} id={beat.id} skipped={skipped} onToggle={onToggle}
                title={
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.4em]" style={{ color: ACCENT }}>Cover</p>
                    <h2 className="text-2xl font-semibold">{beat.content}</h2>
                    <p className="text-sm text-neutral-500 mt-1">
                      {[beat.caption, beat.reasoning].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                }
              >
                <p className="text-xs text-neutral-500">Lesson title card shown first on the board.</p>
              </Unit>
            );
          }

          if (beat.kind === "text") {
            return (
              <Unit key={beat.id} id={beat.id} skipped={skipped} onToggle={onToggle}
                title={
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.4em]" style={{ color: ACCENT }}>
                      {beat.sectionKind}
                    </p>
                    <h2 className="text-lg font-semibold capitalize">{beat.sectionKind}</h2>
                  </div>
                }
              >
                <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
                  <Math ascii={beat.content} />
                </div>
              </Unit>
            );
          }

          // problem / exercise-prompt beats — show the question then the reservoir lines.
          return (
            <Unit key={beat.id} id={beat.id} skipped={skipped} onToggle={onToggle}
              title={
                <div>
                  <p className="text-[10px] uppercase tracking-[0.4em]" style={{ color: ACCENT }}>
                    {beat.caption ?? beat.sectionKind}
                  </p>
                  <div className="text-lg font-medium mt-0.5">
                    <Math ascii={beat.content} />
                  </div>
                </div>
              }
            >
              {res && res.lines.length > 0 ? (
                <>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-400 mb-2">Solution</p>
                  <div className="space-y-1">
                    {(() => {
                      let floatingIdx = 0;
                      return res.lines.map((line, k) => {
                        const hasFloating = !line.notebookOnly && line.fillers.length > 0;
                        if (hasFloating) floatingIdx += 1;
                        return (
                          <SolutionLineRow
                            key={k}
                            line={line}
                            floatingIndex={floatingIdx}
                          />
                        );
                      });
                    })()}
                  </div>
                </>
              ) : (
                <p className="text-xs text-neutral-400 italic">
                  No solution lines highlighted yet — teacher will solve live.
                </p>
              )}
            </Unit>
          );
        })}

        <div className="pt-4 pb-16 flex items-center justify-between border-t border-amber-200/40">
          <p className="text-xs text-neutral-500">
            Rehearsed {activeCount} of {totalCount} units. Skipped units are hidden from the live board.
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
