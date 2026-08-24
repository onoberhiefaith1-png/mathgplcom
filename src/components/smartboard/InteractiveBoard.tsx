// BOARD B — the teacher's live working board.
//
// Board A is the prepared lesson ("what I planned to teach"). Board B is the
// working board ("what I am doing with the students right now").
//
// It is NOT a second lesson note and NOT a copy of the lesson. Only two kinds
// of content are carried across automatically from the current lesson section:
// DIAGRAMS (2D / 3D / geometry / mathematical) and GRAPHS. Tables, Calculator
// and Conversion stay where they already work, on Board A.
//
// Structure, top to bottom:
//   PART 1 — the extracted diagram/graph of the current lesson position.
//   PART 2 — a blank Teacher Working Area for real-time drawing and working.
// Teacher work in Part 2 never modifies the lesson note.

import { ArrowLeft } from "lucide-react";
import { SolutionObjectView } from "@/components/lessonnotes/SolutionObjectView";
import { CompanionNoteBoard } from "./CompanionNoteBoard";
import type { SolutionObject } from "@/lib/floating/solutionItems";

export interface InteractiveBoardProps {
  /** The single active lesson position, shared with Board A. */
  sectionId: string;
  sectionLabel: string;
  /** Diagram / graph objects belonging to THIS section only. */
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
        <span className="truncate text-[11px] font-medium">Working board</span>
        <span className="ml-auto truncate text-[11px] opacity-70">{sectionLabel || "Lesson"}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {/* PART 1 — extracted diagram / graph for the current section. Nothing
            is invented when the section has none. */}
        {objects.length > 0 && (
          <div className="px-4 py-6 md:px-10">
            <div className="mx-auto w-full max-w-[1100px]">
              <div className="mb-4 text-[13px] uppercase tracking-[0.2em] text-white/60">
                {sectionLabel}
              </div>
              <div className="space-y-8">
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
            </div>
          </div>
        )}

        {/* PART 2 — the teacher's live working area. Mounted once for the whole
            session so working is never lost when moving between sections or
            boards, and always separate from the lesson note itself. */}
        <div className="px-4 pb-8 md:px-10">
          <div className="mx-auto w-full max-w-[1100px]">
            <div className="mb-3 text-[11px] uppercase tracking-[0.2em] text-white/50">
              Teacher working area
            </div>
            <div
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: palette.chromeBorder, height: "min(1200px, 150vh)" }}
            >
              <CompanionNoteBoard
                notebookId={notebookId}
                editable={editable}
                onReturn={onReturn}
                palette={palette}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveBoard;
