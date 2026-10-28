import { useEffect, useMemo, useState } from "react";
import { X, Route as RouteIcon, Check, XCircle, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JOURNEYS, checkAnswer, type JourneyStep } from "@/lib/graphApp/journeys";

interface Props {
  userId: string | null;
  onShow: (step: JourneyStep) => void;
  onClose: () => void;
}

const key = (u: string | null, id: string) => `mathlab.journey.${u ?? "anon"}.${id}`;

/** Stage 17: guided journeys — each step opens its picture and is checked
 *  against Math Lab's own calculation. */
export default function JourneyPanel({ userId, onShow, onClose }: Props) {
  const [id, setId] = useState<string | null>(null);
  const [seed, setSeed] = useState(0);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const journey = JOURNEYS.find(j => j.id === id);
  const steps = useMemo(() => journey?.build(seed) ?? [], [journey, seed]);
  const step = steps[i];

  const open = (jid: string) => {
    let saved = { seed: 0, i: 0 };
    try { saved = { ...saved, ...JSON.parse(localStorage.getItem(key(userId, jid)) ?? "{}") }; } catch { /* fresh */ }
    setId(jid); setSeed(saved.seed); setI(saved.i);
  };
  useEffect(() => { setTyped(""); setResult(null); if (step) onShow(step); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (id) localStorage.setItem(key(userId, id), JSON.stringify({ seed, i })); }, [id, seed, i, userId]);

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto rounded-xl border bg-card p-3 max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:shadow-xl max-sm:w-full">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-semibold"><RouteIcon className="h-4 w-4 text-primary" /> {journey?.title ?? "Journeys"}</h2>
        <button aria-label="Close journeys" onClick={onClose}><X className="h-4 w-4" /></button>
      </div>
      {!journey ? (
        <ul className="flex flex-col gap-2">
          {JOURNEYS.map(j => <li key={j.id}><Button variant="outline" className="w-full justify-start" onClick={() => open(j.id)}>{j.title}</Button></li>)}
        </ul>
      ) : step && (
        <>
          <p className="text-xs text-muted-foreground">Step {i + 1} of {steps.length}</p>
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">{step.question}</p>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setResult(checkAnswer(step, typed)); }}>
            <input value={typed} onChange={e => setTyped(e.target.value)} aria-label="Your answer" placeholder="Your answer"
              className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 font-mono text-sm outline-none focus:border-primary" />
            <Button type="submit" size="sm">Check</Button>
          </form>
          {result === true && <p className="flex items-center gap-1 text-sm font-medium text-primary"><Check className="h-4 w-4" /> Correct</p>}
          {result === false && <p className="flex items-start gap-1 text-sm text-destructive"><XCircle className="mt-0.5 h-4 w-4 shrink-0" /> Not yet. Hint: {step.hint}</p>}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setI(i - 1)}>Back</Button>
            {i < steps.length - 1
              ? <Button size="sm" onClick={() => setI(i + 1)}>Next</Button>
              : <Button size="sm" onClick={() => { setId(null); setI(0); }}>Finish</Button>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setSeed(s => s + 1); setI(0); }}><Shuffle /> Change the numbers</Button>
          <Button variant="ghost" size="sm" onClick={() => setId(null)}>All journeys</Button>
        </>
      )}
      <p className="text-xs text-muted-foreground">Answers are computed on this device — no AI, no credits.</p>
    </aside>
  );
}
