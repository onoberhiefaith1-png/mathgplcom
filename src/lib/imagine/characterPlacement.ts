export type PlacementRect = { x: number; y: number; width: number; height: number };

export function clampCharacterScale(value: number) {
  return Math.min(2.5, Math.max(0.3, Number.isFinite(value) ? value : 1));
}

/** Saved coordinates are percentages of the scene, never device-specific pixels. */
export function characterPlacement(width: number, height: number, position: { x: number; y: number; scale: number }, obstacles: PlacementRect[] = []) {
  const gap = 8;
  const w = Math.max(32, width);
  const h = Math.max(32, height);
  let ch = Math.min(h - gap * 2, Math.min(w, h) * 0.45 * clampCharacterScale(position.scale));
  let cw = Math.min(w - gap * 2, ch * 0.75);
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const px = Number.isFinite(position.x) ? position.x : 76;
  const py = Number.isFinite(position.y) ? position.y : 56;
  const desired = () => ({ x: clamp(w * px / 100 - cw / 2, gap, w - cw - gap), y: clamp(h * py / 100 - ch / 2, gap, h - ch - gap), width: cw, height: ch });
  const clear = (r: PlacementRect) => obstacles.every(o => r.x + r.width + gap <= o.x || r.x >= o.x + o.width + gap || r.y + r.height + gap <= o.y || r.y >= o.y + o.height + gap);
  for (let attempt = 0; attempt < 32; attempt++) {
    const target = desired();
    const xs = [target.x, gap, w - cw - gap, ...obstacles.flatMap(o => [o.x - cw - gap, o.x + o.width + gap])];
    const ys = [target.y, gap, h - ch - gap, ...obstacles.flatMap(o => [o.y - ch - gap, o.y + o.height + gap])];
    const candidates = xs.flatMap(x => ys.map(y => ({ x: clamp(x, gap, w - cw - gap), y: clamp(y, gap, h - ch - gap), width: cw, height: ch }))).filter(clear);
    candidates.sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y));
    if (candidates[0]) return candidates[0];
    ch *= 0.9;
    cw *= 0.9;
  }
  return desired();
}