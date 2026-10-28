// Structured "More" menu — Settings · Workspace · Theme · Accessibility ·
// Equation Display · Symbol Controls · Zoom Controls.
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { THEMES, ThemeId } from "@/lib/smartboard/theme";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Settings, LayoutGrid, Palette, Eye, Type, Sigma, Maximize2,
} from "lucide-react";

type View =
  | "root" | "settings" | "workspace" | "theme"
  | "accessibility" | "equation" | "symbols" | "zoom";

interface Props {
  trigger: React.ReactNode;
  themeId: ThemeId;
  setThemeId: (t: ThemeId) => void;
  equationSize: number;
  setEquationSize: (n: number) => void;
  workspaceZoom: number;
  setWorkspaceZoom: (n: number) => void;
  glow: number;
  setGlow: (n: number) => void;
  onReset: () => void;
}

const Row = ({
  icon, label, onClick,
}: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between px-2 py-2 rounded-md hover:bg-muted/40 text-sm"
  >
    <span className="flex items-center gap-2">
      <span className="opacity-70">{icon}</span>
      {label}
    </span>
    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
  </button>
);

const Header = ({ title, onBack }: { title: string; onBack: () => void }) => (
  <div className="flex items-center gap-2 mb-2">
    <button
      onClick={onBack}
      className="p-1 rounded hover:bg-muted/40"
      aria-label="back"
    >
      <ChevronLeft className="h-4 w-4" />
    </button>
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
  </div>
);

export const MoreMenu = ({
  trigger, themeId, setThemeId, equationSize, setEquationSize,
  workspaceZoom, setWorkspaceZoom, glow, setGlow, onReset,
}: Props) => {
  const [view, setView] = useState<View>("root");
  const back = () => setView("root");

  return (
    <Popover onOpenChange={(o) => { if (!o) setView("root"); }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-1">
        {view === "root" && (
          <div className="space-y-0.5">
            <Row icon={<Settings className="h-4 w-4" />}    label="Settings"          onClick={() => setView("settings")} />
            <Row icon={<LayoutGrid className="h-4 w-4" />}  label="Workspace"         onClick={() => setView("workspace")} />
            <Row icon={<Palette className="h-4 w-4" />}     label="Theme"             onClick={() => setView("theme")} />
            <Row icon={<Eye className="h-4 w-4" />}         label="Accessibility"     onClick={() => setView("accessibility")} />
            <Row icon={<Type className="h-4 w-4" />}        label="Equation Display"  onClick={() => setView("equation")} />
            <Row icon={<Sigma className="h-4 w-4" />}       label="Symbol Controls"   onClick={() => setView("symbols")} />
            <Row icon={<Maximize2 className="h-4 w-4" />}   label="Zoom"              onClick={() => setView("zoom")} />
          </div>
        )}

        {view === "settings" && (
          <>
            <Header title="Settings" onBack={back} />
            <div className="space-y-3">
              <Row icon={<Palette className="h-4 w-4" />}   label="Background Color" onClick={() => setView("theme")} />
              <div className="text-[10px] px-2 -mt-1 text-muted-foreground">
                Text color adapts automatically to the background.
              </div>
              <Row icon={<Type className="h-4 w-4" />}      label="Equation Size"    onClick={() => setView("equation")} />
              <Row icon={<Maximize2 className="h-4 w-4" />} label="Zoom"              onClick={() => setView("zoom")} />
              <Row icon={<Palette className="h-4 w-4" />}   label="Theme Presets"    onClick={() => setView("theme")} />
              <Row icon={<Eye className="h-4 w-4" />}       label="Contrast Mode"    onClick={() => setView("accessibility")} />
            </div>
          </>
        )}

        {view === "workspace" && (
          <>
            <Header title="Workspace" onBack={back} />
            <button onClick={onReset}
              className="w-full text-sm py-2 rounded-md border border-border hover:bg-muted/40 transition">
              Reset board
            </button>
          </>
        )}

        {view === "theme" && (
          <>
            <Header title="Theme" onBack={back} />
            <div className="grid grid-cols-3 gap-2">
              {Object.values(THEMES).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  className={[
                    "px-2 py-2 rounded-md text-xs border transition text-left",
                    themeId === t.id ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted/40",
                  ].join(" ")}
                  style={{
                    background: t.bg,
                    color: t.bgLuminance < 0.5 ? "hsl(0 0% 96%)" : "hsl(220 25% 12%)",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="text-[10px] mt-2 text-muted-foreground">
              Text colour adapts to the background luminance.
            </div>
          </>
        )}

        {view === "accessibility" && (
          <>
            <Header title="Accessibility" onBack={back} />
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Glow — {Math.round(glow * 100)}%
            </div>
            <Slider min={0} max={100} step={5} value={[Math.round(glow * 100)]}
              onValueChange={(v) => setGlow(v[0] / 100)} />
          </>
        )}

        {view === "equation" && (
          <>
            <Header title="Equation Display" onBack={back} />
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Equation size — {equationSize}px
            </div>
            <Slider min={16} max={64} step={1} value={[equationSize]}
              onValueChange={(v) => setEquationSize(v[0])} />
          </>
        )}

        {view === "symbols" && (
          <>
            <Header title="Symbol Controls" onBack={back} />
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Tap a symbol to cycle through its variants.</div>
              <div>Hold a symbol to open the quick-select wheel.</div>
            </div>
          </>
        )}

        {view === "zoom" && (
          <>
            <Header title="Zoom" onBack={back} />
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Zoom — {Math.round(workspaceZoom * 100)}%
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setWorkspaceZoom(Math.max(0.5, Number((workspaceZoom - 0.1).toFixed(2))))}
                  className="p-1 rounded hover:bg-muted/40"
                  aria-label="zoom out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setWorkspaceZoom(Math.min(2, Number((workspaceZoom + 0.1).toFixed(2))))}
                  className="p-1 rounded hover:bg-muted/40"
                  aria-label="zoom in"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setWorkspaceZoom(1)}
                  className="px-2 text-[10px] rounded hover:bg-muted/40"
                >
                  Reset
                </button>
              </div>
            </div>
            <Slider min={50} max={200} step={5} value={[Math.round(workspaceZoom * 100)]}
              onValueChange={(v) => setWorkspaceZoom(v[0] / 100)} />
            <div className="text-[10px] mt-2 text-muted-foreground">
              Shortcut: Ctrl/Cmd + + / − / 0, or Ctrl + scroll.
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default MoreMenu;
