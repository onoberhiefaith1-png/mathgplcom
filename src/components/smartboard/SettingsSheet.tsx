// SettingsSheet — slide-in right-side panel for Smartboard. Holds:
//  1. Board Surface (whiteboard / blackboard)
//  2. Writing Style (5 profiles, each with live sample)
//  3. Ink Color (softened palette)
//  4. Writing Lab (live preview sandbox)

import { useEffect } from "react";
import { X } from "lucide-react";
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
import { FloatingDisplayGallery } from "./FloatingDisplayGallery";

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
}: Props) => {
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
