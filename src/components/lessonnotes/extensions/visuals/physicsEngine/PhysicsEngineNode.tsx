// Editable Physics diagram. All settings live in the right-hand Properties
// Panel (universal editing rule): title plus every label of the diagram.
import { useMemo } from "react";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { PhysicsDiagramModel } from "@/lib/lessonnotes/ai/physicsDiagram";
import { validateCircuit } from "@/lib/lessonnotes/ai/physicsDiagram";
import { PhysicsDiagramSvg } from "./PhysicsDiagramSvg";

interface Props {
  attrs: Record<string, unknown>;
  selected: boolean;
  assetId?: string;
  onChange: (patch: Record<string, unknown>) => void;
  onDeleteDiagram?: () => void;
}

export function PhysicsEngineNode({ attrs, selected, assetId, onChange, onDeleteDiagram }: Props) {
  const model = attrs.model as PhysicsDiagramModel | undefined;
  const uid = useMemo(() => `phy${Math.random().toString(36).slice(2, 8)}`, []);
  const set = (next: PhysicsDiagramModel) => onChange({ model: next });
  const issues = model?.kind === "circuit" ? validateCircuit(model) : [];

  const editor = model ? (
    <div className="space-y-3 text-sm">
      <label className="block space-y-1"><span className="text-muted-foreground">Title</span>
        <Input value={model.title} onChange={(e) => set({ ...model, title: e.target.value })} /></label>
      {model.items.map((it, i) => (
        <label key={it.id} className="block space-y-1">
          <span className="text-muted-foreground capitalize">{it.type}{it.dir ? ` (${it.dir})` : ""}</span>
          <Input value={it.label} onChange={(e) => {
            const items = model.items.slice(); items[i] = { ...it, label: e.target.value }; set({ ...model, items });
          }} />
        </label>
      ))}
      {issues.length > 0 && <ul className="text-destructive text-xs list-disc pl-4">{issues.map((x) => <li key={x}>{x}</li>)}</ul>}
      {onDeleteDiagram && <Button variant="destructive" size="sm" onClick={onDeleteDiagram}>Delete diagram</Button>}
    </div>
  ) : null;
  useRegisterAssetEditor(selected, assetId || `physics:${uid}`, "Physics diagram", editor);

  if (!model) return <div className="text-sm text-muted-foreground p-3">Physics diagram</div>;
  return <div className="w-full max-w-[520px] mx-auto"><PhysicsDiagramSvg model={model} uid={uid} /></div>;
}
