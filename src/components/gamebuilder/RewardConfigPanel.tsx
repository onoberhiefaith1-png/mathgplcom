import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Play, MapPin, Flag, Save, X, Check } from "lucide-react";

export type RewardCapture = "none" | "start" | "end";

export interface RewardDraft {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  scale: number;
  rotation: number;
  opacity: number;
  durationMs: number;
}

interface Props {
  label: string;
  draft: RewardDraft;
  startSet: boolean;
  endSet: boolean;
  previewing: boolean;
  /** Record the reward's current on-canvas position as start or end. */
  onCapture: (mode: "start" | "end") => void;
  onPatch: (patch: Partial<RewardDraft>) => void;
  onPreview: () => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}

const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "—");

const RewardConfigPanel = ({
  label,
  draft,
  startSet,
  endSet,
  previewing,
  onCapture,
  onPatch,
  onPreview,
  onSave,
  onCancel,
  saving = false,
}: Props) => {
  const seconds = Math.round(draft.durationMs / 1000);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Configuring Reward
        </div>
        <div className="mt-1 truncate text-sm font-semibold">{label}</div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Drag the reward on the canvas, then click Start or End to record that position.
        </p>
      </div>

      <div className="space-y-2">
        <Button
          variant={startSet ? "default" : "secondary"}
          className="w-full justify-start"
          onClick={() => onCapture("start")}
          disabled={previewing}
        >
          {startSet ? <Check className="mr-2 h-4 w-4" /> : <MapPin className="mr-2 h-4 w-4" />}
          Start Position
          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
            {startSet ? `${fmt(draft.startX)}, ${fmt(draft.startY)}` : "not set"}
          </span>
        </Button>
        <Button
          variant={endSet ? "default" : "secondary"}
          className="w-full justify-start"
          onClick={() => onCapture("end")}
          disabled={previewing}
        >
          {endSet ? <Check className="mr-2 h-4 w-4" /> : <Flag className="mr-2 h-4 w-4" />}
          End Position
          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
            {endSet ? `${fmt(draft.endX)}, ${fmt(draft.endY)}` : "not set"}
          </span>
        </Button>
      </div>

      <div className="space-y-3 border-t border-border/50 pt-3">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-xs">Size</Label>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {(draft.scale * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            value={[draft.scale]}
            min={0.04}
            max={0.6}
            step={0.01}
            onValueChange={(v) => onPatch({ scale: v[0] })}
            disabled={previewing}
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-xs">Rotation</Label>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {draft.rotation.toFixed(0)}°
            </span>
          </div>
          <Slider
            value={[draft.rotation]}
            min={-180}
            max={180}
            step={1}
            onValueChange={(v) => onPatch({ rotation: v[0] })}
            disabled={previewing}
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-xs">Opacity</Label>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {(draft.opacity * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            value={[draft.opacity]}
            min={0.1}
            max={1}
            step={0.05}
            onValueChange={(v) => onPatch({ opacity: v[0] })}
            disabled={previewing}
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-xs">Animate over</Label>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {seconds} seconds
            </span>
          </div>
          <Slider
            value={[seconds]}
            min={5}
            max={120}
            step={5}
            onValueChange={(v) => onPatch({ durationMs: v[0] * 1000 })}
            disabled={previewing}
          />
        </div>
      </div>

      <div className="space-y-2 border-t border-border/50 pt-3">
        <Button
          className="w-full"
          variant="secondary"
          onClick={onPreview}
          disabled={previewing || !startSet || !endSet}
        >
          <Play className="mr-2 h-4 w-4" /> {previewing ? "Previewing…" : "Preview"}
        </Button>
        <Button className="w-full" onClick={onSave} disabled={saving || previewing || !startSet || !endSet}>
          <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save"}
        </Button>
        <Button className="w-full" variant="ghost" onClick={onCancel} disabled={saving}>
          <X className="mr-2 h-4 w-4" /> Cancel
        </Button>
      </div>
    </div>
  );
};

export default RewardConfigPanel;
