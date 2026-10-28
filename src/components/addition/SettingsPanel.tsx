import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon } from "lucide-react";
import { AddDifficulty } from "@/lib/addition";

export interface AddSettings {
  roundSec: number;
  startingLives: number;
  difficulty: AddDifficulty;
  sound: boolean;
}

export const DEFAULT_ADD_SETTINGS: AddSettings = {
  roundSec: 60,
  startingLives: 5,
  difficulty: "easy",
  sound: true,
};

interface Props {
  settings: AddSettings;
  onChange: (patch: Partial<AddSettings>) => void;
}

export const AddSettingsPanel = ({ settings, onChange }: Props) => (
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
          <Select value={settings.difficulty} onValueChange={(v) => onChange({ difficulty: v as AddDifficulty })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy (2-digit)</SelectItem>
              <SelectItem value="medium">Medium (3-digit)</SelectItem>
              <SelectItem value="hard">Hard (4-digit)</SelectItem>
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
