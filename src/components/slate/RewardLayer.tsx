import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { getReward } from "@/lib/slate/rewards";
import type { EffectSettings, RewardInstance, RewardSettings } from "@/lib/slate/types";

interface Props {
  rewards: RewardInstance[];
  settings: RewardSettings;
  effects: EffectSettings;
  editable: boolean;
  selectedId: string | null;
  onSelect: (rewardId: string) => void;
  onMove: (rewardId: string, x: number, y: number) => void;
  onActivate: (rewardId: string, type: string) => void;
}

/**
 * Dormant rewards attached to the physical surface.
 * Activation here is the lightweight test pulse; the full VFX engine
 * (spin-up, charge, particles, directional sweeps) lands in phase two.
 */
export function RewardLayer({
  rewards,
  settings,
  effects,
  editable,
  selectedId,
  onSelect,
  onMove,
  onActivate,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    if (!dragging) return;
    const host = hostRef.current;
    if (!host) return;
    const move = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      const x = Math.min(96, Math.max(2, ((e.clientX - r.left) / r.width) * 100));
      const y = Math.min(92, Math.max(4, ((e.clientY - r.top) / r.height) * 100));
      onMove(dragging, x, y);
    };
    const up = () => setDragging(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, onMove]);

  if (!settings.visible) return null;

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0 z-[8]">
      {rewards.map((r) => {
        if (r.hidden && !editable) return null;
        const def = getReward(r.type);
        const active = r.state === "active";
        const size = 52 * settings.scale * (r.scale ?? 1);
        return (
          <button
            key={r.id}
            type="button"
            onPointerDown={(e) => {
              if (!editable) return;
              e.preventDefault();
              onSelect(r.id);
              setDragging(r.id);
            }}
            onClick={() => {
              if (editable) onSelect(r.id);
               else if (effects.testMode) onActivate(r.id, r.type);
            }}
            data-reward-id={r.id}
            data-reward-type={r.type}
            data-reward-hidden={r.hidden || r.state === "archived" ? "true" : "false"}
            className={`living-reward reward-${def.profile} reward-material-${r.material ?? "metal"} reward-colour-${r.colour ?? "natural"} reward-relief-${r.relief ?? "raised"}${active ? " is-active" : ""} pointer-events-auto absolute`}
            style={{
              left: `${r.x}%`,
              top: `${r.y}%`,
              width: size,
              height: size,
              "--reward-z": `${r.z ?? 0}px`,
              "--reward-rotation": `${r.rotation ?? 0}deg`,
              "--reward-effect": r.effectIntensity ?? 1,
              cursor: editable ? "grab" : "pointer",
              opacity: r.hidden ? 0.18 : active ? 1 : settings.opacity,
              filter: active
                ? `saturate(1.35) brightness(${1.1 + .3 * (r.lighting ?? 1)}) drop-shadow(0 0 ${18 * effects.glow * (r.effectIntensity ?? 1)}px ${def.glow})`
                : `saturate(${0.35 + settings.opacity * 0.3}) brightness(${.75 + .25 * (r.lighting ?? 1)}) contrast(0.92) drop-shadow(0 2px 4px rgba(0,0,0,0.55)) drop-shadow(0 0 ${10 * settings.glow}px ${def.glow}${Math.round(settings.glow * 60).toString(16).padStart(2, "0")})`,
              outline:
                selectedId === r.id
                  ? "2px dashed rgba(255,255,255,0.8)"
                  : "none",
              outlineOffset: 4,
              animationDuration: `${1.1 / effects.speed / Math.max(.2, r.animation ?? 1)}s`,
              background: "transparent",
              border: "none",
              padding: 0,
            } as CSSProperties}
            title={def.label}
          >
            <img
              src={def.art}
              alt={def.label}
              loading="lazy"
              className="h-full w-full select-none object-contain"
              style={{ animationDuration: `${4.6 / Math.max(.2, r.animation ?? 1)}s` }}
              draggable={false}
            />
          </button>
        );
      })}
    </div>
  );
}
