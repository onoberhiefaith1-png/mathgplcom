import { renderMathInline } from "@/lib/notebook/mathRender";

/** Question/option text drawn with the Lesson Note maths renderer. */
export default function McqText({ text, k }: { text: string; k: string }) {
  return (
    <>
      {String(text ?? "").split("\n").map((l, i) => (
        <span key={i} className="block">{renderMathInline(l, `${k}-${i}`)}</span>
      ))}
    </>
  );
}
