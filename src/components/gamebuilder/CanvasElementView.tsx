import { useCallback, useRef } from "react";
import SignedMedia from "./SignedMedia";
import ChromaVideo from "./ChromaVideo";
import ProgressColumn from "./ProgressColumn";
import { getPreset } from "@/lib/games/progressPresets";
import type { BlendMode, CanvasElement, SlantSettings } from "@/lib/games/types";
import { cn } from "@/lib/utils";

const slantTransform = (s?: SlantSettings): string => {
  if (!s) return "";
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const flat: string[] = [];
  const rotated: string[] = [];

  const tilt = clamp(s.tilt?.amount ?? 0);
  if (tilt > 0) {
    const deg = tilt * 45 * (s.tilt.dir === "in" ? -1 : 1);
    rotated.push(`rotateX(${deg.toFixed(2)}deg)`);
  }

  const slide = clamp(s.slide?.amount ?? 0);
  if (slide > 0) {
    const deg = slide * 45 * (s.slide.dir === "left" ? 1 : -1);
    rotated.push(`rotateY(${deg.toFixed(2)}deg)`);
  }

  const lean = clamp(s.lean?.amount ?? 0);
  if (lean > 0) {
    const deg = lean * 35 * (s.lean.dir === "left" ? -1 : 1);
    flat.push(`skewX(${deg.toFixed(2)}deg)`);
  }

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
  return { animation: anims.join(", "), ...vars } as React.CSSProperties;
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
  editable,
  onSelect,
  onMove,
}: CanvasElementViewProps) => {
  const dragging = useRef(false);
  const isBackground = element.kind === "background";

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!editable || isBackground) return;
      e.stopPropagation();
      onSelect(element.id);
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [editable, isBackground, element.id, onSelect],
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

  if (isBackground) {
    return (
      <div className="absolute inset-0" style={{ zIndex: element.z }}>
        <SignedMedia
          path={element.storagePath}
          source={element.source}
          mediaType={element.mediaType}
          fit="cover"
          className="h-full w-full"
        />
      </div>
    );
  }

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
        selected && editable && "outline outline-2 outline-primary/80 rounded-md",
      )}
      style={wrapperStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
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
