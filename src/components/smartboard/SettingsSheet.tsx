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
import { clampLineSpacing, clampTextScale } from "@/lib/smartboard/grid";
import { WritingSurface } from "./WritingSurface";
import { WritingLab } from "./WritingLab";

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
  chromeBg: string;
  chromeFg: string;
  chromeBorder: string;
  surfaceBg: string;
  /** Lesson Line Spacing multiplier (applies only to vertical gap). */
  lineSpacing?: number;
  setLineSpacing?: (v: number) => void;
  /** Text Size multiplier (applies only to content font, not page). */
  textScale?: number;
  setTextScale?: (v: number) => void;
}

const SAMPLE_SRC = "x^{2} + 5x - 7";

export const SettingsSheet = ({
  open,
  onClose,
  surface,
  setSurface,
  profile,
  setProfileId,
  inkColorId,
  setInkColorId,
  chromeBg,
  chromeFg,
  chromeBorder,
  surfaceBg,
  lineSpacing = 0,
  setLineSpacing,
  textScale = 1,
  setTextScale,
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
                          {renderMathInline(SAMPLE_SRC, `samp-${p.id}`)}
                        </div>
                      </WritingSurface>
                    </div>
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

          {/* ── Lesson Line Spacing ─────────────────────────── */}
          {setLineSpacing && (
            <section>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.25em] opacity-60">
                  Lesson Line Spacing
                </p>
                <span className="text-[10px] opacity-60">{Math.round(clampLineSpacing(lineSpacing) * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(clampLineSpacing(lineSpacing) * 100)}
                onChange={(e) => setLineSpacing(clampLineSpacing(Number(e.target.value) / 100))}
                className="w-full"
              />
              <p className="text-[10px] opacity-50 mt-1">
                0% adds no extra blank gap; higher values separate complete lesson lines.
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
                Grows lesson text, equations and math symbols. The page, margins and chrome stay the same.
              </p>
            </section>
          )}



          {/* ── Writing Lab ───────────────────────────────── */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] opacity-60 mb-2">
              Writing Lab
            </p>
            <WritingLab
              profile={profile}
              inkColor={activeInk}
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
