import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/games/types";

interface SceneStripProps {
  scenes: Scene[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Adventure is one complete challenge, so adding scenes is off by default. */
  onAdd?: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

const SceneStrip = ({
  scenes,
  activeId,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
}: SceneStripProps) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-border/40 bg-background/70 px-3 py-2 backdrop-blur">
      {scenes.map((s, i) => {
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={cn(
              "group flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition",
              active
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            <span className="font-semibold">Scene {i + 1}</span>
            {s.tag && (
              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {s.tag}
              </span>
            )}
            {active && (
              <span className="ml-1 flex items-center gap-0.5">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(s.id);
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  title="Duplicate scene"
                >
                  <Copy className="h-3.5 w-3.5" />
                </span>
                {scenes.length > 1 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                    title="Delete scene"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
            )}
          </button>
        );
      })}
      {onAdd && (
      <Button size="sm" variant="secondary" className="shrink-0" onClick={onAdd}>
        <Plus className="mr-1.5 h-4 w-4" /> Add Scene
      </Button>
    </div>
  );
};

export default SceneStrip;
