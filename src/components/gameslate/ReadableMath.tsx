// Shows a maths line as written maths: stacked fractions, real minus signs,
// boxes for blanks. Never shows raw LaTeX or calculator syntax.
import type { ReactNode } from "react";

type Tok = { kind: "frac"; num: string; den: string } | { kind: "text"; value: string };

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

const tokenize = (src: string): Tok[] => {
  const out: Tok[] = [];
  let text = "";
  const flush = () => { if (text) out.push({ kind: "text", value: text }); text = ""; };
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("\\frac", i) || src.startsWith("\\dfrac", i)) {
      const start = src.indexOf("{", i);
      const a = start >= 0 ? group(src, start, "{", "}") : null;
      const b = a ? group(src, a[1], "{", "}") : null;
      if (a && b) { flush(); out.push({ kind: "frac", num: a[0], den: b[0] }); i = b[1]; continue; }
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
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[{}]/g, "")
    .replace(/-/g, "−")
    .replace(/\s*([=+×÷])\s*/g, " $1 ")
    .replace(/\s+/g, " ");

const Slot = ({ value }: { value: string }): ReactNode =>
  value.trim() === "" || value.trim() === "□"
    ? <span className="inline-block h-3.5 w-3 rounded-sm border border-current opacity-60 align-middle" />
    : <MathLine src={value} />;

export function MathLine({ src }: { src: string }) {
  return (
    <>
      {tokenize(src).map((t, i) =>
        t.kind === "text" ? (
          <span key={i} className="whitespace-pre-wrap">
            {tidy(t.value).split("□").map((part, j, arr) => (
              <span key={j}>{part}{j < arr.length - 1 && <Slot value="" />}</span>
            ))}
          </span>
        ) : (
          <span key={i} className="mx-0.5 inline-flex flex-col items-center align-middle text-[0.9em] leading-tight">
            <span className="px-0.5"><Slot value={t.num} /></span>
            <span className="w-full border-t border-current" />
            <span className="px-0.5"><Slot value={t.den} /></span>
          </span>
        ),
      )}
    </>
  );
}

export function ReadableMath({ src }: { src?: string | null }) {
  if (!src || !src.trim()) return <>—</>;
  return <span className="text-sm"><MathLine src={src} /></span>;
}
