// Popover-style picker that inserts a MathObject node at the editor cursor.
// One column per category. Click an object to insert; the teacher can then
// resize, duplicate, or delete it via the inline node controls.

import { useState } from "react";
import { CATEGORIES, OBJECTS, objectsByCategory, type CategoryId } from "@/lib/mathObjects/catalog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called once per click — picker stays open so teachers can insert multiple. */
  onInsert: (kind: string) => void;
}

export function MathObjectsPicker({ open, onOpenChange, onInsert }: Props) {
  const [active, setActive] = useState<CategoryId>("everyday");
  const list = active ? objectsByCategory(active) : OBJECTS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Math Objects</DialogTitle>
          <DialogDescription>
            Click an object to insert it into the lesson note. Objects can then be
            resized, duplicated, or replaced — useful before introducing variables.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5 pb-2 border-b">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActive(c.id)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                active === c.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-[55vh] overflow-y-auto pt-3">
          {list.map((o) => (
            <button
              key={o.kind}
              type="button"
              onClick={() => onInsert(o.kind)}
              className="flex flex-col items-center gap-1 p-2 rounded hover:bg-muted text-foreground"
              title={`Insert ${o.label}`}
            >
              <span style={{ width: 36, height: 36, display: "inline-block" }}>{o.draw()}</span>
              <span className="text-[10px] text-muted-foreground leading-tight text-center">{o.label}</span>
            </button>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
