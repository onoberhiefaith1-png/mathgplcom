import { memo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Delete, RotateCcw, CornerDownLeft } from "lucide-react";

const SYMBOLS = ["I", "V", "X", "L", "C", "D", "M"] as const;

interface Props {
  onAppend: (sym: string) => void;
  onUndo: () => void;
  onClear: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}

const RomanInputPadInner = ({ onAppend, onUndo, onClear, onSubmit, disabled }: Props) => {
  // Keyboard support — snappy input even when buttons re-render
  useEffect(() => {
    if (disabled) return;
    const h = (e: KeyboardEvent) => {
      // Ignore typing inside inputs/textareas
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toUpperCase();
      if ("IVXLCDM".includes(k) && e.key.length === 1) {
        e.preventDefault();
        onAppend(k);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onSubmit();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        onUndo();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClear();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [disabled, onAppend, onUndo, onClear, onSubmit]);

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="flex flex-wrap justify-center gap-2">
        {SYMBOLS.map((s) => (
          <Button
            key={s}
            type="button"
            variant="secondary"
            disabled={disabled}
            // pointerdown = instant; avoids 300ms-ish click delays and missed clicks during heavy raf re-renders
            onPointerDown={(e) => {
              e.preventDefault();
              onAppend(s);
            }}
            onClick={(e) => e.preventDefault()}
            className="h-12 w-12 text-lg font-black touch-manipulation active:scale-95 transition-transform"
          >
            {s}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onPointerDown={(e) => { e.preventDefault(); onUndo(); }}
          onClick={(e) => e.preventDefault()}
          className="touch-manipulation"
        >
          <RotateCcw className="h-4 w-4" /> Undo
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onPointerDown={(e) => { e.preventDefault(); onClear(); }}
          onClick={(e) => e.preventDefault()}
          className="touch-manipulation"
        >
          <Delete className="h-4 w-4" /> Clear
        </Button>
        <Button
          type="button"
          disabled={disabled}
          onPointerDown={(e) => { e.preventDefault(); onSubmit(); }}
          onClick={(e) => e.preventDefault()}
          className="touch-manipulation"
        >
          <CornerDownLeft className="h-4 w-4" /> Enter
        </Button>
      </div>
    </div>
  );
};

export const RomanInputPad = memo(RomanInputPadInner);
