import { renderMathInline } from "@/lib/notebook/mathRender";

/** Question/option text drawn with the Lesson Note maths renderer. */
export default function McqText({ text, k }: { text: string; k: string }) {
  const numberLine = /[─═]{2}/.test(text);
  return (
    <>
      {String(text ?? "").split("\n").map((l, i) => (
        <span key={i} className={numberLine ? "block whitespace-pre overflow-x-auto font-mono" : "block"}>{numberLine ? l : renderMathInline(l, `${k}-${i}`)}</span>
      ))}
    </>
  );
}
