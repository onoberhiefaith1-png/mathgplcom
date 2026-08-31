// Pure background analysis. No DOM: it takes raw RGBA frames and works out
// whether the media sits on a flat backdrop, and which colour that backdrop is.
//
// The old approach sampled eight lone pixels of the first frame and averaged
// them, so a subject touching an edge, a vignette, or a soft studio-white
// falloff made detection give up. This version reads a wide border ring across
// several frames and decides by how much of that ring one colour covers.

export interface KeyColor {
  r: number;
  g: number;
  b: number;
}

export interface BgDetection {
  color: KeyColor;
  keyable: boolean;
  /** Fraction (0..1) of the border ring that matches the detected colour. */
  coverage: number;
  /** Mean colour distance inside the matching cluster — shading tolerance. */
  spread: number;
  /** Short human-readable explanation of the verdict. */
  reason: string;
}

export interface RawFrame {
  /** RGBA bytes, row-major, length = w * h * 4. */
  data: Uint8ClampedArray | number[];
  w: number;
  h: number;
}

/** Border thickness as a fraction of each side. */
const RING = 0.08;
/** Quantisation bucket size when finding the dominant border colour. */
const BUCKET = 24;
/** A ring pixel counts as background when it is this close to the cluster mean. */
const MATCH_TOLERANCE = 60;

const dist = (a: KeyColor, b: KeyColor) => {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

/** True for white, grey and black keys, which carry no useful hue. */
export const isLowSaturation = (c: KeyColor) =>
  Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 32;

const ringPixels = (frames: RawFrame[]): KeyColor[] => {
  const out: KeyColor[] = [];
  for (const frame of frames) {
    const { data, w, h } = frame;
    if (!w || !h) continue;
    const bw = Math.max(1, Math.round(w * RING));
    const bh = Math.max(1, Math.round(h * RING));
    // Step so that huge frames stay cheap without losing the ring's shape.
    const step = Math.max(1, Math.round(Math.min(w, h) / 160));
    for (let y = 0; y < h; y += step) {
      const edgeRow = y < bh || y >= h - bh;
      for (let x = 0; x < w; x += step) {
        if (!edgeRow && x >= bw && x < w - bw) continue;
        const i = (y * w + x) * 4;
        if ((data[i + 3] ?? 255) < 8) continue; // already transparent
        out.push({ r: data[i] ?? 0, g: data[i + 1] ?? 0, b: data[i + 2] ?? 0 });
      }
    }
  }
  return out;
};

/**
 * Works out the backdrop colour of one or more frames and whether it is flat
 * enough to cut safely.
 */
export const analyseFrames = (frames: RawFrame[]): BgDetection => {
  const ring = ringPixels(frames);
  if (ring.length === 0) {
    return {
      color: { r: 255, g: 255, b: 255 },
      keyable: false,
      coverage: 0,
      spread: 0,
      reason: "The frame could not be read.",
    };
  }

  // Dominant quantised colour of the ring.
  const counts = new Map<number, number>();
  for (const p of ring) {
    const key =
      ((p.r / BUCKET) | 0) * 10000 + ((p.g / BUCKET) | 0) * 100 + ((p.b / BUCKET) | 0);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let bestKey = 0;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }
  const seed: KeyColor = {
    r: (((bestKey / 10000) | 0) + 0.5) * BUCKET,
    g: ((((bestKey / 100) | 0) % 100) + 0.5) * BUCKET,
    b: ((bestKey % 100) + 0.5) * BUCKET,
  };

  // Refine the colour from the members of that cluster, then measure how much
  // of the ring it actually covers.
  const members = ring.filter((p) => dist(p, seed) < MATCH_TOLERANCE);
  const sum = members.reduce(
    (a, p) => ({ r: a.r + p.r, g: a.g + p.g, b: a.b + p.b }),
    { r: 0, g: 0, b: 0 },
  );
  const color: KeyColor = {
    r: Math.round(sum.r / members.length),
    g: Math.round(sum.g / members.length),
    b: Math.round(sum.b / members.length),
  };
  const matched = ring.filter((p) => dist(p, color) < MATCH_TOLERANCE);
  const coverage = matched.length / ring.length;
  const spread = matched.reduce((a, p) => a + dist(p, color), 0) / matched.length;

  // Studio white and other neutral backdrops fall off in brightness towards the
  // corners, so they are allowed more variation than a coloured screen.
  const spreadLimit = isLowSaturation(color) ? 42 : 30;

  if (coverage < 0.6) {
    return {
      color,
      keyable: false,
      coverage,
      spread,
      reason: "The edges of the frame contain several different colours.",
    };
  }
  if (spread > spreadLimit) {
    return {
      color,
      keyable: false,
      coverage,
      spread,
      reason: "The background shades or patterns too much to cut cleanly.",
    };
  }
  return {
    color,
    keyable: true,
    coverage,
    spread,
    reason:
      coverage >= 0.85
        ? "Flat background found across the whole edge of the frame."
        : "Flat background found, with the subject reaching the edge.",
  };
};
