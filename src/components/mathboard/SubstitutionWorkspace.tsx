// Substitution Workspace — two equation panels + pinned reusable expressions.
// Layout-only in this pass; verification engine wiring is a later step.

import { useState } from "react";
import { Pin, Plus, ArrowRightLeft, X } from "lucide-react";

interface Step { id: string; text: string; }
interface EqPanel { id: string; title: string; steps: Step[]; }
interface Pinned { id: string; text: string; from: string; }

const uid = () => Math.random().toString(36).slice(2, 9);

export const SubstitutionWorkspace = () => {
  const [panels, setPanels] = useState<EqPanel[]>([
    { id: "e1", title: "Equation 1", steps: [{ id: uid(), text: "2x + 3 = 3y" }] },
    { id: "e2", title: "Equation 2", steps: [{ id: uid(), text: "7y + 2x = 1" }] },
  ]);
  const [pins, setPins] = useState<Pinned[]>([]);
  const [activePanelId, setActivePanelId] = useState("e1");

  const addStep = (panelId: string) => {
    setPanels((p) =>
      p.map((x) => (x.id === panelId ? { ...x, steps: [...x.steps, { id: uid(), text: "" }] } : x))
    );
  };
  const updateStep = (panelId: string, stepId: string, text: string) => {
    setPanels((p) =>
      p.map((x) =>
        x.id === panelId
          ? { ...x, steps: x.steps.map((s) => (s.id === stepId ? { ...s, text } : s)) }
          : x
      )
    );
  };
  const pinStep = (panelTitle: string, text: string) => {
    if (!text.trim()) return;
    setPins((p) => [...p, { id: uid(), text, from: panelTitle }]);
  };
  const usePin = (pin: Pinned) => {
    setPanels((p) =>
      p.map((x) =>
        x.id === activePanelId ? { ...x, steps: [...x.steps, { id: uid(), text: pin.text }] } : x
      )
    );
  };
  const removePin = (id: string) => setPins((p) => p.filter((x) => x.id !== id));

  const addPanel = () => {
    setPanels((p) => [
      ...p,
      { id: uid(), title: `Equation ${p.length + 1}`, steps: [{ id: uid(), text: "" }] },
    ]);
  };

  return (
    <div className="flex-1 grid grid-cols-[1fr_280px] gap-3 min-h-0 p-3">
      {/* Equation panels (left) */}
      <div className="flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
        {panels.map((panel) => {
          const isActive = panel.id === activePanelId;
          return (
            <div
              key={panel.id}
              onClick={() => setActivePanelId(panel.id)}
              className={[
                "rounded-2xl border bg-background/30 backdrop-blur p-4 transition cursor-text",
                isActive
                  ? "border-cyan-400/50 shadow-[0_0_20px_hsl(200_90%_60%/0.18)]"
                  : "border-amber-200/15 hover:border-amber-200/30",
              ].join(" ")}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] uppercase tracking-widest text-cyan-300/70 font-semibold">
                  {panel.title}
                </div>
                {isActive && (
                  <span className="text-[10px] uppercase tracking-wider text-cyan-300/60">Active</span>
                )}
              </div>
              <div className="space-y-1.5">
                {panel.steps.map((s, i) => (
                  <div key={s.id} className="group flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums w-5">{i + 1}.</span>
                    <input
                      value={s.text}
                      onChange={(e) => updateStep(panel.id, s.id, e.target.value)}
                      placeholder="Type a step…"
                      className="flex-1 bg-transparent border-b border-amber-200/10 focus:border-cyan-400/50 outline-none py-1 text-foreground italic font-serif"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); pinStep(panel.title, s.text); }}
                      title="Pin this expression"
                      className="opacity-0 group-hover:opacity-100 text-amber-200/70 hover:text-amber-200 transition"
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); addStep(panel.id); }}
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition"
              >
                <Plus className="h-3 w-3" /> Add step
              </button>
            </div>
          );
        })}
        <button
          onClick={addPanel}
          className="self-start inline-flex items-center gap-1.5 rounded-lg border border-dashed border-amber-200/25 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-amber-200/50 transition"
        >
          <Plus className="h-3.5 w-3.5" /> Add equation panel
        </button>
      </div>

      {/* Pinned rail (right) */}
      <aside className="flex flex-col rounded-2xl border border-amber-200/15 bg-card/40 backdrop-blur p-3 min-h-0">
        <div className="flex items-center gap-2 mb-2 text-foreground">
          <Pin className="h-3.5 w-3.5 text-amber-300" />
          <span className="text-xs font-bold uppercase tracking-wider">Pinned Expressions</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {pins.length === 0 && (
            <div className="text-xs text-muted-foreground italic px-1">
              Hover any step and tap the pin icon to make it reusable here.
            </div>
          )}
          {pins.map((pin) => (
            <div
              key={pin.id}
              className="rounded-lg border border-amber-200/20 bg-background/40 p-2"
            >
              <div className="text-[10px] uppercase tracking-wider text-cyan-300/60 mb-1">
                from {pin.from}
              </div>
              <div className="font-serif italic text-sm text-foreground break-words">
                {pin.text}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  onClick={() => usePin(pin)}
                  className="inline-flex items-center gap-1 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20 transition"
                >
                  <ArrowRightLeft className="h-3 w-3" /> Substitute
                </button>
                <button
                  onClick={() => removePin(pin.id)}
                  className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground transition"
                  title="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-amber-200/10 text-[10px] uppercase tracking-wider text-muted-foreground">
          Substitute into: <span className="text-cyan-300/80">{panels.find(p => p.id === activePanelId)?.title}</span>
        </div>
      </aside>
    </div>
  );
};

export default SubstitutionWorkspace;
