import { useMemo } from "react";
import SignedMedia from "./SignedMedia";
import { getPreset } from "@/lib/games/progressPresets";
import { progressFill } from "@/lib/games/types";
import type { ProgressConfig, MediaSource, MediaType, SlotEffect } from "@/lib/games/types";
import { cn } from "@/lib/utils";

interface ProgressColumnProps {
  config: ProgressConfig;
  fallbackPath: string;
  fallbackMedia: MediaType;
  fallbackSource?: MediaSource;
  className?: string;
}

interface Resolved {
  path?: string;
  media: MediaType;
  source?: MediaSource;
}

const hexToRgb = (hex: string): string => {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return "150,190,255";
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

const ProgressColumn = ({
  config,
  fallbackPath,
  fallbackMedia,
  fallbackSource,
  className,
}: ProgressColumnProps) => {
  const preset = getPreset(config.presetId);
  const geo = preset?.slotGeometry ?? { left: 37, right: 37, top: 15, bottom: 11, gap: 8 };
  const tint = preset?.glowTint ?? "150,190,255";

  const segments = Math.max(1, config.segments);
  const fill = progressFill(config);
  const lit = Math.min(segments, Math.floor(fill * segments + 1e-6));

  const cells = useMemo(() => Array.from({ length: segments }), [segments]);

  const fillStyle = config.fillStyle ?? "plain";
  const fillRgb = config.plainColor ? hexToRgb(config.plainColor) : tint;
  const effectScale = config.effectScale ?? 1;

  const resolveSlot = (i: number): Resolved => {
    const override: SlotEffect | undefined = config.slotEffects?.[i];
    if (override?.effectStoragePath) {
      return {
        path: override.effectStoragePath,
        media: override.effectMediaType ?? "image",
        source: override.effectSource,
      };
    }
    return {
      path: config.effectStoragePath,
      media: config.effectMediaType ?? "image",
      source: config.effectSource,
    };
  };

  const slotIsPlain = (i: number): boolean =>
    config.slotEffects?.[i]?.fill === "plain";

  const slotPlainRgb = (i: number): string => {
    const c = config.slotEffects?.[i]?.plainColor;
    return c ? hexToRgb(c) : fillRgb;
  };

  return (
    <div className={cn("relative h-full w-full", className)}>
      {preset ? (
        <img
          src={preset.image}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
        />
      ) : (
        <SignedMedia
          path={fallbackPath}
          source={fallbackSource}
          mediaType={fallbackMedia}
          fit="contain"
          className="absolute inset-0 h-full w-full"
        />
      )}

      <div
        className="absolute flex flex-col-reverse overflow-hidden"
        style={{
          left: `${geo.left}%`,
          right: `${geo.right}%`,
          top: `${geo.top}%`,
          bottom: `${geo.bottom}%`,
          gap: 0,
        }}
      >
        {cells.map((_, i) => {
          const isLit = i < lit;
          const perSlotPlain = fillStyle === "effect" && slotIsPlain(i);
          const slot = isLit && fillStyle === "effect" && !perSlotPlain ? resolveSlot(i) : null;
          const isPlain = fillStyle === "plain" || perSlotPlain || !slot?.path;
          const cellRgb = perSlotPlain ? slotPlainRgb(i) : fillRgb;
          return (
            <div key={i} className={cn("relative flex-1", isPlain ? "overflow-hidden" : "overflow-visible")}>
              {isLit && (
                <div
                  className="gb-slot-ignite absolute inset-0"
                  style={{
                    boxShadow: `inset 0 0 ${8 + config.glow * 22}px rgba(${cellRgb},${0.4 + config.glow * 0.5})`,
                  }}
                >
                  {isPlain ? (
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(90deg, rgba(${cellRgb},0.82), rgba(${cellRgb},0.98) 50%, rgba(${cellRgb},0.82)), radial-gradient(120% 60% at 50% 50%, rgba(255,255,255,0.18), transparent 70%)`,
                      }}
                    />
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        overflow: "visible",
                        transform: `scale(${effectScale})`,
                        transformOrigin: "center",
                        filter: `drop-shadow(0 0 ${6 + config.glow * 20}px rgba(${fillRgb},${0.5 + config.glow * 0.5}))`,
                      }}
                    >
                      <SignedMedia
                        path={slot!.path}
                        source={slot!.source}
                        mediaType={slot!.media}
                        fit="contain"
                        className="h-full w-full"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {lit > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{
              height: `${(lit / segments) * 100}%`,
              boxShadow: `0 0 ${12 + config.glow * 28}px rgba(${fillRgb},${0.3 + config.glow * 0.45})`,
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ProgressColumn;
