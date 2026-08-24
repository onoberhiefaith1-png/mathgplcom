// BOARD B — the teacher's working copy of the lesson note.
//
// Board A (the main teaching board) owns the master lesson presentation and is
// unchanged. Board B is simply an independent duplicate of the same lesson note
// that the teacher can edit freely as rough work: no companion pages, no
// calculator/conversion tabs, no extraction logic, no Session system.

import { CompanionNoteBoard } from "./CompanionNoteBoard";

export interface InteractiveBoardProps {
  /** The active lesson position, shared with Board A (context only). */
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
  notebookId,
  editable,
  onReturn,
  palette,
}: InteractiveBoardProps) => (
  <CompanionNoteBoard
    notebookId={notebookId}
    editable={editable}
    onReturn={onReturn}
    palette={palette}
  />
);

export default InteractiveBoard;
