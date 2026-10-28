import { useState } from "react";
import { X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Concept, ConceptAction } from "@/lib/graphApp/concepts";

interface Props {
  concept: Concept;
  onBuild: (action: ConceptAction) => void;
  onClose: () => void;
}

/** Stage 15: a concept the student typed asks for the values it needs,
 *  then builds the demonstration from Math Lab's own engines. */
export default function ConceptPanel({ concept, onBuild, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(concept.inputs.map(i => [i.key, i.def])),
  );

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto rounded-xl border bg-card p-3 max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:shadow-xl max-sm:w-full">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-semibold"><Lightbulb className="h-4 w-4 text-primary" /> {concept.title}</h2>
        <button aria-label="Close concept" onClick={onClose}><X className="h-4 w-4" /></button>
      </div>
      <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">{concept.question}</p>
      {concept.inputs.map(inp => (
        <label key={inp.key} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{inp.label}</span>
          <input
            value={values[inp.key] ?? ""}
            onChange={e => setValues(v => ({ ...v, [inp.key]: e.target.value }))}
            placeholder={inp.hint}
            aria-label={inp.label}
            className="h-9 rounded-md border bg-background px-2 font-mono text-sm outline-none focus:border-primary"
          />
        </label>
      ))}
      <Button onClick={() => onBuild(concept.run(values))}>Build the demonstration</Button>
      <p className="text-xs text-muted-foreground">Everything is computed on this device — no AI, no credits.</p>
    </aside>
  );
}
