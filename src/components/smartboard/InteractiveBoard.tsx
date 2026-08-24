// BOARD B — the teacher's interactive tools board.
//
// Board A (the main teaching board) owns ALL lesson-note content: text,
// headings, questions, solutions, equations AND diagrams, tables and graphs.
// Board B is the secondary surface holding the teacher's tools for the same
// lesson position: Calculator, Conversion and the blank companion Lesson Note
// page. It never mirrors or duplicates lesson objects.

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Calculator, NotebookPen, Repeat } from "lucide-react";
import { SmartCalculatorBody } from "@/components/lessonnotes/math-tools/SmartCalculator";
import { ConversionBody } from "@/components/lessonnotes/ConversionPanel";
import { CompanionNoteBoard } from "./CompanionNoteBoard";

type Mode = "calculator" | "conversion" | "companion";

export interface InteractiveBoardProps {
  /** The single active lesson position, shared with Board A. */
  sectionId: string;
  sectionLabel: string;
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
  notebookId,
  editable,
  onReturn,
  palette,
}: InteractiveBoardProps) => {
  // Tool choice is remembered PER SECTION, so moving away and coming back
  // restores the surface the teacher was using for that part of the lesson.
  const modeBySection = useRef<Record<string, Mode>>({});
  const [mode, setMode] = useState<Mode>(() => modeBySection.current[sectionId] ?? "calculator");

  useEffect(() => {
    setMode(modeBySection.current[sectionId] ?? "calculator");
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

  const tabs: { id: Mode; label: string; icon: typeof Calculator }[] = useMemo(
    () => [
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
            onReturn={() => pick("calculator")}
            palette={palette}
          />
        </div>
      </div>
    </div>
  );
};

export default InteractiveBoard;
