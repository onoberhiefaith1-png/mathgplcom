// Floating toolbar for a Smart Table cell. Mirrors the document-level
// SelectionToolbar (Copy · Cut · Delete · Duplicate · Comment · AI Edit) so a
// teacher never has to learn a different workflow inside a table.

import { Copy, Scissors, Trash2, CopyPlus, MessageSquare, Sparkles } from "lucide-react";

interface Props {
  onCopy: () => void;
  onCut: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onComment: () => void;
  onAiEdit: () => void;
}

export function SmartTableCellToolbar({
  onCopy, onCut, onDelete, onDuplicate, onComment, onAiEdit,
}: Props) {
  return (
    <div
      contentEditable={false}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onClick={(e) => e.stopPropagation()}
      className="absolute left-1/2 -top-9 z-50 -translate-x-1/2 whitespace-nowrap
                 flex items-center gap-0.5 rounded-md border border-foreground/15
                 bg-popover text-popover-foreground shadow-md px-1 py-1"
    >
      <Btn label="Copy" onClick={onCopy}><Copy className="h-3.5 w-3.5" /></Btn>
      <Btn label="Cut" onClick={onCut}><Scissors className="h-3.5 w-3.5" /></Btn>
      <Btn label="Delete" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Btn>
      <Btn label="Duplicate" onClick={onDuplicate}><CopyPlus className="h-3.5 w-3.5" /></Btn>
      <Btn label="Comment" onClick={onComment}><MessageSquare className="h-3.5 w-3.5" /></Btn>
      <div className="w-px h-4 bg-foreground/15 mx-0.5" />
      <button
        type="button"
        onClick={onAiEdit}
        title="AI Edit"
        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary"
      >
        <Sparkles className="h-3.5 w-3.5" /> AI Edit
      </button>
    </div>
  );
}

function Btn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="p-1.5 rounded hover:bg-foreground/10 transition-colors"
    >
      {children}
    </button>
  );
}

export default SmartTableCellToolbar;
