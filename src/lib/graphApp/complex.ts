// Complex numbers for Math Lab — pure, on the device.
import { compile, complex as mc, type Complex as MComplex } from "mathjs";
import { normalise } from "./math";

export interface C { re: number; im: number }
export const add = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im });
export const sub = (a: C, b: C): C => ({ re: a.re - b.re, im: a.im - b.im });
export const mul = (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export function div(a: C, b: C): C {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) throw Error("Cannot divide by zero.");
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
export const modulus = (z: C) => Math.hypot(z.re, z.im);
export const argument = (z: C) => Math.atan2(z.im, z.re);

/** All n nth roots of unity, starting at 1 and going anticlockwise. */
export function rootsOfUnity(n: number): C[] {
  if (!Number.isInteger(n) || n < 1 || n > 24) throw Error("Choose n between 1 and 24.");
  return Array.from({ length: n }, (_, k) => ({ re: Math.cos(2 * Math.PI * k / n), im: Math.sin(2 * Math.PI * k / n) }));
}

export function parseC(src: string): C {
  const v = compile(normalise(src).replace(/LOG10\(/g, "log10(")).evaluate({ i: mc(0, 1) }) as number | MComplex;
  if (typeof v === "number") return { re: v, im: 0 };
  if (v && typeof v === "object" && "re" in v) return { re: v.re, im: v.im };
  throw Error("Enter a complex number such as 3 + 2i.");
}

export type CFn = (z: C) => C;
/** Complex function of z, e.g. "z^2", "1/z", "e^z". */
export function complexFn(src: string): CFn {
  const code = compile(normalise(src.replace(/^\s*f\(z\)\s*=|^\s*w\s*=/, "")).replace(/LOG10\(/g, "log10("));
  return (z) => {
    try {
      const v = code.evaluate({ z: mc(z.re, z.im), i: mc(0, 1), e: Math.E, pi: Math.PI }) as number | MComplex;
      return typeof v === "number" ? { re: v, im: 0 } : { re: v.re, im: v.im };
    } catch { return { re: NaN, im: NaN }; }
  };
}

/** Domain colouring: hue = argument, brightness from modulus. Returns RGB 0-255. */
export function domainColour(w: C): [number, number, number] {
  if (!Number.isFinite(w.re) || !Number.isFinite(w.im)) return [255, 255, 255];
  const h = ((argument(w) / (2 * Math.PI)) + 1) % 1;
  const m = modulus(w);
  const l = 0.35 + 0.3 * ((Math.log2(m + 1e-12) % 1 + 1) % 1);
  const s = 0.9, a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0) * 255, f(8) * 255, f(4) * 255].map(Math.round) as [number, number, number];
}

export const fmtC = (z: C) => {
  const r = (x: number) => Math.round(x * 1e4) / 1e4;
  const re = r(z.re), im = r(z.im);
  if (im === 0) return `${re}`;
  if (re === 0) return `${im}i`;
  return `${re} ${im < 0 ? "−" : "+"} ${Math.abs(im)}i`;
};
