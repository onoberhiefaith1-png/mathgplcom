import { Eraser, Minus, Plus, Redo2, RotateCcw, Triangle, Undo2 } from "lucide-react";
import { useFloatingNumberSize } from "@/hooks/useFloatingNumberSize";
import { FLOATING_SIZE_DEFAULT, GAME_CHIP_METRICS, floatingSizeLabel } from "@/lib/smartboard/floatingNumberSize";

/** The preview lives inside the settings sheet; past this it is clipped, so cap it. */
const PREVIEW_MAX_ZOOM = 2.5;

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
  const previewZoom = Math.min(size.scale, PREVIEW_MAX_ZOOM);
  const atMax = !size.canGrow && size.scale > FLOATING_SIZE_DEFAULT;
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
          <div className="text-[10px] opacity-60">{size.scale === FLOATING_SIZE_DEFAULT ? "Default (game) size" : atMax ? "Maximum — ⅓ of screen" : "Custom size"}</div>
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
        <div style={previewZoom === 1 ? undefined : { zoom: previewZoom }}>
          {preview === "phone" && (
            <div className="grid h-12 grid-cols-[repeat(3,1fr)_auto_auto] items-center px-1">
              {[Eraser, Undo2, Redo2].map((Icon, i) => (
                <span key={i} className="mx-auto grid h-12 w-full max-w-12 place-items-center"><Icon className="h-5 w-5" /></span>
              ))}
              <span className="grid h-12 w-11 place-items-center"><Triangle className="h-3.5 w-3.5 -rotate-90 fill-current" /></span>
              <span className="grid h-12 w-11 place-items-center"><Triangle className="h-3.5 w-3.5 rotate-90 fill-current" /></span>
            </div>
          )}
          <div className="flex min-h-11 items-center justify-center border-t px-1 py-1" style={{ borderColor: border, gap: GAME_CHIP_METRICS.gapPx }}>
            {SAMPLE.map((n) => (
              <span key={n} className="inline-flex items-center justify-center rounded-lg border font-semibold leading-none"
                style={{
                  borderColor: border,
                  width: GAME_CHIP_METRICS.minPx,
                  height: GAME_CHIP_METRICS.minPx,
                  minWidth: GAME_CHIP_METRICS.minPx,
                  minHeight: GAME_CHIP_METRICS.minPx,
                  boxSizing: "border-box",
                  overflow: "hidden",
                  padding: GAME_CHIP_METRICS.padding,
                  fontSize: GAME_CHIP_METRICS.fontPx,
                }}>{n}</span>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[10px] opacity-60">
        Default matches the game's floating numbers. Bigger or smaller steps, up to one third of the screen
        (a number can grow to ⅓ of the screen's shorter side). Controls, numbers and the space between them
        scale together. Saved on this device.
        {size.scale > PREVIEW_MAX_ZOOM && ` Preview shown at ${floatingSizeLabel(PREVIEW_MAX_ZOOM)}.`}
      </p>
    </div>
  );
};

export default FloatingNumberSizeControl;
