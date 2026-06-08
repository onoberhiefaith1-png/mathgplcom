import { Button } from "@/components/ui/button";
import { useEffect } from "react";

interface Props {
  onAddOne: () => void;
  onAddFive: () => void;
  onUndo: () => void;
  onClear: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}

const TallyOne = () => (
  <span className="inline-block h-6 w-1 rounded-full bg-current" />
);

const TallyFive = () => (
  <span className="relative inline-block h-6 w-7">
    {[0, 1, 2, 3].map((i) => (
      <span
        key={i}
        className="absolute top-0 h-6 w-1 rounded-full bg-current"
        style={{ left: `${i * 6}px` }}
      />
    ))}
    <span className="absolute left-[-3px] top-1/2 h-1 w-8 -translate-y-1/2 rotate-[-22deg] rounded-full bg-current" />
  </span>
);

export const InputPad = ({ onAddOne, onAddFive, onUndo, onClear, onSubmit, disabled }: Props) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key === "1") onAddOne();
      else if (e.key === "5") onAddFive();
      else if (e.key === "Enter") onSubmit();
      else if (e.key === "Backspace") onUndo();
      else if (e.key === "Escape") onClear();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onAddOne, onAddFive, onUndo, onClear, onSubmit, disabled]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button size="lg" variant="secondary" onClick={onAddFive} disabled={disabled} aria-label="Add five" className="h-14 px-4">
        <TallyFive />
      </Button>
      <Button size="lg" variant="secondary" onClick={onAddOne} disabled={disabled} aria-label="Add one" className="h-14 px-5">
        <TallyOne />
      </Button>
      <Button size="lg" variant="outline" onClick={onUndo} disabled={disabled}>
        Undo
      </Button>
      <Button size="lg" variant="outline" onClick={onClear} disabled={disabled}>
        Clear
      </Button>
      <Button size="lg" onClick={onSubmit} disabled={disabled} className="px-8 text-lg font-bold">
        Enter
      </Button>
    </div>
  );
};
