import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon } from "lucide-react";
import { DivDifficulty } from "@/lib/division";

export interface DivSettings {
  roundSec: number;
  startingLives: number;
  difficulty: DivDifficulty;
  sound: boolean;
  showHelper: boolean;
}

export const DEFAULT_DIV_SETTINGS: DivSettings = {
  roundSec: 150,
  startingLives: 5,
  difficulty: "easy",
  sound: true,
  showHelper: true,
};

interface Props {
  settings: DivSettings;
  onChange: (patch: Partial<DivSettings>) => void;
}

export const DivSettingsPanel = ({ settings, onChange }: Props) => (
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
              <SelectItem value="90">1.5 minutes</SelectItem>
              <SelectItem value="150">2.5 minutes</SelectItem>
              <SelectItem value="240">4 minutes</SelectItem>
              <SelectItem value="360">6 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block">Difficulty</Label>
          <Select value={settings.difficulty} onValueChange={(v) => onChange({ difficulty: v as DivDifficulty })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy (2÷1, no remainder)</SelectItem>
              <SelectItem value="medium">Medium (3÷1)</SelectItem>
              <SelectItem value="hard">Hard (4÷1)</SelectItem>
              <SelectItem value="expert">Expert (5÷2)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <Label>Visual grouping helper</Label>
          <Switch checked={settings.showHelper} onCheckedChange={(v) => onChange({ showHelper: v })} />
        </div>
        <div>
          <Label className="mb-2 block">Starting lives: {settings.startingLives}</Label>
          <Slider min={1} max={9} step={1} value={[settings.startingLives]} onValueChange={(v) => onChange({ startingLives: v[0] })} />
        </div>
      </div>
    </SheetContent>
  </Sheet>
);
