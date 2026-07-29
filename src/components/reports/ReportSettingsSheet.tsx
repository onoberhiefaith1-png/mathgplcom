// Report Settings — display-only preferences for the report page.

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ReportSettings } from "./reportTheme";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings: ReportSettings;
  update: <K extends keyof ReportSettings>(key: K, value: ReportSettings[K]) => void;
}

const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <div className="flex gap-2">{children}</div>
  </div>
);

const Opt = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
      active
        ? "border-primary bg-primary/15 text-foreground"
        : "border-border bg-background text-muted-foreground hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

const ReportSettingsSheet = ({ open, onOpenChange, settings, update }: Props) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className="overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Report Settings</SheetTitle>
        <SheetDescription>Display only — nothing here changes scores or data.</SheetDescription>
      </SheetHeader>
      <div className="mt-6 space-y-6">
        <Group label="Background">
          <Opt active={settings.background === "white"} onClick={() => update("background", "white")}>
            White (Default)
          </Opt>
          <Opt active={settings.background === "dark"} onClick={() => update("background", "dark")}>
            Dark
          </Opt>
        </Group>
        <Group label="Grid lines">
          <Opt active={settings.gridLines} onClick={() => update("gridLines", true)}>Show</Opt>
          <Opt active={!settings.gridLines} onClick={() => update("gridLines", false)}>Hide</Opt>
        </Group>
        <Group label="Animations">
          <Opt active={settings.animations} onClick={() => update("animations", true)}>On</Opt>
          <Opt active={!settings.animations} onClick={() => update("animations", false)}>Off</Opt>
        </Group>
        <Group label="Bar labels">
          <Opt active={settings.barLabels} onClick={() => update("barLabels", true)}>Show percentages</Opt>
          <Opt active={!settings.barLabels} onClick={() => update("barLabels", false)}>Hide</Opt>
        </Group>
      </div>
    </SheetContent>
  </Sheet>
);

export default ReportSettingsSheet;
