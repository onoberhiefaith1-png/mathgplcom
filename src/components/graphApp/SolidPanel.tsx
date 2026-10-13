import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SOLID_FIELDS, fmtSolid, solidMeasures, validSolid, type Solid } from "@/lib/graphApp/solids";

export default function SolidPanel({ solid, editable = true, onChange, onClose }: { solid: Solid; editable?: boolean; onChange: (s: Solid) => void; onClose: () => void }) {
  const [working,setWorking] = useState(false);
  const [error,setError] = useState<string | null>(null);
  return <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l bg-card p-3 max-sm:w-full max-sm:overflow-visible max-sm:border-l-0 max-sm:border-t">
    <div className="flex items-center justify-between"><h2 className="font-semibold">Measurements</h2><Button variant="ghost" size="icon-sm" aria-label="Close solid" onClick={onClose}><X/></Button></div>
    <p className="break-words text-sm text-muted-foreground">{solid.source}</p>
    {editable && <form key={`${solid.kind}:${solid.source}`} className="space-y-2" onSubmit={e => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      const next = { ...solid, dimensions: SOLID_FIELDS[solid.kind].map(f => Number(data.get(f))) };
      if (!validSolid(next)) { setError("Enter positive dimensions with a ratio of at least one in a million."); return; }
      setError(null); onChange(next);
    }}>
      <div className="grid grid-cols-2 gap-2">{SOLID_FIELDS[solid.kind].map((field,i) => <label key={field} className="text-xs font-medium">{field} ({solid.unit})<input required name={field} aria-label={`${field} (${solid.unit})`} type="number" step="any" min="0.000000001" defaultValue={solid.dimensions[i]} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"/></label>)}</div>
      <Button type="submit" size="sm" className="w-full">Update dimensions</Button>
    </form>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <dl className="divide-y">{solidMeasures(solid).map(m => <div key={m.label} className="py-3">
      <dt className="text-xs font-medium text-muted-foreground">{m.label}</dt>
      <dd className="mt-1 text-xl font-semibold" data-measure={m.label}>{Number.isInteger(m.value) ? "" : "≈ "}{fmtSolid(m.value)} {solid.unit}{m.power === 2 ? "²" : m.power === 3 ? "³" : ""}</dd>
      {working && <div className="mt-2 space-y-1 break-words text-sm"><p>{m.formula}</p><p>{m.working}</p><p>{Number.isInteger(m.value) ? "= " : "≈ "}{fmtSolid(m.value)} {solid.unit}{m.power === 2 ? "²" : m.power === 3 ? "³" : ""}</p></div>}
    </div>)}</dl>
    <Button variant="outline" size="sm" onClick={() => setWorking(!working)}>{working ? "Hide working" : "Show working"}</Button>
    {!(["cube","cuboid"].includes(solid.kind)) && <p className="text-xs text-muted-foreground">{solid.kind === "sphere" ? "A sphere has no flat net or vertex-to-vertex diagonal." : "Surface area includes the base" + (solid.kind === "cylinder" ? "s. The diagonal belongs to the rectangular axial section." : ". The highlighted length is the slant height, not a space diagonal.")}</p>}
  </aside>;
}