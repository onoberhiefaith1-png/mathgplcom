/**
 * BUILDING SETTINGS — the owner's environment panel.
 *
 * Each surface (left wall, right wall, floor, roof) supports a preset design,
 * a solid colour, or an uploaded texture with scale/offset/repeat controls.
 * The door has its own design; lighting and effects are separate sections.
 *
 * Edits update a local draft that flows straight into the live 3D preview;
 * "Save Changes" persists the draft to the database.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Save, Upload } from "lucide-react";
import {
  DEFAULT_ENVIRONMENT,
  EFFECT_OPTIONS,
  type EnvironmentSettings,
  type SurfaceDesign,
  type SurfaceKey,
} from "@/lib/building/types";
import { SURFACE_PRESET_LIST } from "@/lib/building/presets";
import { SURFACE_KEYS, SURFACE_LABEL } from "@/lib/building/textures";

const Section = ({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-border/70 bg-card">
    <button
      type="button"
      onClick={onToggle}
      className="flex min-h-[44px] w-full items-center justify-between px-3 text-sm font-semibold text-foreground"
    >
      {title}
      {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </button>
    {open && <div className="space-y-3 border-t border-border/60 p-3">{children}</div>}
  </div>
);

const SliderField = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) => (
  <label className="block">
    <span className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
      {label}
      <span className="tabular-nums">{Math.round(value * 100) / 100}</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-6 w-full accent-primary"
    />
  </label>
);

const ToggleField = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <label className="flex min-h-[40px] cursor-pointer items-center justify-between gap-2 text-sm text-foreground">
    {label}
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  </label>
);

/** One surface editor: presets + colour + uploaded texture + placement. */
const SurfaceEditor = ({
  title,
  design,
  onChange,
  onUpload,
}: {
  title: string;
  design: SurfaceDesign;
  onChange: (d: SurfaceDesign) => void;
  onUpload: (file: File) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2 rounded-lg border border-border/50 p-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1">
        {SURFACE_PRESET_LIST.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange({ ...design, preset: p.value })}
            className={`min-h-[30px] rounded-full px-2.5 text-[11px] font-semibold ${
              design.preset === p.value
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          Colour
          <input
            type="color"
            value={design.color}
            onChange={(e) => onChange({ ...design, color: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
          />
        </label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <Upload className="h-3.5 w-3.5" />
          {design.texture ? "Replace texture" : "Upload texture"}
        </button>
        {design.texture && (
          <button
            type="button"
            onClick={() => onChange({ ...design, texture: null })}
            className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-destructive"
          >
            Remove
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
      </div>
      <SliderField label="Scale" value={design.scale} min={0.2} max={4} step={0.1} onChange={(v) => onChange({ ...design, scale: v })} />
      <div className="grid grid-cols-2 gap-2">
        <SliderField label="Offset X" value={design.offsetX} min={-2} max={2} step={0.05} onChange={(v) => onChange({ ...design, offsetX: v })} />
        <SliderField label="Offset Y" value={design.offsetY} min={-2} max={2} step={0.05} onChange={(v) => onChange({ ...design, offsetY: v })} />
      </div>
      <ToggleField label="Repeat / tile the texture" checked={design.repeat} onChange={(v) => onChange({ ...design, repeat: v })} />
    </div>
  );
};

export interface BuildingSettingsPanelProps {
  buildingId: string;
  environment: EnvironmentSettings;
  onPreviewChange: (env: EnvironmentSettings) => void;
  onSave: (env: EnvironmentSettings) => Promise<void>;
  onUpload: (surface: string, file: File) => Promise<void>;
}

const BuildingSettingsPanel = ({
  buildingId,
  environment,
  onPreviewChange,
  onSave,
  onUpload,
}: BuildingSettingsPanelProps) => {
  const [draft, setDraft] = useState<EnvironmentSettings>(environment);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    walls: true,
    floor: true,
    roof: false,
    door: false,
    lighting: false,
    effects: false,
  });

  // Re-sync the draft when the building changes (switcher / reload).
  const envKey = JSON.stringify(environment);
  useEffect(() => {
    setDraft(environment);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId, envKey]);

  const apply = (next: EnvironmentSettings) => {
    setDraft(next);
    setDirty(true);
    onPreviewChange(next);
  };

  const surface = (key: SurfaceKey) => draft[key] ?? DEFAULT_ENVIRONMENT[key];
  const setSurface = (key: SurfaceKey, d: SurfaceDesign) => apply({ ...draft, [key]: d });

  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  const upload = async (key: string, file: File) => {
    try {
      await onUpload(key, file);
      // The parent re-resolves textures and calls back with the new path.
    } catch (e: unknown) {
      alert(String((e as Error)?.message ?? e));
    }
  };

  const fieldSections = useMemo(
    () => [
      {
        key: "walls",
        title: "Walls",
        body: (
          <div className="space-y-2">
            <SurfaceEditor
              title="Left wall"
              design={surface("leftWall")}
              onChange={(d) => setSurface("leftWall", d)}
              onUpload={(f) => upload("leftWall", f)}
            />
            <SurfaceEditor
              title="Right wall"
              design={surface("rightWall")}
              onChange={(d) => setSurface("rightWall", d)}
              onUpload={(f) => upload("rightWall", f)}
            />
          </div>
        ),
      },
      {
        key: "floor",
        title: "Floor",
        body: (
          <SurfaceEditor
            title="Floor"
            design={surface("floor")}
            onChange={(d) => setSurface("floor", d)}
            onUpload={(f) => upload("floor", f)}
          />
        ),
      },
      {
        key: "roof",
        title: "Roof / ceiling",
        body: (
          <SurfaceEditor
            title="Roof / ceiling"
            design={surface("roof")}
            onChange={(d) => setSurface("roof", d)}
            onUpload={(f) => upload("roof", f)}
          />
        ),
      },
      {
        key: "door",
        title: "Doors",
        body: (
          <div className="space-y-2 rounded-lg border border-border/50 p-2.5">
            <div className="flex flex-wrap gap-1">
              {SURFACE_PRESET_LIST.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => apply({ ...draft, door: { ...draft.door, preset: p.value } })}
                  className={`min-h-[30px] rounded-full px-2.5 text-[11px] font-semibold ${
                    draft.door.preset === p.value
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                Colour
                <input
                  type="color"
                  value={draft.door.color}
                  onChange={(e) => apply({ ...draft, door: { ...draft.door, color: e.target.value } })}
                  className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
                />
              </label>
              <button
                type="button"
                onClick={() => upload("door", new File([new Blob()], "placeholder"))}
                className="hidden"
              />
              <UploadButton label={draft.door.texture ? "Replace texture" : "Upload texture"} onPick={(f) => upload("door", f)} />
              {draft.door.texture && (
                <button
                  type="button"
                  onClick={() => apply({ ...draft, door: { ...draft.door, texture: null } })}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              )}
            </div>
            <SliderField
              label="Brightness"
              value={draft.door.brightness}
              min={0.5}
              max={2}
              step={0.05}
              onChange={(v) => apply({ ...draft, door: { ...draft.door, brightness: v } })}
            />
          </div>
        ),
      },
      {
        key: "lighting",
        title: "Lighting",
        body: (
          <div className="space-y-2">
            <SliderField label="Brightness" value={draft.lighting.brightness} min={0.3} max={2} step={0.05} onChange={(v) => apply({ ...draft, lighting: { ...draft.lighting, brightness: v } })} />
            <SliderField label="Ambient light" value={draft.lighting.ambient} min={0} max={1.5} step={0.05} onChange={(v) => apply({ ...draft, lighting: { ...draft.lighting, ambient: v } })} />
            <SliderField label="Light intensity" value={draft.lighting.intensity} min={0.2} max={2.5} step={0.05} onChange={(v) => apply({ ...draft, lighting: { ...draft.lighting, intensity: v } })} />
            <ToggleField label="Atmosphere (soft glow)" checked={draft.lighting.atmosphere} onChange={(v) => apply({ ...draft, lighting: { ...draft.lighting, atmosphere: v } })} />
          </div>
        ),
      },
      {
        key: "effects",
        title: "Effects",
        body: (
          <div className="space-y-2">
            <ToggleField label="Enable an effect" checked={draft.effects.enabled} onChange={(v) => apply({ ...draft, effects: { ...draft.effects, enabled: v } })} />
            {draft.effects.enabled && (
              <div className="flex flex-wrap gap-1">
                {EFFECT_OPTIONS.map((e) => (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => apply({ ...draft, effects: { ...draft.effects, effect: e.value } })}
                    className={`min-h-[34px] rounded-full px-3 text-xs font-semibold ${
                      draft.effects.effect === e.value
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft],
  );

  return (
    <div className="space-y-2">
      {fieldSections.map((s) => (
        <Section key={s.key} title={s.title} open={open[s.key]} onToggle={() => toggle(s.key)}>
          {s.body}
        </Section>
      ))}
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={async () => {
          setSaving(true);
          try {
            await onSave(draft);
            setDirty(false);
          } catch (e: unknown) {
            alert(String((e as Error)?.message ?? e));
          } finally {
            setSaving(false);
          }
        }}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {dirty ? "Save Changes" : "Saved"}
      </button>
    </div>
  );
};

const UploadButton = ({ label, onPick }: { label: string; onPick: (f: File) => void }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <Upload className="h-3.5 w-3.5" /> {label}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </>
  );
};

export default BuildingSettingsPanel;