// BOARD B — the interactive mathematics board.
//
// Think of a classroom with two physical boards used for the same lesson at the
// same time: Board A carries the teaching (text, headings, questions,
// solutions), Board B carries the interactive mathematics of the SAME lesson
// position — Diagram, Table, Graph, Calculator, Conversion.
//
// It is NOT a second lesson and NOT an independent page: the active section is
// owned by the Smartboard and passed in, so both boards always show the same
// part of the lesson. The existing blank companion Lesson Note page stays
// available here as a secondary mode.

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Calculator, NotebookPen, Repeat, Shapes } from "lucide-react";
import { SolutionObjectView } from "@/components/lessonnotes/SolutionObjectView";
import { SmartCalculatorBody } from "@/components/lessonnotes/math-tools/SmartCalculator";
import { ConversionBody } from "@/components/lessonnotes/ConversionPanel";
import { CompanionNoteBoard } from "./CompanionNoteBoard";
import type { SolutionObject } from "@/lib/floating/solutionItems";

type Mode = "objects" | "calculator" | "conversion" | "companion";

export interface InteractiveBoardProps {
  /** The single active lesson position, shared with Board A. */
  sectionId: string;
  sectionLabel: string;
  /** Board-B objects belonging to THIS section only. */
  objects: SolutionObject[];
  notebookId?: string;
  editable: boolean;
  zoom?: number;
  onReturn: () => void;
  palette: {
    chromeBg: string;
    chromeFg: string;
    chromeBorder: string;
    hoverBg: string;
    accent?: string;
  };
}

export const InteractiveBoard = ({
  sectionId,
  sectionLabel,
  objects,
  notebookId,
  editable,
  zoom = 1,
  onReturn,
  palette,
}: InteractiveBoardProps) => {
  // Tool choice is remembered PER SECTION, so moving away and coming back
  // restores the surface the teacher was using for that part of the lesson.
  const modeBySection = useRef<Record<string, Mode>>({});
  const [mode, setMode] = useState<Mode>(() => modeBySection.current[sectionId] ?? "objects");

  useEffect(() => {
    setMode(modeBySection.current[sectionId] ?? "objects");
  }, [sectionId]);

  const pick = (next: Mode) => {
    modeBySection.current[sectionId] = next;
    setMode(next);
  };

  // Tool panels stay mounted per visited section so calculator / conversion
  // work is never lost by switching boards or sections.
  const [visited, setVisited] = useState<string[]>([sectionId]);
  useEffect(() => {
    setVisited((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]));
  }, [sectionId]);

  const tabs: { id: Mode; label: string; icon: typeof Shapes }[] = useMemo(
    () => [
      { id: "objects", label: "Section", icon: Shapes },
      { id: "calculator", label: "Calculator", icon: Calculator },
      { id: "conversion", label: "Conversion", icon: Repeat },
      { id: "companion", label: "Companion page", icon: NotebookPen },
    ],
    [],
  );

  return (
    <div className="flex h-full w-full flex-col" style={{ background: "#15132a" }}>
      <div
        className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5"
        style={{ background: palette.chromeBg, color: palette.chromeFg, borderColor: palette.chromeBorder }}
      >
        <button
          onClick={onReturn}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
          style={{ background: palette.hoverBg }}
          title="Back to the teaching board"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Teaching board
        </button>

        <span className="truncate text-[11px] font-medium">
          {sectionLabel || "Lesson"}
        </span>

        <span className="ml-auto inline-flex items-center gap-1">
          {tabs.map((t) => {
            const active = mode === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => pick(t.id)}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border px-2 py-1 text-[11px]"
                style={active
                  ? {
                    background: palette.accent ?? palette.chromeFg,
                    color: palette.chromeBg,
                    borderColor: palette.accent ?? palette.chromeFg,
                  }
                  : { color: palette.chromeFg, borderColor: palette.chromeBorder }}
                title={t.label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* SECTION OBJECTS — only this section's interactive mathematics. */}
        <div
          className="absolute inset-0 overflow-y-auto overflow-x-hidden px-4 py-6 md:px-10"
          style={{ display: mode === "objects" ? "block" : "none" }}
        >
          <div className="mx-auto w-full max-w-[1100px]">
            <div className="mb-5 text-[13px] uppercase tracking-[0.2em] text-white/60">
              {sectionLabel}
            </div>
            {objects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/20 p-10 text-center text-[13px] text-white/60">
                No diagram, table or graph in this part of the lesson. Use the
                Calculator, Conversion or the companion page.
              </div>
            ) : (
              <div className="space-y-10">
                {objects.map((o) => (
                  <div
                    key={`${sectionId}-${o.objId}`}
                    className="lesson-doc sb-board-object w-full max-w-full rounded-xl bg-white p-4 text-slate-900"
                    style={{ fontSize: `${zoom}rem` }}
                  >
                    <SolutionObjectView
                      nodeType={o.nodeType}
                      attrs={o.attrs ?? {}}
                      presentation
                      zoom={zoom}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CALCULATOR / CONVERSION — one instance per visited section, kept
            mounted so their working survives board and section switches. */}
        {visited.map((sid) => (
          <div
            key={`calc-${sid}`}
            className="absolute inset-0 overflow-y-auto px-4 py-6"
            style={{ display: mode === "calculator" && sid === sectionId ? "block" : "none" }}
          >
            <div className="mx-auto w-full max-w-[560px] rounded-2xl bg-white p-4 text-slate-900">
              <SmartCalculatorBody onInsertWorking={() => { /* Board B is a workspace */ }} />
            </div>
          </div>
        ))}
        {visited.map((sid) => (
          <div
            key={`conv-${sid}`}
            className="absolute inset-0 overflow-y-auto px-4 py-6"
            style={{ display: mode === "conversion" && sid === sectionId ? "block" : "none" }}
          >
            <div className="mx-auto w-full max-w-[720px] rounded-2xl bg-white p-4 text-slate-900">
              <ConversionBody />
            </div>
          </div>
        ))}

        {/* COMPANION PAGE — the existing private blank Lesson Note page. */}
        <div
          className="absolute inset-0"
          style={{ display: mode === "companion" ? "block" : "none" }}
        >
          <CompanionNoteBoard
            notebookId={notebookId}
            editable={editable}
            onReturn={() => pick("objects")}
            palette={palette}
          />
        </div>
      </div>
    </div>
  );
};

export default InteractiveBoard;
