export type ImagineProjectileArt = "horizontal-collector" | "vertical-collector";

export interface ImagineProjectileGeometry {
  dx: number;
  dy: number;
  distance: number;
  angle: number;
  visualAngle: number;
  artType: ImagineProjectileArt;
}

/** A collector projectile always points and travels directly to its target. */
export function imagineProjectileGeometry(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): ImagineProjectileGeometry {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const artType = Math.abs(dx) >= Math.abs(dy) ? "horizontal-collector" : "vertical-collector";
  return {
    dx,
    dy,
    distance: Math.hypot(dx, dy),
    angle,
    visualAngle: artType === "horizontal-collector" ? angle : angle - 90,
    artType,
  };
}
