import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TEXT_LABEL_SIZE, textLabelStyle, type GameTextLabel } from "@/lib/slate/textLabels";
import { Trash2, Type } from "lucide-react";

/** Add and restyle labels. The sample uses the same size and colour as the game. */
export function TextLabelControls({
  labels,
  selected,
  disabled,
  onAdd,
  onSelect,
  onChange,
  onRemove,
}: {
  labels: GameTextLabel[];
  selected: GameTextLabel | null;
  disabled?: boolean;
  onAdd: () => void;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<Pick<GameTextLabel, "text" | "size" | "colour">>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-3 border-t border-border pt-5">
      <div className="flex items-center justify-between gap-2">
        <Label>Text on the game</Label>
        <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={disabled} onClick={onAdd}>
          <Type /> Add text
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Drag a label to move it. Size and colour update on the game as you change them.</p>
      {labels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <Button
              key={label.id}
              type="button"
              size="sm"
              variant={selected?.id === label.id ? "default" : "outline"}
              className="min-h-11 max-w-full"
              onClick={() => onSelect(label.id)}
            >
              <span className="truncate">{label.text || "Text"}</span>
            </Button>
          ))}
        </div>
      ) : null}
      {selected ? (
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">Words</span>
            <textarea
              aria-label="Label text"
              value={selected.text}
              disabled={disabled}
              rows={2}
              onChange={(event) => onChange(selected.id, { text: event.target.value })}
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
            />
          </label>
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Size · {Math.round(selected.size)}px</span>
            <Slider
              min={TEXT_LABEL_SIZE.min}
              max={TEXT_LABEL_SIZE.max}
              step={1}
              value={[selected.size]}
              disabled={disabled}
              aria-label="Label size"
              onValueChange={([size]) => onChange(selected.id, { size: size ?? selected.size })}
            />
            <p
              aria-hidden
              className="overflow-hidden rounded-md border border-border bg-background px-3 py-2"
              style={textLabelStyle(selected)}
            >
              {selected.text || "Text"}
            </p>
          </div>
          <label className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Colour</span>
            <input
              aria-label="Label colour"
              type="color"
              value={selected.colour}
              disabled={disabled}
              onChange={(event) => onChange(selected.id, { colour: event.target.value })}
              className="h-11 w-16 rounded-md border border-input bg-background p-1"
            />
          </label>
          <Button type="button" variant="outline" className="min-h-11" disabled={disabled} onClick={() => onRemove(selected.id)}>
            <Trash2 /> Delete text
          </Button>
        </div>
      ) : null}
    </div>
  );
}
