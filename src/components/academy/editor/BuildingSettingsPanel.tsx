/**
 * BUILDING SETTINGS — the owner's environment panel.
 *
 * Each surface (left wall, right wall, floor, roof) behaves like a physical
 * panel fitted to the building: the teacher picks a built-in template from the
 * gallery or uploads their own image, and the system fits it with a cover crop
 * (never stretching it). Zoom / move / reset / fit / remove controls adjust
 * the placement; everything flows into the live 3D preview as a draft and is
 * persisted per building with "Save Changes". The door, lighting and effects
 * sections complete the environment.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, LayoutGrid, Loader2, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import {
  DEFAULT_ENVIRONMENT,
  EFFECT_OPTIONS,
  type EnvironmentSettings,
  type SurfaceDesign,
  type SurfaceKey,
} from "@/lib/building/types";
import { SURFACE_PRESET_LIST } from "@/lib/building/presets";
import { DOOR_STYLES } from "@/lib/building/doors";
import {
  builtinTextureLabel,
  builtinTexturePath,
  builtinTextureUrl,
} from "@/lib/building/gallery";
import { optimizeImageForTexture } from "@/lib/building/imageFit";
import SurfaceGalleryDialog from "./SurfaceGalleryDialog";
import SurfaceUploadDialog from "./SurfaceUploadDialog";

const SURFACE_TITLES: Record<SurfaceKey, string> = {
  leftWall: "Left wall",
  rightWall: "Right wall",
  floor: "Floor",
  roof: "Ceiling",
  endWall: "Terminal Wall",
};

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

/** One surface: current-design preview + template/upload + placement. */
const SurfaceEditor = ({
  title,
  design,
  previewUrl,
  onChange,
  onChooseTemplate,
  onUploadClick,
}: {
  title: string;
  design: SurfaceDesign;
  previewUrl?: string;
  onChange: (d: SurfaceDesign) => void;
  onChooseTemplate: () => void;
  onUploadClick: () => void;
}) => {
  const hasTexture = Boolean(design.texture);
  const label = design.texture
    ? builtinTextureLabel(design.texture.path)
      ? `${builtinTextureLabel(design.texture.path)} (template)`
      : "Your image"
    : SURFACE_PRESET_LIST.find((p) => p.value === design.preset)?.label ?? "Solid colour";

  return (
<div data-surface={title.toLowerCase().replace(/\s+/g, "-")} className="space-y-2 rounded-lg border border-border/50 p-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>

      {/* Current design — a preview of the panel fitted to the surface */}
      <div
        className="relative aspect-[4/1] w-full overflow-hidden rounded-md border border-border"
        style={{
          background: previewUrl
            ? `url(${previewUrl}) center / cover no-repeat`
            : design.color,
        }}
      >
        <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {label}
        </span>
      </div>

      {/* Choose Template / Upload Your Own / Remove */}
      <div className="flex flex-wrap gap-1.5">
<button
          type="button"
          data-action="template"
          onClick={onChooseTemplate}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <LayoutGrid className="h-3.5 w-3.5" /> Choose template
        </button>
<button
          type="button"
          data-action="upload"
          onClick={onUploadClick}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <Upload className="h-3.5 w-3.5" /> {hasTexture ? "Replace image" : "Upload your own"}
        </button>
        {hasTexture && (
          <button
            type="button"
            onClick={() => onChange({ ...design, texture: null })}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-semibold text-muted-foreground hover:border-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>

      {/* Placement adjustments — only meaningful with an image */}
      {hasTexture && (
        <div className="space-y-2 rounded-md border border-border/40 bg-background/40 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">Fit</span>
            <div className="flex gap-1">
              {(["cover", "stretch"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onChange({ ...design, fit: f })}
                  className={`min-h-[30px] rounded-full px-2.5 text-[11px] font-semibold ${
                    design.fit === f
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "cover" ? "Cover (no distortion)" : "Stretch"}
                </button>
              ))}
            </div>
          </div>
          <SliderField label="Zoom" value={design.scale} min={0.2} max={4} step={0.05} onChange={(v) => onChange({ ...design, scale: v })} />
          <div className="grid grid-cols-2 gap-2">
            <SliderField label="Move left / right" value={design.offsetX} min={-2} max={2} step={0.05} onChange={(v) => onChange({ ...design, offsetX: v })} />
            <SliderField label="Move up / down" value={design.offsetY} min={-2} max={2} step={0.05} onChange={(v) => onChange({ ...design, offsetY: v })} />
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...design, scale: 1, offsetX: 0, offsetY: 0 })}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset placement
          </button>
          <SliderField
            label="Brightness (1 = as imported)"
            value={design.brightness ?? 1}
            min={0.2}
            max={2}
            step={0.05}
            onChange={(v) => onChange({ ...design, brightness: v })}
          />
          <ToggleField label="Tile the image" checked={design.repeat} onChange={(v) => onChange({ ...design, repeat: v })} />
        </div>
      )}
    </div>
  );
};

export interface BuildingSettingsPanelProps {
  buildingId: string;
  environment: EnvironmentSettings;
  onPreviewChange: (env: EnvironmentSettings) => void;
  onSave: (env: EnvironmentSettings) => Promise<void>;
  /** Optimised upload (blob + mime). Returns the stored texture path. */
  onUpload: (
    surface: SurfaceKey | "door",
    blob: Blob,
    contentType: string,
    previousPath: string | null,
  ) => Promise<string>;
  /** Resolve a texture path (built-in or stored) to a previewable URL. */
  getTextureUrl: (path: string) => string | undefined;
}

const BuildingSettingsPanel = ({
  buildingId,
  environment,
  onPreviewChange,
  onSave,
  onUpload,
  getTextureUrl,
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
  const [galleryFor, setGalleryFor] = useState<SurfaceKey | null>(null);
  const [uploadFor, setUploadFor] = useState<SurfaceKey | null>(null);

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

  /** Preview URL for a texture path: built-in sample or stored upload. */
  const urlOf = (path: string | null | undefined): string | undefined => {
    if (!path) return undefined;
    return builtinTextureUrl(path) ?? getTextureUrl(path);
  };

  const applyTemplate = (key: SurfaceKey, sampleKey: string) =>
    apply({
      ...draft,
      [key]: {
        ...surface(key),
        texture: { path: builtinTexturePath(sampleKey) },
        fit: "cover",
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        repeat: false,
      },
    });

  const upload = async (key: SurfaceKey | "door", file: File, zoom: number, panX: number, panY: number) => {
    try {
      const blob = await optimizeImageForTexture(file);
      const current = key === "door" ? draft.door : surface(key);
      const prev = current.texture?.path ?? null;
      const path = await onUpload(key, blob, blob.type, prev);
      if (key === "door") {
        apply({ ...draft, door: { ...draft.door, texture: { path } } });
      } else {
        apply({
          ...draft,
          [key]: {
            ...surface(key),
            texture: { path },
            fit: "cover",
            scale: zoom,
            offsetX: panX,
            offsetY: panY,
            repeat: false,
          },
        });
      }
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
              previewUrl={urlOf(surface("leftWall").texture?.path)}
              onChange={(d) => setSurface("leftWall", d)}
              onChooseTemplate={() => setGalleryFor("leftWall")}
              onUploadClick={() => setUploadFor("leftWall")}
            />
            <SurfaceEditor
              title="Right wall"
              design={surface("rightWall")}
              previewUrl={urlOf(surface("rightWall").texture?.path)}
              onChange={(d) => setSurface("rightWall", d)}
              onChooseTemplate={() => setGalleryFor("rightWall")}
              onUploadClick={() => setUploadFor("rightWall")}
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
            previewUrl={urlOf(surface("floor").texture?.path)}
            onChange={(d) => setSurface("floor", d)}
            onChooseTemplate={() => setGalleryFor("floor")}
            onUploadClick={() => setUploadFor("floor")}
          />
        ),
      },
      {
        key: "endWall",
        title: "Terminal Wall",
        body: (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              The wall at the end of a hallway that does not continue forward.
            </p>
            <SurfaceEditor
              title="Terminal Wall"
              design={surface("endWall")}
              previewUrl={urlOf(surface("endWall").texture?.path)}
              onChange={(d) => setSurface("endWall", d)}
              onChooseTemplate={() => setGalleryFor("endWall")}
              onUploadClick={() => setUploadFor("endWall")}
            />
          </div>
        ),
      },
      {
        key: "roof",
        title: "Ceiling",
        body: (
          <SurfaceEditor
            title="Ceiling"
            design={surface("roof")}
            previewUrl={urlOf(surface("roof").texture?.path)}
            onChange={(d) => setSurface("roof", d)}
            onChooseTemplate={() => setGalleryFor("roof")}
            onUploadClick={() => setUploadFor("roof")}
          />
        ),
      },
      {
        key: "door",
        title: "Doors",
        body: (
          <div className="space-y-2 rounded-lg border border-border/50 p-2.5">
            <p className="text-[11px] font-semibold text-foreground">Door design</p>
            <div className="grid grid-cols-3 gap-2">
              {DOOR_STYLES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => apply({ ...draft, door: { ...draft.door, style: s.key } })}
                  className={`rounded-lg border p-1 text-[10px] font-medium transition ${
                    draft.door.style === s.key
                      ? "border-primary ring-2 ring-primary/50 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                  title={s.label}
                >
                  <img
                    src={s.url}
                    alt={s.label}
                    loading="lazy"
                    className="mx-auto h-20 w-auto object-contain"
                  />
                  <span className="mt-1 block truncate">{s.label}</span>
                </button>
              ))}
            </div>
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
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = () => {
                    const f = input.files?.[0];
                    if (f) void upload("door", f, 1, 0, 0);
                  };
                  input.click();
                }}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                <Upload className="h-3.5 w-3.5" /> {draft.door.texture ? "Replace image" : "Upload your own"}
              </button>
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

      <SurfaceGalleryDialog
        open={galleryFor !== null}
        title={galleryFor ? SURFACE_TITLES[galleryFor] : ""}
        onOpenChange={(o) => {
          if (!o) setGalleryFor(null);
        }}
        onChoose={(sampleKey) => {
          if (galleryFor) applyTemplate(galleryFor, sampleKey);
          setGalleryFor(null);
        }}
      />
      <SurfaceUploadDialog
        open={uploadFor !== null}
        title={uploadFor ? SURFACE_TITLES[uploadFor] : ""}
        onOpenChange={(o) => {
          if (!o) setUploadFor(null);
        }}
        onApply={(file, zoom, panX, panY) => {
          if (uploadFor) void upload(uploadFor, file, zoom, panX, panY);
          setUploadFor(null);
        }}
      />

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

export default BuildingSettingsPanel;