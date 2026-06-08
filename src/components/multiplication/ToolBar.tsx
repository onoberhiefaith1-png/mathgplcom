import { Button } from "@/components/ui/button";
import { Eraser, Undo2 } from "lucide-react";

interface Props {
  onErase: () => void;
  onUndo: () => void;
  canUndo: boolean;
  hint?: string;
}

export const ToolBar = ({ onErase, onUndo, canUndo, hint }: Props) => (
  <div className="flex flex-wrap items-center justify-center gap-2">
    {hint && (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200">
        {hint}
      </div>
    )}
    <Button variant="outline" onClick={onUndo} disabled={!canUndo} className="gap-1">
      <Undo2 className="h-4 w-4" /> Undo
    </Button>
    <Button variant="outline" onClick={onErase} className="gap-1">
      <Eraser className="h-4 w-4" /> Erase
    </Button>
  </div>
);
