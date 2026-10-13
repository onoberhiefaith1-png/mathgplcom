import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Lightbulb, ListOrdered, CheckCircle2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { asLinearSystem, asVertexForm, quadraticSteps, equationFn, type SystemSolution } from "@/lib/graphApp/steps";
import type { Item } from "@/components/graphApp/Graph2D";
import { cn } from "@/lib/utils";

type ModeTab = "explore" | "steps" | "solution";

function StepList({ steps, reveal }: { steps: string[]; reveal: number | "all" }) {
  const shown = reveal === "all" ? steps.length : reveal;
  return (
    <ol className="space-y-1 font-mono text-xs">
      {steps.slice(0, shown).map((s, i) => (
        <li key={i} className="rounded bg-muted px-2 py-1">{s}</li>
      ))}
    </ol>
  );
}

/** Explore / Step-by-Step / Show Solution for the maths currently on the canvas. */
export default function ModesCard({ items, onPlot }: { items: Item[]; onPlot: (src: string) => void }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<ModeTab>("explore");
  const [revealed, setRevealed] = useState(1);
  const [q, setQ] = useState({ a: 1, h: 0, k: 0 });

  // The two most recently added visible equations → try a linear system.
  const system: SystemSolution | null = useMemo(() => {
    const eqs = items.filter(i => !i.hidden && (i.eq.kind === "implicit2d" || i.eq.kind === "curve2d"));
    if (eqs.length < 2) return null;
    const f1 = equationFn(eqs[eqs.length - 2].eq.src);
    const f2 = equationFn(eqs[eqs.length - 1].eq.src);
    if (!f1 || !f2) return null;
    return asLinearSystem(f1, f2);
  }, [items]);

  // The latest visible quadratic → vertex-form explorer.
  const detected = useMemo(() => {
    if (system) return null;
    const c = [...items].reverse().find(i => !i.hidden && i.eq.kind === "curve2d");
    if (!c || c.eq.kind !== "curve2d") return null;
    const v = asVertexForm(c.eq.f);
    return v ? { src: c.eq.src, ...v } : null;
  }, [items, system]);

  // Sliders follow the plotted curve until the student moves them.
  const [qSrc, setQSrc] = useState<string | null>(null);
  const qEff = detected && qSrc === detected.src ? q : detected ? { a: detected.a, h: detected.h, k: detected.k } : q;
  const quad = useMemo(() => (detected ? quadraticSteps(qEff.a, qEff.h, qEff.k) : null), [detected, qEff]);

  if (!system && !quad) return null;
  const steps = system?.steps ?? quad?.steps ?? [];
  const question = system?.exploreQuestion ?? quad?.exploreQuestion ?? "";
  const answer = system
    ? system.kind === "point"
      ? `The lines meet at (${system.x}, ${system.y}).`
      : system.kind === "parallel"
        ? "The lines are parallel — no solution."
        : "The equations describe the same line — infinitely many solutions."
    : quad
      ? `Vertex (${quad.h}, ${quad.k}); axis x = ${quad.h}.`
      : "";

  return (
    <div className="absolute bottom-2 right-2 z-10 w-80 rounded-xl border bg-card/95 p-3 text-sm shadow-lg max-sm:bottom-20 max-sm:w-[calc(100%-1rem)]">
      <button className="flex w-full items-center justify-between font-semibold" onClick={() => setOpen(o => !o)} aria-label="Toggle learning modes">
        <span>Learn it</span>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-3 gap-1">
            {([["explore", Lightbulb, "Explore"], ["steps", ListOrdered, "Step-by-Step"], ["solution", CheckCircle2, "Solution"]] as const).map(([id, Icon, l]) => (
              <button key={id} onClick={() => { setTab(id); setRevealed(1); }}
                className={cn("flex flex-col items-center rounded-md py-1 text-[11px]", tab === id ? "bg-primary text-primary-foreground" : "bg-muted")}>
                <Icon className="h-4 w-4" />{l}
              </button>
            ))}
          </div>

          {tab === "explore" && (
            <div className="space-y-2">
              <p className="rounded-lg bg-accent/10 px-2 py-1.5 text-xs font-medium text-accent-foreground">{question}</p>
              <p className="text-xs text-muted-foreground">Drag the graph and inspect the lines before revealing the answer.</p>
              {quad && (
                <div className="space-y-1.5">
                  {([["a", qEff.a, -3, 3, 0.1], ["h", qEff.h, -5, 5, 0.1], ["k", qEff.k, -5, 5, 0.1]] as const).map(([label, val, min, max, step]) => (
                    <label key={label} className="flex items-center gap-2 text-xs">
                      <span className="w-3 font-mono font-bold">{label}</span>
                      <Slider value={[val]} min={min} max={max} step={step}
                        onValueChange={([v]) => { const next = { ...qEff, [label]: v }; setQ(next); if (detected) setQSrc(detected.src); onPlot(quadraticSteps(next.a, next.h, next.k).src); }} />
                      <span className="w-8 text-right font-mono">{val}</span>
                    </label>
                  ))}
                </div>
              )}
              <Button size="sm" variant="outline" className="w-full" onClick={() => setTab("solution")}>Reveal the answer</Button>
            </div>
          )}

          {tab === "steps" && (
            <div className="space-y-2">
              <StepList steps={steps} reveal={revealed} />
              {revealed < steps.length
                ? <Button size="sm" className="w-full" onClick={() => setRevealed(r => r + 1)}>Next step</Button>
                : <p className="text-xs font-semibold text-primary">{answer}</p>}
            </div>
          )}

          {tab === "solution" && (
            <div className="space-y-2">
              <StepList steps={steps} reveal="all" />
              <p className="rounded-lg bg-primary/10 px-2 py-1.5 text-xs font-semibold text-primary">{answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
