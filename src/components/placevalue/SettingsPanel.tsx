import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon } from "lucide-react";
import { Difficulty } from "@/lib/placeValue";
import { RewardKind, REWARD_KINDS, RewardWeights, REWARD_META } from "@/lib/placeValueRewards";

export interface PVSettings {
  roundSec: number;
  startingLives: number;
  difficulty: Difficulty;
  numbersPerRound: number;
  weights: RewardWeights;
  sound: boolean;
}

export const DEFAULT_PV_SETTINGS: PVSettings = {
  roundSec: 60,
  startingLives: 5,
  difficulty: "easy",
  numbersPerRound: 5,
  weights: { coin: 0.8, crown: 0.07, heart: 0.07, diamond: 0.06, star: 0, key: 0 },
  sound: true,
};

interface Props {
  settings: PVSettings;
  onChange: (patch: Partial<PVSettings>) => void;
}

export const PVSettingsPanel = ({ settings, onChange }: Props) => (
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="outline" size="icon" aria-label="Settings">
        <SettingsIcon className="h-4 w-4" />
      </Button>
    </SheetTrigger>
    <SheetContent className="overflow-y-auto">
      <SheetHeader><SheetTitle>Game Settings</SheetTitle></SheetHeader>
      <div className="mt-6 space-y-5">
        <div>
          <Label className="mb-2 block">Round time</Label>
          <Select value={String(settings.roundSec)} onValueChange={(v) => onChange({ roundSec: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="60">1 minute</SelectItem>
              <SelectItem value="120">2 minutes</SelectItem>
              <SelectItem value="180">3 minutes</SelectItem>
              <SelectItem value="240">4 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block">Difficulty</Label>
          <Select value={settings.difficulty} onValueChange={(v) => onChange({ difficulty: v as Difficulty })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy (Tens & Units)</SelectItem>
              <SelectItem value="medium">Medium (+ Hundreds)</SelectItem>
              <SelectItem value="hard">Hard (+ Thousands)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block">Numbers per round: {settings.numbersPerRound}</Label>
          <Slider min={3} max={6} step={1} value={[settings.numbersPerRound]} onValueChange={(v) => onChange({ numbersPerRound: v[0] })} />
        </div>
        <div>
          <Label className="mb-2 block">Starting lives: {settings.startingLives}</Label>
          <Slider min={1} max={9} step={1} value={[settings.startingLives]} onValueChange={(v) => onChange({ startingLives: v[0] })} />
        </div>
        <div className="space-y-3 pt-2 border-t">
          <Label className="block">Reward weights</Label>
          {REWARD_KINDS.map((k: RewardKind) => (
            <div key={k}>
              <Label className="mb-1 block text-xs">
                <span className={REWARD_META[k].color}>{REWARD_META[k].label}</span>: {(settings.weights[k] * 100).toFixed(0)}%
              </Label>
              <Slider
                min={0} max={1} step={0.05}
                value={[settings.weights[k]]}
                onValueChange={(v) => onChange({ weights: { ...settings.weights, [k]: v[0] } })}
              />
            </div>
          ))}
        </div>
      </div>
    </SheetContent>
  </Sheet>
);
