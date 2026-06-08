import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Settings as SettingsIcon } from "lucide-react";

export interface AbacusSettings {
  roundSec: number;
  startingLives: number;
  objectiveScale: number; // 0.5 .. 2
  coinWeight: number;
  diamondWeight: number;
  goldWeight: number;
  gemWeight: number;
}

export const DEFAULT_SETTINGS: AbacusSettings = {
  roundSec: 20,
  startingLives: 5,
  objectiveScale: 1,
  coinWeight: 0.6,
  diamondWeight: 0.2,
  goldWeight: 0.1,
  gemWeight: 0.1,
};

interface Props {
  settings: AbacusSettings;
  onChange: (patch: Partial<AbacusSettings>) => void;
}

export const AbacusSettingsPanel = ({ settings, onChange }: Props) => (
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="outline" size="icon" aria-label="Settings">
        <SettingsIcon className="h-4 w-4" />
      </Button>
    </SheetTrigger>
    <SheetContent className="overflow-y-auto">
      <SheetHeader><SheetTitle>Game Settings</SheetTitle></SheetHeader>
      <div className="mt-6 space-y-5">
        <Row label={`Round time: ${settings.roundSec}s`} min={5} max={60} step={1} value={settings.roundSec} onChange={(v) => onChange({ roundSec: v })} />
        <Row label={`Starting lives: ${settings.startingLives}`} min={1} max={9} step={1} value={settings.startingLives} onChange={(v) => onChange({ startingLives: v })} />
        <Row label={`Objective size: ${settings.objectiveScale.toFixed(2)}x`} min={0.5} max={2} step={0.1} value={settings.objectiveScale} onChange={(v) => onChange({ objectiveScale: v })} />
        <Row label={`Coin weight: ${(settings.coinWeight * 100).toFixed(0)}%`} min={0} max={1} step={0.05} value={settings.coinWeight} onChange={(v) => onChange({ coinWeight: v })} />
        <Row label={`Diamond weight: ${(settings.diamondWeight * 100).toFixed(0)}%`} min={0} max={1} step={0.05} value={settings.diamondWeight} onChange={(v) => onChange({ diamondWeight: v })} />
        <Row label={`Gold weight: ${(settings.goldWeight * 100).toFixed(0)}%`} min={0} max={1} step={0.05} value={settings.goldWeight} onChange={(v) => onChange({ goldWeight: v })} />
        <Row label={`Gem weight: ${(settings.gemWeight * 100).toFixed(0)}%`} min={0} max={1} step={0.05} value={settings.gemWeight} onChange={(v) => onChange({ gemWeight: v })} />
      </div>
    </SheetContent>
  </Sheet>
);

const Row = ({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number }) => (
  <div>
    <Label className="mb-2 block">{label}</Label>
    <Slider min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0])} />
  </div>
);
