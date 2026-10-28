import { Camera, ChevronRight, Eye, Image as ImageIcon, Trophy, Zap } from "lucide-react";
import SignedMedia from "./SignedMedia";
import { cn } from "@/lib/utils";
import type { CanvasElement } from "@/lib/games/types";

interface EffectsRailProps {
  elements: CanvasElement[];
  selectedId: string | null;
  cameraTargetId: string | null | undefined;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const kindIcon = (kind: CanvasElement["kind"]) => {
  switch (kind) {
    case "reward":
      return Trophy;
    case "progress_bar":
      return ImageIcon;
    case "effect":
      return Zap;
    default:
      return Zap;
  }
};

const EffectsRail = ({
  elements,
  selectedId,
  cameraTargetId,
  onSelect,
  onClose,
}: EffectsRailProps) => {
  const items = [...elements]
    .filter((e) => e.kind !== "background")
    .sort((a, b) => b.z - a.z);

  return (
    <div className="flex h-full w-64 flex-col border-l border-border/40 bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/90">
          Layers
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          title="Hide layers"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {items.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            No items yet. Add a reward or effect to see it here.
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((el) => {
              const Icon = kindIcon(el.kind);
              const active = el.id === selectedId;
              return (
                <li key={el.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(el.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition",
                      active
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border/60 hover:text-foreground",
                    )}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-black/40">
                      <SignedMedia
                        path={el.storagePath}
                        source={el.source}
                        mediaType={el.mediaType}
                        fit="contain"
                        className="h-full w-full"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 truncate font-medium">
                        <Icon className="h-3 w-3 shrink-0 opacity-70" />
                        {el.label || el.kind.replace("_", " ")}
                      </span>
                    </span>
                    {cameraTargetId === el.id && (
                      <Camera className="h-3.5 w-3.5 shrink-0 text-accent" />
                    )}
                    {active && <Eye className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default EffectsRail;
