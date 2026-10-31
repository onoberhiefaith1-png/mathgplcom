import { Eraser, Minus, Plus, Redo2, RotateCcw, Triangle, Undo2 } from "lucide-react";
import { useFloatingNumberSize } from "@/hooks/useFloatingNumberSize";
import { FLOATING_SIZE_DEFAULT, floatingSizeLabel } from "@/lib/smartboard/floatingNumberSize";

const SAMPLE = ["3", "7", "12", "½", "x²"];

/**
 * Floating Number Size (spec §8–§10): − / + with a live preview. On a phone
 * the preview is the phone strip (first-row controls over the numbers) so the
 * learner sees controls, numbers and spacing scale together before leaving.
 * The saved size applies immediately to every board on this device.
 */
const FloatingNumberSizeControl = ({ preview = "board", chromeFg, chromeBorder }: {
  preview?: "phone" | "board";
  chromeFg?: string;
  chromeBorder?: string;
}) => {
  const size = useFloatingNumberSize();
  const border = chromeBorder ?? "color-mix(in oklab, currentColor 20%, transparent)";
  const stepBtn = "grid h-12 w-12 place-items-center rounded-xl border text-current disabled:opacity-30 md:h-9 md:w-9";
  return (
    <div className="space-y-2" style={chromeFg ? { color: chromeFg } : undefined} data-testid="floating-number-size">
      <div className="flex items-center gap-2">
        <button type="button" className={stepBtn} style={{ borderColor: border }} onClick={size.smaller}
          disabled={!size.canShrink} aria-label="Smaller floating numbers">
          <Minus className="h-5 w-5 md:h-4 md:w-4" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-base font-bold tabular-nums md:text-sm" aria-live="polite">{floatingSizeLabel(size.scale)}</div>
          <div className="text-[10px] opacity-60">{size.scale === FLOATING_SIZE_DEFAULT ? "Default size" : "Custom size"}</div>
        </div>
        <button type="button" className={stepBtn} style={{ borderColor: border }} onClick={size.bigger}
          disabled={!size.canGrow} aria-label="Bigger floating numbers">
          <Plus className="h-5 w-5 md:h-4 md:w-4" />
        </button>
        <button type="button" className={stepBtn} style={{ borderColor: border }} onClick={size.reset}
          disabled={size.scale === FLOATING_SIZE_DEFAULT} aria-label="Reset floating number size" title="Reset to default">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: border }} aria-label="Floating number size preview">
        <div style={size.scale === 1 ? undefined : { zoom: size.scale }}>
          {preview === "phone" && (
            <div className="grid h-12 grid-cols-[repeat(3,1fr)_auto_auto] items-center px-1">
              {[Eraser, Undo2, Redo2].map((Icon, i) => (
                <span key={i} className="mx-auto grid h-12 w-full max-w-12 place-items-center"><Icon className="h-5 w-5" /></span>
              ))}
              <span className="grid h-12 w-11 place-items-center"><Triangle className="h-3.5 w-3.5 -rotate-90 fill-current" /></span>
              <span className="grid h-12 w-11 place-items-center"><Triangle className="h-3.5 w-3.5 rotate-90 fill-current" /></span>
            </div>
          )}
          <div className="flex min-h-11 items-center justify-center gap-1 border-t px-1 py-1 text-lg" style={{ borderColor: border }}>
            {SAMPLE.map((n) => (
              <span key={n} className="rounded-md border px-2 py-0.5 font-semibold" style={{ borderColor: border }}>{n}</span>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[10px] opacity-60">
        Bigger or smaller steps up to what fits this screen. Controls, numbers and the space between them scale together.
      </p>
    </div>
  );
};

export default FloatingNumberSizeControl;
