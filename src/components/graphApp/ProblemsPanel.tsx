import { useState } from "react";
import { Lightbulb, X, ChartNoAxesCombined, Check, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROBLEMS, checkAnswer, type Topic } from "@/lib/graphApp/problems";

export default function ProblemsPanel({ onPlot, onClose }: { onPlot: (src: string) => void; onClose: () => void }) {
  const [topic, setTopic] = useState<Topic>("Calculus");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean | undefined>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const list = PROBLEMS.filter(p => p.topic === topic);
  const score = PROBLEMS.filter(p => checked[p.id]).length;
  return <section aria-label="Real-world problems" className="absolute inset-y-0 right-0 z-30 flex w-[min(460px,100%)] flex-col gap-3 overflow-y-auto border-l bg-card p-4 shadow-lg">
    <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Lightbulb className="h-4 w-4" />Real-world problems</h2><Button variant="ghost" size="icon-sm" aria-label="Close tools" onClick={onClose}><X /></Button></div>
    <div className="flex items-center gap-2">{(["Calculus", "Matrices"] as Topic[]).map(t => <Button key={t} size="sm" variant={t === topic ? "default" : "outline"} onClick={() => setTopic(t)}>{t}</Button>)}<span className="ml-auto text-sm text-muted-foreground">{score} / {PROBLEMS.length} correct</span></div>
    {list.map(p => <article key={p.id} className="rounded-md border bg-background p-3 text-sm">
      <h3 className="font-semibold">{p.title}</h3>
      <p className="mt-1 text-muted-foreground">{p.story}</p>
      <p className="mt-1 font-medium">{p.question}</p>
      <div className="mt-2 flex items-center gap-2">
        <input aria-label={`Answer for ${p.title}`} inputMode="decimal" value={answers[p.id] ?? ""} onChange={e => { setAnswers({ ...answers, [p.id]: e.target.value }); setChecked({ ...checked, [p.id]: undefined }); }} className="h-9 w-28 rounded-md border bg-background px-2 font-mono" />
        <span className="text-xs text-muted-foreground">{p.unit}</span>
        <Button size="sm" onClick={() => setChecked({ ...checked, [p.id]: checkAnswer(p, answers[p.id] ?? "") })}>Check</Button>
        <Button size="sm" variant="outline" onClick={() => setShown({ ...shown, [p.id]: !shown[p.id] })}>{shown[p.id] ? "Hide" : "Show"} working</Button>
      </div>
      {checked[p.id] === true && <p role="status" className="mt-2 flex items-center gap-1 text-primary"><Check className="h-4 w-4" />Correct!</p>}
      {checked[p.id] === false && <p role="status" className="mt-2 flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" />Not yet — try again or show the working.</p>}
      {shown[p.id] && <ol className="mt-2 list-decimal space-y-1 rounded-md bg-muted p-3 pl-7 font-mono text-xs">{p.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
      {p.plot && <Button className="mt-2" size="sm" variant="ghost" onClick={() => onPlot(p.plot!)}><ChartNoAxesCombined />See the graph</Button>}
    </article>)}
  </section>;
}
