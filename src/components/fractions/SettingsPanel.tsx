import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon } from "lucide-react";
import { FractionDifficulty } from "@/lib/fractions";

export interface FractionSettings {
  difficulty: FractionDifficulty;
  travelSec: number;
  rampSec: number;
  initialActiveRows: number;
  missLimit: number;
}

interface Props {
  settings: FractionSettings;
  onChange: (patch: Partial<FractionSettings>) => void;
}

export const FractionSettingsPanel = ({ settings, onChange }: Props) => (
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="outline" size="icon" aria-label="Settings">
        <SettingsIcon className="h-4 w-4" />
      </Button>
    </SheetTrigger>
    <SheetContent className="overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Game Settings</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-5">
        <div>
          <Label className="mb-2 block">Difficulty</Label>
          <Select
            value={settings.difficulty}
            onValueChange={(v) => onChange({ difficulty: v as FractionDifficulty })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block">Edge-to-edge time: {settings.travelSec}s</Label>
          <Slider
            min={15} max={180} step={1}
            value={[settings.travelSec]}
            onValueChange={(v) => onChange({ travelSec: v[0] })}
          />
        </div>
        <div>
          <Label className="mb-2 block">Lane ramp: every {settings.rampSec}s</Label>
          <Slider
            min={4} max={30} step={1}
            value={[settings.rampSec]}
            onValueChange={(v) => onChange({ rampSec: v[0] })}
          />
        </div>
        <div>
          <Label className="mb-2 block">Starting active lanes: {settings.initialActiveRows}</Label>
          <Slider
            min={1} max={5} step={1}
            value={[settings.initialActiveRows]}
            onValueChange={(v) => onChange({ initialActiveRows: v[0] })}
          />
        </div>
        <div>
          <Label className="mb-2 block">Starting lives: {settings.missLimit}</Label>
          <Slider
            min={1} max={9} step={1}
            value={[settings.missLimit]}
            onValueChange={(v) => onChange({ missLimit: v[0] })}
          />
        </div>
      </div>
    </SheetContent>
  </Sheet>
);
