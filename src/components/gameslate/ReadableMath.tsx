// THE canonical maths display for the Game evaluation surfaces.
// Shows a line as written maths: stacked fractions, radicals with index,
// superscripts, subscripts, real minus signs, boxes for blanks. Raw LaTeX,
// braces, backslash commands or token dumps can never reach the screen.
import type { ReactNode } from "react";

type Tok =
  | { kind: "frac"; num: string; den: string }
  | { kind: "root"; idx: string | null; body: string }
  | { kind: "sup"; value: string }
  | { kind: "sub"; value: string }
  | { kind: "text"; value: string };

export const MATH_FALLBACK = "Continue with a valid mathematical step.";

/** Read one balanced group starting at `open` index; returns [inner, endIndex]. */
const group = (s: string, i: number, open: string, close: string): [string, number] | null => {
  if (s[i] !== open) return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === open) depth++;
    else if (s[j] === close && --depth === 0) return [s.slice(i + 1, j), j + 1];
  }
  return null;
};

const skipWs = (s: string, i: number) => { while (s[i] === " ") i++; return i; };

const tokenize = (src: string): Tok[] => {
  const out: Tok[] = [];
  let text = "";
  const flush = () => { if (text) out.push({ kind: "text", value: text }); text = ""; };
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("\\frac", i) || src.startsWith("\\dfrac", i) || src.startsWith("\\tfrac", i)) {
      const start = skipWs(src, src.indexOf("c", i + 1) + 1);
      const a = group(src, start, "{", "}");
      const b = a ? group(src, skipWs(src, a[1]), "{", "}") : null;
      flush();
      if (a && b) { out.push({ kind: "frac", num: a[0], den: b[0] }); i = b[1]; continue; }
      out.push({ kind: "frac", num: a?.[0] ?? "", den: "" });
      i = a ? a[1] : start;
      continue;
    }
    if (src.startsWith("\\sqrt", i)) {
      let j = skipWs(src, i + 5);
      const idx = group(src, j, "[", "]");
      if (idx) j = skipWs(src, idx[1]);
      const body = group(src, j, "{", "}");
      flush();
      out.push({ kind: "root", idx: idx?.[0] ?? null, body: body?.[0] ?? "" });
      i = body ? body[1] : j;
      continue;
    }
    if ((src[i] === "√" || src[i] === "∛" || src[i] === "∜") && src[i + 1] === "(") {
      const body = group(src, i + 1, "(", ")");
      if (body) {
        flush();
        out.push({ kind: "root", idx: src[i] === "∛" ? "3" : src[i] === "∜" ? "4" : null, body: body[0] });
        i = body[1];
        continue;
      }
    }
    if (src[i] === "^" || src[i] === "_") {
      const kind = src[i] === "^" ? "sup" : "sub";
      const g = group(src, i + 1, "{", "}") ?? group(src, i + 1, "(", ")");
      const single = /^[a-zA-Z0-9]+/.exec(src.slice(i + 1));
      if (g || single) {
        flush();
        const value = g ? g[0] : single![0].slice(0, /^\d+/.test(single![0]) ? (/^\d+/.exec(single![0])![0].length) : 1);
        out.push({ kind, value });
        i = g ? g[1] : i + 1 + value.length;
        continue;
      }
    }
    if (src[i] === "(") {
      const a = group(src, i, "(", ")");
      if (a && src[a[1]] === "/" && src[a[1] + 1] === "(") {
        const b = group(src, a[1] + 1, "(", ")");
        if (b) { flush(); out.push({ kind: "frac", num: a[0], den: b[0] }); i = b[1]; continue; }
      }
    }
    text += src[i];
    i++;
  }
  flush();
  return out;
};

const tidy = (s: string) =>
  s
    .replace(/\\(left|right)/g, "")
    .replace(/\\cdot|\\times|\*/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\(le|leq)\b/g, "≤").replace(/\\(ge|geq)\b/g, "≥").replace(/\\(ne|neq)\b/g, "≠")
    .replace(/<=/g, "≤").replace(/>=/g, "≥").replace(/!=/g, "≠")
    .replace(/\\pm/g, "±").replace(/\\pi/g, "π").replace(/\\infty/g, "∞")
    .replace(/\\angle/g, "∠").replace(/\\circ|\\degree/g, "°")
    .replace(/\\sl\{\}/g, "□")
    .replace(/\\([a-zA-Z]+)/g, (_m, w: string) => (/^(sin|cos|tan|log|ln)$/.test(w) ? w : ""))
    .replace(/\\/g, "")
    .replace(/[{}]/g, "")
    .replace(/\bsqrt\b/g, "√")
    .replace(/-/g, "−")
    .replace(/\s*([=+×÷<>≤≥≠±])\s*/g, " $1 ")
    .replace(/\s+/g, " ");

const Slot = ({ value }: { value: string }): ReactNode =>
  value.trim() === "" || value.trim() === "□"
    ? <span className="inline-block h-3.5 w-3 rounded-sm border border-current opacity-60 align-middle" />
    : <MathLine src={value} />;

export function MathLine({ src }: { src: string }) {
  return (
    <>
      {tokenize(src).map((t, i) => {
        if (t.kind === "text")
          return (
            <span key={i} className="whitespace-pre-wrap">
              {tidy(t.value).split("□").map((part, j, arr) => (
                <span key={j}>{part}{j < arr.length - 1 && <Slot value="" />}</span>
              ))}
            </span>
          );
        if (t.kind === "frac")
          return (
            <span key={i} className="mx-0.5 inline-flex flex-col items-center align-middle text-[0.9em] leading-tight">
              <span className="px-0.5"><Slot value={t.num} /></span>
              <span className="w-full border-t border-current" />
              <span className="px-0.5"><Slot value={t.den} /></span>
            </span>
          );
        if (t.kind === "root")
          return (
            <span key={i} className="mx-0.5 inline-flex items-stretch align-middle">
              {t.idx && <sup className="mr-[-0.2em] text-[0.6em]"><MathLine src={t.idx} /></sup>}
              <span className="text-[1.1em] leading-none">√</span>
              <span className="border-t border-current px-0.5"><Slot value={t.body} /></span>
            </span>
          );
        if (t.kind === "sup") return <sup key={i} className="text-[0.7em]"><MathLine src={t.value} /></sup>;
        return <sub key={i} className="text-[0.7em]"><MathLine src={t.value} /></sub>;
      })}
    </>
  );
}

/** Does anything that looks like source code survive the display pass? */
export const leaksSyntax = (src: string): boolean => {
  const toks = tokenize(src);
  const visible = toks.map((t) => (t.kind === "text" ? tidy(t.value) : "")).join("");
  return /[\\{}]|"kind"|\[object/.test(visible);
};

export function ReadableMath({ src }: { src?: string | null }) {
  if (!src || !src.trim()) return <>—</>;
  if (leaksSyntax(src) || /^\s*[[{]\s*"/.test(src)) return <span className="text-sm text-muted-foreground">{MATH_FALLBACK}</span>;
  return <span className="text-sm"><MathLine src={src} /></span>;
}

/** Canonical name: every maths surface renders through this. */
export const MathView = ReadableMath;
