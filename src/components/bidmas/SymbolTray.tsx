import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eraser, Undo2, CornerDownLeft } from "lucide-react";

interface Props {
  onSym: (s: string) => void;
  onEnter: () => void;
  onUndo: () => void;
  onErase: () => void;
  canUndo: boolean;
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const OPS = ["+", "-", "×", "÷", "(", ")", "^", "."];

export const SymbolTray = ({ onSym, onEnter, onUndo, onErase, canUndo }: Props) => (
  <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-card/85 to-card/50 p-3 backdrop-blur">
    <div className="grid grid-cols-10 gap-1.5 mb-2">
      {DIGITS.map((d) => (
        <button key={d} onClick={() => onSym(d)} className={cn(
          "h-10 rounded-md border-2 border-primary/30 bg-card/70 text-lg font-black tabular-nums",
          "hover:border-amber-400/70 hover:shadow-[0_0_10px_hsl(45_95%_60%/0.5)] transition-all",
        )}>{d}</button>
      ))}
    </div>
    <div className="grid grid-cols-12 gap-1.5">
      {OPS.map((o) => (
        <button key={o} onClick={() => onSym(o)} className={cn(
          "h-10 rounded-md border-2 border-primary/30 bg-card/70 text-lg font-black",
          "hover:border-amber-400/70 hover:shadow-[0_0_10px_hsl(45_95%_60%/0.5)] transition-all",
          /[+\-×÷^]/.test(o) ? "text-rose-300" : "",
        )}>{o}</button>
      ))}
      <Button variant="outline" onClick={onUndo} disabled={!canUndo} className="h-10 col-span-1 px-1">
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button variant="outline" onClick={onErase} className="h-10 col-span-1 px-1">
        <Eraser className="h-4 w-4" />
      </Button>
      <Button onClick={onEnter} className="h-10 col-span-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black gap-1">
        <CornerDownLeft className="h-4 w-4" /> ENTER
      </Button>
    </div>
  </div>
);
