// A learning point's bar inside the Academia Adventure player: the teacher's own
// designed bar when there is one, otherwise a plain high-contrast default, so a
// bar is always visible. Filled by `current / max`.
import ProgressColumn from "@/components/gamebuilder/ProgressColumn";
import QuestionProgressContainer from "@/components/assets/QuestionProgressContainer";
import { getLiquidStyle } from "@/lib/games/liquidStyles";
import { getPreset } from "@/lib/games/progressPresets";
import type { CanvasElement } from "@/lib/games/types";

type Props = {
  element: CanvasElement | null;
  /** 0..max */
  current: number;
  max: number;
  /** Plain default bar: where the pass mark sits (1–100), if it has one. */
  passPct?: number;
  /** Plain default bar colour class. */
  tone?: "primary" | "accent";
  label: string;
};

/** The designed bar needs an explicit height: its column fills 100% of its box, and a box with no height is zero pixels. */
export default function AdventureBar({ element, current, max, passPct, tone = "primary", label }: Props) {
  const cfg = element?.progress;
  const safeMax = max > 0 ? max : 1;
  if (element && cfg) {
    const aspect = getPreset(cfg.presetId)?.aspect ?? 0.5;
    return (
      <div className="relative h-[min(100%,22rem)]" style={{ aspectRatio: String(aspect) }} data-testid="designed-bar" aria-label={label}>
        {cfg.barType === "liquid" ? (
          <QuestionProgressContainer
            width="fill"
            theme={getLiquidStyle(cfg.liquidStyleId).id}
            current={current}
            max={safeMax}
            fillColor={(cfg.fillStyle ?? "plain") === "plain" ? cfg.liquidColor : undefined}
            hideProgressText
          />
        ) : (
          <ProgressColumn
            config={{ ...cfg, currentMarks: current, totalMarks: safeMax }}
            fallbackPath={element.storagePath}
            fallbackMedia={element.mediaType}
            fallbackSource={element.source}
          />
        )}
      </div>
    );
  }
  const share = Math.min(1, Math.max(0, current / safeMax));
  return (
    <div className="relative h-full w-5 overflow-hidden rounded-full border-2 border-white/90 bg-black/45 shadow-lg ring-1 ring-black/40" data-testid="default-bar" aria-label={label}>
      <div className={`absolute inset-x-0 bottom-0 transition-all duration-500 ${tone === "accent" ? "bg-accent" : "bg-primary"}`} style={{ height: `${share * 100}%`, minHeight: share > 0 ? 4 : 0 }} />
      {passPct != null && <div className="absolute inset-x-0 h-0.5 bg-white" style={{ bottom: `${passPct}%` }} />}
    </div>
  );
}
