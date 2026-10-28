// Report Settings — display-only preferences for the report page.

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TREND_SWATCHES, type ReportSettings, type TrendColors } from "./reportTheme";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings: ReportSettings;
  update: <K extends keyof ReportSettings>(key: K, value: ReportSettings[K]) => void;
  updateTrendColor: (key: keyof TrendColors, value: string) => void;
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

const Swatches = ({
  label,
  which,
  settings,
  updateTrendColor,
}: {
  label: string;
  which: keyof TrendColors;
  settings: ReportSettings;
  updateTrendColor: (key: keyof TrendColors, value: string) => void;
}) => (
  <div className="space-y-2">
    <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
    <div className="flex flex-wrap gap-2">
      {TREND_SWATCHES[which].map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`${label}: ${c}`}
          aria-pressed={settings.trend[which] === c}
          onClick={() => updateTrendColor(which, c)}
          className={`h-7 w-7 rounded-full border-2 transition ${
            settings.trend[which] === c ? "border-foreground scale-110" : "border-border"
          }`}
          style={{ background: c }}
        />
      ))}
    </div>
  </div>
);

const ReportSettingsSheet = ({ open, onOpenChange, settings, update, updateTrendColor }: Props) => (
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

        <div className="space-y-4 rounded-xl border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trend chart</p>
          <Group label="Show trend chart">
            <Opt active={settings.showTrend} onClick={() => update("showTrend", true)}>Show</Opt>
            <Opt active={!settings.showTrend} onClick={() => update("showTrend", false)}>Hide</Opt>
          </Group>
          <Group label="Grouping">
            <Opt active={settings.trendGrouping === "week"} onClick={() => update("trendGrouping", "week")}>Weekly</Opt>
            <Opt active={settings.trendGrouping === "month"} onClick={() => update("trendGrouping", "month")}>Monthly</Opt>
            <Opt active={settings.trendGrouping === "year"} onClick={() => update("trendGrouping", "year")}>Yearly</Opt>
          </Group>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trend colours</p>
            <Swatches label="Activity line" which="activity" settings={settings} updateTrendColor={updateTrendColor} />
            <Swatches label="No activity line" which="inactive" settings={settings} updateTrendColor={updateTrendColor} />
            <Swatches label="Area fill" which="fill" settings={settings} updateTrendColor={updateTrendColor} />
            <Swatches label="Grid lines" which="grid" settings={settings} updateTrendColor={updateTrendColor} />
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
);

export default ReportSettingsSheet;
