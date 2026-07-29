// Parallel Workspace — side-by-side aligned equations for elimination/synchronized solving.
// Layout-only in this pass; engine wiring is a later step.

import { useState } from "react";
import { Plus, X } from "lucide-react";

interface Step { id: string; text: string; }
interface Eq { id: string; label: string; steps: Step[]; }

const uid = () => Math.random().toString(36).slice(2, 9);

const OPS = ["× n", "÷ n", "A + B", "A − B", "B − A"];

export const ParallelWorkspace = () => {
  const [eqA, setEqA] = useState<Eq>({
    id: "A",
    label: "Equation A",
    steps: [{ id: uid(), text: "2x + 3y = 10" }],
  });
  const [eqB, setEqB] = useState<Eq>({
    id: "B",
    label: "Equation B",
    steps: [{ id: uid(), text: "4x − 3y = 8" }],
  });
  const [derived, setDerived] = useState<Eq[]>([]);

  const addStep = (which: "A" | "B") => {
    const set = which === "A" ? setEqA : setEqB;
    set((e) => ({ ...e, steps: [...e.steps, { id: uid(), text: "" }] }));
  };
  const updateStep = (which: "A" | "B", id: string, text: string) => {
    const set = which === "A" ? setEqA : setEqB;
    set((e) => ({ ...e, steps: e.steps.map((s) => (s.id === id ? { ...s, text } : s)) }));
  };

  const addDerived = () => {
    setDerived((d) => [
      ...d,
      { id: uid(), label: `Derived ${d.length + 1}`, steps: [{ id: uid(), text: "" }] },
    ]);
  };
  const updateDerived = (eid: string, sid: string, text: string) => {
    setDerived((d) =>
      d.map((e) =>
        e.id === eid ? { ...e, steps: e.steps.map((s) => (s.id === sid ? { ...s, text } : s)) } : e
      )
    );
  };
  const removeDerived = (eid: string) => setDerived((d) => d.filter((e) => e.id !== eid));

  return (
    <div className="flex-1 flex flex-col min-h-0 p-3 gap-3">
      {/* Relational ops bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground mr-1">
          Relational ops:
        </span>
        {OPS.map((op) => (
          <button
            key={op}
            className="rounded-md border border-amber-200/25 bg-background/40 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:border-cyan-400/50 hover:text-cyan-200 transition"
          >
            {op}
          </button>
        ))}
        <button
          onClick={addDerived}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-dashed border-cyan-400/40 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/10 transition"
        >
          <Plus className="h-3 w-3" /> Derived equation
        </button>
      </div>

      {/* Side-by-side aligned equations */}
      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0 overflow-y-auto">
        {[eqA, eqB].map((eq, idx) => {
          const which = (idx === 0 ? "A" : "B") as "A" | "B";
          return (
            <div
              key={eq.id}
              className="rounded-2xl border border-amber-200/15 bg-background/30 backdrop-blur p-4 flex flex-col"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] uppercase tracking-widest text-cyan-300/70 font-semibold">
                  {eq.label}
                </div>
                <span className="text-[10px] text-muted-foreground">aligned</span>
              </div>
              <div className="space-y-1.5 font-mono">
                {eq.steps.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums w-5">{i + 1}.</span>
                    <input
                      value={s.text}
                      onChange={(e) => updateStep(which, s.id, e.target.value)}
                      placeholder="Type a step…"
                      className="flex-1 bg-transparent border-b border-amber-200/10 focus:border-cyan-400/50 outline-hidden py-1 text-foreground tracking-wide"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => addStep(which)}
                className="mt-2 self-start inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition"
              >
                <Plus className="h-3 w-3" /> Add step
              </button>
            </div>
          );
        })}
      </div>

      {/* Derived panels (full-width, temporary) */}
      {derived.length > 0 && (
        <div className="space-y-2">
          {derived.map((eq) => (
            <div
              key={eq.id}
              className="rounded-2xl border border-dashed border-violet-400/40 bg-violet-500/5 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] uppercase tracking-widest text-violet-200 font-semibold">
                  {eq.label} <span className="text-violet-300/60 normal-case">(temporary)</span>
                </div>
                <button
                  onClick={() => removeDerived(eq.id)}
                  className="rounded-md p-1 text-violet-200/70 hover:text-violet-200 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1.5 font-mono">
                {eq.steps.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums w-5">{i + 1}.</span>
                    <input
                      value={s.text}
                      onChange={(e) => updateDerived(eq.id, s.id, e.target.value)}
                      placeholder="Type a step…"
                      className="flex-1 bg-transparent border-b border-violet-200/15 focus:border-violet-400/60 outline-hidden py-1 text-foreground"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ParallelWorkspace;
