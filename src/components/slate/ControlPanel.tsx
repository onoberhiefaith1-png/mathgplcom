import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SURFACES } from "@/lib/slate/surfaces";
import { ROOMS } from "@/lib/slate/rooms";
import { REWARDS, getReward } from "@/lib/slate/rewards";
import {
  INTEGRATIONS,
  RELIEFS,
  TEXT_STYLES,
  defaultTextSettings,
} from "@/lib/slate/text3d";
import { TextColourPicker } from "./TextColourPicker";
import type { TextSettings } from "@/lib/slate/text3d";
import { defaultNumberSettings, makeSlot } from "@/lib/slate/defaults";
import type { Game, NumberSettings, Selection, Slot } from "@/lib/slate/types";

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
  const t: TextSettings = s.text ?? defaultTextSettings();
  const setText = (patch: Partial<TextSettings>) => set({ text: { ...t, ...patch } });
  const n: NumberSettings = s.numbers ?? defaultNumberSettings();
  const setNumbers = (patch: Partial<NumberSettings>) => set({ numbers: { ...n, ...patch } });

  const activeSlot =
    selection.kind !== "none" ? (game.slots.find((x) => x.id === selection.slotId) ?? null) : null;
  const activeReward =
    selection.kind === "reward"
      ? (activeSlot?.rewards.find((r) => r.id === selection.rewardId) ?? null)
      : null;

  const onBackgroundFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () =>
      onChange({
        background: {
          ...game.background,
          src: String(reader.result),
          kind: file.type.startsWith("video") ? "video" : "image",
        },
      });
    reader.readAsDataURL(file);
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
    <aside className="flex h-full w-full flex-col border-l border-amber-200/15 bg-[#120d07]/95 backdrop-blur-md">
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

      <div className="slate-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
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
            value={game.roomId}
            aria-label="Room"
            onChange={(e) => {
              const room = ROOMS.find((r) => r.id === e.target.value);
              if (room) onChange({ roomId: room.id, surfaceId: room.surfaceId });
            }}
            className="w-full rounded border border-amber-200/20 bg-black/50 px-2 py-1.5 text-[11px] text-amber-100"
          >
            {ROOMS.map((r) => (
              <option key={r.id} value={r.id} className="bg-[#120d07]">
                {r.label}
              </option>
            ))}
          </select>
        </Section>

        <Section title="Slate / Surface">
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
                  className="block h-8 w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${sf.texture})` }}
                />
                <span className="block px-1.5 py-1 text-amber-100/75">{sf.label}</span>
              </button>
            ))}
          </div>
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


        <Section title="Text">
          <div className="space-y-1.5">
            {TEXT_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => setText({ style: style.id })}
                className={`w-full rounded border px-2.5 py-2 text-left ${
                  t.style === style.id
                    ? "border-amber-300 bg-amber-200/10 text-amber-100"
                    : "border-amber-200/15 text-amber-100/60 hover:border-amber-200/40"
                }`}
              >
                <span className="block text-[11px] font-semibold">{style.label}</span>
                <span className="block text-[10px] text-amber-100/50">{style.blurb}</span>
              </button>
            ))}
          </div>

          <Choice values={RELIEFS} value={t.relief} cols={4} onChange={(v) => setText({ relief: v })} />
          <Choice
            values={["left", "center", "right"] as const}
            value={t.align}
            onChange={(v) => setText({ align: v })}
          />

          <TextColourPicker text={t} onChange={setText} />

          <Row label="Text size" value={t.size} min={16} max={64} step={1}
            onChange={(v) => setText({ size: v })} />
          <Row label="Depth" value={t.depth} min={0} max={2} step={0.05}
            onChange={(v) => setText({ depth: v })} />
          <Row label="Bevel" value={t.bevel} min={0} max={2} step={0.05}
            onChange={(v) => setText({ bevel: v })} />
          <Row label="Contrast" value={t.contrast} min={0.3} max={2} step={0.05}
            onChange={(v) => setText({ contrast: v })} />
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-100/60">
            <span>Shadow</span>
            <Switch checked={t.shadow} onCheckedChange={(v) => setText({ shadow: v })} />
          </div>
          <Row label="Shadow strength" value={t.shadowStrength} min={0} max={2} step={0.05}
            onChange={(v) => setText({ shadowStrength: v })} />
          <Row label="Highlight" value={t.highlight} min={0} max={2} step={0.05}
            onChange={(v) => setText({ highlight: v })} />
          <Choice
            values={["off", "subtle", "medium"] as const}
            value={t.glow}
            prefix="Glow"
            onChange={(v) => setText({ glow: v })}
          />
          <Row label="Glow intensity" value={t.glowIntensity} min={0} max={2} step={0.05}
            onChange={(v) => setText({ glowIntensity: v })} />
          <Row label="Line spacing" value={t.lineSpacing} min={1} max={2.2} step={0.05}
            onChange={(v) => setText({ lineSpacing: v })} />
          <Row label="Letter spacing" value={t.letterSpacing} min={-0.02} max={0.2} step={0.005}
            onChange={(v) => setText({ letterSpacing: v })} />
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
        </Section>

        <Section title="Rewards">
          <div className="grid grid-cols-5 gap-1">
            {REWARDS.map((r) => (
              <button
                key={r.id}
                onClick={() => onAddReward(r.id)}
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
                  {getReward(activeReward.type).label} · {activeReward.state}
                </span>
              </div>
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
            </div>
          ) : null}
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
      </div>

      <div className="border-t border-amber-200/10 p-4">
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
