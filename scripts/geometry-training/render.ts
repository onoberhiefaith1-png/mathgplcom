// Headless GeometryScene → SVG, for the geometry drawing training harness ONLY.
// The app's own renderer is untouched; this exists so every trained figure can
// be looked at as a picture instead of trusted as a passing check.

import type { GeometryScene, GeoPoint } from "../../src/lib/geometry/scene";

const INK = "#0f172a";
const ACCENT = "#0369a1";

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function sceneToSvg(scene: GeometryScene): string {
  const pts = new Map<string, GeoPoint>();
  for (const o of scene.objects) if (o.type === "point") pts.set(o.id, o);
  const P = (id: string) => pts.get(id);

  const out: string[] = [];
  const w = scene.bounds.width, h = scene.bounds.height;
  // A measurement or angle value that lands outside the frame is cut off, so
  // pull it back inside allowing for the text's own width.
  const inX = (x: number, text: string) => {
    const half = 3.4 * String(text).length + 4;
    return Math.min(Math.max(x, half), w - half);
  };
  const inY = (y: number) => Math.min(Math.max(y, 12), h - 4);


  // regions first (under the lines)
  for (const o of scene.objects) {
    if (o.type === "region") {
      const d = (o.boundary as string[]).map(P).filter(Boolean) as GeoPoint[];
      if (d.length < 3) continue;
      out.push(`<polygon points="${d.map((p) => `${p.x},${p.y}`).join(" ")}" fill="${o.fill ?? "#38bdf8"}" fill-opacity="${o.opacity ?? 0.22}"/>`);
    }
    if (o.type === "polygon") {
      const d = (o.points as string[]).map(P).filter(Boolean) as GeoPoint[];
      if (d.length < 3) continue;
      out.push(`<polygon points="${d.map((p) => `${p.x},${p.y}`).join(" ")}" fill="${o.fill ?? "none"}" stroke="${INK}" stroke-width="1.4"/>`);
    }
  }

  for (const o of scene.objects) {
    if (o.type === "circle") {
      const c = P(o.center);
      if (!c) continue;
      out.push(`<circle cx="${c.x}" cy="${c.y}" r="${o.r}" fill="none" stroke="${INK}" stroke-width="1.4"${o.dashed ? ' stroke-dasharray="5 4"' : ""}/>`);
    }
    if (o.type === "arc") {
      const c = P(o.center);
      if (!c) continue;
      const a0 = (o.from * Math.PI) / 180, a1 = (o.to * Math.PI) / 180;
      const x0 = c.x + o.r * Math.cos(a0), y0 = c.y - o.r * Math.sin(a0);
      const x1 = c.x + o.r * Math.cos(a1), y1 = c.y - o.r * Math.sin(a1);
      let sweep = ((o.to - o.from) % 360 + 360) % 360;
      const large = sweep > 180 ? 1 : 0;
      out.push(`<path d="M${x0} ${y0} A${o.r} ${o.r} 0 ${large} 0 ${x1} ${y1}" fill="none" stroke="${INK}" stroke-width="1.4"${o.dashed ? ' stroke-dasharray="5 4"' : ""}/>`);
    }
    if (o.type === "segment" || o.type === "line" || o.type === "ray") {
      const a = P(o.a), b = P(o.b);
      if (!a || !b) continue;
      out.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${INK}" stroke-width="1.5"${(o as any).dashed ? ' stroke-dasharray="5 4"' : ""}/>`);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const marks = (o as any).marks;
      if (marks === "tick" || marks === "double" || marks === "triple") {
        const n = marks === "tick" ? 1 : marks === "double" ? 2 : 3;
        const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
        const ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
        for (let k = 0; k < n; k++) {
          const t = (k - (n - 1) / 2) * 5;
          const cx = mid.x + ux * t, cy = mid.y + uy * t;
          out.push(`<line x1="${cx - nx * 5}" y1="${cy - ny * 5}" x2="${cx + nx * 5}" y2="${cy + ny * 5}" stroke="${INK}" stroke-width="1.3"/>`);
        }
      }
      const text = (o as any).distance ?? (o as any).label ?? (o as any).length;
      if (text) {
        const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l, ny = dx / l;
        out.push(`<text x="${inX(mid.x + nx * 13, String(text))}" y="${inY(mid.y + ny * 13 + 4)}" font-size="12" fill="${ACCENT}" text-anchor="middle" font-family="system-ui">${esc(text)}</text>`);
      }
    }
    if (o.type === "angle") {
      const v = P(o.vertex), a = P(o.a), b = P(o.b);
      if (!v || !a || !b) continue;
      const ang = (p: GeoPoint) => Math.atan2(-(p.y - v.y), p.x - v.x);
      const a0 = ang(a), a1 = ang(b);
      const r = 22;
      let diff = ((a1 - a0) * 180) / Math.PI;
      diff = ((diff % 360) + 360) % 360;
      // The mark always shows the angle BETWEEN the two arms — the minor arc.
      // Sweeping the long way round drew an almost complete circle at the
      // vertex, which reads as a circle in the figure instead of an angle.
      const [s0, s1] = diff > 180 ? [a1, a0] : [a0, a1];
      const x0 = v.x + r * Math.cos(s0), y0 = v.y - r * Math.sin(s0);
      const x1 = v.x + r * Math.cos(s1), y1 = v.y - r * Math.sin(s1);
      if (o.marker === "right") {
        const u = (p: GeoPoint) => {
          const d = { x: p.x - v.x, y: p.y - v.y };
          const l = Math.hypot(d.x, d.y) || 1;
          return { x: d.x / l, y: d.y / l };
        };
        const ua = u(a), ub = u(b), s = 13;
        out.push(`<path d="M${v.x + ua.x * s} ${v.y + ua.y * s} L${v.x + (ua.x + ub.x) * s} ${v.y + (ua.y + ub.y) * s} L${v.x + ub.x * s} ${v.y + ub.y * s}" fill="none" stroke="${INK}" stroke-width="1.3"/>`);
      } else {
        out.push(`<path d="M${x0} ${y0} A${r} ${r} 0 0 0 ${x1} ${y1}" fill="none" stroke="${ACCENT}" stroke-width="1.3"/>`);
      }
      if (o.value) {
        const mid = (s0 + s1) / 2;
        out.push(`<text x="${inX(v.x + (r + 14) * Math.cos(mid), String(o.value))}" y="${inY(v.y - (r + 14) * Math.sin(mid) + 4)}" font-size="12" fill="${ACCENT}" text-anchor="middle" font-family="system-ui">${esc(o.value)}</text>`);
      }

    }
    if (o.type === "label") {
      out.push(`<text x="${inX(o.x, String(o.text))}" y="${inY(o.y)}" font-size="${(o as any).fontSize ?? 13}" fill="${INK}" text-anchor="middle" font-family="system-ui">${esc(o.text)}</text>`);
    }
  }

  for (const p of pts.values()) {
    if (p.hidden) continue;
    out.push(`<circle cx="${p.x}" cy="${p.y}" r="${p.size ?? 2.6}" fill="${INK}"/>`);
    if (p.label) {
      const off = p.labelOffset ?? { dx: 0, dy: -14 };
      out.push(`<text x="${p.x + off.dx}" y="${p.y + off.dy + 4}" font-size="${p.labelFontSize ?? 14}" fill="${INK}" text-anchor="middle" font-family="system-ui">${esc(p.label)}</text>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#ffffff"/>${out.join("")}</svg>`;
}
