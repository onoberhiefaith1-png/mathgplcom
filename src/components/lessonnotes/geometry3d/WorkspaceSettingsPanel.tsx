// Workspace-level settings for the 3D Geometry Workspace. These control the
// world (theme, grid, axes, background, camera), never individual objects.

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, Crosshair } from "lucide-react";
import type { DisplayMode, Scene3DSettings, ThemeMode } from "@/lib/geometry3d/scene3d";

interface Props {
  settings: Scene3DSettings;
  onChange: (patch: Partial<Scene3DSettings>) => void;
  onResetCamera: () => void;
  onSaveCameraAsDefault: () => void;
  defaultZoom: number;
  onDefaultZoom: (v: number) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
      <Separator />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm font-normal">{label}</Label>
      {children}
    </div>
  );
}

export function WorkspaceSettingsPanel({
  settings, onChange, onResetCamera, onSaveCameraAsDefault, defaultZoom, onDefaultZoom,
}: Props) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5">
          <SettingsIcon className="h-4 w-4" /> Settings
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[340px] overflow-y-auto sm:max-w-[340px]">
        <SheetHeader><SheetTitle>Workspace settings</SheetTitle></SheetHeader>

        <div className="mt-6 space-y-5">
          <Section title="Appearance">
            <Row label="Theme">
              <Select value={settings.theme} onValueChange={(v) => onChange({ theme: v as ThemeMode })}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="auto">Automatic</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Default object display">
              <Select
                value={settings.defaultDisplay}
                onValueChange={(v) => onChange({ defaultDisplay: v as DisplayMode })}
              >
                <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wireframe">Wireframe</SelectItem>
                  <SelectItem value="solid">Solid</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </Section>

          <Section title="Grid">
            <Row label="Show grid">
              <Switch checked={settings.showGrid} onCheckedChange={(v) => onChange({ showGrid: v })} />
            </Row>
            <Row label="Grid colour">
              <input
                type="color"
                aria-label="Grid colour"
                value={settings.gridColor}
                onChange={(e) => onChange({ gridColor: e.target.value })}
                className="h-7 w-12 cursor-pointer rounded border border-border bg-transparent"
              />
            </Row>
            <div>
              <Label className="mb-2 block text-sm font-normal">
                Grid opacity: {Math.round(settings.gridOpacity * 100)}%
              </Label>
              <Slider
                min={0} max={1} step={0.05}
                value={[settings.gridOpacity]}
                onValueChange={(v) => onChange({ gridOpacity: v[0] })}
              />
            </div>
          </Section>

          <Section title="Axes">
            <Row label="Show X axis">
              <Switch checked={settings.showAxisX} onCheckedChange={(v) => onChange({ showAxisX: v })} />
            </Row>
            <Row label="Show Y axis">
              <Switch checked={settings.showAxisY} onCheckedChange={(v) => onChange({ showAxisY: v })} />
            </Row>
            <Row label="Show Z axis">
              <Switch checked={settings.showAxisZ} onCheckedChange={(v) => onChange({ showAxisZ: v })} />
            </Row>
            <div>
              <Label className="mb-2 block text-sm font-normal">Axis thickness: {settings.axisThickness}</Label>
              <Slider
                min={1} max={8} step={0.5}
                value={[settings.axisThickness]}
                onValueChange={(v) => onChange({ axisThickness: v[0] })}
              />
            </div>
            <Row label="Axis labels">
              <Switch checked={settings.axisLabels} onCheckedChange={(v) => onChange({ axisLabels: v })} />
            </Row>
          </Section>

          <Section title="Background">
            <Row label="Background colour">
              <input
                type="color"
                aria-label="Background colour"
                value={settings.backgroundColor}
                onChange={(e) => onChange({ backgroundColor: e.target.value })}
                className="h-7 w-12 cursor-pointer rounded border border-border bg-transparent"
              />
            </Row>
            <div>
              <Label className="mb-2 block text-sm font-normal">
                Brightness: {settings.backgroundBrightness.toFixed(2)}×
              </Label>
              <Slider
                min={0.2} max={2} step={0.05}
                value={[settings.backgroundBrightness]}
                onValueChange={(v) => onChange({ backgroundBrightness: v[0] })}
              />
            </div>
          </Section>

          <Section title="Camera">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8 flex-1 gap-1.5" onClick={onResetCamera}>
                <Crosshair className="h-4 w-4" /> Reset camera
              </Button>
              <Button size="sm" variant="outline" className="h-8 flex-1" onClick={onSaveCameraAsDefault}>
                Save current view
              </Button>
            </div>
            <div>
              <Label className="mb-2 block text-sm font-normal">Default zoom: {defaultZoom.toFixed(1)}</Label>
              <Slider min={2} max={20} step={0.5} value={[defaultZoom]} onValueChange={(v) => onDefaultZoom(v[0])} />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Distance of the default camera from the origin. "Save current view" stores the current rotation.
              </p>
            </div>
          </Section>

          <Section title="Workspace">
            <Row label="Show origin">
              <Switch checked={settings.showOrigin} onCheckedChange={(v) => onChange({ showOrigin: v })} />
            </Row>
            <Row label="Coordinate labels">
              <Switch
                checked={settings.coordinateLabels}
                onCheckedChange={(v) => onChange({ coordinateLabels: v })}
              />
            </Row>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default WorkspaceSettingsPanel;
