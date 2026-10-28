import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon } from "lucide-react";
import { PrimeDifficulty } from "@/lib/prime";

export interface PrimeSettings {
  roundSec: number;
  startingLives: number;
  difficulty: PrimeDifficulty;
  sound: boolean;
  animSpeed: "slow" | "normal" | "fast";
}

export const DEFAULT_PRIME_SETTINGS: PrimeSettings = {
  roundSec: 165,
  startingLives: 5,
  difficulty: "easy",
  sound: true,
  animSpeed: "normal",
};

interface Props {
  settings: PrimeSettings;
  onChange: (patch: Partial<PrimeSettings>) => void;
}

export const PrimeSettingsPanel = ({ settings, onChange }: Props) => (
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="outline" size="icon" aria-label="Settings">
        <SettingsIcon className="h-4 w-4" />
      </Button>
    </SheetTrigger>
    <SheetContent className="overflow-y-auto">
      <SheetHeader><SheetTitle>Prime Lab Settings</SheetTitle></SheetHeader>
      <div className="mt-6 space-y-5">
        <div>
          <Label className="mb-2 block">Round time: {Math.round((settings.roundSec / 60) * 10) / 10} min</Label>
          <Slider min={30} max={360} step={30} value={[settings.roundSec]} onValueChange={(v) => onChange({ roundSec: v[0] })} />
        </div>
        <div>
          <Label className="mb-2 block">Difficulty</Label>
          <Select value={settings.difficulty} onValueChange={(v) => onChange({ difficulty: v as PrimeDifficulty })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy (1–20)</SelectItem>
              <SelectItem value="medium">Medium (21–40)</SelectItem>
              <SelectItem value="hard">Hard (41–2000)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block">Starting lives: {settings.startingLives}</Label>
          <Slider min={1} max={9} step={1} value={[settings.startingLives]} onValueChange={(v) => onChange({ startingLives: v[0] })} />
        </div>
        <div>
          <Label className="mb-2 block">Animation speed</Label>
          <Select value={settings.animSpeed} onValueChange={(v) => onChange({ animSpeed: v as PrimeSettings["animSpeed"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="slow">Slow</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="fast">Fast</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="prime-sfx">Sound effects</Label>
          <Switch id="prime-sfx" checked={settings.sound} onCheckedChange={(b) => onChange({ sound: b })} />
        </div>
      </div>
    </SheetContent>
  </Sheet>
);
