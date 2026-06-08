import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export interface SavedItem {
  id: string;
  questionAscii: string;
  lines: string[];
  savedAt: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: SavedItem[];
  onPick: (item: SavedItem) => void;
}

export const HistorySheet = ({ open, onOpenChange, items, onPick }: Props) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-[360px] sm:w-[420px] overflow-y-auto">
      <SheetHeader>
        <SheetTitle>History</SheetTitle>
      </SheetHeader>
      <div className="mt-4 space-y-2">
        {items.length === 0 && (
          <div className="text-sm text-muted-foreground py-12 text-center">
            No saved sessions yet. Solve an equation and tap Save.
          </div>
        )}
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onPick(it)}
            className="w-full text-left p-3 rounded-xl border border-border hover:bg-muted/40 transition"
          >
            <div className="text-base font-medium">{it.questionAscii}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {it.lines.length} step{it.lines.length === 1 ? "" : "s"} · {new Date(it.savedAt).toLocaleString()}
            </div>
          </button>
        ))}
      </div>
    </SheetContent>
  </Sheet>
);

export default HistorySheet;
