// SettingsSheet — slide-in right-side panel for Smartboard. Holds:
//  1. Board Surface (whiteboard / blackboard)
//  2. Writing Style (5 profiles, each with live sample)
//  3. Ink Color (softened palette)
//  4. Writing Lab (live preview sandbox)

import { useEffect } from "react";
import { X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { TRAIL_PRESETS } from "@/lib/flow/types";
import { DEFAULT_TRAY, type TraySettings } from "@/lib/smartboard/traySettings";
import { renderMathInline } from "@/lib/notebook/mathRender";
import {
  PROFILE_LIST,
  WritingProfile,
  WritingProfileId,
} from "@/lib/smartboard/writingProfiles";
import { COLOR_LIST, InkColorId, resolveInk } from "@/lib/smartboard/inkColors";
import {
  PLACEHOLDER_COLOR_LIST,
  PlaceholderColorId,
  resolvePlaceholderColor,
} from "@/lib/smartboard/placeholderColor";
import { clampRowSpacing, clampTextScale } from "@/lib/smartboard/grid";
import { WritingSurface } from "./WritingSurface";
import { WritingLab } from "./WritingLab";
import { TrayPreview } from "./BoardTray";
import { FloatingDisplayGallery } from "./FloatingDisplayGallery";
import FloatingNumberSizeControl from "./FloatingNumberSizeControl";
import TierPicker from "@/components/academia/TierPicker";
import { useDefaultTier } from "@/hooks/useDefaultTier";

type Surface = "whiteboard" | "blackboard";

interface Props {
  open: boolean;
  onClose: () => void;
  surface: Surface;
  setSurface: (s: Surface) => void;
  profile: WritingProfile;
  setProfileId: (id: WritingProfileId) => void;
  inkColorId: InkColorId;
  setInkColorId: (id: InkColorId) => void;
  placeholderColorId: PlaceholderColorId;
  setPlaceholderColorId: (id: PlaceholderColorId) => void;
  chromeBg: string;
  chromeFg: string;
  chromeBorder: string;
  surfaceBg: string;
  /** Row Spacing multiplier (extra gap between consecutive rows). */
  rowSpacing?: number;
  setRowSpacing?: (v: number) => void;
  /** Text Size multiplier (applies only to content font, not page). */
  textScale?: number;
  setTextScale?: (v: number) => void;
  /** Phones use one purpose-built compact Floating Number layout. */
  compactPhone?: boolean;
  permanentAchievementColor?: string;
  currentAttemptColor?: string;
  onPermanentAchievementColorChange?: (color: string) => void;
  onCurrentAttemptColorChange?: (color: string) => void;
  tray?: TraySettings;
  setTray?: (next: TraySettings) => void;
}

const SAMPLE_SRC = "x = \\frac{\\sl{}}{\\sl{}}";

export const SettingsSheet = ({
  open,
  onClose,
  surface,
  setSurface,
  profile,
  setProfileId,
  inkColorId,
  setInkColorId,
  placeholderColorId,
  setPlaceholderColorId,
  chromeBg,
  chromeFg,
  chromeBorder,
  surfaceBg,
  rowSpacing = 0,
  setRowSpacing,
  textScale = 1,
  setTextScale,
  compactPhone = false,
  permanentAchievementColor,
  currentAttemptColor,
  onPermanentAchievementColorChange,
  onCurrentAttemptColorChange,
  tray = DEFAULT_TRAY,
  setTray,
}: Props) => {
  const { tier: defaultTier, setTier: setDefaultTier } = useDefaultTier({ account: true });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const activeInk = resolveInk(inkColorId, surface);
  const activePlaceholder = resolvePlaceholderColor(placeholderColorId, surface);

  return (
    <>
      {/* Scrim — dismiss on click */}
      <button
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 z-30 cursor-default"
        style={{ background: "rgba(0,0,0,0.18)", backdropFilter: "blur(2px)" }}
      />

      <aside
        data-sb-settings-open="true"
        className="absolute top-0 right-0 z-40 h-full w-[min(420px,92vw)] overflow-y-auto border-l shadow-2xl animate-slide-in-right"
        style={{
          background: chromeBg,
          color: chromeFg,
          borderColor: chromeBorder,
          backdropFilter: "blur(14px)",
        }}
      >
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: chromeBorder, background: chromeBg }}
        >
          <h2 className="text-sm font-medium tracking-wide">Board Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-black/5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-4 py-4 space-y-6">
          {/* ── Board Surface ─────────────────────────────── */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] opacity-60 mb-2">
              Board Surface
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["whiteboard", "blackboard"] as Surface[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSurface(s)}
                  className="rounded-lg border px-2 py-2 text-xs flex flex-col items-stretch gap-1.5"
                  style={{
                    borderColor: surface === s ? chromeFg : chromeBorder,
                    background: surface === s ? "rgba(0,0,0,0.05)" : "transparent",
                    color: chromeFg,
                  }}
                >
                  <span
                    className="h-8 rounded-md"
                    style={{
                      background:
                        s === "whiteboard"
                          ? "linear-gradient(160deg,#f6f4ef,#e8e6df)"
                          : "linear-gradient(170deg,#1d2522,#111614)",
                      boxShadow: "inset 0 0 18px rgba(0,0,0,0.25)",
                    }}
                  />
                  <span className="capitalize">{s}</span>
                </button>
              ))}
            </div>
          </section>

          {setTray && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-[0.25em] opacity-60">Tray</p>
                <Switch
                  checked={tray.enabled}
                  onCheckedChange={(enabled) => setTray({ ...tray, enabled })}
                  aria-label="Tray on or off"
                />
              </div>
              <p className="mb-3 text-[10px] opacity-60">
                Follows the pointer on the board. On for a solution, or on for the whole lesson.
              </p>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {([
                  ["solution", "Only on solution"],
                  ["always", "Always on"],
                ] as const).map(([mode, label]) => {
                  const on = tray.mode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTray({ ...tray, mode })}
                      className="rounded-md border px-2 py-1.5 text-xs"
                      style={{
                        borderColor: on ? chromeFg : chromeBorder,
                        background: on ? "rgba(0,0,0,0.06)" : "transparent",
                        color: chromeFg,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {TRAIL_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    title={preset.name}
                    aria-label={preset.name}
                    onClick={() => setTray({ ...tray, color: preset.color })}
                    className="h-7 w-7 rounded-md border-2"
                    style={{
                      background: preset.color,
                      borderColor: tray.color === preset.color ? chromeFg : "transparent",
                    }}
                  />
                ))}
                <label className="flex items-center gap-1 text-[10px] opacity-70">
                  Colour
                  <input
                    type="color"
                    aria-label="Tray colour"
                    value={tray.color}
                    onChange={(event) => setTray({ ...tray, color: event.target.value })}
                    className="h-7 w-8 cursor-pointer rounded border bg-transparent p-0.5"
                    style={{ borderColor: chromeBorder }}
                  />
                </label>
              </div>
              {([
                ["length", "Length"],
                ["width", "Width"],
                ["speed", "Speed"],
                ["vibration", "Vibration"],
                ["glow", "Glow"],
              ] as const).map(([key, label]) => (
                <label key={key} className="mb-2 block">
                  <span className="mb-1 flex items-baseline justify-between text-[10px] opacity-70">
                    <span>{label}</span>
                    <span>{Math.round(tray[key] * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    aria-label={`Tray ${label}`}
                    value={Math.round(tray[key] * 100)}
                    onChange={(event) => setTray({ ...tray, [key]: Number(event.target.value) / 100 })}
                    className="w-full"
                  />
                </label>
              ))}
              <label className="block">
                <span className="mb-1 flex items-baseline justify-between text-[10px] opacity-70">
                  <span>Fade</span>
                  <span>{tray.fadeSec.toFixed(1)}s</span>
                </span>
                <input
                  type="range"
                  min={0.3}
                  max={5}
                  step={0.1}
                  aria-label="Tray fade"
                  value={tray.fadeSec}
                  onChange={(event) => setTray({ ...tray, fadeSec: Number(event.target.value) })}
                  className="w-full"
                />
              </label>
              <div className="mt-2 flex items-center justify-between text-[10px] opacity-80">
                <span>Snake animation (as in Flow)</span>
                <Switch
                  checked={tray.animate !== false}
                  onCheckedChange={(animate) => setTray({ ...tray, animate })}
                  aria-label="Trail animation on or off"
                />
              </div>
              {/* Live preview — the same ribbon with these exact values. Move
                  the mouse or a finger over it to see it follow. */}
              <TrayPreview settings={tray} border={chromeBorder} />
              <p className="mt-1 text-[10px] opacity-60">Preview — move your pointer or finger over it.</p>
            </section>
          )}

          {/* ── Writing Style ─────────────────────────────── */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] opacity-60 mb-2">
              Writing Style
            </p>
            <div className="space-y-2">
              {PROFILE_LIST.map((p) => {
                const active = p.id === profile.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setProfileId(p.id)}
                    className="w-full text-left rounded-lg border p-2.5"
                    style={{
                      borderColor: active ? chromeFg : chromeBorder,
                      background: active ? "rgba(0,0,0,0.05)" : "transparent",
                    }}
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs font-medium">{p.label}</span>
                      <span className="text-[10px] opacity-50">{p.blurb}</span>
                    </div>
                    <div
                      className="rounded-md mt-1 px-3 py-2"
                      style={{ background: surfaceBg }}
                    >
                      <WritingSurface profile={p} inkColor={activeInk} surface={surface}>
                        <div className="text-sm leading-snug">The Smartboard</div>
                        <div style={{ fontSize: 18 }}>
                          {renderMathInline(SAMPLE_SRC, `samp-${p.id}`, { placeholderColor: activePlaceholder })}
                        </div>
                      </WritingSurface>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Placeholder Color ─────────────────────────── */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] opacity-60 mb-2">
              Placeholder Color
            </p>
            <div className="flex flex-wrap gap-2">
              {PLACEHOLDER_COLOR_LIST.map((c) => {
                const swatch = c[surface];
                const active = c.id === placeholderColorId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setPlaceholderColorId(c.id)}
                    className="rounded-md border flex flex-col items-center gap-1 px-2 py-1.5"
                    style={{
                      borderColor: active ? chromeFg : chromeBorder,
                      background: active ? "rgba(0,0,0,0.05)" : "transparent",
                      minWidth: 56,
                    }}
                    title={c.label}
                  >
                    <span
                      className="block rounded-full"
                      style={{
                        width: 22,
                        height: 22,
                        background: swatch,
                        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)",
                      }}
                    />
                    <span className="text-[10px] opacity-70">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Ink Color ─────────────────────────────────── */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] opacity-60 mb-2">
              Ink Color
            </p>
            <div className="flex flex-wrap gap-2">
              {COLOR_LIST.map((c) => {
                const swatch = c[surface];
                const active = c.id === inkColorId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setInkColorId(c.id)}
                    className="rounded-md border flex flex-col items-center gap-1 px-2 py-1.5"
                    style={{
                      borderColor: active ? chromeFg : chromeBorder,
                      background: active ? "rgba(0,0,0,0.05)" : "transparent",
                      minWidth: 56,
                    }}
                    title={c.label}
                  >
                    <span
                      className="block rounded-full"
                      style={{
                        width: 22,
                        height: 22,
                        background: swatch,
                        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
                      }}
                    />
                    <span className="text-[10px] opacity-70">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {(onPermanentAchievementColorChange || onCurrentAttemptColorChange) && (
            <section>
              <p className="mb-2 text-[10px] uppercase tracking-[0.25em] opacity-60">Line Progress Colours</p>
              <div className="space-y-3">
                {onPermanentAchievementColorChange && permanentAchievementColor && (
                  <label className="flex items-center justify-between gap-3 text-xs">
                    <span>Permanent Achievement Colour</span>
                    <input
                      type="color"
                      aria-label="Permanent Achievement Colour"
                      value={permanentAchievementColor}
                      onChange={(event) => onPermanentAchievementColorChange(event.target.value)}
                      className="h-9 w-12 cursor-pointer rounded-md border p-1"
                      style={{ borderColor: chromeBorder, background: "transparent" }}
                    />
                  </label>
                )}
                {onCurrentAttemptColorChange && currentAttemptColor && (
                  <label className="flex items-center justify-between gap-3 text-xs">
                    <span>Current Timed/Repeat Attempt Colour</span>
                    <input
                      type="color"
                      aria-label="Current Timed/Repeat Attempt Colour"
                      value={currentAttemptColor}
                      onChange={(event) => onCurrentAttemptColorChange(event.target.value)}
                      className="h-9 w-12 cursor-pointer rounded-md border p-1"
                      style={{ borderColor: chromeBorder, background: "transparent" }}
                    />
                  </label>
                )}
              </div>
            </section>
          )}

          {/* ── Row Spacing ─────────────────────────── */}
          {setRowSpacing && (
            <section>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.25em] opacity-60">
                  Row Spacing
                </p>
                <span className="text-[10px] opacity-60">
                  {clampRowSpacing(rowSpacing)} × cursor height
                </span>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5, 6].map((n) => {
                  const active = clampRowSpacing(rowSpacing) === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setRowSpacing(n)}
                      className="flex-1 rounded-md border py-1.5 text-xs font-medium"
                      style={{
                        borderColor: active ? chromeFg : chromeBorder,
                        background: active ? "rgba(0,0,0,0.06)" : "transparent",
                        opacity: active ? 1 : 0.65,
                      }}
                      aria-pressed={active}
                    >
                      {n}×
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] opacity-50 mt-1">
                Vertical gap between writable Rows, counted in whole cursor
                heights. Does not change text size.
              </p>
            </section>
          )}

          {/* ── Text Size ──────────────────────────────────── */}
          {setTextScale && (
            <section>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.25em] opacity-60">
                  Text Size
                </p>
                <span className="text-[10px] opacity-60">{Math.round(textScale * 100)}%</span>
              </div>
              <input
                type="range"
                min={70}
                max={180}
                step={1}
                value={Math.round(textScale * 100)}
                onChange={(e) => setTextScale(clampTextScale(Number(e.target.value) / 100))}
                className="w-full"
              />
              <p className="text-[10px] opacity-50 mt-1">
                Size of text and mathematical expressions only. Larger text
                grows downward and pushes the content below it down; it never
                changes Row Spacing.
              </p>
            </section>
          )}


          {/* ── Floating Number Display ─────────────────────── */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] opacity-60 mb-2">
              Floating Number Display
            </p>
            {compactPhone ? (
              <div
                className="rounded-md border px-3 py-2 text-xs"
                style={{ borderColor: chromeBorder, color: chromeFg }}
              >
                Compact phone layout
              </div>
            ) : (
              <FloatingDisplayGallery chromeFg={chromeFg} chromeBorder={chromeBorder} />
            )}
          </section>


          {/* ── Floating Number Size (spec §8) ─────────────── */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] opacity-60 mb-2">
              Floating Number Size
            </p>
            <FloatingNumberSizeControl
              preview={compactPhone ? "phone" : "board"}
              chromeFg={chromeFg}
              chromeBorder={chromeBorder}
            />
          </section>

          {/* ── Default tier (spec §4) ──────────────────────── */}
          <section>
            <TierPicker
              label="Default tier"
              value={defaultTier}
              onChange={setDefaultTier}
              hint="Academia sessions open on this tier. Switch any time with the selector at the top right of a session."
            />
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] opacity-60 mb-2">
              Writing Lab
            </p>
            <WritingLab
              profile={profile}
              inkColor={activeInk}
              placeholderColor={activePlaceholder}
              surface={surface}
              surfaceBg={surfaceBg}
              chromeFg={chromeFg}
              chromeBorder={chromeBorder}
            />
          </section>
        </div>
      </aside>
    </>
  );
};

export default SettingsSheet;
