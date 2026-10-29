import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TIERS, TIER_LABEL, type AcademiaTier } from "@/lib/academia/tiers";

/** Choose the Session tier batch at assignment time. It cannot change later. */
const TierPicker = ({ value, onChange, label = "Tier" }: { value: AcademiaTier; onChange: (t: AcademiaTier) => void; label?: string }) => (
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
    <p className="text-[11px] text-muted-foreground">Activities stay in this tier's batch; they can only be reordered inside it.</p>
  </div>
);

export default TierPicker;
