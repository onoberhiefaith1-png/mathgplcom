import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  ListChecks,
  RotateCcw,
  SkipForward,
  Trash2,
  Upload,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SignedMedia from "./SignedMedia";
import { listGameAssets, renderPathOf } from "@/lib/games/assets";
import { detectMediaBackground } from "@/lib/games/removeBackground";
import { getSignedUrl } from "@/lib/games/urls";
import { PROGRESS_PRESETS } from "@/lib/games/progressPresets";
import { LIQUID_STYLES, DEFAULT_LIQUID_STYLE } from "@/lib/games/liquidStyles";
import { TIME_BAR_LABEL, TIME_DURATION_OPTIONS, roleOf } from "@/lib/games/types";
import { cn } from "@/lib/utils";
import type {
  AnimationType,
  BlendMode,
  CanvasElement,
  GameAssetRow,
  MotionTrigger,
  ProgressFillStyle,
  SlantAxisDir,
  TiltDir,
} from "@/lib/games/types";
import { defaultSlant } from "@/lib/games/types";

interface SettingsPanelProps {
  element: CanvasElement | null;
  onChange: (patch: Partial<CanvasElement>) => void;
  onDelete: () => void;
  onLayer: (dir: "front" | "back" | "forward" | "backward") => void;
  onDuplicate?: () => void;
  onOpenEnergyPicker?: () => void;
  energyRefreshKey?: number;
  onOpenQuestions?: (element: CanvasElement) => void;
}

const ANIM_OPTIONS: { value: AnimationType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "float", label: "Float up/down" },
  { value: "sway", label: "Sway left/right" },
  { value: "pulse", label: "Pulse" },
  { value: "travel", label: "Travel end to end" },
];

const BLEND_OPTIONS: { value: BlendMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "screen", label: "Screen" },
  { value: "add", label: "Add (glow)" },
  { value: "lighten", label: "Lighten" },
  { value: "multiply", label: "Multiply" },
];

const TRIGGERS: { value: MotionTrigger; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "on-enter", label: "On enter" },
  { value: "loop", label: "Loop" },
];

const LEAN_DIRECTIONS: { value: SlantAxisDir; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

const SLIDE_DIRECTIONS: { value: SlantAxisDir; label: string }[] = [
  { value: "left", label: "Slide Left" },
  { value: "right", label: "Slide Right" },
];

const TILT_DIRECTIONS: { value: TiltDir; label: string }[] = [
  { value: "in", label: "In" },
  { value: "out", label: "Out" },
];

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3 rounded-xl border border-border/40 bg-muted/20 p-3">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/90">{title}</p>
    {children}
  </div>
);

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const PresetRow = ({
  values,
  active,
  onPick,
  suffix = "",
}: {
  values: number[];
  active: number;
  onPick: (v: number) => void;
  suffix?: string;
}) => (
  <div className="flex flex-wrap gap-1.5">
    {values.map((v) => (
      <button
        key={v}
        type="button"
        onClick={() => onPick(v)}
        className={cn(
          "rounded-md border px-2.5 py-1 text-xs transition",
          active === v
            ? "border-primary bg-primary/20 text-foreground"
            : "border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground",
        )}
      >
        {v}
        {suffix}
      </button>
    ))}
  </div>
);

const SettingsPanel = ({
  element,
  onChange,
  onDelete,
  onLayer,
  onDuplicate,
  onOpenEnergyPicker,
  energyRefreshKey,
  onOpenQuestions,
}: SettingsPanelProps) => {
  const [effects, setEffects] = useState<GameAssetRow[]>([]);

  useEffect(() => {
    if (element?.kind === "progress_bar") {
      listGameAssets("effect").then(setEffects).catch(console.error);
    }
  }, [element?.kind, element?.id, energyRefreshKey]);

  if (!element) {
    return (
      <p className="px-1 py-8 text-center text-xs text-muted-foreground">
        Select an item on the stage to edit its transform, layer, blend and motion.
      </p>
    );
  }

  const isBackground = element.kind === "background";
  const isVideo = element.mediaType === "video";
  const progress = element.progress;
  // The Time Progress Bar is system-owned: appearance and duration only.
  const isTimeBar = element.kind === "progress_bar" && roleOf(element) === "time";
  const barType = progress?.barType ?? "segmented";
  const anim = element.animation;
  const slant = element.slant ?? defaultSlant();
  const patchSlant = (p: Partial<NonNullable<CanvasElement["slant"]>>) =>
    onChange({ slant: { ...slant, ...p } });

  const patchProgress = (p: Partial<NonNullable<CanvasElement["progress"]>>) =>
    onChange({ progress: { ...(progress as NonNullable<CanvasElement["progress"]>), ...p } });
  const patchAnim = (p: Partial<CanvasElement["animation"]>) =>
    onChange({ animation: { ...anim, ...p } });

  const marksPerSlot = progress
    ? Math.max(1, Math.round(progress.totalMarks / Math.max(1, progress.segments)))
    : 0;
  const litSlots = progress
    ? Math.min(
        progress.segments,
        Math.floor((progress.currentMarks / Math.max(1, progress.totalMarks)) * progress.segments + 1e-6),
      )
    : 0;

  const setSlotEffect = (slotIdx: number, value: string) => {
    if (!progress) return;
    const slotEffects = { ...(progress.slotEffects ?? {}) };
    if (value === "default") {
      delete slotEffects[slotIdx];
    } else if (value === "plain") {
      slotEffects[slotIdx] = {
        fill: "plain",
        plainColor: progress.slotEffects?.[slotIdx]?.plainColor ?? progress.plainColor ?? "#8a5cff",
      };
    } else {
      const fx = effects.find((e) => e.id === value);
      if (!fx) return;
      slotEffects[slotIdx] = {
        effectAssetId: fx.id,
        effectStoragePath: renderPathOf(fx),
        effectMediaType: fx.media_type,
        effectSource: "storage",
      };
    }
    patchProgress({ slotEffects });
  };

  const setSlotPlainColor = (slotIdx: number, color: string) => {
    if (!progress) return;
    const slotEffects = { ...(progress.slotEffects ?? {}) };
    slotEffects[slotIdx] = { ...slotEffects[slotIdx], fill: "plain", plainColor: color };
    patchProgress({ slotEffects });
  };

  const rescanBackground = async () => {
    if (!element) return;
    const url =
      element.source === "url"
        ? element.storagePath
        : await getSignedUrl(element.storagePath);
    if (!url) return;
    const det = await detectMediaBackground(url, "video");
    onChange({ keyColor: det.color });
  };

  return (
    <div className="space-y-4 px-1 pb-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          {element.label || element.kind.replace("_", " ")}
        </span>
        <div className="flex gap-1">
          {!isBackground && !isTimeBar && onDuplicate && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDuplicate} title="Duplicate">
              <Copy className="h-4 w-4" />
            </Button>
          )}
          {!isTimeBar && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete} title="Remove">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isBackground ? (
        <p className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
          The background fills the whole scene. Swap it from the Background button in the toolbar.
        </p>
      ) : (
        <>
          <Section title="Transform">
            <div className="grid grid-cols-2 gap-2">
              <Row label="X (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(element.x * 100)}
                  onChange={(e) => onChange({ x: Math.min(1, Math.max(0, Number(e.target.value) / 100)) })}
                  className="h-8"
                />
              </Row>
              <Row label="Y (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(element.y * 100)}
                  onChange={(e) => onChange({ y: Math.min(1, Math.max(0, Number(e.target.value) / 100)) })}
                  className="h-8"
                />
              </Row>
            </div>
            <Row label={`Width (${Math.round(element.scale * 100)}%)`}>
              <Slider min={5} max={100} step={1} value={[element.scale * 100]} onValueChange={([v]) => onChange({ scale: v / 100 })} />
            </Row>
            <Row label="Scale presets">
              <PresetRow values={[50, 100, 150, 200, 300]} active={Math.round(element.scale * 100)} onPick={(v) => onChange({ scale: Math.min(1, v / 100) })} suffix="%" />
            </Row>
            <Row label={`Rotate (${element.rotation}°)`}>
              <PresetRow values={[0, 90, 180, 270]} active={((element.rotation % 360) + 360) % 360} onPick={(v) => onChange({ rotation: v })} suffix="°" />
            </Row>
            <Row label={`Opacity (${Math.round(element.opacity * 100)}%)`}>
              <Slider min={10} max={100} step={1} value={[element.opacity * 100]} onValueChange={([v]) => onChange({ opacity: v / 100 })} />
            </Row>
          </Section>

          <Section title="Layer & Blend">
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={() => onLayer("front")}><ChevronsUp className="mr-1.5 h-3.5 w-3.5" /> To Front</Button>
              <Button size="sm" variant="secondary" onClick={() => onLayer("forward")}><ArrowUp className="mr-1.5 h-3.5 w-3.5" /> Forward</Button>
              <Button size="sm" variant="secondary" onClick={() => onLayer("backward")}><ArrowDown className="mr-1.5 h-3.5 w-3.5" /> Backward</Button>
              <Button size="sm" variant="secondary" onClick={() => onLayer("back")}><ChevronsDown className="mr-1.5 h-3.5 w-3.5" /> To Back</Button>
            </div>
            <Row label="Blend mode">
              <Select value={element.blend ?? "normal"} onValueChange={(v) => onChange({ blend: v as BlendMode })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLEND_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </Row>
            {isVideo && (
              <div className="space-y-2 rounded-lg border border-border/40 bg-muted/10 p-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs text-muted-foreground">Remove background</Label>
                    <p className="text-[10px] text-muted-foreground/70">Keys out the backdrop so the clip blends into the scene.</p>
                  </div>
                  <Switch checked={element.bgRemoval === "chroma"} onCheckedChange={(c) => onChange({ bgRemoval: c ? "chroma" : "none" })} />
                </div>
                {element.bgRemoval === "chroma" && (
                  <>
                    <Row label={`Tolerance (${Math.round((element.keyTolerance ?? 0.12) * 100)}%)`}>
                      <Slider min={2} max={60} step={1} value={[(element.keyTolerance ?? 0.12) * 100]} onValueChange={([v]) => onChange({ keyTolerance: v / 100 })} />
                    </Row>
                    <Button size="sm" variant="secondary" className="w-full" onClick={rescanBackground}>Re-scan background</Button>
                  </>
                )}
              </div>
            )}
          </Section>

          <Section title="Motion">
            <Row label="Movement">
              <Select value={anim.type} onValueChange={(v) => patchAnim({ type: v as AnimationType })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANIM_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </Row>
            {anim.type !== "none" && (
              <>
                <Row label={`Distance (${Math.round(anim.amplitude * 100)}%)`}>
                  <Slider min={1} max={40} step={1} value={[anim.amplitude * 100]} onValueChange={([v]) => patchAnim({ amplitude: v / 100 })} />
                </Row>
                <Row label={`Speed (${anim.speed}s per cycle)`}>
                  <Slider min={0.5} max={12} step={0.5} value={[anim.speed]} onValueChange={([v]) => patchAnim({ speed: v })} />
                </Row>
                <Row label={`Start delay (${anim.delay ?? 0}s)`}>
                  <Slider min={0} max={8} step={0.5} value={[anim.delay ?? 0]} onValueChange={([v]) => patchAnim({ delay: v })} />
                </Row>
                <Row label="Trigger">
                  <div className="flex gap-1.5">
                    {TRIGGERS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => patchAnim({ trigger: t.value, loop: t.value === "loop" ? true : anim.loop })}
                        className={cn(
                          "flex-1 rounded-md border px-2 py-1 text-xs transition",
                          (anim.trigger ?? "auto") === t.value
                            ? "border-primary bg-primary/20 text-foreground"
                            : "border-border/50 text-muted-foreground hover:border-primary/50",
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </Row>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Loop forever</Label>
                  <Switch checked={anim.loop} onCheckedChange={(c) => patchAnim({ loop: c })} />
                </div>
              </>
            )}
            <Row label={`Fade in (${anim.fadeIn ?? 0}s)`}>
              <Slider min={0} max={5} step={0.5} value={[anim.fadeIn ?? 0]} onValueChange={([v]) => patchAnim({ fadeIn: v })} />
            </Row>
          </Section>

          <Section title="Slant">
            <p className="text-[11px] text-muted-foreground">
              Lean the asset to match the background. The base stays fixed while the top leans. Each axis is independent — combine them freely.
            </p>
            <Row label="Lean">
              <div className="flex flex-wrap gap-1.5">
                {LEAN_DIRECTIONS.map((d) => (
                  <button key={d.value} type="button" onClick={() => patchSlant({ lean: { ...slant.lean, dir: d.value } })}
                    className={cn("rounded-md border px-2.5 py-1 text-xs transition", slant.lean.dir === d.value ? "border-primary bg-primary/20 text-foreground" : "border-border/50 text-muted-foreground hover:border-primary/50")}>{d.label}</button>
                ))}
              </div>
            </Row>
            <Row label={`Lean amount (${Math.round(slant.lean.amount * 100)}%)`}>
              <Slider min={0} max={100} step={1} value={[slant.lean.amount * 100]} onValueChange={([v]) => patchSlant({ lean: { ...slant.lean, amount: v / 100 } })} />
            </Row>
            <Row label="Slide">
              <div className="flex flex-wrap gap-1.5">
                {SLIDE_DIRECTIONS.map((d) => (
                  <button key={d.value} type="button" onClick={() => patchSlant({ slide: { ...slant.slide, dir: d.value } })}
                    className={cn("rounded-md border px-2.5 py-1 text-xs transition", slant.slide.dir === d.value ? "border-primary bg-primary/20 text-foreground" : "border-border/50 text-muted-foreground hover:border-primary/50")}>{d.label}</button>
                ))}
              </div>
            </Row>
            <Row label={`Slide amount (${Math.round(slant.slide.amount * 100)}%)`}>
              <Slider min={0} max={100} step={1} value={[slant.slide.amount * 100]} onValueChange={([v]) => patchSlant({ slide: { ...slant.slide, amount: v / 100 } })} />
            </Row>
            <Row label="In / Out">
              <div className="flex flex-wrap gap-1.5">
                {TILT_DIRECTIONS.map((d) => (
                  <button key={d.value} type="button" onClick={() => patchSlant({ tilt: { ...slant.tilt, dir: d.value } })}
                    className={cn("rounded-md border px-2.5 py-1 text-xs transition", slant.tilt.dir === d.value ? "border-primary bg-primary/20 text-foreground" : "border-border/50 text-muted-foreground hover:border-primary/50")}>{d.label}</button>
                ))}
              </div>
            </Row>
            <Row label={`In / Out amount (${Math.round(slant.tilt.amount * 100)}%)`}>
              <Slider min={0} max={100} step={1} value={[slant.tilt.amount * 100]} onValueChange={([v]) => patchSlant({ tilt: { ...slant.tilt, amount: v / 100 } })} />
            </Row>
          </Section>
        </>
      )}

      {element.kind === "progress_bar" && progress && (
        <>
          {isTimeBar ? (
            <>
              <Section title="Name">
                <p className="rounded-md border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground">
                  {TIME_BAR_LABEL} — this bar always represents time. Its name, questions and scoring are fixed;
                  you can restyle it and set its duration.
                </p>
              </Section>

              <Section title="Time Duration">
                <Select
                  value={String(progress.timeDurationSeconds ?? 0)}
                  onValueChange={(v) => patchProgress({ timeDurationSeconds: Number(v) })}
                >
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_DURATION_OPTIONS.map((o) => (
                      <SelectItem key={o.seconds} value={String(o.seconds)}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  No Time hides the timer completely — students keep solving until the Progress Bar is full.
                  A Video Adventure needs a duration on every Learning Point.
                </p>
              </Section>
            </>
          ) : (
          <>
          <Section title="Name">
            <Input
              value={element.label ?? ""}
              placeholder="Progress Bar"
              onChange={(e) => onChange({ label: e.target.value })}
              className="h-8"
            />
            <p className="text-[11px] text-muted-foreground">
              This name appears everywhere this bar is used — groups, course assignment and reports.
            </p>
          </Section>


          <Section title="Questions">
            <p className="text-[11px] text-muted-foreground">
              The progress bar holds this game's questions. Students solve them on the whiteboard and every correct line charges the tower.
            </p>
            <Button size="sm" className="w-full" onClick={() => onOpenQuestions?.(element)}>
              <ListChecks className="mr-1.5 h-3.5 w-3.5" />
              {progress.questionNotebookId ? "Edit Questions" : "Add Questions"}
            </Button>
          </Section>
          </>
          )}

          <Section title="Progress Bar Type">
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "liquid" as const, label: "Liquid Fill" },
                { id: "segmented" as const, label: "Segmented / 10-Slot" },
              ]).map((t) => {
                const active = barType === t.id;
                return (
                  <button key={t.id} type="button"
                    onClick={() => patchProgress(t.id === "liquid"
                      ? { barType: "liquid", liquidStyleId: progress.liquidStyleId ?? DEFAULT_LIQUID_STYLE }
                      : { barType: "segmented" })}
                    className={cn("rounded-md border px-2 py-2 text-xs transition", active ? "border-primary bg-primary/20 text-foreground" : "border-border/50 text-muted-foreground hover:border-primary/50")}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Style">
            {barType === "liquid" ? (
              <div className="grid grid-cols-3 gap-2">
                {LIQUID_STYLES.map((s) => {
                  const active = (progress.liquidStyleId ?? DEFAULT_LIQUID_STYLE) === s.id;
                  return (
                    <button key={s.id} type="button" onClick={() => patchProgress({ liquidStyleId: s.id })}
                      className={cn("overflow-hidden rounded-md border bg-black/40 p-1", active ? "border-primary ring-2 ring-primary/50" : "border-border/50")}
                      title={s.name}>
                      <img src={s.image} alt={s.name} loading="lazy" className="mx-auto h-20 w-auto object-contain" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {PROGRESS_PRESETS.map((p) => {
                    const active = progress.presetId === p.id;
                    return (
                      <button key={p.id} type="button" onClick={() => patchProgress({ presetId: p.id })}
                        className={cn("overflow-hidden rounded-md border bg-black/40 p-1", active ? "border-primary ring-2 ring-primary/50" : "border-border/50")}
                        title={p.name}>
                        <img src={p.image} alt={p.name} loading="lazy" className="mx-auto h-20 w-auto object-contain" />
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={() => patchProgress({ presetId: undefined })}
                  className={cn("w-full rounded-md border px-2 py-1.5 text-xs transition", !progress.presetId ? "border-primary bg-primary/20 text-foreground" : "border-border/50 text-muted-foreground hover:border-primary/50")}>
                  Use my uploaded frame
                </button>
              </>
            )}
          </Section>

          {!isTimeBar && (
          <Section title="Scoring">
            <Row label={barType === "liquid" ? "Marks to pass (fills the vessel)" : "Marks to pass (charges the full tower)"}>
              <Input type="number" min={1} value={progress.totalMarks}
                onChange={(e) => patchProgress({ totalMarks: Math.max(1, Math.round(Number(e.target.value) || 0)) })}
                className="h-8" />
            </Row>
            {barType === "segmented" && (
              <p className="text-[11px] text-muted-foreground">{progress.segments} slots · {marksPerSlot} marks lights each slot</p>
            )}
            <div className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{progress.currentMarks} / {progress.totalMarks} marks</span>
                {barType === "segmented" && (
                  <span className="text-xs font-semibold text-primary">{litSlots} / {progress.segments} lit</span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button size="sm" onClick={() => patchProgress({ currentMarks: Math.min(progress.totalMarks, progress.currentMarks + marksPerSlot) })}>
                  <SkipForward className="mr-1.5 h-3.5 w-3.5" /> Next (+{marksPerSlot})
                </Button>
                <Button size="sm" variant="secondary" onClick={() => patchProgress({ currentMarks: 0 })}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Replay
                </Button>
              </div>
            </div>
            {barType === "segmented" && (
            <Row label={`Slots (${progress.segments})`}>
              <Slider min={2} max={20} step={1} value={[progress.segments]}
                onValueChange={([v]) => patchProgress({ segments: v, currentMarks: Math.min(progress.currentMarks, progress.totalMarks) })} />
            </Row>
            )}
            <Row label={`Glow (${Math.round(progress.glow * 100)}%)`}>
              <Slider min={0} max={100} step={1} value={[progress.glow * 100]} onValueChange={([v]) => patchProgress({ glow: v / 100 })} />
            </Row>
            <Row label={`Class goal (${Math.round(progress.progressGoalPct ?? 100)}% of grand total)`}>
              <div className="flex items-center gap-2">
                <Slider min={10} max={100} step={5}
                  value={[Math.round(progress.progressGoalPct ?? 100)]}
                  onValueChange={([v]) => patchProgress({ progressGoalPct: v })}
                  className="flex-1" />
                <Input type="number" min={10} max={100}
                  value={Math.round(progress.progressGoalPct ?? 100)}
                  onChange={(e) => {
                    const raw = Math.round(Number(e.target.value) || 0);
                    patchProgress({ progressGoalPct: Math.min(100, Math.max(10, raw)) });
                  }}
                  className="h-8 w-16" />
              </div>
            </Row>
            <p className="text-[11px] text-muted-foreground">
              Live class total needed = marks × students × goal%. Lower the goal for a partial-completion challenge.
            </p>
          </Section>
          )}

          <>
          <Section title="Fill style">
            <div className="grid grid-cols-2 gap-2">
              {(["plain", "effect"] as ProgressFillStyle[]).map((s) => (
                <button key={s} type="button" onClick={() => patchProgress({ fillStyle: s })}
                  className={cn("rounded-md border px-2 py-2 text-xs capitalize transition",
                    (progress.fillStyle ?? "plain") === s ? "border-primary bg-primary/20 text-foreground" : "border-border/50 text-muted-foreground hover:border-primary/50")}>
                  {s === "plain" ? "Plain color" : "Energy"}
                </button>
              ))}
            </div>
            {(progress.fillStyle ?? "plain") === "plain" && (
              <Row label="Fill color">
                <div className="flex items-center gap-2">
                  <input type="color" value={progress.plainColor ?? "#8a5cff"} onChange={(e) => patchProgress({ plainColor: e.target.value })}
                    className="h-8 w-12 cursor-pointer rounded-md border border-border/50 bg-transparent" />
                  <Input value={progress.plainColor ?? "#8a5cff"} onChange={(e) => patchProgress({ plainColor: e.target.value })} className="h-8 flex-1" />
                </div>
              </Row>
            )}
            <p className="text-[11px] text-muted-foreground">
              Boxes always fill edge-to-edge with no gaps. Plain paints one solid color; Energy fills each lit slot with your uploaded effect.
            </p>
          </Section>

          <Section title="Energy">
            {onOpenEnergyPicker && (
              <Button size="sm" variant="secondary" className="w-full" onClick={onOpenEnergyPicker}>
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload / choose energy
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground/70">
              A picked energy applies to all {progress.segments} slots by default — override any single slot below.
            </p>
            <Row label={`Effect size (${Math.round((progress.effectScale ?? 1) * 100)}%)`}>
              <Slider min={50} max={250} step={5} value={[(progress.effectScale ?? 1) * 100]} onValueChange={([v]) => patchProgress({ effectScale: v / 100 })} />
            </Row>
            {effects.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No energy yet — tap the button above to upload or choose one.</p>
            ) : (
              <>
                <Row label="Default energy (all slots)">
                  <div className="grid grid-cols-3 gap-2">
                    {effects.map((fx) => {
                      const active = progress.effectAssetId === fx.id;
                      return (
                        <button key={fx.id} type="button" onClick={() => patchProgress({ fillStyle: "effect", effectAssetId: fx.id, effectStoragePath: renderPathOf(fx), effectMediaType: fx.media_type, effectSource: "storage" })}
                          className={cn("overflow-hidden rounded-md border", active ? "border-primary ring-2 ring-primary/50" : "border-border/50")}
                          title={fx.title}>
                          <div className="aspect-square w-full bg-black/40">
                            <SignedMedia path={renderPathOf(fx)} mediaType={fx.media_type} fit="cover" className="h-full w-full" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Row>
                <Row label="Per-slot energy (overrides default)">
                  <div className="space-y-1.5">
                    {Array.from({ length: progress.segments }).map((_, i) => {
                      const slotIdx = progress.segments - 1 - i;
                      const slotFx = progress.slotEffects?.[slotIdx];
                      const isPlain = slotFx?.fill === "plain";
                      const current = isPlain ? "plain" : slotFx?.effectAssetId ?? "default";
                      return (
                        <div key={slotIdx} className="flex items-center gap-2">
                          <span className="w-14 shrink-0 text-[11px] text-muted-foreground">Slot {slotIdx + 1}</span>
                          <Select value={current} onValueChange={(v) => setSlotEffect(slotIdx, v)}>
                            <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Use default</SelectItem>
                              <SelectItem value="plain">Plain color</SelectItem>
                              {effects.map((fx) => (<SelectItem key={fx.id} value={fx.id}>{fx.title}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          {isPlain && (
                            <input type="color" aria-label={`Slot ${slotIdx + 1} color`}
                              value={slotFx?.plainColor ?? progress.plainColor ?? "#8a5cff"}
                              onChange={(e) => setSlotPlainColor(slotIdx, e.target.value)}
                              className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-border/50 bg-transparent" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Row>
              </>
            )}
          </Section>
          </>
        </>
      )}
    </div>
  );
};

export default SettingsPanel;
