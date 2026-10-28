import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon } from "lucide-react";
import { PFDifficulty } from "@/lib/primeFactors";

export interface PFSettings {
  roundSec: number;
  startingLives: number;
  difficulty: PFDifficulty;
  sound: boolean;
  showHints: boolean;
}

export const DEFAULT_PF_SETTINGS: PFSettings = {
  roundSec: 240,
  startingLives: 5,
  difficulty: "easy",
  sound: true,
  showHints: true,
};

interface Props {
  settings: PFSettings;
  onChange: (patch: Partial<PFSettings>) => void;
}

export const PFSettingsPanel = ({ settings, onChange }: Props) => (
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="outline" size="icon" aria-label="Settings">
        <SettingsIcon className="h-4 w-4" />
      </Button>
    </SheetTrigger>
    <SheetContent className="overflow-y-auto">
      <SheetHeader><SheetTitle>Prime Factors Lab Settings</SheetTitle></SheetHeader>
      <div className="mt-6 space-y-5">
        <div>
          <Label className="mb-2 block">Round time: {Math.round((settings.roundSec / 60) * 10) / 10} min</Label>
          <Slider min={60} max={600} step={30} value={[settings.roundSec]} onValueChange={(v) => onChange({ roundSec: v[0] })} />
        </div>
        <div>
          <Label className="mb-2 block">Difficulty</Label>
          <Select value={settings.difficulty} onValueChange={(v) => onChange({ difficulty: v as PFDifficulty })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy (20–50)</SelectItem>
              <SelectItem value="medium">Medium (51–200)</SelectItem>
              <SelectItem value="hard">Hard (201–1000)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block">Starting lives: {settings.startingLives}</Label>
          <Slider min={1} max={9} step={1} value={[settings.startingLives]} onValueChange={(v) => onChange({ startingLives: v[0] })} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="pf-hints">Show prime hints</Label>
          <Switch id="pf-hints" checked={settings.showHints} onCheckedChange={(b) => onChange({ showHints: b })} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="pf-sfx">Sound effects</Label>
          <Switch id="pf-sfx" checked={settings.sound} onCheckedChange={(b) => onChange({ sound: b })} />
        </div>
      </div>
    </SheetContent>
  </Sheet>
);
