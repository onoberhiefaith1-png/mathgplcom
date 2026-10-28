import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon } from "lucide-react";
import { Settings } from "@/hooks/useTallyGame";
import { SPEED_OPTIONS } from "@/data/tallyAssets";

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

export const SettingsPanel = ({ settings, onChange }: Props) => (
  <div className="flex items-center gap-2">
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
            <Label>Edge-to-edge time</Label>
            <Select
              value={String(settings.durationSec)}
              onValueChange={(v) => onChange({ durationSec: Number(v) })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEED_OPTIONS.map((o) => (
                  <SelectItem key={o.seconds} value={String(o.seconds)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SliderRow
            label={`Spawn stagger: ${settings.spawnStaggerSec.toFixed(1)}s`}
            min={0.5}
            max={4}
            step={0.1}
            value={settings.spawnStaggerSec}
            onChange={(v) => onChange({ spawnStaggerSec: v })}
          />
          <SliderRow
            label={`Max active rows: ${settings.maxRows}`}
            min={1}
            max={5}
            step={1}
            value={settings.maxRows}
            onChange={(v) => onChange({ maxRows: v })}
          />
          <SliderRow
            label={`Miss limit: ${settings.missLimit}`}
            min={1}
            max={10}
            step={1}
            value={settings.missLimit}
            onChange={(v) => onChange({ missLimit: v })}
          />
          <SliderRow
            label={`Bomb frequency: ${(settings.bombFreq * 100).toFixed(0)}%`}
            min={0}
            max={0.25}
            step={0.01}
            value={settings.bombFreq}
            onChange={(v) => onChange({ bombFreq: v })}
          />
          <SliderRow
            label={`Coin weight: ${(settings.coinWeight * 100).toFixed(0)}%`}
            min={0}
            max={1}
            step={0.05}
            value={settings.coinWeight}
            onChange={(v) => onChange({ coinWeight: v })}
          />
          <SliderRow
            label={`Heart weight: ${(settings.heartWeight * 100).toFixed(0)}%`}
            min={0}
            max={0.5}
            step={0.025}
            value={settings.heartWeight}
            onChange={(v) => onChange({ heartWeight: v })}
          />
          <SliderRow
            label={`Diamond weight: ${(settings.diamondWeight * 100).toFixed(0)}%`}
            min={0}
            max={0.5}
            step={0.025}
            value={settings.diamondWeight}
            onChange={(v) => onChange({ diamondWeight: v })}
          />
          <SliderRow
            label={`Number range: ${settings.minVal}–${settings.maxVal}`}
            min={5}
            max={60}
            step={1}
            value={settings.maxVal}
            onChange={(v) => onChange({ maxVal: Math.max(settings.minVal + 1, v) })}
          />
        </div>
      </SheetContent>
    </Sheet>
  </div>
);

const SliderRow = ({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) => (
  <div>
    <Label className="mb-2 block">{label}</Label>
    <Slider min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0])} />
  </div>
);
