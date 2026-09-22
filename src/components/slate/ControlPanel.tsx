import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SURFACES, getSurface } from "@/lib/slate/surfaces";
import { PRESET_COLOURS, resolveTextStyle } from "@/lib/slate/textPresets";
import { TextPresetPicker } from "./TextPresetPicker";
import { NO_ROOM_ID, ROOMS } from "@/lib/slate/rooms";
import { PLACEABLE_REWARDS, getReward } from "@/lib/slate/rewards";
import {
  INTEGRATIONS,
  RELIEFS,
  TEXT_STYLES,
  DIMENSIONAL_SUBSTYLES,
  defaultTextSettings,
} from "@/lib/slate/text3d";
import { TextColourPicker } from "./TextColourPicker";
import type { TextSettings } from "@/lib/slate/text3d";
import { normalizeConversion } from "@/lib/slate/conversion";
import {
  REWARD_SOUND_KEYS,
  REWARD_SOUND_LABEL,
  normalizeSoundSettings,
} from "@/lib/slate/sound";
import { SoundPicker } from "./SoundPicker";
import type { GameSoundSettings, RewardConversion } from "@/lib/slate/types";
import { useState } from "react";
import { toast } from "sonner";
import { defaultAssetSettings, defaultNumberSettings, makeSlot, uid } from "@/lib/slate/defaults";
import { putAsset, removeAsset } from "@/lib/slate/assets";
import { SCRIPT_HINT, compileScript } from "@/lib/slate/vfx/script";
import { PREMIUM_BOMB_PROFILES } from "@/lib/slate/vfx/premiumProfiles";
import { ensureEffectReady } from "@/lib/slate/vfx/prepare";
import { playTrack, setTrackVolume, stopTrack } from "@/lib/slate/music";
import type { AssetSettings, AudioTrack, Game, NumberSettings, PremiumBombStyle, Selection, Slot } from "@/lib/slate/types";

interface Props {
  game: Game;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onChange: (patch: Partial<Game>) => void;
  onSlotChange: (slotId: string, patch: Partial<Slot>) => void;
  onAddReward: (typeId: string) => void;
  onClose: () => void;
  onSave: () => void;
}

/** One collapsible group inside Advanced. */
const Fold = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border border-amber-200/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] uppercase tracking-wider text-amber-100/70"
      >
        <span>{title}</span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="space-y-2 px-2 pb-2">{children}</div> : null}
    </div>
  );
};

/** A single colour override. */
const Swatch = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-[10px] uppercase tracking-wider text-amber-100/60">{label}</span>
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="h-6 w-10 cursor-pointer rounded border border-amber-200/20 bg-transparent"
    />
  </div>
);

const Row = ({
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
  <div className="space-y-1.5">
    <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-100/60">
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 tabular-nums text-amber-100/80">{value.toFixed(2)}</span>
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([v]) => onChange(v ?? value)}
    />
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3 border-t border-amber-200/10 pt-4 first:border-0 first:pt-0">
    <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/80">{title}</h3>
    {children}
  </section>
);

const PLAIN_COLOURS = [
  { label: "Blue", value: "#1677ff" },
  { label: "Red", value: "#ef3340" },
  { label: "Green", value: "#16b85c" },
  { label: "Gold", value: "#f3b51b" },
  { label: "Purple", value: "#8b4de8" },
  { label: "White", value: "#f7f7f4" },
  { label: "Black", value: "#17191d" },
  { label: "Cream", value: "#f4ead7" },
] as const;

/** Small segmented control — one row of mutually exclusive choices. */
function Choice<T extends string>({
  values,
  value,
  onChange,
  cols = 3,
  prefix,
}: {
  values: readonly T[];
  value: T;
  onChange: (v: T) => void;
  cols?: number;
  prefix?: string;
}) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {values.map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded border px-1 py-1 text-[10px] capitalize ${
            value === v
              ? "border-amber-300 text-amber-100"
              : "border-amber-200/15 text-amber-100/60 hover:border-amber-200/40"
          }`}
        >
          {prefix ? `${prefix} ${v}` : v}
        </button>
      ))}
    </div>
  );
}

/**
 * The single control room for the whole slate. Every property lives here
 * exactly once and writes straight into game state, so the 3D world on the
 * left updates as the control moves.
 */
export function ControlPanel({
  game,
  selection,
  onSelect,
  onChange,
  onSlotChange,
  onAddReward,
  onClose,
  onSave,
}: Props) {
  const s = game.settings;
  const set = (patch: Partial<Game["settings"]>) => onChange({ settings: { ...s, ...patch } });
  // Reward Conversion: Time is the main resource, Life the intermediate one.
  const conversion = normalizeConversion(s.conversion, s.life?.multiplier);
  const setConversion = (patch: Partial<RewardConversion>) =>
    set({ conversion: normalizeConversion({ ...conversion, ...patch }) });
  // Game Sound: the background layer and the independent reward sounds.
  const sound = normalizeSoundSettings(s.sound);
  const setSound = (patch: Partial<GameSoundSettings>) =>
    set({ sound: normalizeSoundSettings({ ...sound, ...patch }) });
  const t: TextSettings = s.text ?? defaultTextSettings();
  const setText = (patch: Partial<TextSettings>) => set({ text: { ...t, ...patch } });
  const n: NumberSettings = s.numbers ?? defaultNumberSettings();
  const setNumbers = (patch: Partial<NumberSettings>) => set({ numbers: { ...n, ...patch } });
  const a: AssetSettings = s.assets ?? defaultAssetSettings();
  const setAssets = (patch: Partial<AssetSettings>) => set({ assets: { ...a, ...patch } });
  const patchTrack = (trackId: string, patch: Partial<AudioTrack>) =>
    setAssets({
      audio: a.audio.map((track) => (track.id === trackId ? { ...track, ...patch } : track)),
    });
  const [preview, setPreview] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [effectPaused, setEffectPaused] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const transport = (action: "play" | "pause" | "reset") => {
    setEffectPaused(action === "pause");
    window.dispatchEvent(new CustomEvent("slate:effect-transport", { detail: { action } }));
  };
  const [premiumDraft, setPremiumDraft] = useState<PremiumBombStyle>(
    s.effects.premiumBombStyle ?? "radiant-chain",
  );
  const resolved = resolveTextStyle(getSurface(game.surfaceId), t);

  const activeSlot =
    selection.kind !== "none" ? (game.slots.find((x) => x.id === selection.slotId) ?? null) : null;
  const activeReward =
    selection.kind === "reward"
      ? (activeSlot?.rewards.find((r) => r.id === selection.rewardId) ?? null)
      : null;

  const onBackgroundFile = async (file: File) => {
    try {
      // the file lives in IndexedDB; the saved game only stores its id
      const assetId = await putAsset(file);
      onChange({
        background: {
          ...game.background,
          src: null,
          assetId,
          kind: file.type.startsWith("video") ? "video" : "image",
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not use that file.");
    }
  };

  const patchReward = (key: string, value: unknown) => {
    if (!activeSlot || !activeReward) return;
    onSlotChange(activeSlot.id, {
      rewards: activeSlot.rewards.map((r) =>
        r.id === activeReward.id ? { ...r, [key]: value } : r,
      ),
    });
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-amber-200/15 bg-[#120d07]/95 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 border-b border-amber-200/10 px-4 py-3">
        <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.22em] text-amber-100">
          Edit &amp; Settings
        </h2>
        <button
          onClick={onClose}
          aria-label="Close edit and settings"
          className="shrink-0 rounded border border-amber-200/20 px-2 py-1 text-xs leading-none text-amber-100/70 hover:bg-amber-200/10"
        >
          ✕
        </button>
      </div>

      {/* every setting must be reachable: nothing hides behind the Save bar */}
      <div className="slate-scroll min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 pb-10">
        <Section title="Game">
          <div className="space-y-2">
            <Label className="text-[11px] text-amber-100/60">Game name</Label>
            <Input
              value={game.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="border-amber-200/20 bg-black/40 text-amber-50"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={game.topic}
                placeholder="Topic"
                onChange={(e) => onChange({ topic: e.target.value })}
                className="border-amber-200/20 bg-black/40 text-amber-50"
              />
              <Input
                value={game.subtopic}
                placeholder="Subtopic"
                onChange={(e) => onChange({ subtopic: e.target.value })}
                className="border-amber-200/20 bg-black/40 text-amber-50"
              />
            </div>
          </div>
        </Section>

        <Section title="Background">
          <input
            type="file"
            accept="image/*,video/*"
            aria-label="Background image or video"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onBackgroundFile(f);
            }}
            className="w-full text-xs text-amber-100/60 file:mr-3 file:rounded file:border file:border-amber-200/25 file:bg-transparent file:px-2 file:py-1 file:text-amber-100"
          />
          <Row label="Scale" value={game.background.scale} min={0.5} max={3} step={0.01}
            onChange={(v) => onChange({ background: { ...game.background, scale: v } })} />
          <Row label="Position X" value={game.background.x} min={-50} max={50} step={1}
            onChange={(v) => onChange({ background: { ...game.background, x: v } })} />
          <Row label="Position Y" value={game.background.y} min={-50} max={50} step={1}
            onChange={(v) => onChange({ background: { ...game.background, y: v } })} />
          <Row label="Opacity" value={game.background.opacity} min={0} max={1} step={0.01}
            onChange={(v) => onChange({ background: { ...game.background, opacity: v } })} />
        </Section>

        <Section title="Room">
          <select
            value={game.roomId || NO_ROOM_ID}
            aria-label="Room"
            onChange={(e) => {
              if (e.target.value === NO_ROOM_ID) {
                onChange({ roomId: NO_ROOM_ID });
                return;
              }
              const room = ROOMS.find((r) => r.id === e.target.value);
              if (room) onChange({ roomId: room.id, surfaceId: room.surfaceId });
            }}
            className="w-full rounded border border-amber-200/20 bg-black/50 px-2 py-1.5 text-[11px] text-amber-100"
          >
            <option value={NO_ROOM_ID} className="bg-[#120d07]">
              None (use background)
            </option>
            {ROOMS.map((r) => (
              <option key={r.id} value={r.id} className="bg-[#120d07]">
                {r.label}
              </option>
            ))}
          </select>
        </Section>

        <Section title="Writing Surface">
          <div className="grid grid-cols-2 gap-2">
            {SURFACES.map((sf) => (
              <button
                key={sf.id}
                onClick={() => onChange({ surfaceId: sf.id })}
                className={`overflow-hidden rounded border text-left text-[11px] ${
                  game.surfaceId === sf.id
                    ? "border-amber-300 ring-1 ring-amber-300/60"
                    : "border-amber-200/15 hover:border-amber-200/40"
                }`}
              >
                <span
                  className={`block h-8 w-full bg-cover bg-center ${sf.none ? "bg-black/40" : ""}`}
                  style={sf.none ? undefined : { backgroundImage: `url(${sf.texture})` }}
                >
                  {sf.none ? <span className="flex h-full items-center justify-center text-amber-100/55">No surface</span> : null}
                </span>
                <span className="block px-1.5 py-1 text-amber-100/75">{sf.label}</span>
              </button>
            ))}
          </div>
          {game.surfaceId === "plain" ? (
            <div className="space-y-2 rounded border border-amber-200/10 p-2.5">
              <span className="text-[10px] uppercase tracking-wider text-amber-100/60">Surface Colour</span>
              <div className="grid grid-cols-5 gap-1.5">
                {PLAIN_COLOURS.map((colour) => {
                  const selected = (game.surfaceColour ?? "#f4ead7") === colour.value;
                  return (
                    <button
                      key={colour.value}
                      title={colour.label}
                      aria-label={`Surface colour: ${colour.label}`}
                      aria-pressed={selected}
                      onClick={() => onChange({ surfaceColour: colour.value })}
                      className={`flex h-7 items-center justify-center rounded border ${selected ? "border-amber-300 ring-1 ring-amber-300/60" : "border-amber-200/15"}`}
                    >
                      <span className="h-4 w-4 rounded-full border border-amber-50/30" style={{ background: colour.value }} />
                    </button>
                  );
                })}
                <label className="relative flex h-7 cursor-pointer items-center justify-center rounded border border-amber-200/15" title="Custom colour">
                  <span className="text-[9px] uppercase text-amber-100/60">Custom</span>
                  <input
                    type="color"
                    value={game.surfaceColour ?? "#f4ead7"}
                    onChange={(event) => onChange({ surfaceColour: event.target.value })}
                    aria-label="Custom surface colour"
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>
          ) : null}
          <Row label="Scale" value={s.slate.scale} min={0.6} max={1.6} step={0.01}
            onChange={(v) => set({ slate: { ...s.slate, scale: v } })} />
          <Row label="Width" value={s.slate.width} min={520} max={1200} step={10}
            onChange={(v) => set({ slate: { ...s.slate, width: v } })} />
          <Row label="Slot spacing" value={s.slate.slotSpacing} min={0} max={80} step={1}
            onChange={(v) => set({ slate: { ...s.slate, slotSpacing: v } })} />
          <Row label="Minimum slot height" value={s.slate.slotMinHeight} min={56} max={240} step={2}
            onChange={(v) => set({ slate: { ...s.slate, slotMinHeight: v } })} />
          <Row label="Slot padding" value={s.slate.slotPadding} min={8} max={48} step={1}
            onChange={(v) => set({ slate: { ...s.slate, slotPadding: v } })} />
          <Row
            label="Writing areas"
            value={game.slots.length}
            min={1}
            max={50}
            step={1}
            onChange={(v) => {
              const next = Math.max(1, Math.round(v));
              if (next === game.slots.length) return;
              if (next < game.slots.length) {
                onChange({ slots: game.slots.slice(0, next) });
                onSelect({ kind: "none" });
              } else {
                const extra = Array.from({ length: next - game.slots.length }, (_, i) =>
                  makeSlot(game.slots.length + i),
                );
                onChange({ slots: [...game.slots, ...extra] });
              }
            }}
          />
        </Section>

        <Section title="Section numbers">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-100/60">
            <span>Visible</span>
            <Switch
              checked={n.visible}
              onCheckedChange={(v) => setNumbers({ visible: v })}
            />
          </div>
          <TextColourPicker heading="Number colour" text={n} onChange={setNumbers} />
          <Row label="Size" value={n.size} min={0.5} max={2} step={0.05}
            onChange={(v) => setNumbers({ size: v })} />
          <Row label="Depth" value={n.depth} min={0} max={2} step={0.05}
            onChange={(v) => setNumbers({ depth: v })} />
          <Row label="Bevel" value={n.bevel} min={0} max={2} step={0.05}
            onChange={(v) => setNumbers({ bevel: v })} />
          <Row label="Shadow" value={n.shadow} min={0} max={2} step={0.05}
            onChange={(v) => setNumbers({ shadow: v })} />
          <Row label="Contrast" value={n.contrast} min={0.3} max={2} step={0.05}
            onChange={(v) => setNumbers({ contrast: v })} />
          <Choice
            values={["left", "right"] as const}
            value={n.align}
            onChange={(v) => setNumbers({ align: v })}
            cols={2}
          />
          <Choice
            values={["top", "middle"] as const}
            value={n.vertical}
            onChange={(v) => setNumbers({ vertical: v })}
            cols={2}
          />
          <Choice
            values={["auto", "engraved", "carved", "raised"] as const}
            value={n.relief}
            cols={4}
            onChange={(v) => setNumbers({ relief: v })}
          />
        </Section>


        <Section title="Text appearance">
          <div className="space-y-1.5">
            <span className="block text-[11px] uppercase tracking-wider text-amber-100/60">
              Test display
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { id: "surface", label: "Surface Test" },
                { id: "threeD", label: "3D Test" },
              ] as const).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => set({ testDisplay: option.id })}
                  aria-pressed={(s.testDisplay ?? "threeD") === option.id}
                  className={`rounded border px-2 py-1.5 text-[10px] uppercase tracking-wider ${
                    (s.testDisplay ?? "threeD") === option.id
                      ? "border-amber-300 bg-amber-300/10 text-amber-100"
                      : "border-amber-200/15 text-amber-100/60 hover:border-amber-200/40"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-[11px] uppercase tracking-wider text-amber-100/60">
              Writing style
            </span>
            <select
              value={t.style}
              onChange={(e) => setText({ style: e.target.value as TextSettings["style"] })}
              className="w-full rounded border border-amber-200/20 bg-black/40 px-2 py-1.5 text-[11px] text-amber-100"
            >
              {TEXT_STYLES.map((style) => (
                <option key={style.id} value={style.id} className="bg-[#161009]">
                  {style.label}
                </option>
              ))}
            </select>
            {t.style === "dimensional" ? (
              <div className="grid grid-cols-3 gap-1.5">
                {DIMENSIONAL_SUBSTYLES.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setText({ substyle: sub.id })}
                    className={`rounded border px-1.5 py-1.5 text-[10px] ${
                      (t.substyle ?? "classic") === sub.id
                        ? "border-amber-300 bg-amber-200/10 text-amber-100"
                        : "border-amber-200/15 text-amber-100/60 hover:border-amber-200/40"
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <span className="block text-[11px] uppercase tracking-wider text-amber-100/60">
              Visual style
            </span>
            <TextPresetPicker
              surface={getSurface(game.surfaceId)}
              settings={t}
              onSelect={(preset) => setText({ preset })}
            />
          </div>

          {([
            ["Desktop Text Size", "desktopSize"],
            ["Tablet Text Size", "tabletSize"],
            ["Mobile Text Size", "mobileSize"],
          ] as const).map(([label, key]) => {
            const value = t[key] ?? t.size;
            return (
              <Row
                key={key}
                label={label}
                value={value}
                min={5}
                max={1000}
                step={value < 100 ? 1 : 5}
                onChange={(next) => setText({ [key]: next })}
              />
            );
          })}

          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-100/60">
            <span>Animate</span>
            <Switch checked={t.animate ?? false} onCheckedChange={(v) => setText({ animate: v })} />
          </div>

          <button
            onClick={() => setAdvanced((v) => !v)}
            className="w-full rounded border border-amber-200/20 px-2.5 py-2 text-[11px] uppercase tracking-wider text-amber-100/70 hover:bg-amber-200/10"
          >
            {advanced ? "Close text settings" : "Text settings"}
          </button>

          {advanced ? (
            <div className="space-y-3 rounded border border-amber-200/15 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-amber-100/50">
                  Text settings
                </span>
                <button
                  onClick={() => {
                    const d = defaultTextSettings();
                    setText({
                      advanced: {},
                      depth: d.depth,
                      bevel: d.bevel,
                      contrast: d.contrast,
                      shadow: d.shadow,
                      shadowStrength: d.shadowStrength,
                      highlight: d.highlight,
                      glow: d.glow,
                      glowIntensity: d.glowIntensity,
                      relief: d.relief,
                      integration: d.integration,
                      colour: null,
                    });
                    toast.success("Reset to the preset.");
                  }}
                  className="rounded border border-amber-200/20 px-2 py-1 text-[10px] text-amber-100/70 hover:bg-amber-200/10"
                >
                  Reset to preset
                </button>
              </div>

              <Fold title="Material & colour">
                <TextColourPicker heading="Main text colour" text={t} onChange={setText} />
                <Swatch label="3D depth colour" value={t.depthColour ?? PRESET_COLOURS[3]!.value}
                  onChange={(v) => setText({ depthColour: v })} />
                <Row label="Contrast" value={t.contrast} min={0.3} max={2} step={0.05}
                  onChange={(v) => setText({ contrast: v })} />
                <Row label="Opacity" value={t.opacity} min={0.1} max={1} step={0.01}
                  onChange={(v) => setText({ opacity: v })} />
                <Choice values={RELIEFS} value={t.relief} cols={4}
                  onChange={(v) => setText({ relief: v })} />
                <div className="space-y-1.5">
                  <span className="block text-[11px] uppercase tracking-wider text-amber-100/60">
                    Surface integration
                  </span>
                  <Choice
                    values={INTEGRATIONS}
                    value={t.integration}
                    onChange={(v) => setText({ integration: v })}
                  />
                </div>
              </Fold>

              <Fold title="3D depth & bevel">
                <Row label="Depth" value={t.depth} min={0} max={2} step={0.05}
                  onChange={(v) => setText({ depth: v })} />
                <Row label="Bevel" value={t.bevel} min={0} max={2} step={0.05}
                  onChange={(v) => setText({ bevel: v })} />
                <Swatch label="Side colour" value={resolved.side}
                  onChange={(v) => setText({ advanced: { ...t.advanced, side: v } })} />
                <Swatch label="Outline colour" value={resolved.outline}
                  onChange={(v) => setText({ advanced: { ...t.advanced, outline: v } })} />
              </Fold>

              <Fold title="Highlight & gloss">
                <Row label="Highlight" value={t.highlight} min={0} max={2} step={0.05}
                  onChange={(v) => setText({ highlight: v })} />
                <Swatch label="Bevel highlight" value={resolved.bevelHighlight}
                  onChange={(v) => setText({ advanced: { ...t.advanced, bevelHighlight: v } })} />
              </Fold>

              <Fold title="Shadow">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-100/60">
                  <span>Shadow</span>
                  <Switch checked={t.shadow} onCheckedChange={(v) => setText({ shadow: v })} />
                </div>
                <Row label="Shadow strength" value={t.shadowStrength} min={0} max={2} step={0.05}
                  onChange={(v) => setText({ shadowStrength: v })} />
                <Swatch label="Shadow colour" value={resolved.shadow}
                  onChange={(v) => setText({ advanced: { ...t.advanced, shadow: v } })} />
                <Swatch label="Contact shadow" value={resolved.contact}
                  onChange={(v) => setText({ advanced: { ...t.advanced, contact: v } })} />
              </Fold>

              <Fold title="Glow">
                <Choice
                  values={["off", "subtle", "medium"] as const}
                  value={t.glow}
                  prefix="Glow"
                  onChange={(v) => setText({ glow: v })}
                />
                <Row label="Glow intensity" value={t.glowIntensity} min={0} max={2} step={0.05}
                  onChange={(v) => setText({ glowIntensity: v })} />
                <Swatch label="Glow colour" value={resolved.glow}
                  onChange={(v) => setText({ advanced: { ...t.advanced, glow: v } })} />
              </Fold>

              <Fold title="Layout">
                <Choice
                  values={["left", "center", "right"] as const}
                  value={t.align}
                  onChange={(v) => setText({ align: v })}
                />
                <Row label="Line spacing" value={t.lineSpacing} min={1} max={2.2} step={0.05}
                  onChange={(v) => setText({ lineSpacing: v })} />
                <Row label="Letter spacing" value={t.letterSpacing} min={-0.02} max={0.2} step={0.005}
                  onChange={(v) => setText({ letterSpacing: v })} />
              </Fold>

              <Fold title="Living 3D animation">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-100/60">
                  <span>Animate</span>
                  <Switch checked={t.animate ?? false} onCheckedChange={(v) => setText({ animate: v })} />
                </div>
                <Row label="Turn angle" value={t.livingAngle ?? 4} min={1} max={7} step={0.25}
                  onChange={(v) => setText({ livingAngle: v })} />
                <Row label="Horizontal drift" value={t.livingDrift ?? 0.012} min={0} max={0.04} step={0.002}
                  onChange={(v) => setText({ livingDrift: v })} />
                <Row label="Vertical movement" value={t.livingLift ?? 0.008} min={0} max={0.025} step={0.001}
                  onChange={(v) => setText({ livingLift: v })} />
                <Row label="Scale change" value={t.livingScale ?? 0.008} min={0} max={0.025} step={0.001}
                  onChange={(v) => setText({ livingScale: v })} />
                <Row label="Cycle duration" value={t.livingDuration ?? 7.5} min={4} max={14} step={0.5}
                  onChange={(v) => setText({ livingDuration: v })} />
              </Fold>
            </div>
          ) : null}
        </Section>

        <Section title="Rewards">
          <div className="grid grid-cols-5 gap-1">
            {PLACEABLE_REWARDS.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  // placed straight away; its images prepare behind the click
                  onAddReward(r.id);
                  void ensureEffectReady(r.profile, r.label);
                }}
                title={`Add ${r.label}`}
                aria-label={`Add ${r.label}`}
                className="rounded p-1 hover:bg-amber-200/10"
              >
                <img src={r.art} alt={r.label} loading="lazy" className="h-8 w-8 object-contain" />
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-100/60">
            <span>Visible</span>
            <Switch
              checked={s.rewards.visible}
              onCheckedChange={(v) => set({ rewards: { ...s.rewards, visible: v } })}
            />
          </div>
          <Row label="Opacity" value={s.rewards.opacity} min={0.1} max={1} step={0.01}
            onChange={(v) => set({ rewards: { ...s.rewards, opacity: v } })} />
          <Row label="Glow" value={s.rewards.glow} min={0} max={1} step={0.01}
            onChange={(v) => set({ rewards: { ...s.rewards, glow: v } })} />
          <Row label="Scale" value={s.rewards.scale} min={0.5} max={2} step={0.01}
            onChange={(v) => set({ rewards: { ...s.rewards, scale: v } })} />

          {activeReward && activeSlot ? (
            <div className="space-y-2 rounded border border-amber-200/15 p-2.5">
              <div className="flex items-center gap-2">
                <img
                  src={getReward(activeReward.type).art}
                  alt={getReward(activeReward.type).label}
                  className="h-8 w-8 shrink-0 object-contain"
                />
                <span className="min-w-0 truncate text-[11px] text-amber-100/85">
                  {getReward(activeReward.type).label}{" "}
                  · {activeReward.state}
                </span>
              </div>
              {activeReward.type === "time-shard" ? (
                <div className="space-y-2 rounded border border-cyan-300/20 bg-cyan-400/5 p-2">
                  <Label className="text-[10px] uppercase tracking-wider text-cyan-100/70">
                    Reward time
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      aria-label="Reward minutes"
                      value={Math.floor((activeReward.durationMs ?? 15_000) / 60_000)}
                      onChange={(e) => {
                        const minutes = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                        const seconds = Math.floor(((activeReward.durationMs ?? 15_000) % 60_000) / 1000);
                        patchReward("durationMs", (minutes * 60 + seconds) * 1000);
                      }}
                      className="h-8 w-16 border-cyan-200/20 bg-black/40 text-[12px] text-amber-50"
                    />
                    <span className="text-[12px] text-amber-100/60">min</span>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      aria-label="Reward seconds"
                      value={Math.floor(((activeReward.durationMs ?? 15_000) % 60_000) / 1000)}
                      onChange={(e) => {
                        const seconds = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                        const minutes = Math.floor((activeReward.durationMs ?? 15_000) / 60_000);
                        patchReward("durationMs", (minutes * 60 + seconds) * 1000);
                      }}
                      className="h-8 w-16 border-cyan-200/20 bg-black/40 text-[12px] text-amber-50"
                    />
                    <span className="text-[12px] text-amber-100/60">sec</span>
                  </div>
                  <p className="text-[10px] leading-snug text-amber-100/45">
                    The hourglass counts this down while playing. Collect it in time and exactly
                    this much is added to the timer; leave it and it fades away with no bonus.
                  </p>
                </div>
              ) : null}
              {(
                [
                  ["X position", "x", 2, 96, 1],
                  ["Y position", "y", 4, 92, 1],
                  ["Z depth", "z", -30, 100, 1],
                  ["Scale", "scale", 0.5, 2, 0.05],
                  ["Rotation", "rotation", -180, 180, 1],
                  ["Lighting", "lighting", 0.3, 2, 0.05],
                  ["Ambient life", "animation", 0, 2, 0.05],
                  ["Effect power", "effectIntensity", 0.3, 2, 0.05],
                ] as const
              ).map(([label, key, min, max, step]) => (
                <Row
                  key={key}
                  label={label}
                  value={activeReward[key] ?? 0}
                  min={min}
                  max={max}
                  step={step}
                  onChange={(v) => patchReward(key, v)}
                />
              ))}
              <div className="grid grid-cols-3 gap-1">
                <select
                  value={activeReward.material ?? "metal"}
                  aria-label="Reward material"
                  onChange={(e) => patchReward("material", e.target.value)}
                  className="rounded border border-amber-200/15 bg-black/50 p-1 text-[9px] text-amber-50"
                >
                  {(["wood", "stone", "metal", "glass", "ice", "crystal", "leather"] as const).map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
                <select
                  value={activeReward.colour ?? "natural"}
                  aria-label="Reward colour"
                  onChange={(e) => patchReward("colour", e.target.value)}
                  className="rounded border border-amber-200/15 bg-black/50 p-1 text-[9px] text-amber-50"
                >
                  {(["natural", "warm", "cool", "verdant", "ember", "celestial"] as const).map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
                <select
                  value={activeReward.relief ?? "raised"}
                  aria-label="Reward relief"
                  onChange={(e) => patchReward("relief", e.target.value)}
                  className="rounded border border-amber-200/15 bg-black/50 p-1 text-[9px] text-amber-50"
                >
                  {(["carved", "raised", "engraved", "embossed", "recessed"] as const).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => patchReward("hidden", !activeReward.hidden)}
                  className="rounded border border-amber-200/20 px-2 py-1 text-[10px] text-amber-100/75 hover:bg-amber-200/10"
                >
                  {activeReward.hidden ? "Show" : "Hide"}
                </button>
                <button
                  onClick={() => {
                    onSlotChange(activeSlot.id, {
                      rewards: activeSlot.rewards.filter((r) => r.id !== activeReward.id),
                    });
                    onSelect({ kind: "slot", slotId: activeSlot.id });
                  }}
                  className="rounded border border-red-400/30 px-2 py-1 text-[10px] text-red-200/80 hover:bg-red-400/10"
                >
                  Delete
                </button>
              </div>

              {/* hidden content this effect releases while it plays */}
              <div className="space-y-1.5 rounded border border-amber-200/10 bg-black/25 p-2">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-amber-100/55">
                  Effect code
                </Label>
                <textarea
                  value={activeReward.script ?? ""}
                  spellCheck={false}
                  rows={4}
                  placeholder={"REVEAL 2x, +1, 7\nARRANGE row\nWAIT 0.6\nHIDE"}
                  onChange={(e) => patchReward("script", e.target.value)}
                  className="slate-scroll w-full resize-y rounded border border-amber-200/15 bg-black/50 p-2 font-mono text-[11px] leading-snug text-amber-50 placeholder:text-amber-100/25"
                />
                <p className="text-[9px] leading-snug text-amber-100/40">{SCRIPT_HINT}</p>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => {
                      if (!compileScript(activeReward.script)) {
                        toast.error("Add a REVEAL line first.");
                        return;
                      }
                      window.dispatchEvent(
                        new CustomEvent("slate:test-effect", {
                          detail: { slotId: activeSlot.id, rewardId: activeReward.id },
                        }),
                      );
                    }}
                    className="rounded border border-amber-200/20 px-2 py-1 text-[10px] text-amber-100/75 hover:bg-amber-200/10"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => patchReward("script", "")}
                    className="rounded border border-amber-200/20 px-2 py-1 text-[10px] text-amber-100/75 hover:bg-amber-200/10"
                  >
                    Clear
                  </button>
                </div>
                <p className="text-[9px] leading-snug text-amber-100/40">
                  Never shown while playing — it appears only while this effect runs.
                </p>
              </div>
            </div>
          ) : null}
        </Section>

        <Section title="Reward Conversion">
          <p className="text-[9px] leading-snug text-amber-100/40">
            Time is the main resource. The Hourglass becomes Time; the Vault and the
            Completion Coin become Life; a Life becomes Time only when it is used.
            The Bomb and the Collectors keep their own effect and never convert.
          </p>
          <Row
            label="Hourglass → Time"
            value={conversion.hourglassToTime}
            min={0.1}
            max={10}
            step={0.1}
            onChange={(v) => setConversion({ hourglassToTime: v })}
          />
          <Row
            label="Life → Time"
            value={conversion.lifeToTime}
            min={0.1}
            max={10}
            step={0.1}
            onChange={(v) => setConversion({ lifeToTime: v })}
          />
          <Row
            label="Vault → Life"
            value={conversion.vaultToLife}
            min={0.1}
            max={10}
            step={0.1}
            onChange={(v) => setConversion({ vaultToLife: v })}
          />
          <Row
            label="Completion Coin → Life"
            value={conversion.completionToLife}
            min={0.1}
            max={10}
            step={0.1}
            onChange={(v) => setConversion({ completionToLife: v })}
          />
        </Section>

        {/* Game Sound: one persistent background layer, independent reward sounds. */}
        <Section title="Game Sound">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-100/60">
            <span>Background sound on</span>
            <Switch
              checked={sound.background.enabled}
              onCheckedChange={(v) =>
                setSound({ background: { ...sound.background, enabled: v } })
              }
            />
          </div>
          <SoundPicker
            label="Game background sound"
            purpose="background"
            slot={sound.background}
            onChange={(next) =>
              setSound({ background: { ...sound.background, ...next } })
            }
          />
          <p className="text-[9px] leading-snug text-amber-100/40">
            Starts when the Game starts and keeps playing for the whole session. Changing line
            never restarts it.
          </p>
        </Section>

        <Section title="Reward Sounds">
          <p className="text-[9px] leading-snug text-amber-100/40">
            Each reward has its own sound and its own volume, played at the exact moment that
            reward activates. A reward simply sitting on the line stays silent.
          </p>
          {REWARD_SOUND_KEYS.map((key) => (
            <SoundPicker
              key={key}
              label={REWARD_SOUND_LABEL[key]}
              purpose={key}
              slot={sound.rewards[key]}
              onChange={(next) =>
                setSound({ rewards: { ...sound.rewards, [key]: next } })
              }
            />
          ))}
        </Section>



        <Section title="Effects">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-100/60">
            <span>Test mode</span>
            <Switch
              checked={s.effects.testMode}
              onCheckedChange={(v) => set({ effects: { ...s.effects, testMode: v } })}
            />
          </div>
          <Row label="Animation speed" value={s.effects.speed} min={0.25} max={3} step={0.05}
            onChange={(v) => set({ effects: { ...s.effects, speed: v } })} />
          <Row label="Glow intensity" value={s.effects.glow} min={0} max={2} step={0.05}
            onChange={(v) => set({ effects: { ...s.effects, glow: v } })} />
          <Row label="Particle intensity" value={s.effects.particles} min={0} max={2} step={0.05}
            onChange={(v) => set({ effects: { ...s.effects, particles: v } })} />
          <Row label="Test duration (s)" value={s.effects.duration} min={1} max={8} step={0.5}
            onChange={(v) => set({ effects: { ...s.effects, duration: v } })} />
        </Section>

        <Section title="Premium Bomb Effect">
          <div className="grid grid-cols-2 gap-1.5">
            {PREMIUM_BOMB_PROFILES.map((profile, index) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  // selection is instant; preparation happens after the frame
                  setPremiumDraft(profile.id);
                  void ensureEffectReady("chain-bomb", profile.label);
                }}
                aria-pressed={premiumDraft === profile.id}
                className={`relative overflow-hidden rounded border p-2 text-left transition ${
                  premiumDraft === profile.id
                    ? "border-amber-300 bg-amber-300/10 text-amber-50"
                    : "border-amber-200/15 bg-black/20 text-amber-100/60 hover:border-amber-200/40"
                }`}
              >
                <span className="mb-1.5 flex h-8 items-center justify-center">
                  <span
                    className="h-5 w-5 rounded-full border border-white/60"
                    style={{
                      background: `radial-gradient(circle at 35% 30%, ${profile.colours[0]} 0 12%, ${profile.colours[1]} 24%, ${profile.colours[2]} 56%, ${profile.colours[3]} 100%)`,
                      boxShadow: `0 0 8px ${profile.colours[1]}, 0 0 15px ${profile.colours[2]}`,
                    }}
                  />
                  <span className="ml-1 h-px w-8" style={{ background: `linear-gradient(90deg, ${profile.colours[0]}, ${profile.colours[2]}, transparent)` }} />
                </span>
                <span className="block text-[9px] font-medium uppercase leading-tight tracking-wider">
                  {index + 1}. {profile.label}
                </span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (!activeSlot || !activeReward || activeReward.type !== "premium-chain-bomb") {
                  toast.error("Select a Premium Spherical Chain Bomb on the slate first.");
                  return;
                }
                setEffectPaused(false);
                const slotId = activeSlot.id;
                const rewardId = activeReward.id;
                // everything this effect needs is ready before the first frame
                setPreparing(true);
                void ensureEffectReady("chain-bomb", "Premium bomb").finally(() => {
                  setPreparing(false);
                  window.dispatchEvent(new CustomEvent("slate:test-effect", {
                    detail: { slotId, rewardId, style: premiumDraft },
                  }));
                });
              }}
              className="rounded border border-cyan-300/35 px-2 py-1.5 text-[10px] uppercase tracking-wider text-cyan-100 hover:bg-cyan-300/10"
            >
              {preparing ? "Preparing…" : "Preview"}
            </button>
            <button
              type="button"
              onClick={() => {
                set({ effects: { ...s.effects, premiumBombStyle: premiumDraft } });
                toast.success("Premium bomb effect applied.");
              }}
              className="rounded border border-amber-300/45 bg-amber-300/10 px-2 py-1.5 text-[10px] uppercase tracking-wider text-amber-50 hover:bg-amber-300/20"
            >
              Apply
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => transport(effectPaused ? "play" : "pause")}
              className="rounded border border-amber-100/25 px-2 py-1.5 text-[10px] uppercase tracking-wider text-amber-50 hover:bg-amber-100/10"
            >
              {effectPaused ? "Play" : "Pause"}
            </button>
            <button
              type="button"
              onClick={() => transport("reset")}
              className="rounded border border-amber-100/25 px-2 py-1.5 text-[10px] uppercase tracking-wider text-amber-50 hover:bg-amber-100/10"
            >
              Reset
            </button>
          </div>
          <p className="text-[9px] leading-snug text-amber-100/40">
            Select or place the premium bomb to preview the complete chain in the live slate.
            Pause holds the animation exactly where it is; Play continues from there.
          </p>
        </Section>

        <Section title="Effects assets">
          <p className="text-[10px] leading-snug text-amber-100/45">
            Upload your own sun or light effect. It replaces the default until you remove it.
          </p>
          <input
            type="file"
            accept="image/*"
            aria-label="Sun or light effect image"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              putAsset(file)
                .then((assetId) =>
                  setAssets({
                    sun: {
                      assetId,
                      name: file.name,
                      colour: a.sun?.colour ?? "#ffd08a",
                      intensity: a.sun?.intensity ?? 1,
                      glow: a.sun?.glow ?? 0.9,
                      scale: a.sun?.scale ?? 1,
                      loop: a.sun?.loop ?? true,
                    },
                  }),
                )
                .catch((error: Error) => toast.error(error.message));
            }}
            className="w-full text-xs text-amber-100/60 file:mr-3 file:rounded file:border file:border-amber-200/25 file:bg-transparent file:px-2 file:py-1 file:text-amber-100"
          />
          {a.sun ? (
            <div className="space-y-2 rounded border border-amber-200/15 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[11px] text-amber-100/80">{a.sun.name}</span>
                <button
                  onClick={() => {
                    if (a.sun) void removeAsset(a.sun.assetId);
                    setAssets({ sun: null });
                  }}
                  className="shrink-0 rounded border border-red-400/30 px-2 py-0.5 text-[10px] text-red-200/80 hover:bg-red-400/10"
                >
                  Remove
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-100/60">
                <span>Light colour</span>
                <input
                  type="color"
                  aria-label="Sun light colour"
                  value={a.sun.colour}
                  onChange={(e) => setAssets({ sun: { ...a.sun!, colour: e.target.value } })}
                  className="h-6 w-10 rounded border border-amber-200/20 bg-transparent"
                />
              </div>
              <Row label="Intensity" value={a.sun.intensity} min={0} max={3} step={0.05}
                onChange={(v) => setAssets({ sun: { ...a.sun!, intensity: v } })} />
              <Row label="Glow" value={a.sun.glow} min={0} max={1} step={0.01}
                onChange={(v) => setAssets({ sun: { ...a.sun!, glow: v } })} />
              <Row label="Size" value={a.sun.scale} min={0.3} max={4} step={0.05}
                onChange={(v) => setAssets({ sun: { ...a.sun!, scale: v } })} />
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-100/60">
                <span>Animate</span>
                <Switch
                  checked={a.sun.loop}
                  onCheckedChange={(v) => setAssets({ sun: { ...a.sun!, loop: v } })}
                />
              </div>
            </div>
          ) : null}
        </Section>

        <Section title="Background audio">
          <input
            type="file"
            accept="audio/*"
            aria-label="Background music track"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              putAsset(file)
                .then((assetId) =>
                  setAssets({
                    audio: [
                      ...a.audio,
                      {
                        id: uid(),
                        assetId,
                        name: file.name.replace(/\.[^.]+$/, ""),
                        volume: 0.6,
                        loop: true,
                      },
                    ],
                  }),
                )
                .catch((error: Error) => toast.error(error.message));
            }}
            className="w-full text-xs text-amber-100/60 file:mr-3 file:rounded file:border file:border-amber-200/25 file:bg-transparent file:px-2 file:py-1 file:text-amber-100"
          />
          {a.audio.length === 0 ? (
            <p className="text-[10px] leading-snug text-amber-100/45">
              No music yet. Upload your own tracks and choose which one plays.
            </p>
          ) : null}
          {a.audio.map((track) => {
            const active = a.activeTrackId === track.id;
            const playing = preview === track.id;
            return (
              <div key={track.id} className="space-y-2 rounded border border-amber-200/15 p-2.5">
                <Input
                  value={track.name}
                  aria-label="Track name"
                  onChange={(e) => patchTrack(track.id, { name: e.target.value })}
                  className="h-7 border-amber-200/20 bg-black/40 text-[11px] text-amber-50"
                />
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => {
                      if (playing) {
                        stopTrack();
                        setPreview(null);
                      } else {
                        void playTrack(track.assetId, { volume: track.volume, loop: track.loop });
                        setPreview(track.id);
                      }
                    }}
                    className="rounded border border-amber-200/20 px-2 py-1 text-[10px] text-amber-100/75 hover:bg-amber-200/10"
                  >
                    {playing ? "Pause" : "Play"}
                  </button>
                  <button
                    onClick={() => setAssets({ activeTrackId: active ? null : track.id })}
                    className={`rounded border px-2 py-1 text-[10px] ${
                      active
                        ? "border-amber-300 bg-amber-300/15 text-amber-100"
                        : "border-amber-200/20 text-amber-100/75 hover:bg-amber-200/10"
                    }`}
                  >
                    {active ? "In use" : "Use"}
                  </button>
                  <button
                    onClick={() => {
                      if (playing) {
                        stopTrack();
                        setPreview(null);
                      }
                      void removeAsset(track.assetId);
                      setAssets({
                        audio: a.audio.filter((item) => item.id !== track.id),
                        activeTrackId: active ? null : a.activeTrackId,
                      });
                    }}
                    className="rounded border border-red-400/30 px-2 py-1 text-[10px] text-red-200/80 hover:bg-red-400/10"
                  >
                    Delete
                  </button>
                </div>
                <Row
                  label="Volume"
                  value={track.volume}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => {
                    patchTrack(track.id, { volume: v });
                    if (playing) setTrackVolume(v);
                  }}
                />
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-100/60">
                  <span>Loop</span>
                  <Switch
                    checked={track.loop}
                    onCheckedChange={(v) => patchTrack(track.id, { loop: v })}
                  />
                </div>
                <button
                  onClick={() =>
                    setAssets({
                      roomTrackIds:
                        a.roomTrackIds[game.roomId] === track.id
                          ? Object.fromEntries(
                              Object.entries(a.roomTrackIds).filter(([key]) => key !== game.roomId),
                            )
                          : { ...a.roomTrackIds, [game.roomId]: track.id },
                    })
                  }
                  className={`w-full rounded border px-2 py-1 text-[10px] ${
                    a.roomTrackIds[game.roomId] === track.id
                      ? "border-amber-300 text-amber-100"
                      : "border-amber-200/15 text-amber-100/60 hover:border-amber-200/40"
                  }`}
                >
                  {a.roomTrackIds[game.roomId] === track.id
                    ? "Plays in this room"
                    : "Use for this room only"}
                </button>
              </div>
            );
          })}
        </Section>
      </div>

      <div
        className="shrink-0 border-t border-amber-200/10 p-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={onSave}
          className="w-full rounded border border-amber-300/60 bg-amber-300/15 px-3 py-2 text-xs uppercase tracking-[0.2em] text-amber-100 hover:bg-amber-300/25"
        >
          Save
        </button>
      </div>
    </aside>
  );
}
