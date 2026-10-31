import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TIERS, TIER_LABEL, type AcademiaTier } from "@/lib/academia/tiers";

const ASSIGN_HINT = "Activities stay in this tier's batch; they can only be reordered inside it.";

/** Choose a tier. At assignment time it picks the Session tier batch (which cannot
 *  change later); the default-tier setting reuses it with its own hint. */
const TierPicker = ({ value, onChange, label = "Tier", hint = ASSIGN_HINT }: { value: AcademiaTier; onChange: (t: AcademiaTier) => void; label?: string; hint?: string | null }) => (
  <div className="space-y-1">
    <Label>{label}</Label>
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={label}>
      {TIERS.map((t) => (
        <Button key={t} type="button" size="sm" role="radio" aria-checked={value === t}
          variant={value === t ? "default" : "outline"} onClick={() => onChange(t)}>
          {TIER_LABEL[t]}
        </Button>
      ))}
    </div>
    {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
  </div>
);

export default TierPicker;
