// Slim bottom dock with upward-expanding symbol tray.

import { useEffect, useRef, useState } from "react";
import { ChevronUp, CornerDownLeft, RotateCcw, RotateCw, Trash2, Delete } from "lucide-react";
import { useMathBoard } from "@/hooks/useMathBoard";
import { mkSym } from "@/lib/mathboard/tokens";
import {
  TabKey, TAB_LABELS, SUPER,
  BasicPanel, FractionsPanel, AlgebraPanel, AdvancedPanel, GeometryPanel, LettersPanel,
} from "./Keyboard";

const TABS: TabKey[] = ["basic", "fractions", "algebra", "advanced", "geometry", "letters"];

export const BottomDock = () => {
  const [open, setOpen] = useState<TabKey | null>(null);
  const [exponent, setExponent] = useState(false);
  const { state, insert, type, backspace, undo, redo, reset, submit } = useMathBoard();
  const isSmart = state.mode === "smartboard";
  const trayRef = useRef<HTMLDivElement>(null);

  const typeMaybeExp = (ch: string) => {
    if (exponent && SUPER[ch]) {
      insert(mkSym(SUPER[ch]));
      return;
    }
    type(ch);
  };

  // Esc closes tray
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Click outside closes tray
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!trayRef.current) return;
      const t = e.target as Node;
      if (trayRef.current.contains(t)) return;
      // Don't close when clicking the dock itself (handled by tab toggle)
      const dock = document.getElementById("mb-bottom-dock");
      if (dock && dock.contains(t)) return;
      setOpen(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative">
      {/* Upward tray */}
      {open && (
        <div
          ref={trayRef}
          className="absolute bottom-full left-0 right-0 z-30 border-t border-x border-amber-200/15 bg-card/95 backdrop-blur rounded-t-2xl shadow-[0_-12px_40px_hsl(244_46%_4%/0.6)]"
          style={{ maxHeight: "38vh" }}
        >
          <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: "38vh" }}>
            {open === "basic" && <BasicPanel exponent={exponent} typeMaybeExp={typeMaybeExp} />}
            {open === "fractions" && <FractionsPanel />}
            {open === "algebra" && <AlgebraPanel />}
            {open === "advanced" && <AdvancedPanel />}
            {open === "geometry" && <GeometryPanel />}
            {open === "letters" && <LettersPanel />}
          </div>
        </div>
      )}

      {/* Dock bar */}
      <div
        id="mb-bottom-dock"
        className="flex items-center gap-1 border-t border-amber-200/15 bg-card/60 backdrop-blur px-3 h-12"
      >
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
          {TABS.map((k) => {
            const active = open === k;
            return (
              <button
                key={k}
                onClick={() => setOpen(active ? null : k)}
                className={[
                  "relative px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition whitespace-nowrap",
                  active ? "text-cyan-300" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <span className="inline-flex items-center gap-1">
                  {TAB_LABELS[k]}
                  <ChevronUp className={`h-3 w-3 transition-transform ${active ? "" : "opacity-40"}`} />
                </span>
                {active && (
                  <span className="absolute left-1 right-1 -top-[1px] h-[2px] rounded-full bg-cyan-400 shadow-[0_0_10px_hsl(200_90%_60%/0.6)]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Exponent toggle (compact) */}
        <button
          onClick={() => setExponent((v) => !v)}
          className={[
            "ml-1 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider transition",
            exponent
              ? "border-violet-400/60 bg-violet-500/15 text-violet-200"
              : "border-amber-200/20 text-muted-foreground hover:text-foreground",
          ].join(" ")}
          aria-pressed={exponent}
          title="Exponent mode (digits → superscript)"
        >
          x²
          <span>Exp</span>
        </button>

        {/* Side controls */}
        <div className="ml-2 flex items-center gap-0.5 border-l border-amber-200/15 pl-2">
          <IconBtn onClick={undo} icon={<RotateCcw className="h-3.5 w-3.5" />} label="Undo" />
          <IconBtn onClick={redo} icon={<RotateCw className="h-3.5 w-3.5" />} label="Redo" />
          <IconBtn onClick={backspace} icon={<Delete className="h-3.5 w-3.5" />} label="Delete" />
          <IconBtn onClick={reset} icon={<Trash2 className="h-3.5 w-3.5" />} label="Clear" />
        </div>

        {/* Inline ENTER — only in game mode (smartboard uses assistant ENTER) */}
        {!isSmart && (
          <button
            onClick={submit}
            className="ml-2 inline-flex items-center gap-1.5 rounded-md border border-cyan-400/60 bg-cyan-500/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-200 hover:bg-cyan-500/25 transition"
          >
            <CornerDownLeft className="h-3.5 w-3.5" /> Enter
          </button>
        )}
      </div>
    </div>
  );
};

const IconBtn = ({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background/40 transition"
  >
    {icon}
  </button>
);

export default BottomDock;
