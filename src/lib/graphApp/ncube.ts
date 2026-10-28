// n-dimensional hypercube, rotated in the plane of axes (0, n-1) and
// perspective-projected down to 3D one dimension at a time.
export function ncube(n: number) {
  const verts: number[][] = [];
  for (let i = 0; i < 1 << n; i++) verts.push(Array.from({ length: n }, (_, k) => ((i >> k) & 1 ? 1 : -1)));
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < verts.length; i++)
    for (let k = 0; k < n; k++) {
      const j = i ^ (1 << k);
      if (j > i) edges.push([i, j]);
    }
  return { verts, edges };
}

export function projectTo3D(v: number[], angle: number, distance = 3): [number, number, number] {
  let p = v.slice();
  const n = p.length;
  if (n > 3) {
    const a = p[0], b = p[n - 1];
    p[0] = a * Math.cos(angle) - b * Math.sin(angle);
    p[n - 1] = a * Math.sin(angle) + b * Math.cos(angle);
  }
  while (p.length > 3) {
    const w = p[p.length - 1];
    const k = distance / (distance - w);
    p = p.slice(0, -1).map((c) => c * k);
  }
  return [p[0], p[1], p[2]];
}
