import type { LayoutItem } from "@/lib/adventure/types";

interface Props {
  item: LayoutItem;
  onChange: (patch: Partial<LayoutItem>) => void;
  /** parent frame element so we can compute % from clicks */
  frameEl: HTMLElement | null;
  active: boolean;
  onClose: () => void;
}

/**
 * Toggle-able overlay that lets the teacher click points on the scene to
 * define a motion path. Right-click a point to remove it.
 */
export default function EffectPathEditor({ item, onChange, frameEl, active, onClose }: Props) {
  const motion = item.motion ?? { type: "static" as const, speed: 1, amplitude: 10 };
  const pts = motion.path ?? [];

  const setPath = (next: { x: number; y: number }[]) =>
    onChange({ motion: { ...motion, type: "path", path: next } });

  if (!active || !frameEl) return null;

  return (
    <div
      className="absolute inset-0 z-30 cursor-crosshair"
      onClick={(e) => {
        const rect = frameEl.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100 - (item.x + item.w / 2);
        const y = ((e.clientY - rect.top) / rect.height) * 100 - (item.y + item.h / 2);
        setPath([...pts, { x, y }]);
      }}
    >
      <svg className="absolute inset-0 h-full w-full pointer-events-none">
        {pts.length >= 2 && (
          <polyline
            points={pts.map((p) => `${item.x + item.w / 2 + p.x},${item.y + item.h / 2 + p.y}`).join(" ")}
            fill="none" stroke="hsl(var(--primary))" strokeWidth="0.3" vectorEffect="non-scaling-stroke"
            transform="scale(1)"
            style={{ transformOrigin: "0 0" }}
          />
        )}
      </svg>
      {pts.map((p, i) => (
        <div
          key={i}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => { e.preventDefault(); setPath(pts.filter((_, idx) => idx !== i)); }}
          className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary border-2 border-background pointer-events-auto"
          style={{ left: `${item.x + item.w / 2 + p.x}%`, top: `${item.y + item.h / 2 + p.y}%` }}
          title={`Point ${i + 1} — right-click to remove`}
        />
      ))}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-2 right-2 rounded bg-background px-2 py-1 text-[10px] pointer-events-auto"
      >Done ({pts.length} pts)</button>
    </div>
  );
}
