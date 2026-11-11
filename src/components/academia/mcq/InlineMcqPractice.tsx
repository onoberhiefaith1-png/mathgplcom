import { useRef, useState, type ReactNode } from "react";
import type { InlineMcq } from "@/lib/lessonnotes/inlineMcq";
import McqText from "./McqText";

/** Practice only; bulk papers retain final-submission marking. */
export function InlineMcqPractice({ question, onCheck, onInput, onContinue, onBack, children, readOnly = false }: {
  question: InlineMcq; onCheck: (label: string) => Promise<boolean>; onInput: () => void;
  onContinue?: () => void; onBack?: () => void; readOnly?: boolean; children?: ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const submit = async () => {
    if (!selected || pending.current || readOnly) return;
    pending.current = true; setBusy(true); setError("");
    try { setResult(await onCheck(selected)); }
    catch { setError("Could not check your answer. Please try again."); }
    finally { pending.current = false; setBusy(false); }
  };
  return <section data-inline-mcq className="pointer-events-auto absolute inset-0 z-40 flex min-h-0 flex-col bg-stone-50 text-slate-900">
    <header className="flex items-center justify-between border-b bg-white px-5 py-3">
      {onBack ? <button type="button" onClick={onBack}>Back</button> : <span>Practice</span>}
      <span className="text-sm text-slate-500">Multiple choice</span>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8"><div className="mx-auto max-w-3xl space-y-5">
      <h2 className="text-xl font-semibold leading-relaxed"><McqText text={question.text} k="question" /></h2>
      {children}
      <div role="radiogroup" aria-label="Answer options" className="grid gap-3">
        {question.options.map(option => <button type="button" role="radio" aria-checked={selected === option.label}
          disabled={readOnly || busy || result !== null} key={option.label}
          onClick={() => { onInput(); setSelected(option.label); setError(""); }}
          className={"flex items-start gap-4 rounded-xl border-2 p-4 text-left transition " +
            (selected === option.label ? "border-amber-600 bg-amber-50" : "border-slate-200 bg-white")}>
          <span className="font-bold">{option.label}</span><McqText text={option.text} k={option.label} />
        </button>)}
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {result !== null && <div role="status" className={"rounded-xl p-4 " + (result ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}>
        <p className="font-semibold">{result ? "Correct" : "Not correct. You can try again."}</p>
        {revealed ? <p className="mt-2">Correct answer: {question.answer} — <McqText text={question.options.find(o => o.label === question.answer)?.text ?? ""} k="answer" /></p> :
          <button type="button" className="mt-2 underline" onClick={() => setRevealed(true)}>Show correct answer</button>}
      </div>}
    </div></div>
    {!readOnly && <footer className="flex justify-end gap-3 border-t bg-white px-5 py-4">
      {result === null ? <button type="button" disabled={!selected || busy} onClick={submit}
        className="rounded-lg bg-amber-700 px-6 py-2 font-semibold text-white disabled:opacity-40">{busy ? "Checking…" : "Next"}</button> : <>
        <button type="button" onClick={() => { setSelected(null); setResult(null); setRevealed(false); }} className="rounded-lg border px-4 py-2">Try again</button>
        {onContinue && <button type="button" onClick={onContinue} className="rounded-lg bg-amber-700 px-5 py-2 text-white">Continue</button>}
      </>}
    </footer>}
  </section>;
}
