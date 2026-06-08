import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon } from "lucide-react";
import { FactorDifficulty } from "@/lib/factors";

export interface FactorSettings {
  roundSec: number;
  startingLives: number;
  difficulty: FactorDifficulty;
}

export const DEFAULT_FACTOR_SETTINGS: FactorSettings = {
  roundSec: 90,
  startingLives: 5,
  difficulty: "easy",
};

interface Props {
  settings: FactorSettings;
  onChange: (patch: Partial<FactorSettings>) => void;
}

export const FactorSettingsPanel = ({ settings, onChange }: Props) => (
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
          <Label className="mb-2 block">Round time: {Math.round(settings.roundSec / 60 * 10) / 10} min</Label>
          <Slider min={30} max={360} step={30} value={[settings.roundSec]} onValueChange={(v) => onChange({ roundSec: v[0] })} />
        </div>
        <div>
          <Label className="mb-2 block">Difficulty</Label>
          <Select value={settings.difficulty} onValueChange={(v) => onChange({ difficulty: v as FactorDifficulty })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy (6–20)</SelectItem>
              <SelectItem value="medium">Medium (21–40)</SelectItem>
              <SelectItem value="hard">Hard (41–100)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block">Starting lives: {settings.startingLives}</Label>
          <Slider min={1} max={9} step={1} value={[settings.startingLives]} onValueChange={(v) => onChange({ startingLives: v[0] })} />
        </div>
      </div>
    </SheetContent>
  </Sheet>
);
