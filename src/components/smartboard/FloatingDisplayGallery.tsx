// Floating Number Display — the design gallery shown inside Smartboard
// Settings. Each card is a real miniature of the layout, drawn with static
// sample chips so previews never touch live floating-number data.

import { Check } from "lucide-react";
import { FLOATING_DISPLAY_STYLES, type FloatingDisplayStyleId } from "@/lib/smartboard/floatingDisplayStyles";
import { useFloatingDisplayStyle } from "@/hooks/useFloatingDisplayStyle";
import { FloatingDisplayFrame } from "./floatingDisplays";

const SAMPLE = ["½", "x =", "− 3", "4"];

const noop = () => {};

const Preview = ({ style, chromeFg }: { style: FloatingDisplayStyleId; chromeFg: string }) => (
  <div
    aria-hidden
    style={{
      display: "flex", alignItems: "center", gap: 8,
      transform: "scale(0.72)", transformOrigin: "left center",
      width: "139%", pointerEvents: "none",
    }}
  >
    <FloatingDisplayFrame
      style={style}
      chromeFg={chromeFg}
      frozen={false}
      frozenTitle=""
      chips={
        <>
          {SAMPLE.map((t) => (
            <span
              key={t}
              style={{
                padding: "0 4px", color: style === "neon" ? "#e2f7ff" : "#111827",
                fontFamily: "ui-serif, Georgia, serif", fontSize: 20, whiteSpace: "nowrap",
              }}
            >{t}</span>
          ))}
        </>
      }
      left={{ enabled: true, label: "Backward", onTap: noop }}
      right={{ enabled: true, label: "Forward", onTap: noop }}
      up={{ enabled: true, label: "Previous line", onTap: noop }}
      down={{ enabled: true, label: "Next line", onTap: noop }}
      lineText="L3"
      lineTitle="Line 3"
    />
  </div>
);

export const FloatingDisplayGallery = ({ chromeFg, chromeBorder }: { chromeFg: string; chromeBorder: string }) => {
  const { style, platformDefault, userChoice, isAdmin, saving, chooseForMe, setPlatformDefault } =
    useFloatingDisplayStyle();

  return (
    <section className="space-y-3">
      <div>
        <h3 style={{ color: chromeFg }} className="text-sm font-semibold">Floating Number Display</h3>
        <p style={{ color: chromeFg }} className="text-xs opacity-70">
          Choose how floating numbers appear on the Smartboard. Your choice applies to you only;
          {isAdmin ? " the platform default is what everyone else starts with." : " administrators set the starting default."}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {FLOATING_DISPLAY_STYLES.map((design) => {
          const mine = userChoice === design.id || (userChoice == null && style === design.id);
          return (
            <div
              key={design.id}
              style={{ border: `1px solid ${chromeBorder}`, color: chromeFg }}
              className="rounded-xl p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{design.name}</span>
                <div className="flex items-center gap-1">
                  {mine && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      <Check className="h-3 w-3" /> Your design
                    </span>
                  )}
                  {platformDefault === design.id && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      <Check className="h-3 w-3" /> Platform default
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs opacity-70">{design.description}</p>
              <div className="overflow-hidden rounded-lg bg-muted/30 px-2 py-3">
                <Preview style={design.id} chromeFg={chromeFg} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={saving || mine}
                  onClick={() => chooseForMe(design.id)}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-45"
                >
                  {mine ? "In use" : "Use this design"}
                </button>
                {isAdmin && (
                  <button
                    disabled={saving || platformDefault === design.id}
                    onClick={() => setPlatformDefault(design.id)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-45"
                    style={{ color: chromeFg }}
                  >
                    {platformDefault === design.id ? "Default" : "Set as platform default"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default FloatingDisplayGallery;
