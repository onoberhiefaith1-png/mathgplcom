import { useCallback, useRef } from "react";
import SignedMedia from "./SignedMedia";
import ChromaVideo from "./ChromaVideo";
import ProgressColumn from "./ProgressColumn";
import TimerVideoView from "./TimerVideoView";
import { getPreset } from "@/lib/games/progressPresets";
import { getLiquidStyle } from "@/lib/games/liquidStyles";
import QuestionProgressContainer from "@/components/assets/QuestionProgressContainer";
import type { BlendMode, CanvasElement, SlantSettings } from "@/lib/games/types";
import { cn } from "@/lib/utils";

/**
 * Build the combined lean transform. The base stays anchored
 * (transform-origin bottom) while the body leans. Three independent axes stack:
 *  - lean  → skewX (top slides sideways)
 *  - slide → perspective rotateY (3D swing left/right — the old In/Out)
 *  - tilt  → perspective rotateX (base fixed, top tips in/out)
 */
const slantTransform = (s?: SlantSettings): string => {
  if (!s) return "";
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const flat: string[] = [];
  const rotated: string[] = [];

  // In/Out — base-fixed 3D tip. Anchored at bottom center, rotateX(+deg) tips
  // the top AWAY from the camera and rotateX(-deg) tips it TOWARD the camera.
  const tilt = clamp(s.tilt?.amount ?? 0);
  if (tilt > 0) {
    const deg = tilt * 45 * (s.tilt.dir === "in" ? -1 : 1);
    rotated.push(`rotateX(${deg.toFixed(2)}deg)`);
  }

  // Slide — 3D swing left/right (the old In/Out).
  const slide = clamp(s.slide?.amount ?? 0);
  if (slide > 0) {
    const deg = slide * 45 * (s.slide.dir === "left" ? 1 : -1);
    rotated.push(`rotateY(${deg.toFixed(2)}deg)`);
  }

  // Lean — flat sideways skew, no perspective needed.
  const lean = clamp(s.lean?.amount ?? 0);
  if (lean > 0) {
    const deg = lean * 35 * (s.lean.dir === "left" ? -1 : 1);
    flat.push(`skewX(${deg.toFixed(2)}deg)`);
  }

  // A single shared perspective governs all 3D rotation so the top edge moves
  // in Z (near/far) while the footprint size holds steady — no uniform zoom.
  const parts = [
    ...(rotated.length ? [`perspective(900px)`, ...rotated] : []),
    ...flat,
  ];

  return parts.join(" ");
};

interface CanvasElementViewProps {
  element: CanvasElement;
  stageEl: HTMLElement | null;
  stageWidth: number;
  selected: boolean;
  pinned?: boolean;
  editable: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}


const animationCss = (el: CanvasElement, stageWidth: number): React.CSSProperties => {
  const { animation } = el;
  const anims: string[] = [];
  const vars: Record<string, string> = {};
  if (animation && animation.type !== "none") {
    const ampPx = Math.max(0, animation.amplitude) * stageWidth;
    const iter = animation.loop || animation.trigger === "loop" ? "infinite" : "1";
    const delay = animation.delay ?? 0;
    const alt = animation.type === "travel" ? " alternate" : "";
    anims.push(`gb-${animation.type} ${animation.speed}s ease-in-out ${delay}s ${iter}${alt}`);
    vars["--gb-amp"] = `${ampPx}px`;
    vars["--gb-pulse"] = `${animation.amplitude * 1.5}`;
  }
  if (animation?.fadeIn) {
    anims.push(`gb-fadein ${animation.fadeIn}s ease-out ${animation.delay ?? 0}s 1 both`);
  }
  if (anims.length === 0) return {};
  return { animation: anims.join(", "), ...vars };
};

const blendModeOf = (el: CanvasElement): React.CSSProperties => {
  if (el.bgRemoval === "screen-black") return { mixBlendMode: "screen" };
  const map: Record<BlendMode, React.CSSProperties["mixBlendMode"]> = {
    normal: "normal",
    screen: "screen",
    add: "plus-lighter",
    multiply: "multiply",
    lighten: "lighten",
  };
  const mode = el.blend && el.blend !== "normal" ? map[el.blend] : undefined;
  return mode ? { mixBlendMode: mode } : {};
};

const CanvasElementView = ({
  element,
  stageEl,
  stageWidth,
  selected,
  pinned = false,
  editable,
  onSelect,
  onMove,
}: CanvasElementViewProps) => {

  const dragging = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!editable) return;
      e.stopPropagation();
      onSelect(element.id);
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [editable, element.id, onSelect],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current || !stageEl) return;
      const rect = stageEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      onMove(element.id, Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
    },
    [stageEl, element.id, onMove],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }, []);


  const wrapperStyle: React.CSSProperties = {
    left: `${element.x * 100}%`,
    top: `${element.y * 100}%`,
    width: `${element.scale * 100}%`,
    transform: "translate(-50%, -50%)",
    zIndex: element.z,
    opacity: element.opacity,
    cursor: editable ? "move" : "default",
    touchAction: "none",
  };

  const innerTransform = `rotate(${element.rotation}deg) ${slantTransform(element.slant)}`.trim();

  return (
    <div
      className={cn(
        "absolute select-none",
        selected && editable && !pinned && "outline outline-2 outline-primary/80 rounded-md",
        pinned && editable && "outline-dashed outline-2 outline-primary rounded-md ring-4 ring-primary/30",
      )}
      style={wrapperStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {pinned && editable && (
        <div className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
          Pinned to scroll · click again to release
        </div>
      )}

      <div
        className="relative"
        style={{
          transform: innerTransform,
          transformOrigin: "bottom center",
          ...blendModeOf(element),
          ...animationCss(element, stageWidth),
        }}
      >
        {element.kind === "progress_bar" && element.progress ? (
          element.progress.timerDisplay === "video" && element.progress.timerVideo?.storagePath ? (
            // Video Timer: the loop region is the clock, so the video replaces
            // the tower/vessel entirely. Scoring stays on the Progress Bar.
            <TimerVideoView
              config={element.progress.timerVideo}
              remainingSeconds={
                (element.progress.timeDurationSeconds ?? 0) > 0
                  ? Math.max(
                      0,
                      (element.progress.timeDurationSeconds ?? 0) *
                        (1 -
                          (element.progress.currentMarks ?? 0) /
                            Math.max(1, element.progress.totalMarks || 1)),
                    )
                  : null
              }
              className="w-full"
            />
          ) : element.progress.barType === "liquid" ? (
            <QuestionProgressContainer
              width="fill"
              theme={getLiquidStyle(element.progress.liquidStyleId).id}
              current={element.progress.currentMarks ?? 0}
              max={element.progress.totalMarks > 0 ? element.progress.totalMarks : 1}
              fillColor={
                (element.progress.fillStyle ?? "plain") === "plain"
                  ? element.progress.liquidColor
                  : undefined
              }
              frameMedia={
                element.progress.liquidStyleId || !element.storagePath
                  ? null
                  : { path: element.storagePath, mediaType: element.mediaType, source: element.source }
              }
              energy={
                element.progress.fillStyle === "effect" && element.progress.effectStoragePath
                  ? {
                      path: element.progress.effectStoragePath,
                      mediaType: element.progress.effectMediaType ?? "image",
                      source: element.progress.effectSource,
                      scale: element.progress.effectScale ?? 1,
                      density: element.progress.energyDensity ?? 0.5,
                    }
                  : null
              }
            />
          ) : (
            <div
              className="w-full"
              style={{
                aspectRatio: String(getPreset(element.progress.presetId)?.aspect ?? 0.5),
              }}
            >
              <ProgressColumn
                config={element.progress}
                fallbackPath={element.storagePath}
                fallbackMedia={element.mediaType}
                fallbackSource={element.source}
              />
            </div>
          )
        ) : element.mediaType === "video" && element.bgRemoval === "chroma" ? (
          <ChromaVideo
            path={element.storagePath}
            source={element.source}
            keyColor={element.keyColor}
            tolerance={element.keyTolerance}
            fit="contain"
            className="h-auto w-full"
          />
        ) : (
          <SignedMedia
            path={element.storagePath}
            source={element.source}
            mediaType={element.mediaType}
            fit="contain"
            className="h-auto w-full"
          />
        )}
      </div>
    </div>
  );
};

export default CanvasElementView;
