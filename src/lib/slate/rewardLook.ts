import type { CSSProperties } from "react";

/** The Game reward-square visibility / blend settings, shared by completion coins. */
export type RewardLook = {
  visible?: boolean;
  opacity?: number;
  glow?: number;
  scale?: number;
};

/** Style the completion-coin art the same way other Game reward squares are blended. */
export const rewardLookStyle = (look?: RewardLook | null): CSSProperties => {
  if (look && look.visible === false) {
    return { visibility: "hidden", opacity: 0, pointerEvents: "none" };
  }
  const opacity = look?.opacity ?? 1;
  const scale = look?.scale ?? 1;
  const glow = look?.glow ?? 0;
  const style: CSSProperties = { opacity };
  if (scale !== 1) style.transform = `scale(${scale})`;
  if (glow > 0) {
    style.filter = `drop-shadow(0 0 ${6 + glow * 10}px hsl(217 85% 55% / ${0.35 + glow * 0.45}))`;
  }
  return style;
};

export const rewardLookIsHidden = (look?: RewardLook | null): boolean =>
  !!(look && look.visible === false);
